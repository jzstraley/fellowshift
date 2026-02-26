// Utilities for syncing schedule data between app state and Supabase.
// Fellows are matched by name (fellow.name must match app schedule keys exactly).
// Block dates are matched by block_number (1-26).
// dayOverrides are NOT synced — no table exists for per-day overrides.
//
// Required table for call/float sync (run once in Supabase SQL editor):
//
// create table call_float_assignments (
//   id uuid primary key default gen_random_uuid(),
//   institution_id uuid not null references institutions(id) on delete cascade,
//   block_number smallint not null,
//   weekend smallint not null,
//   type text not null,
//   fellow_id uuid references fellows(id) on delete set null,
//   relaxed boolean not null default false,
//   created_by uuid references auth.users(id),
//   created_at timestamptz default now(),
//   unique (institution_id, block_number, weekend, type)
// );
// alter table call_float_assignments enable row level security;
// create policy "Institution members can read" on call_float_assignments
//   for select using (institution_id in (
//     select institution_id from profiles where id = auth.uid()
//   ));
// create policy "Approvers can write" on call_float_assignments
//   for all using (institution_id in (
//     select institution_id from profiles where id = auth.uid()
//       and role in ('admin','program_director','chief_fellow')
//   ));

import { supabase } from '../lib/supabaseClient';

// ─── SQL for new tables — run once in Supabase SQL editor ────────────────────
//
// -- Lecture speakers
// create table lecture_speakers (
//   id text primary key,
//   institution_id uuid not null references institutions(id) on delete cascade,
//   name text not null,
//   title text,
//   email text,
//   type text default 'attending',
//   created_at timestamptz default now()
// );
// alter table lecture_speakers enable row level security;
// create policy "Institution members can read" on lecture_speakers
//   for select using (institution_id in (select institution_id from profiles where id = auth.uid()));
// create policy "Approvers can write" on lecture_speakers
//   for all using (institution_id in (
//     select institution_id from profiles where id = auth.uid()
//       and role in ('admin','program_director','chief_fellow')
//   ));
//
// -- Lecture topics
// create table lecture_topics (
//   id text primary key,
//   institution_id uuid not null references institutions(id) on delete cascade,
//   name text not null,
//   series text,
//   duration integer,
//   created_at timestamptz default now()
// );
// alter table lecture_topics enable row level security;
// create policy "Institution members can read" on lecture_topics
//   for select using (institution_id in (select institution_id from profiles where id = auth.uid()));
// create policy "Approvers can write" on lecture_topics
//   for all using (institution_id in (
//     select institution_id from profiles where id = auth.uid()
//       and role in ('admin','program_director','chief_fellow')
//   ));
//
// -- Lectures
// create table lectures (
//   id text primary key,
//   institution_id uuid not null references institutions(id) on delete cascade,
//   topic_id text references lecture_topics(id) on delete set null,
//   title text not null,
//   speaker_id text references lecture_speakers(id) on delete set null,
//   presenter_fellow text,
//   lecture_date date,
//   lecture_time text,
//   duration integer,
//   location text,
//   series text,
//   recurrence text default 'none',
//   reminder_sent boolean default false,
//   notes text,
//   rsvps jsonb default '{}',
//   created_by uuid references auth.users(id),
//   created_at timestamptz default now()
// );
// alter table lectures enable row level security;
// create policy "Institution members can read" on lectures
//   for select using (institution_id in (select institution_id from profiles where id = auth.uid()));
// create policy "Approvers can write" on lectures
//   for all using (institution_id in (
//     select institution_id from profiles where id = auth.uid()
//       and role in ('admin','program_director','chief_fellow')
//   ));
//
// -- Clinic day per fellow (add column to existing fellows table)
// alter table fellows add column if not exists clinic_day integer;
//   -- 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday
//
// ─────────────────────────────────────────────────────────────────────────────

// Parse a callSchedule/nightFloatSchedule value to { name, relaxed }
const parseEntry = (v) => {
  if (!v) return { name: null, relaxed: false };
  if (typeof v === 'string') return { name: v, relaxed: false };
  if (typeof v === 'object') return { name: v.name ?? v.call ?? null, relaxed: !!v.relaxed };
  return { name: null, relaxed: false };
};

