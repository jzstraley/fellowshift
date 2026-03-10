// src/utils/scheduleSupabaseSync.js
//
// Utilities for syncing schedule data between app state and Supabase.
//
// Canonical scope after migration:
//   program_id + academic_year_id
//
// Legacy fallback scope (temporary):
//   institution_id
//
// Fellows are matched by name (fellow.name must match app schedule keys exactly).
// Block dates are matched by block_number (1–26).
// dayOverrides are NOT synced — no table exists for per-day overrides.

import { supabase } from '../lib/supabaseClient';

const BLOCKS = 26;
const WEEKENDS_PER_BLOCK = 2;

const parseEntry = (v) => {
  if (!v) return { name: null, relaxed: false };
  if (typeof v === 'string') return { name: v, relaxed: false };
  if (typeof v === 'object') return { name: v.name ?? v.call ?? null, relaxed: !!v.relaxed };
  return { name: null, relaxed: false };
};

async function getBlockDates({ programId, academicYearId }) {
  if (!supabase) throw new Error('Supabase not configured');
  const { data: blocks, error } = await supabase
    .from('block_dates')
    .select('id, block_number')
    .eq('program_id', programId)
    .eq('academic_year_id', academicYearId);
  if (error) throw new Error(error.message);
  return blocks ?? [];
}

export { getBlockDates as ensureBlockDatesInDb };

