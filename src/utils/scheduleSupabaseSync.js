// Utilities for syncing schedule data between app state and Supabase.
// Fellows are matched by name (fellow.name must match app schedule keys exactly).
// Block dates are matched by block_number (1-26).
// dayOverrides are NOT synced — no table exists for per-day overrides.

import { supabase } from '../lib/supabaseClient';

/**
 * Push the full schedule to Supabase schedule_assignments.
 * Upserts one row per (fellow, block). Empty rotations are stored as ''.
 */
export async function pushScheduleToSupabase({ schedule, fellows, blockDates, institutionId, userId }) {
  if (!supabase) return { error: 'Supabase not configured' };
  if (!institutionId) return { error: 'No institution ID available' };

  const { data: dbFellows, error: fe } = await supabase
    .from('fellows')
    .select('id, name')
    .eq('institution_id', institutionId)
    .eq('is_active', true);
  if (fe) return { error: fe.message };
  if (!dbFellows?.length) return { error: 'No fellows found in database. Populate the fellows table first.' };

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