/**
 * Push callSchedule and nightFloatSchedule to Supabase call_float_assignments.
 * Upserts one row per (institution, block, weekend, type).
 */
export async function pushCallFloatToSupabase({ callSchedule, nightFloatSchedule, institutionId, userId }) {
  if (!supabase) return { error: 'Supabase not configured' };
  if (!institutionId) return { error: 'No institution ID available' };

  const { data: dbFellows, error: fe } = await supabase
    .from('fellows')
    .select('id, name')
    .eq('institution_id', institutionId)
    .eq('is_active', true);
  if (fe) return { error: fe.message };
  if (!dbFellows?.length) return { error: 'No fellows found in database.' };

  const nameToId = Object.fromEntries(dbFellows.map(f => [f.name, f.id]));

  const rows = [];
  const addRows = (sched, type) => {
    for (let b = 1; b <= 26; b++) {
      for (let w = 1; w <= 2; w++) {
        const key = `B${b}-W${w}`;
        const { name, relaxed } = parseEntry(sched?.[key]);
        const fellowId = name ? (nameToId[name] ?? null) : null;
        rows.push({
          institution_id: institutionId,
          block_number: b,
          weekend: w,
          type,
          fellow_id: fellowId,
          relaxed,
          created_by: userId ?? null,
        });
      }
    }
  };

  addRows(callSchedule, 'call');
  addRows(nightFloatSchedule, 'float');

  const { error: ue } = await supabase
    .from('call_float_assignments')
    .upsert(rows, { onConflict: 'institution_id,block_number,weekend,type' });
  if (ue) return { error: ue.message };

  return { error: null, count: rows.length };
}

/**
 * Pull call_float_assignments from Supabase and reconstruct callSchedule / nightFloatSchedule.
 * Returns { error, callSchedule, nightFloatSchedule } — both null if nothing found.
 */
export async function pullCallFloatFromSupabase({ institutionId }) {
  if (!supabase) return { error: 'Supabase not configured', callSchedule: null, nightFloatSchedule: null };
  if (!institutionId) return { error: 'No institution ID available', callSchedule: null, nightFloatSchedule: null };

  const { data: dbFellows, error: fe } = await supabase
    .from('fellows')
    .select('id, name')
    .eq('institution_id', institutionId)
    .eq('is_active', true);
  if (fe) return { error: fe.message, callSchedule: null, nightFloatSchedule: null };

  const idToName = Object.fromEntries((dbFellows ?? []).map(f => [f.id, f.name]));

  const { data: rows, error: re } = await supabase
    .from('call_float_assignments')
    .select('block_number, weekend, type, fellow_id, relaxed')
    .eq('institution_id', institutionId);
  if (re) return { error: re.message, callSchedule: null, nightFloatSchedule: null };
  if (!rows?.length) return { error: null, callSchedule: null, nightFloatSchedule: null };

  const callSchedule = {};
  const nightFloatSchedule = {};

  for (const { block_number, weekend, type, fellow_id, relaxed } of rows) {
    const key = `B${block_number}-W${weekend}`;
    const name = fellow_id ? (idToName[fellow_id] ?? null) : null;
    if (!name) continue; // skip unfilled slots
    const entry = { name, relaxed: !!relaxed };
    if (type === 'call') callSchedule[key] = entry;
    else if (type === 'float') nightFloatSchedule[key] = entry;
  }

  const hasCalls = Object.keys(callSchedule).length > 0;
  const hasFloats = Object.keys(nightFloatSchedule).length > 0;

  return {
    error: null,
    callSchedule: hasCalls ? callSchedule : null,
    nightFloatSchedule: hasFloats ? nightFloatSchedule : null,
  };
}

/**
 * Push the full schedule to Supabase schedule_assignments.
 * Upserts one row per (fellow, block). Empty rotations are stored as ''.
 * If the fellows table is empty, auto-seeds from the passed fellows list.
 */