async function loadFellowsByScope({ programId, institutionId }) {
  const q = supabase.from('fellows').select('id, name').eq('is_active', true);
  const { data, error } = await (programId ? q.eq('program_id', programId) : q.eq('institution_id', institutionId));
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Call / Float sync
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Push callSchedule and nightFloatSchedule to Supabase call_float_assignments.
 *
 * New scope: (program_id, academic_year_id)
 * Legacy fallback: (institution_id)
 *
 * NOTE: Your call_float_assignments table must match the scope you use.
 * If your DB table still has only institution_id (legacy), pass institutionId and omit programId/academicYearId.
 */
export async function pushCallFloatToSupabase({
  callSchedule,
  nightFloatSchedule,
  programId,
  academicYearId,
  institutionId, // legacy fallback
  userId,
}) {
  if (!supabase) return { error: 'Supabase not configured' };

  const useNewScope = !!(programId && academicYearId);
  if (!useNewScope && !institutionId) return { error: 'No scope available (programId+academicYearId OR institutionId required)' };

  let dbFellows = [];
  try {
    dbFellows = await loadFellowsByScope({ programId: useNewScope ? programId : null, institutionId: useNewScope ? null : institutionId });
  } catch (e) {
    return { error: e.message };
  }

  if (!dbFellows.length) return { error: 'No fellows found in database.' };
  const nameToId = Object.fromEntries(dbFellows.map((f) => [f.name, f.id]));

  const rows = [];

  const addRows = (sched, type) => {
    for (let b = 1; b <= BLOCKS; b++) {
      for (let w = 1; w <= WEEKENDS_PER_BLOCK; w++) {
        const key = `B${b}-W${w}`;
        const { name, relaxed } = parseEntry(sched?.[key]);
        const fellowId = name ? (nameToId[name] ?? null) : null;

        rows.push({
          ...(useNewScope
            ? { program_id: programId, academic_year_id: academicYearId, institution_id: institutionId ?? null }
            : { institution_id: institutionId }),
          block_number: b,
          weekend: w,
          type, // 'call' | 'float'
          fellow_id: fellowId,
          relaxed,
          created_by: userId ?? null,
        });
      }
    }
  };

  addRows(callSchedule, 'call');
  addRows(nightFloatSchedule, 'float');

  const conflict = useNewScope
    ? 'program_id,academic_year_id,block_number,weekend,type'
    : 'institution_id,block_number,weekend,type';

  const { error: ue } = await supabase.from('call_float_assignments').upsert(rows, { onConflict: conflict });
  if (ue) return { error: ue.message };

  return { error: null, count: rows.length };
}

export async function pullCallFloatFromSupabase({
  programId,
  academicYearId,
  institutionId, // legacy fallback
}) {
  if (!supabase) return { error: 'Supabase not configured', callSchedule: null, nightFloatSchedule: null };

  const useNewScope = !!(programId && academicYearId);
  if (!useNewScope && !institutionId) return { error: 'No scope available', callSchedule: null, nightFloatSchedule: null };

  let dbFellows = [];
  try {
    dbFellows = await loadFellowsByScope({ programId: useNewScope ? programId : null, institutionId: useNewScope ? null : institutionId });
  } catch (e) {
    return { error: e.message, callSchedule: null, nightFloatSchedule: null };
  }

  const idToName = Object.fromEntries(dbFellows.map((f) => [f.id, f.name]));

  const q = supabase.from('call_float_assignments').select('block_number, weekend, type, fellow_id, relaxed');

  const { data: rows, error: re } = await (useNewScope
    ? q.eq('program_id', programId).eq('academic_year_id', academicYearId)
    : q.eq('institution_id', institutionId));

  if (re) return { error: re.message, callSchedule: null, nightFloatSchedule: null };
  if (!rows?.length) return { error: null, callSchedule: null, nightFloatSchedule: null };

  const callSchedule = {};
  const nightFloatSchedule = {};

  for (const { block_number, weekend, type, fellow_id, relaxed } of rows) {
    const key = `B${block_number}-W${weekend}`;
    const name = fellow_id ? (idToName[fellow_id] ?? null) : null;
    if (!name) continue;

    const entry = { name, relaxed: !!relaxed };
    if (type === 'call') callSchedule[key] = entry;
    if (type === 'float') nightFloatSchedule[key] = entry;
  }

  return {
    error: null,
    callSchedule: Object.keys(callSchedule).length ? callSchedule : null,
    nightFloatSchedule: Object.keys(nightFloatSchedule).length ? nightFloatSchedule : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Full schedule sync (schedule_assignments)
// ─────────────────────────────────────────────────────────────────────────────

export async function pushScheduleToSupabase({
  schedule,
  fellows,        // array of fellow names
  programId,      // REQUIRED uuid
  academicYearId, // REQUIRED uuid
  userId,
}) {
  if (!supabase) return { error: 'Supabase not configured' };
  if (!programId) return { error: 'No programId provided' };
  if (!academicYearId) return { error: 'No academicYearId provided' };
  if (!Array.isArray(fellows) || fellows.length === 0) return { error: 'No fellows provided' };

  // 0) Get block_dates mapping (block_number -> block_date_id)
  let dbBlocks = [];
  try {
    dbBlocks = await getBlockDates({ programId, academicYearId });
  } catch (e) {
    return { error: `Block date load failed: ${e.message}` };
  }
  if (!dbBlocks.length) return { error: 'No block dates found for this program/year.' };

  const numToId = Object.fromEntries(dbBlocks.map((b) => [Number(b.block_number), b.id]));

  // 1) Load fellows for this program
  let dbFellows = [];
  try {
    dbFellows = await loadFellowsByScope({ programId, institutionId: null });
  } catch (e) {
    return { error: e.message };
  }
  if (!dbFellows.length) return { error: 'No fellows found in database for this program.' };

  const nameToId = Object.fromEntries(dbFellows.map((f) => [f.name, f.id]));

  // 2) Build schedule_assignments
  const assignments = [];
  for (const name of fellows) {
    const trimmed = (name ?? '').trim();
    if (!trimmed) continue;

    const fellowId = nameToId[trimmed];
    if (!fellowId) continue;

    const rotations = Array.isArray(schedule?.[trimmed]) ? schedule[trimmed] : [];
    for (let idx = 0; idx < rotations.length; idx++) {
      const blockNum = idx + 1;
      const blockDateId = numToId[blockNum];
      if (!blockDateId) continue;

      assignments.push({
        fellow_id: fellowId,
        block_date_id: blockDateId,
        rotation: rotations[idx] ?? '',
        program_id: programId,
        academic_year_id: academicYearId,
        created_by: userId ?? null,
      });
    }
  }

  if (!assignments.length) {
    return { error: 'No assignments matched. Verify fellow names match DB and blocks exist.' };
  }

  // 4) Upsert schedule_assignments
  const { error: ue } = await supabase
    .from('schedule_assignments')
    .upsert(assignments, { onConflict: 'fellow_id,block_date_id' });

  if (ue) return { error: ue.message };

  return { error: null, count: assignments.length };
}

/**
 * Pull schedule_assignments and reconstruct app schedule format.
 *
 * Scope: program_id + academic_year_id
 * Returns { error, schedule } where schedule is null if DB has no assignments yet.
 */
export async function pullScheduleFromSupabase({
  fellows,        // array of fellow names (used to shape output)
  blockDates,     // local blockDates array (used to size arrays), length should be 26
  programId,
  academicYearId,
}) {
  if (!supabase) return { error: 'Supabase not configured', schedule: null };
  if (!programId) return { error: 'No programId provided', schedule: null };
  if (!academicYearId) return { error: 'No academicYearId provided', schedule: null };
  if (!Array.isArray(fellows) || fellows.length === 0) return { error: 'No fellows provided', schedule: null };

  // Read block dates — no upsert, safe for fellows
  let dbBlocks = [];
  try {
    dbBlocks = await getBlockDates({ programId, academicYearId });
  } catch (e) {
    return { error: `Block date load failed: ${e.message}`, schedule: null };
  }
  if (!dbBlocks.length) return { error: 'No block dates found for this program/year.', schedule: null };

  const blockIdToNum = Object.fromEntries(dbBlocks.map((b) => [b.id, Number(b.block_number)]));

  // Load fellows in this program
  let dbFellows = [];
  try {
    dbFellows = await loadFellowsByScope({ programId, institutionId: null });
  } catch (e) {
    return { error: e.message, schedule: null };
  }
  if (!dbFellows.length) return { error: 'No fellows found in database for this program.', schedule: null };

  const idToName = Object.fromEntries(dbFellows.map((f) => [f.id, f.name]));
  const fellowIds = dbFellows.map((f) => f.id);

  // Pull assignments for fellows in this program. We filter to blocks in this program/year via in(block_date_id,...)
  const blockIds = dbBlocks.map((b) => b.id);

  const { data: assignments, error: ae } = await supabase
    .from('schedule_assignments')
    .select('fellow_id, block_date_id, rotation')
    .in('fellow_id', fellowIds)
    .in('block_date_id', blockIds);

  if (ae) return { error: ae.message, schedule: null };
  if (!assignments?.length) return { error: null, schedule: null };

  const newSchedule = {};
  const nBlocks = Array.isArray(blockDates) && blockDates.length ? blockDates.length : BLOCKS;
  fellows.forEach((f) => { newSchedule[f] = Array(nBlocks).fill(''); });

  for (const { fellow_id, block_date_id, rotation } of assignments) {
    const name = idToName[fellow_id];
    const num = blockIdToNum[block_date_id];
    if (!name || !num) continue;
    if (!newSchedule[name]) continue;

    const idx = num - 1;
    if (idx >= 0 && idx < newSchedule[name].length) newSchedule[name][idx] = rotation ?? '';
  }

  return { error: null, schedule: newSchedule };
}

// ─────────────────────────────────────────────────────────────────────────────
// Vacations push
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Seed/upsert vacation_requests from the initialVacations array.
 * Requires a unique constraint: UNIQUE NULLS NOT DISTINCT (fellow_id, start_block_id, end_block_id, week_part)
 */
export async function pushVacationsToSupabase({
  vacations,       // array of { fellow, startBlock, endBlock, weekPart?, reason, status }
  programId,
  academicYearId,
  institutionId,
  programName,     // text — denormalized `program` column (NOT NULL in DB)
  userId,
}) {
  if (!supabase) return { error: 'Supabase not configured' };
  if (!programId || !academicYearId || !institutionId) return { error: 'Missing scope (programId, academicYearId, institutionId required)' };
  if (!Array.isArray(vacations) || !vacations.length) return { error: null, count: 0 };

  let dbBlocks = [];
  try {
    dbBlocks = await getBlockDates({ programId, academicYearId });
  } catch (e) {
    return { error: `Block date load failed: ${e.message}` };
  }
  if (!dbBlocks.length) return { error: 'No block dates found for this program/year.' };

  const numToId = Object.fromEntries(dbBlocks.map((b) => [Number(b.block_number), b.id]));

  let dbFellows = [];
  try {
    dbFellows = await loadFellowsByScope({ programId, institutionId: null });
  } catch (e) {
    return { error: e.message };
  }
  if (!dbFellows.length) return { error: 'No fellows found in database for this program.' };

  const nameToId = Object.fromEntries(dbFellows.map((f) => [f.name, f.id]));

  const rows = [];
  for (const v of vacations) {
    const fellowId = nameToId[(v.fellow ?? '').trim()];
    const startBlockId = numToId[Number(v.startBlock)];
    const endBlockId = numToId[Number(v.endBlock ?? v.startBlock)];
    if (!fellowId || !startBlockId || !endBlockId) continue;

    rows.push({
      fellow_id: fellowId,
      start_block_id: startBlockId,
      end_block_id: endBlockId,
      week_part: v.weekPart ?? null,
      reason: v.reason ?? 'Vacation',
      status: v.status ?? 'pending',
      program_id: programId,
      academic_year_id: academicYearId,
      institution_id: institutionId,
      program: programName ?? '',
      requested_by: userId,
    });
  }

  if (!rows.length) return { error: 'No vacations matched. Verify fellow names match DB and blocks exist.' };

  const { error: ue } = await supabase
    .from('vacation_requests')
    .upsert(rows, { onConflict: 'fellow_id,start_block_id,end_block_id,week_part' });

  if (ue) return { error: ue.message };
  return { error: null, count: rows.length };
}

// ─────────────────────────────────────────────────────────────────────────────
// Vacations / Swaps (read-only helpers)
// ─────────────────────────────────────────────────────────────────────────────

export async function pullVacationsFromSupabase({ programId, academicYearId }) {
  if (!supabase) return { error: "Supabase not configured", vacations: null };
  if (!programId) return { error: "No programId provided", vacations: null };

  // Query vacation_requests directly by program_id — same approach as useVacationState.
  // The previous 2-step (block_dates → start_block_id IN) silently returned nothing when
  // block_dates rows had a different academic_year_id than AuthContext provided, and the
  // short !column_name FK hints for double block_dates joins caused ambiguity in PostgREST.
  // Full FK constraint names are required when joining the same table twice.
  let q = supabase
    .from("vacation_requests")
    .select(`
      id,
      created_at,
      updated_at,
      reason,
      status,
      week_part,
      fellow_id,
      start_block_id,
      end_block_id,
      fellow:fellows!vacation_requests_fellow_id_fkey (id, name),
      start_block:block_dates!vacation_requests_start_block_id_fkey (id, block_number),
      end_block:block_dates!vacation_requests_end_block_id_fkey (id, block_number)
    `)
    .eq("program_id", programId)
    .order("created_at", { ascending: false });

  if (academicYearId) q = q.eq("academic_year_id", academicYearId);

  const { data, error } = await q;

  if (error) return { error: error.message, vacations: null };
  if (!data?.length) return { error: null, vacations: null };

  // normalize + keep identifiers so UI/state can reconcile approvals
  const vacations = data
    .filter((r) => r.id && r.fellow?.name && r.start_block?.block_number)
    .map((r) => ({
      id: r.id,
      created_at: r.created_at ?? null,
      updated_at: r.updated_at ?? null,

      // canonical IDs (important)
      fellow_id: r.fellow_id,
      start_block_id: r.start_block_id,
      end_block_id: r.end_block_id,

      // display fields
      fellow: r.fellow.name,
      startBlock: r.start_block.block_number,
      // fallback end to start if end_block is null (single-block vacations)
      endBlock: r.end_block?.block_number ?? r.start_block.block_number,
      weekPart: r.week_part ?? null,
      reason: r.reason || "Vacation",
      status: String(r.status || "pending").trim().toLowerCase(),
    }));

  return { error: null, vacations: vacations.length ? vacations : null };
}
export async function pullSwapRequestsFromSupabase({ programId, academicYearId }) {
  if (!supabase) return { error: 'Supabase not configured', swapRequests: null };
  if (!programId) return { error: 'No programId provided', swapRequests: null };
  // Do NOT filter by academic_year_id — swap rows created before the year scope
  // was resolved may have academic_year_id = NULL, and .eq() silently excludes NULLs.
  // program_id is the correct scope boundary.

  // Plain select, no JOINs. Two FKs to the same table require the full pg
  // constraint name for PostgREST disambiguation — skip the complexity.
  let q = supabase
    .from('swap_requests')
    .select('id, created_at, block_number, from_week_part, to_week_part, reason, status, requester_fellow_id, target_fellow_id')
    .eq('program_id', programId)
    .order('created_at', { ascending: false });
  void academicYearId; // intentionally unused — see comment above

  const { data, error } = await q;

  console.log('[pullSwapRequests] programId:', programId, 'rowCount:', data?.length, 'error:', error?.message);
  if (error) return { error: error.message, swapRequests: null };
  if (!data?.length) return { error: null, swapRequests: null };

  // Resolve fellow IDs → names. Omit is_active filter so deactivated fellows
  // whose requests are still pending don't silently drop the record.
  const { data: fellowsData } = await supabase
    .from('fellows')
    .select('id, name')
    .eq('program_id', programId);

  const idToName = Object.fromEntries((fellowsData ?? []).map((f) => [f.id, f.name]));

  const swapRequests = data
    .filter((r) => r.requester_fellow_id)
    .map((r) => ({
      id: r.id,
      created_at: r.created_at ?? null,
      fellow: idToName[r.requester_fellow_id] ?? null,
      requester: idToName[r.requester_fellow_id] ?? null,
      target: idToName[r.target_fellow_id] ?? null,
      target_fellow: idToName[r.target_fellow_id] ?? null,
      from_block: r.block_number ?? null,
      to_block: r.block_number ?? null,
      from_week_part: r.from_week_part ?? null,
      to_week_part: r.to_week_part ?? null,
      reason: r.reason || '',
      status: String(r.status || 'pending').trim().toLowerCase(),
    }));

  console.log('[pullSwapRequests] mapped swapRequests count:', swapRequests.length, 'sample status:', swapRequests[0]?.status);
  return { error: null, swapRequests: swapRequests.length ? swapRequests : null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Lectures / Speakers / Topics
// ─────────────────────────────────────────────────────────────────────────────

export async function pushLecturesToSupabase({ lectures, speakers, topics, institutionId, userId }) {
  if (!supabase) return { error: 'Supabase not configured' };
  if (!institutionId) return { error: 'No institution ID' };

  // Speakers — use new `speakers` table (uuid PK); skip if row already exists by id
  if (speakers?.length) {
    const speakerRows = speakers
      .filter((s) => s.id && !String(s.id).startsWith('sp')) // skip local placeholder ids
      .map((s) => ({
        id: s.id,
        institution_id: institutionId,
        name: s.name,
        title: s.title ?? null,
        email: s.email ?? null,
        type: s.type ?? 'attending',
      }));

    if (speakerRows.length) {
      const { error } = await supabase.from('speakers').upsert(speakerRows, { onConflict: 'id' });
      if (error) return { error: error.message };
    }
  }

  // Topics
  if (topics?.length) {
    const topicRows = topics
      .filter((t) => t.id && !String(t.id).startsWith('t')) // skip local placeholder ids
      .map((t) => ({
        id: t.id,
        institution_id: institutionId,
        name: t.name,
        series: t.series ?? null,
        duration: t.duration ?? null,
      }));

    if (topicRows.length) {
      const { error } = await supabase.from('lecture_topics').upsert(topicRows, { onConflict: 'id' });
      if (error) return { error: error.message };
    }
  }

  // Lectures — use actual column names: date, time, presenter_fellow_id (no rsvps column)
  if (lectures?.length) {
    const lectureRows = lectures
      .filter((l) => l.id && !String(l.id).startsWith('lec')) // skip local placeholder ids
      .map((l) => ({
        id: l.id,
        institution_id: institutionId,
        topic_id: l.topicId ?? null,
        title: l.title,
        speaker_id: l.speakerId ?? null,
        presenter_fellow_id: l.presenterFellowId ?? null,
        date: l.date ?? null,
        time: l.time ?? null,
        duration: l.duration ?? null,
        location: l.location ?? null,
        series: l.series ?? null,
        recurrence: l.recurrence ?? 'none',
        reminder_sent: l.reminderSent ?? false,
        notes: l.notes ?? null,
        created_by: userId ?? null,
      }));

    if (lectureRows.length) {
      const { error } = await supabase.from('lectures').upsert(lectureRows, { onConflict: 'id' });
      if (error) return { error: error.message };
    }
  }

  const count = (speakers?.length ?? 0) + (topics?.length ?? 0) + (lectures?.length ?? 0);
  return { error: null, count };
}

export async function pullLecturesFromSupabase({ institutionId }) {
  if (!supabase) return { error: 'Supabase not configured', lectures: null, speakers: null, topics: null };
  if (!institutionId) return { error: 'No institution ID', lectures: null, speakers: null, topics: null };

  const [speakerRes, topicRes, lectureRes] = await Promise.all([
    supabase.from('speakers').select('id, name, title, email, type').eq('institution_id', institutionId),
    supabase.from('lecture_topics').select('id, name, series, duration').eq('institution_id', institutionId),
    supabase
      .from('lectures')
      .select('id, topic_id, title, speaker_id, presenter_fellow_id, date, time, duration, location, series, recurrence, reminder_sent, notes')
      .eq('institution_id', institutionId)
      .order('date', { ascending: true }),
  ]);

  const error = speakerRes.error?.message || topicRes.error?.message || lectureRes.error?.message || null;
  if (error) return { error, lectures: null, speakers: null, topics: null };

  const speakers = speakerRes.data?.length ? speakerRes.data : null;
  const topics = topicRes.data?.length ? topicRes.data : null;

  const lectures = lectureRes.data?.length
    ? lectureRes.data.map((l) => ({
        id: l.id,
        topicId: l.topic_id,
        title: l.title,
        speakerId: l.speaker_id,
        presenterFellowId: l.presenter_fellow_id,
        presenterFellow: null, // resolved name populated by useLectureState join
        date: l.date,
        time: l.time,
        duration: l.duration,
        location: l.location,
        series: l.series,
        recurrence: l.recurrence ?? 'none',
        reminderSent: l.reminder_sent ?? false,
        notes: l.notes,
        rsvps: {},
      }))
    : null;

  return { error: null, lectures, speakers, topics };
}

// ─────────────────────────────────────────────────────────────────────────────
// Clinic Days
// ─────────────────────────────────────────────────────────────────────────────

export async function pushClinicDaysToSupabase({ clinicDays, programId }) {
  if (!supabase) return { error: 'Supabase not configured' };
  if (!programId) return { error: 'No programId provided' };

  const { data: dbFellows, error: fe } = await supabase
    .from('fellows')
    .select('id, name')
    .eq('program_id', programId)
    .eq('is_active', true);

  if (fe) return { error: fe.message };
  if (!dbFellows?.length) return { error: 'No fellows found in database.' };

  const updates = dbFellows
    .filter((f) => clinicDays[f.name] !== undefined)
    .map((f) => supabase.from('fellows').update({ clinic_day: clinicDays[f.name] }).eq('id', f.id));

  const results = await Promise.all(updates);
  const err = results.find((r) => r.error)?.error?.message ?? null;

  return { error: err, count: results.length };
}

export async function pullClinicDaysFromSupabase({ programId }) {
  if (!supabase) return { error: 'Supabase not configured', clinicDays: null };
  if (!programId) return { error: 'No programId provided', clinicDays: null };

  const { data, error } = await supabase
    .from('fellows')
    .select('name, clinic_day')
    .eq('program_id', programId)
    .eq('is_active', true)
    .not('clinic_day', 'is', null);

  if (error) return { error: error.message, clinicDays: null };
  if (!data?.length) return { error: null, clinicDays: null };

  const clinicDays = Object.fromEntries(data.map((f) => [f.name, f.clinic_day]));
  return { error: null, clinicDays };
}