export async function pushScheduleToSupabase({ schedule, fellows, institutionId, userId, pgyLevels = {} }) {
  if (!supabase) return { error: 'Supabase not configured' };
  if (!institutionId) return { error: 'No institution ID available' };

  let { data: dbFellows, error: fe } = await supabase
    .from('fellows')
    .select('id, name')
    .eq('institution_id', institutionId)
    .eq('is_active', true);
  if (fe) return { error: fe.message };

  if (!dbFellows?.length) {
    // Auto-seed fellows from the local schedule data
    const toInsert = fellows.map(name => ({
      name,
      institution_id: institutionId,
      is_active: true,
      // The DB schema requires a non-null `program` column. Use empty string
      // as a safe default when auto-seeding from local data.
      program: '',
      pgy_level: pgyLevels[name] ?? 1,
    }));
    const { data: seeded, error: seedErr } = await supabase
      .from('fellows')
      .insert(toInsert)
      .select('id, name');
    if (seedErr) return { error: `Fellows table is empty. Auto-seed failed: ${seedErr.message}` };
    if (!seeded?.length) return { error: 'Fellows table is empty and auto-seed returned no rows.' };
    dbFellows = seeded;
  }

  const { data: dbBlocks, error: be } = await supabase
    .from('block_dates')
    .select('id, block_number')
    .eq('institution_id', institutionId);
  if (be) return { error: be.message };
  if (!dbBlocks?.length) return { error: 'No block dates found in database. Populate the block_dates table first.' };

  const nameToId = Object.fromEntries(dbFellows.map(f => [f.name, f.id]));
  const numToId = Object.fromEntries(dbBlocks.map(b => [b.block_number, b.id]));

  const assignments = [];
  for (const name of fellows) {
    const fellowId = nameToId[name];
    if (!fellowId) continue;
    (schedule[name] || []).forEach((rotation, idx) => {
      const blockDateId = numToId[idx + 1];
      if (!blockDateId) return;
      assignments.push({
        fellow_id: fellowId,
        block_date_id: blockDateId,
        rotation: rotation || '',
        created_by: userId || null,
      });
    });
  }

  if (!assignments.length) {
    return { error: 'No assignments could be matched. Verify fellow names match the database.' };
  }

  const { error: ue } = await supabase
    .from('schedule_assignments')
    .upsert(assignments, { onConflict: 'fellow_id,block_date_id' });
  if (ue) return { error: ue.message };

  return { error: null, count: assignments.length };
}

/**
 * Pull schedule_assignments from Supabase and convert to app format.
 * Returns { error, schedule } where schedule is null if nothing was found
 * (caller should keep existing state in that case).
 */
export async function pullScheduleFromSupabase({ fellows, blockDates, institutionId }) {
  if (!supabase) return { error: 'Supabase not configured', schedule: null };
  if (!institutionId) return { error: 'No institution ID available', schedule: null };

  const { data: dbFellows, error: fe } = await supabase
    .from('fellows')
    .select('id, name')
    .eq('institution_id', institutionId)
    .eq('is_active', true);
  if (fe) return { error: fe.message, schedule: null };
  if (!dbFellows?.length) return { error: 'No fellows found in database.', schedule: null };

  const { data: dbBlocks, error: be } = await supabase
    .from('block_dates')
    .select('id, block_number')
    .eq('institution_id', institutionId);
  if (be) return { error: be.message, schedule: null };
  if (!dbBlocks?.length) return { error: 'No block dates found in database.', schedule: null };

  const idToName = Object.fromEntries(dbFellows.map(f => [f.id, f.name]));
  const idToNum = Object.fromEntries(dbBlocks.map(b => [b.id, b.block_number]));
  const fellowIds = dbFellows.map(f => f.id);

  const { data: assignments, error: ae } = await supabase
    .from('schedule_assignments')
    .select('fellow_id, block_date_id, rotation')
    .in('fellow_id', fellowIds);
  if (ae) return { error: ae.message, schedule: null };

  // Return null schedule (not an error) if DB has no assignments yet
  if (!assignments?.length) return { error: null, schedule: null };

  const newSchedule = {};
  fellows.forEach(f => { newSchedule[f] = Array(blockDates.length).fill(''); });

  assignments.forEach(({ fellow_id, block_date_id, rotation }) => {
    const name = idToName[fellow_id];
    const num = idToNum[block_date_id];
    if (name && num && newSchedule[name]) {
      newSchedule[name][num - 1] = rotation || '';
    }
  });

  return { error: null, schedule: newSchedule };
}

// ─── Vacations ────────────────────────────────────────────────────────────────

/**
 * Pull vacation_requests from Supabase and convert to local app format.
 * Local format: [{ fellow, startBlock, endBlock, reason, status }]
 * Does NOT push — VacationsView handles writes to vacation_requests directly.
 */
export async function pullVacationsFromSupabase({ institutionId }) {
  if (!supabase) return { error: 'Supabase not configured', vacations: null };
  if (!institutionId) return { error: 'No institution ID', vacations: null };

  const { data, error } = await supabase
    .from('vacation_requests')
    .select(`
      reason,
      status,
      fellow:fellows!fellow_id (name),
      start_block:block_dates!start_block_id (block_number),
      end_block:block_dates!end_block_id (block_number)
    `)
    .order('created_at', { ascending: false });

  if (error) return { error: error.message, vacations: null };
  if (!data?.length) return { error: null, vacations: null };

  const vacations = data
    .filter(r => r.fellow?.name && r.start_block?.block_number && r.end_block?.block_number)
    .map(r => ({
      fellow: r.fellow.name,
      startBlock: r.start_block.block_number,
      endBlock: r.end_block.block_number,
      reason: r.reason || 'Vacation',
      status: r.status || 'pending',
    }));

  return { error: null, vacations: vacations.length ? vacations : null };
}

/**
 * Pull swap_requests from Supabase and convert to local app format.
 * Local format: [{ fellow, from_block, to_block, target_fellow, reason, status }]
 */
export async function pullSwapRequestsFromSupabase({ institutionId }) {
  if (!supabase) return { error: 'Supabase not configured', swapRequests: null };
  if (!institutionId) return { error: 'No institution ID', swapRequests: null };

  const { data, error } = await supabase
    .from('swap_requests')
    .select(`
      block_number,
      reason,
      status,
      requester:fellows!requester_fellow_id (name),
      target:fellows!target_fellow_id (name)
    `)
    .order('created_at', { ascending: false });

  if (error) return { error: error.message, swapRequests: null };
  if (!data?.length) return { error: null, swapRequests: null };

  const swapRequests = data
    .filter(r => r.requester?.name)
    .map(r => ({
      fellow: r.requester.name,
      from_block: r.block_number,
      to_block: r.block_number,
      target_fellow: r.target?.name ?? null,
      reason: r.reason || '',
      status: r.status || 'pending',
    }));

  return { error: null, swapRequests: swapRequests.length ? swapRequests : null };
}

// ─── Lectures / Speakers / Topics ────────────────────────────────────────────

/**
 * Push lectures, speakers, and topics to Supabase.
 * Upserts all three tables. Speaker/topic IDs are the app-generated text IDs.
 */
export async function pushLecturesToSupabase({ lectures, speakers, topics, institutionId, userId }) {
  if (!supabase) return { error: 'Supabase not configured' };
  if (!institutionId) return { error: 'No institution ID' };

  // Upsert speakers
  if (speakers?.length) {
    const speakerRows = speakers.map(s => ({
      id: s.id,
      institution_id: institutionId,
      name: s.name,
      title: s.title ?? null,
      email: s.email ?? null,
      type: s.type ?? 'attending',
    }));
    const { error } = await supabase
      .from('speakers')
      .upsert(speakerRows, { onConflict: 'id' });
    if (error) return { error: error.message };
  }

  // Upsert topics
  if (topics?.length) {
    const topicRows = topics.map(t => ({
      id: t.id,
      institution_id: institutionId,
      name: t.name,
      series: t.series ?? null,
      duration: t.duration ?? null,
    }));
    const { error } = await supabase
      .from('lecture_topics')
      .upsert(topicRows, { onConflict: 'id' });
    if (error) return { error: error.message };
  }

  // Upsert lectures
  if (lectures?.length) {
    const lectureRows = lectures.map(l => ({
      id: l.id,
      institution_id: institutionId,
      program: l.program ?? 'general',
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
    const { error } = await supabase
      .from('lectures')
      .upsert(lectureRows, { onConflict: 'id' });
    if (error) return { error: error.message };
  }

  const count = (speakers?.length ?? 0) + (topics?.length ?? 0) + (lectures?.length ?? 0);
  return { error: null, count };
}

/**
 * Pull lectures, speakers, and topics from Supabase.
 * Returns { error, lectures, speakers, topics } — all null if nothing found.
 */
export async function pullLecturesFromSupabase({ institutionId }) {
  if (!supabase) return { error: 'Supabase not configured', lectures: null, speakers: null, topics: null };
  if (!institutionId) return { error: 'No institution ID', lectures: null, speakers: null, topics: null };

  const [speakerRes, topicRes, lectureRes] = await Promise.all([
    supabase.from('speakers').select('id, name, title, email, type').eq('institution_id', institutionId),
    supabase.from('lecture_topics').select('id, name, series, duration').eq('institution_id', institutionId),
    supabase.from('lectures').select('id, program, topic_id, title, speaker_id, presenter_fellow_id, date, time, duration, location, series, recurrence, reminder_sent, notes').eq('institution_id', institutionId),
  ]);

  const error = speakerRes.error?.message || topicRes.error?.message || lectureRes.error?.message || null;
  if (error) return { error, lectures: null, speakers: null, topics: null };

  const speakers = speakerRes.data?.length ? speakerRes.data : null;
  const topics = topicRes.data?.length
    ? topicRes.data.map(t => ({ id: t.id, name: t.name, series: t.series, duration: t.duration }))
    : null;
  const lectures = lectureRes.data?.length
    ? lectureRes.data.map(l => ({
        id: l.id,
        program: l.program,
        topicId: l.topic_id,
        title: l.title,
        speakerId: l.speaker_id,
        presenterFellowId: l.presenter_fellow_id,
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

// ─── Clinic Days ──────────────────────────────────────────────────────────────

/**
 * Push clinic day assignments to Supabase (updates fellows.clinic_day).
 * clinicDays: { [fellowName]: dayNumber } where 1=Mon … 4=Thu
 */
export async function pushClinicDaysToSupabase({ clinicDays, institutionId }) {
  if (!supabase) return { error: 'Supabase not configured' };
  if (!institutionId) return { error: 'No institution ID' };

  const { data: dbFellows, error: fe } = await supabase
    .from('fellows')
    .select('id, name')
    .eq('institution_id', institutionId)
    .eq('is_active', true);
  if (fe) return { error: fe.message };
  if (!dbFellows?.length) return { error: 'No fellows found in database.' };

  const updates = dbFellows
    .filter(f => clinicDays[f.name] !== undefined)
    .map(f => supabase.from('fellows').update({ clinic_day: clinicDays[f.name] }).eq('id', f.id));

  const results = await Promise.all(updates);
  const err = results.find(r => r.error)?.error?.message ?? null;
  return { error: err, count: results.length };
}

/**
 * Pull clinic_day from fellows table and return as { [name]: dayNumber }.
 */
export async function pullClinicDaysFromSupabase({ institutionId }) {
  if (!supabase) return { error: 'Supabase not configured', clinicDays: null };
  if (!institutionId) return { error: 'No institution ID', clinicDays: null };

  const { data, error } = await supabase
    .from('fellows')
    .select('name, clinic_day')
    .eq('institution_id', institutionId)
    .eq('is_active', true)
    .not('clinic_day', 'is', null);

  if (error) return { error: error.message, clinicDays: null };
  if (!data?.length) return { error: null, clinicDays: null };

  const clinicDays = Object.fromEntries(data.map(f => [f.name, f.clinic_day]));
  return { error: null, clinicDays };
}
