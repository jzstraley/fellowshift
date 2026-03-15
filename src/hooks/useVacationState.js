// useVacationState.js
// One hook. One contract. Matches your existing UI props.
// Uses deterministic FK joins for vacation_requests (your actual constraint names).
// Uses map-enrichment for swap_requests to avoid FK-name brittleness.

import { useEffect, useMemo, useCallback, useState, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { blockDates as localBlockDates, allRotationTypes } from '../data/scheduleData';
import { DAY_NAMES, DAY_OFF_REASONS, SWAP_RESET, getNameFromAssignment, formatPretty, getWeekWindowWithinBlock, parseSwapReason } from '../utils/vacationHelpers';
import { pullCallFloatFromSupabase } from '../utils/scheduleSupabaseSync';

const asArray = (v) => (Array.isArray(v) ? v : []);
const safeStr = (v) => (typeof v === 'string' ? v : '');
const isUuidish = (v) => typeof v === 'string' && v.length >= 24; // good enough for supabase ids
const toISODate = (d) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const DAY_OFF_SET = new Set([
  'Sick Day',
  'Personal Day',
  'Conference',
  'CME',
  'Board Exam',
  'FLEX Day',
  ...(asArray(DAY_OFF_REASONS) || []),
]);

const normalizeStatus = (v) => {
  const s = safeStr(v).toLowerCase();
  if (!s) return 'pending';
  if (s === 'approved') return 'approved';
  if (s === 'pending') return 'pending';
  if (s === 'pending_peer') return 'pending_peer';
  if (s === 'denied' || s === 'rejected') return 'denied';
  if (s === 'cancelled' || s === 'canceled') return 'cancelled';
  return s;
};

export function useVacationState({
  useDatabase = true,
  programId,
  academicYearId,

  // these are used for visibility and inserts/approvals
  profile,
  user,
  userCanApprove = false,
  userCanRequest = true,

  // optional schedule context (used by getRequestExtras; safe if omitted)
  fellows = [],
  schedule = {},
  setSchedule = null,
  vacations = [],
  setVacations,
  setSwapRequests,
  callSchedule = {},
  nightFloatSchedule = {},
  setCallSchedule = null,
  setNightFloatSchedule = null,
  clinicDays = {},
  pgyLevels = {},
}) {
  const pid = safeStr(programId);
  const yid = safeStr(academicYearId);
  const uid = safeStr(user?.id);
  const institutionId = safeStr(profile?.institution_id || profile?.institutionId);

  // ---- state ----
  const [loadingDb, setLoadingDb] = useState(!!useDatabase);
  const [dbError, setDbError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const hasLoadedOnce = useRef(false);

  const [dbFellows, setDbFellows] = useState([]);
  const [blockDates, setBlockDates] = useState([]);
  const [dbRequests, setDbRequests] = useState([]); // vacation_requests rows (includes day-offs)
  const [dbSwapRequests, setDbSwapRequests] = useState([]); // swap_requests rows, enriched

  // inline deny UI
  const [denyingId, setDenyingId] = useState(null);
  const [denyReason, setDenyReason] = useState('');

  // ---- forms (your UI expects these exact names) ----
  const [newDbReq, setNewDbReq] = useState({ fellow_id: '', start_block_id: '', reason: 'Vacation' });
  const [newDayOff, setNewDayOff] = useState({ fellow_id: '', date: '', reason_type: 'Sick Day' });
  const [newDbSwap, setNewDbSwap] = useState(SWAP_RESET);
  const [newDbSwapError, setNewDbSwapError] = useState(null);

  // ---- local weeks for UI selects (always arrays) ----
  const weeklyBlocks = useMemo(() => {
    const weeks = [];
    const today = new Date();
    const day = today.getDay();
    const daysUntilMonday = day === 1 ? 0 : (8 - day) % 7;
    const firstMonday = new Date(today);
    firstMonday.setDate(today.getDate() + daysUntilMonday);

    const fmtDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    for (let i = 0; i < 26; i++) {
      const start = new Date(firstMonday);
      start.setDate(firstMonday.getDate() + i * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      const blockKey = `${i + 1}-1`;
      weeks.push({
        block: blockKey,
        start: toISODate(start),
        end: toISODate(end),
        part: 1,
        parentBlock: i + 1,
        id: blockKey,
        label: `Wk ${i + 1}: ${fmtDate(start)} – ${fmtDate(end)}`,
      });
    }
    return weeks;
  }, []);

  const splitLocalWeeks = useMemo(() => {
    if (!Array.isArray(localBlockDates) || !localBlockDates.length) return [];
    const weeks = [];
    localBlockDates.forEach((b) => {
      const start = new Date(`${b.start}T00:00:00`);
      const firstStart = new Date(start);
      const firstEnd = new Date(firstStart);
      firstEnd.setDate(firstStart.getDate() + 6);

      const secondStart = new Date(firstStart);
      secondStart.setDate(firstStart.getDate() + 7);
      const secondEnd = new Date(secondStart);
      secondEnd.setDate(secondStart.getDate() + 6);

      weeks.push({
        block: `${b.block}-1`,
        parentBlock: b.block,
        part: 1,
        start: toISODate(firstStart),
        end: toISODate(firstEnd),
        rotation: b.rotation ?? 0,
      });
      weeks.push({
        block: `${b.block}-2`,
        parentBlock: b.block,
        part: 2,
        start: toISODate(secondStart),
        end: toISODate(secondEnd),
        rotation: b.rotation ?? 0,
      });
    });
    return weeks;
  }, []);

  // ---- fetch ----
  const fetchRequests = useCallback(async () => {
    if (!useDatabase) {
      setLoadingDb(false);
      setDbError(null);
      return;
    }

    if (!pid) {
      setDbFellows([]);
      setBlockDates([]);
      setDbRequests([]);
      setDbSwapRequests([]);
      setLoadingDb(false);
      if (!userCanApprove) {
        setDbError('No program scope found. Make sure your account has a program membership.');
      }
      return;
    }

    if (!hasLoadedOnce.current) setLoadingDb(true);
    setDbError(null);

    try {
      // Fellows
      // Your fellows schema matches these columns.
      let fellowsQ = supabase
        .from('fellows')
        .select('id, institution_id, program_id, program, name, pgy_level, clinic_day, email, user_id, is_active')
        .eq('program_id', pid)
        .eq('is_active', true)
        .order('name', { ascending: true });

      // Optional institution scope if your UI wants it, not required by your RLS.
      // if (institutionId) fellowsQ = fellowsQ.eq('institution_id', institutionId);

      const fellowsRes = await fellowsQ;
      if (fellowsRes.error) throw fellowsRes.error;

      const fellowsData = asArray(fellowsRes.data);
      setDbFellows(fellowsData);

      const fellowById = new Map(fellowsData.map((f) => [f.id, f]));

      // Block dates
      let blocksQ = supabase
        .from('block_dates')
        .select('id, institution_id, program_id, program, academic_year_id, academic_year, block_number, rotation_number, start_date, end_date')
        .eq('program_id', pid)
        .order('block_number', { ascending: true });

      if (yid) blocksQ = blocksQ.eq('academic_year_id', yid);
      // if (institutionId) blocksQ = blocksQ.eq('institution_id', institutionId);

      const blocksRes = await blocksQ;
      if (blocksRes.error) throw blocksRes.error;

      const blocksData = asArray(blocksRes.data);
      setBlockDates(blocksData);

      const blockById = new Map(blocksData.map((b) => [b.id, b]));

      // Vacation requests, deterministic joins using your actual FK constraint names
      let vacQ = supabase
        .from('vacation_requests')
        .select(`
          id,
          reason,
          status,
          notes,
          week_part,
          created_at,
          updated_at,
          approved_at,
          requested_by,
          approved_by,
          program_id,
          academic_year_id,
          institution_id,

          fellow_id,
          fellow:fellows!vacation_requests_fellow_id_fkey (
            id, name, pgy_level, user_id, program_id, institution_id, is_active, email, clinic_day
          ),

          start_block_id,
          start_block:block_dates!vacation_requests_start_block_id_fkey (
            id, block_number, rotation_number, start_date, end_date, academic_year_id, program_id, institution_id
          ),

          end_block_id,
          end_block:block_dates!vacation_requests_end_block_id_fkey (
            id, block_number, rotation_number, start_date, end_date, academic_year_id, program_id, institution_id
          ),

          requested_by_profile:profiles!vacation_requests_requested_by_fkey (
            id, full_name, email, username
          ),

          approved_by_profile:profiles!vacation_requests_approved_by_fkey (
            id, full_name, email, username
          )
        `)
        .eq('program_id', pid)
        .order('created_at', { ascending: false });

      if (yid) vacQ = vacQ.eq('academic_year_id', yid);
      // if (institutionId) vacQ = vacQ.eq('institution_id', institutionId);

      const vacRes = await vacQ;
      if (vacRes.error) throw vacRes.error;

      const vacData = asArray(vacRes.data).map((r) => ({
        ...r,
        status: normalizeStatus(r.status),
      }));

      setDbRequests(vacData);

      // Sync back to App.jsx's vacations state so the Dashboard count stays current.
      if (typeof setVacations === 'function') {
        setVacations(vacData.map((r) => ({
          id: r.id,
          created_at: r.created_at ?? null,
          updated_at: r.updated_at ?? null,
          fellow_id: r.fellow_id,
          start_block_id: r.start_block_id,
          end_block_id: r.end_block_id,
          fellow: r.fellow?.name || '',
          startBlock: r.start_block?.block_number ?? null,
          endBlock: r.end_block?.block_number ?? null,
          weekPart: r.week_part ?? null,
          reason: r.reason || 'Vacation',
          status: r.status,
        })));
      }

      // Swap requests, base rows then enrich via maps, no FK-name guessing
      let swapQ = supabase
        .from('swap_requests')
        .select(`
          id,
          requester_fellow_id,
          target_fellow_id,
          block_number,
          block_date_id,
          from_week_part,
          to_week_part,
          reason,
          status,
          notes,
          created_at,
          updated_at,
          approved_at,
          requested_by,
          approved_by,
          program_id,
          academic_year_id
        `)
        .eq('program_id', pid)
        .order('created_at', { ascending: false });

      if (yid) swapQ = swapQ.eq('academic_year_id', yid);

      const swapRes = await swapQ;

      if (swapRes.error) {
        console.warn('swap_requests load failed:', swapRes.error);
        setDbSwapRequests([]);
      } else {
        const swapRows = asArray(swapRes.data).map((r) => ({
          ...r,
          status: normalizeStatus(r.status),
          requester: fellowById.get(r.requester_fellow_id) || null,
          target: fellowById.get(r.target_fellow_id) || null,
          block_date: (r.block_date_id && blockById.get(r.block_date_id)) ? blockById.get(r.block_date_id) : null,
        }));
        setDbSwapRequests(swapRows);
        // Sync back to App.jsx's swapRequests state so the Dashboard count stays current.
        if (typeof setSwapRequests === 'function') {
          setSwapRequests(swapRows.map((r) => ({
            id: r.id,
            created_at: r.created_at ?? null,
            fellow: r.requester?.name ?? null,
            requester: r.requester?.name ?? null,
            target: r.target?.name ?? null,
            target_fellow: r.target?.name ?? null,
            block_number: r.block_number ?? null,
            from_week_part: r.from_week_part ?? null,
            to_week_part: r.to_week_part ?? null,
            reason: r.reason || '',
            status: r.status,
          })));
        }
      }
    } catch (e) {
      console.error(e);
      setDbError(e?.message || String(e));
      setDbFellows([]);
      setBlockDates([]);
      setDbRequests([]);
      setDbSwapRequests([]);
    } finally {
      hasLoadedOnce.current = true;
      setLoadingDb(false);
    }
  }, [useDatabase, pid, yid, institutionId]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // ---- helpers: translate UI "3-1" to a block_dates.id (creates row if needed) ----
  const ensureBlockDateIdForUiWeek = useCallback(
    async (uiWeekValue) => {
      if (isUuidish(uiWeekValue) && !String(uiWeekValue).includes('-')) return uiWeekValue;

      const s = safeStr(uiWeekValue);
      const [parentStr, partStr] = s.split('-');
      const parent = Number(parentStr);
      const part = Number(partStr);
      if (!parent || (part !== 1 && part !== 2)) throw new Error('Invalid week selection');

      const source = (Array.isArray(localBlockDates) && localBlockDates.length) ? splitLocalWeeks : weeklyBlocks;
      const match = asArray(source).find(w => String(w.block) === `${parent}-${part}`);
      if (!match) throw new Error('Selected week not found');

      // Look up by parent block number (1–13) so both "1-1" and "1-2" resolve to
      // the same 2-week block_date row. week_part is stored separately on the request.
      const existing = asArray(blockDates).find(b => Number(b.block_number) === parent);
      if (existing?.id) return existing.id;

      // Prefer the full parent-block date range so week_part narrowing works in display.
      const parentBlock = asArray(localBlockDates).find(b => Number(b.block) === parent);
      const toInsert = {
        program_id: pid,
        academic_year_id: yid,
        block_number: parent,
        start_date: parentBlock?.start ?? match.start,
        end_date: parentBlock?.end ?? match.end,
        rotation_number: match.rotation ?? parentBlock?.rotation ?? 0,
        institution_id: institutionId || null,
        program: safeStr(profile?.program) || null,
        academic_year: safeStr(profile?.academic_year) || null,
      };

      const upsertRes = await supabase
        .from('block_dates')
        .upsert(toInsert, { onConflict: 'program_id,academic_year_id,block_number' })
        .select('id')
        .limit(1);

      if (upsertRes.error) throw upsertRes.error;
      const newId = upsertRes.data?.[0]?.id;
      if (!newId) throw new Error('Could not create block date');
      return newId;
    },
    [pid, yid, blockDates, splitLocalWeeks, weeklyBlocks, institutionId, profile?.program, profile?.academic_year]
  );

  // ---- actions: vacations/time-off ----
  const approveDbRequest = useCallback(async (requestId) => {
    if (!userCanApprove) return;
    setSubmitting(true);
    setDbError(null);
    try {
      const { error } = await supabase
        .from('vacation_requests')
        .update({ status: 'approved', approved_by: uid, approved_at: new Date().toISOString() })
        .eq('id', requestId);
      if (error) throw error;
      await fetchRequests();
    } catch (e) {
      setDbError(e?.message || String(e));
    } finally {
      setSubmitting(false);
    }
  }, [userCanApprove, uid, fetchRequests]);

  const denyDbRequest = useCallback(async (requestId, notes = '') => {
    if (!userCanApprove) return;
    setSubmitting(true);
    setDbError(null);
    try {
      const patch = { status: 'denied' };
      if (safeStr(notes)) patch.notes = safeStr(notes);
      const { error } = await supabase.from('vacation_requests').update(patch).eq('id', requestId);
      if (error) throw error;
      setDenyingId(null);
      setDenyReason('');
      await fetchRequests();
    } catch (e) {
      setDbError(e?.message || String(e));
    } finally {
      setSubmitting(false);
    }
  }, [userCanApprove, fetchRequests]);

const cancelDbRequest = useCallback(async (requestId, notes = '') => {
  setSubmitting(true);
  setDbError(null);

  try {
    const { data: row, error: readErr } = await supabase
      .from('vacation_requests')
      .select('id, status, requested_by')
      .eq('id', requestId)
      .single();

    if (readErr) throw readErr;

    if (safeStr(row?.status).toLowerCase() === 'approved' && !userCanApprove) {
      throw new Error('Approved vacations can only be cancelled by PD/Chief/Admin.');
    }

    const patch = { status: 'cancelled' };
    if (notes) patch.notes = notes;

    let q = supabase.from('vacation_requests').update(patch).eq('id', requestId);
    if (!userCanApprove) q = q.eq('requested_by', uid);

    const { error } = await q;
    if (error) throw error;

    await fetchRequests();
  } catch (e) {
    setDbError(e?.message || String(e));
  } finally {
    setSubmitting(false);
  }
}, [userCanApprove, uid, fetchRequests]);

  const submitDbRequest = useCallback(async () => {
    if (!pid) throw new Error('Missing programId. Cannot submit request.');
    if (!yid) throw new Error('Missing academicYearId. Cannot submit request.');
    if (!userCanRequest) return;
    setSubmitting(true);
    setDbError(null);
    try {
      const fid = safeStr(newDbReq?.fellow_id);
      const wk = safeStr(newDbReq?.start_block_id);
      if (!fid || !wk) return;

      // Client-side fellow-scope guard: non-approvers can only submit for fellows
      // linked to their own account (fellows.user_id = uid). This catches the case
      // before the DB trigger fires "No active fellow scope for this user."
      if (!userCanApprove) {
        const myFellows = asArray(dbFellows).filter(f => f?.user_id === uid);
        if (myFellows.length === 0) {
          setDbError('Your account is not linked to a fellow record. Contact your program director to link your account.');
          return;
        }
        if (!myFellows.some(f => f.id === fid)) {
          setDbError('You can only submit vacation requests for your own fellow record.');
          return;
        }
      }

      // Parse week_part (1 or 2) from the "parent-part" key so we can store it.
      const wkParts = wk.split('-');
      const weekPart = Number(wkParts[1]);
      const resolvedWeekPart = (weekPart === 1 || weekPart === 2) ? weekPart : null;

      const blockId = await ensureBlockDateIdForUiWeek(wk);

      const { error } = await supabase.from('vacation_requests').insert({
        fellow_id: fid,
        start_block_id: blockId,
        end_block_id: blockId,
        week_part: resolvedWeekPart,
        reason: safeStr(newDbReq?.reason) || 'Vacation',
        status: 'pending',
        requested_by: uid,
        program_id: pid,
        academic_year_id: yid,
        institution_id: institutionId || null,
        program: safeStr(profile?.program) || null,
        academic_year: safeStr(profile?.academic_year) || null,
      });
      if (error) throw error;

      setNewDbReq({ fellow_id: '', start_block_id: '', reason: 'Vacation' });
      await fetchRequests();
    } catch (e) {
      setDbError(e?.message || String(e));
    } finally {
      setSubmitting(false);
    }
  }, [userCanRequest, userCanApprove, newDbReq, dbFellows, ensureBlockDateIdForUiWeek, uid, pid, yid, institutionId, profile?.program, profile?.academic_year, fetchRequests]);

  // ---- actions: day-off (stored in vacation_requests with notes=date) ----
  const approveDayOff = useCallback(async (requestId) => approveDbRequest(requestId), [approveDbRequest]);
  const denyDayOff = useCallback(async (requestId, reason = '') => denyDbRequest(requestId, reason), [denyDbRequest]);

  const submitDayOff = useCallback(async () => {
    if (!userCanRequest) return;
    setSubmitting(true);
    setDbError(null);
    try {
      const fid = safeStr(newDayOff?.fellow_id);
      const dateStr = safeStr(newDayOff?.date);
      const reasonType = safeStr(newDayOff?.reason_type) || 'Sick Day';
      if (!fid || !dateStr) return;

      // Client-side fellow-scope guard (same as submitDbRequest)
      if (!userCanApprove) {
        const myFellows = asArray(dbFellows).filter(f => f?.user_id === uid);
        if (myFellows.length === 0) {
          setDbError('Your account is not linked to a fellow record. Contact your program director to link your account.');
          return;
        }
        if (!myFellows.some(f => f.id === fid)) {
          setDbError('You can only submit day-off requests for your own fellow record.');
          return;
        }
      }

      const d = new Date(`${dateStr}T00:00:00`);
      let match = asArray(blockDates).find(b => {
        const s = new Date(`${b.start_date}T00:00:00`);
        const e = new Date(`${b.end_date}T00:00:00`);
        return d >= s && d <= e;
      });

      if (!match?.id) {
        const source = (Array.isArray(localBlockDates) && localBlockDates.length) ? splitLocalWeeks : weeklyBlocks;
        const local = asArray(source).find(w => {
          const s = new Date(`${w.start}T00:00:00`);
          const e = new Date(`${w.end}T00:00:00`);
          return d >= s && d <= e;
        });
        if (!local?.block) throw new Error('No schedule week found for that date');
        const blockId = await ensureBlockDateIdForUiWeek(String(local.block));
        match = { id: blockId };
      }

      const { error } = await supabase.from('vacation_requests').insert({
        fellow_id: fid,
        start_block_id: match.id,
        end_block_id: match.id,
        reason: reasonType,
        notes: dateStr,
        status: 'pending',
        requested_by: uid,
        program_id: pid,
        academic_year_id: yid,
        institution_id: institutionId || null,
        program: safeStr(profile?.program) || null,
        academic_year: safeStr(profile?.academic_year) || null,
      });
      if (error) throw error;

      setNewDayOff({ fellow_id: '', date: '', reason_type: 'Sick Day' });
      await fetchRequests();
    } catch (e) {
      setDbError(e?.message || String(e));
    } finally {
      setSubmitting(false);
    }
  }, [userCanRequest, userCanApprove, newDayOff, dbFellows, blockDates, splitLocalWeeks, weeklyBlocks, ensureBlockDateIdForUiWeek, uid, pid, yid, institutionId, profile?.program, profile?.academic_year, fetchRequests]);

  // ---- swaps (minimal CRUD so UI renders; uses your real swap_requests schema) ----
  const submitDbSwap = useCallback(async () => {
    setDbError(null);
    setNewDbSwapError(null);

    const requester_id = safeStr(newDbSwap?.requester_id);
    const target_shift_key = safeStr(newDbSwap?.target_shift_key);
    const my_shift_key = safeStr(newDbSwap?.my_shift_key);
    const reason = safeStr(newDbSwap?.reason);

    if (!requester_id || !my_shift_key || !target_shift_key) {
      setNewDbSwapError('Select your shift and a swap partner.');
      return;
    }

    let blockNum = null;
    let fromPart = null;
    try {
      const parts = my_shift_key.split('|');
      const key = parts[1] || '';
      const m = key.match(/^B(\d+)-W([12])$/);
      if (m) {
        blockNum = Number(m[1]);
        fromPart = Number(m[2]);
      }
    } catch (_) {}
    if (!blockNum) {
      setNewDbSwapError('Invalid shift selection.');
      return;
    }

    let targetFellowId = null;
    let toPart = null;
    try {
      const parts = target_shift_key.split('|');
      targetFellowId = safeStr(parts[0]);
      const key = parts[1] || '';
      const m = key.match(/^B(\d+)-W([12])$/);
      if (m) toPart = Number(m[2]);
    } catch (_) {}
    if (!targetFellowId) {
      setNewDbSwapError('Invalid target selection.');
      return;
    }

    // optionally link to a real block_dates row if you can resolve it
    let blockDateId = null;
    try {
      const weeklyNum = (blockNum - 1) * 2 + (fromPart || 1);
      const existing = asArray(blockDates).find(b => Number(b.block_number) === weeklyNum);
      blockDateId = existing?.id || null;
    } catch (_) {}

    setSubmitting(true);
    try {
      const { error } = await supabase.from('swap_requests').insert({
        requester_fellow_id: requester_id,
        target_fellow_id: targetFellowId,
        block_number: blockNum,
        reason: reason || my_shift_key,
        status: 'pending_peer',
        requested_by: uid,
        program_id: pid,
        academic_year_id: yid,
        block_date_id: blockDateId,
        from_week_part: fromPart,
        to_week_part: toPart,
      });
      if (error) throw error;

      setNewDbSwap(SWAP_RESET);
      await fetchRequests();
    } catch (e) {
      setDbError(e?.message || String(e));
    } finally {
      setSubmitting(false);
    }
  }, [newDbSwap, uid, pid, yid, blockDates, fetchRequests]);

  // ---- peer approval (target fellow confirms or declines) ----
  const peerApproveDbSwap = useCallback(async (requestId) => {
    const swap = dbSwapRequests.find(r => r.id === requestId);
    if (!swap || !linkedFellowIds.has(swap.target_fellow_id)) return;
    setSubmitting(true);
    setDbError(null);
    try {
      const { error } = await supabase.from('swap_requests')
        .update({ status: 'pending', peer_approved_by: uid, peer_approved_at: new Date().toISOString() })
        .eq('id', requestId)
        .eq('status', 'pending_peer');
      if (error) throw error;
      await fetchRequests();
    } catch (e) {
      setDbError(e?.message || String(e));
    } finally {
      setSubmitting(false);
    }
  }, [dbSwapRequests, linkedFellowIds, uid, fetchRequests]);

  const peerDenyDbSwap = useCallback(async (requestId, notes = '') => {
    const swap = dbSwapRequests.find(r => r.id === requestId);
    if (!swap || !linkedFellowIds.has(swap.target_fellow_id)) return;
    setSubmitting(true);
    setDbError(null);
    try {
      const patch = { status: 'denied' };
      if (safeStr(notes)) patch.notes = safeStr(notes);
      const { error } = await supabase.from('swap_requests')
        .update(patch)
        .eq('id', requestId)
        .eq('status', 'pending_peer');
      if (error) throw error;
      await fetchRequests();
    } catch (e) {
      setDbError(e?.message || String(e));
    } finally {
      setSubmitting(false);
    }
  }, [dbSwapRequests, linkedFellowIds, fetchRequests]);

  const approveDbSwap = useCallback(async (swap) => {
    if (!userCanApprove) return;
    setSubmitting(true);
    setDbError(null);
    try {
      // 1. Mark swap as approved
      const { error } = await supabase
        .from('swap_requests')
        .update({ status: 'approved', approved_by: uid, approved_at: new Date().toISOString() })
        .eq('id', swap.id);
      if (error) throw error;

      // 2. Execute the actual call/float swap (if applicable)
      const { swapType } = parseSwapReason(swap.reason);
      const fromWeek = swap.from_week_part;
      const toWeek = swap.to_week_part;

      // Only swap if both week parts are defined (skip rotation-only swaps)
      if (fromWeek && toWeek && fromWeek !== toWeek) {
        const type = swapType === 'float' ? 'float' : 'call';
        const swapPid = swap.program_id || pid;
        const swapYid = swap.academic_year_id || yid;

        // Fetch existing rows to preserve relaxed flag
        const { data: existingRows } = await supabase
          .from('call_float_assignments')
          .select('weekend, relaxed')
          .eq('program_id', swapPid)
          .eq('academic_year_id', swapYid)
          .eq('block_number', swap.block_number)
          .eq('type', type)
          .in('weekend', [fromWeek, toWeek]);

        const fromRelaxed = existingRows?.find(r => r.weekend === fromWeek)?.relaxed ?? false;
        const toRelaxed = existingRows?.find(r => r.weekend === toWeek)?.relaxed ?? false;

        const { error: swapErr } = await supabase.from('call_float_assignments').upsert([
          {
            program_id: swapPid,
            academic_year_id: swapYid,
            block_number: swap.block_number,
            weekend: fromWeek,
            type,
            fellow_id: swap.target_fellow_id,
            relaxed: fromRelaxed,
            created_by: uid,
          },
          {
            program_id: swapPid,
            academic_year_id: swapYid,
            block_number: swap.block_number,
            weekend: toWeek,
            type,
            fellow_id: swap.requester_fellow_id,
            relaxed: toRelaxed,
            created_by: uid,
          },
        ], { onConflict: 'program_id,academic_year_id,block_number,weekend,type' });

        if (swapErr) throw swapErr;

        // 3. Refresh in-memory call/float schedule
        const { callSchedule: newCall, nightFloatSchedule: newFloat } =
          await pullCallFloatFromSupabase({ programId: swapPid, academicYearId: swapYid });
        if (newCall && setCallSchedule) setCallSchedule(newCall);
        if (newFloat && setNightFloatSchedule) setNightFloatSchedule(newFloat);
      }

      await fetchRequests();
    } catch (e) {
      setDbError(e?.message || String(e));
    } finally {
      setSubmitting(false);
    }
  }, [userCanApprove, uid, pid, yid, fetchRequests, setCallSchedule, setNightFloatSchedule]);

  const denyDbSwap = useCallback(async (requestId, notes = '') => {
    if (!userCanApprove) return;
    setSubmitting(true);
    setDbError(null);
    try {
      const patch = { status: 'denied' };
      if (safeStr(notes)) patch.notes = safeStr(notes);
      const { error } = await supabase.from('swap_requests').update(patch).eq('id', requestId);
      if (error) throw error;
      await fetchRequests();
    } catch (e) {
      setDbError(e?.message || String(e));
    } finally {
      setSubmitting(false);
    }
  }, [userCanApprove, fetchRequests]);

  const cancelDbSwap = useCallback(async (requestId) => {
    setSubmitting(true);
    setDbError(null);
    try {
      const { error } = await supabase
        .from('swap_requests')
        .update({ status: 'cancelled' })
        .eq('id', requestId)
        .eq('requested_by', uid);
      if (error) throw error;
      await fetchRequests();
    } catch (e) {
      setDbError(e?.message || String(e));
    } finally {
      setSubmitting(false);
    }
  }, [uid, fetchRequests]);

  // ---- visibility + derived lists (ALWAYS arrays) ----
  const linkedFellows = useMemo(() => asArray(dbFellows).filter(f => f?.user_id === uid), [dbFellows, uid]);
  const linkedFellowIds = useMemo(() => new Set(linkedFellows.map(f => f.id).filter(Boolean)), [linkedFellows]);

  const selectableFellows = useMemo(() => {
    if (userCanApprove) return asArray(dbFellows);
    return linkedFellows.length ? linkedFellows : asArray(dbFellows);
  }, [userCanApprove, dbFellows, linkedFellows]);

  const isVisibleRequest = useCallback(
    (r) => userCanApprove || r?.requested_by === uid || linkedFellowIds.has(r?.fellow?.id),
    [userCanApprove, uid, linkedFellowIds]
  );

  const visibleRequests = useMemo(() => asArray(dbRequests).filter(isVisibleRequest), [dbRequests, isVisibleRequest]);

  const vacationOnly = useMemo(
    () => visibleRequests.filter(r => !DAY_OFF_SET.has(r?.reason)),
    [visibleRequests]
  );

  const dayOffOnly = useMemo(
    () => visibleRequests.filter(r => DAY_OFF_SET.has(r?.reason)),
    [visibleRequests]
  );

  const pendingRequests = useMemo(() => vacationOnly.filter(r => r.status === 'pending'), [vacationOnly]);
  const approvedRequests = useMemo(() => vacationOnly.filter(r => r.status === 'approved'), [vacationOnly]);
  const deniedRequests = useMemo(() => vacationOnly.filter(r => r.status === 'denied'), [vacationOnly]);

  const pendingDayOffs = useMemo(() => dayOffOnly.filter(r => r.status === 'pending'), [dayOffOnly]);
  const approvedDayOffs = useMemo(() => dayOffOnly.filter(r => r.status === 'approved'), [dayOffOnly]);
  const deniedDayOffs = useMemo(() => dayOffOnly.filter(r => r.status === 'denied'), [dayOffOnly]);

  const isVisibleSwap = useCallback(
    (r) =>
      userCanApprove ||
      r?.requested_by === uid ||
      linkedFellowIds.has(r?.requester?.id) ||
      linkedFellowIds.has(r?.target?.id),
    [userCanApprove, uid, linkedFellowIds]
  );

  const visibleSwaps = useMemo(() => asArray(dbSwapRequests).filter(isVisibleSwap), [dbSwapRequests, isVisibleSwap]);
  const pendingPeerSwapRequests = useMemo(() => visibleSwaps.filter(r => r.status === 'pending_peer'), [visibleSwaps]);
  const pendingSwapRequests = useMemo(() => visibleSwaps.filter(r => r.status === 'pending'), [visibleSwaps]);
  const approvedSwapRequests = useMemo(() => visibleSwaps.filter(r => r.status === 'approved'), [visibleSwaps]);
  const deniedSwapRequests = useMemo(() => visibleSwaps.filter(r => r.status === 'denied'), [visibleSwaps]);

  // ---- request extras (safe even if schedule context missing) ----
  const getRequestExtras = useCallback((req) => {
    const bnum = Number(req?.start_block?.block_number || 0);
    if (!bnum) {
      return {
        parent: null,
        part: null,
        rotationNumber: null,
        rotationName: null,
        start: null,
        end: null,
        callAssigned: '—',
        floatAssigned: '—',
      };
    }

    const parent = Math.ceil(bnum / 2);
    const part = (bnum % 2 === 1) ? 1 : 2;

    let rotationNumber = null;
    let rotationName = null;

    const fellowName = req?.fellow?.name;
    try {
      if (fellowName && schedule?.[fellowName]) rotationName = schedule[fellowName][parent - 1] || null;
    } catch (_) {}

    try {
      const localParent = asArray(localBlockDates).find(b => Number(b.block) === parent);
      rotationNumber = localParent?.rotation ?? req?.start_block?.rotation_number ?? null;
      if (!rotationName && rotationNumber != null) rotationName = allRotationTypes?.[rotationNumber] || String(rotationNumber);
    } catch (_) {}

    let start = req?.start_block?.start_date || null;
    let end = req?.end_block?.end_date || req?.start_block?.end_date || null;

    if ((!start || !end) && (Array.isArray(localBlockDates) && localBlockDates.length)) {
      const match = splitLocalWeeks.find(w => String(w.block) === `${parent}-${part}`);
      if (match) {
        start = match.start;
        end = match.end;
      }
    }

    // Narrow to just the requested week if week_part is specified (1 = first week, 2 = second week)
    const weekPart = req?.week_part ? Number(req.week_part) : null;
    if (weekPart === 1 || weekPart === 2) {
      const window = getWeekWindowWithinBlock(req?.start_block?.start_date, req?.start_block?.end_date, weekPart);
      if (window.start) start = window.start.toISOString().split('T')[0];
      if (window.end) end = window.end.toISOString().split('T')[0];
    }

    const key = `B${parent}-W${part}`;
    const callAssigned = getNameFromAssignment(callSchedule?.[key]) || '—';
    const floatAssigned = getNameFromAssignment(nightFloatSchedule?.[key]) || '—';

    return { parent, part, rotationNumber, rotationName, start, end, callAssigned, floatAssigned };
  }, [schedule, callSchedule, nightFloatSchedule, splitLocalWeeks]);

  // ---- swap form helpers: my shifts + valid swap targets ----
  const myShifts = useMemo(() => {
    const requesterId = safeStr(newDbSwap?.requester_id);
    if (!requesterId) return [];
    const fellow = asArray(dbFellows).find(f => f.id === requesterId);
    if (!fellow?.name) return [];
    const name = fellow.name;
    const shifts = [];
    Object.entries(callSchedule || {}).forEach(([key, val]) => {
      if (getNameFromAssignment(val) !== name) return;
      const m = key.match(/^B(\d+)-W([12])$/);
      if (!m) return;
      shifts.push({ type: 'call', key, blockNum: Number(m[1]), weekend: Number(m[2]) });
    });
    Object.entries(nightFloatSchedule || {}).forEach(([key, val]) => {
      if (getNameFromAssignment(val) !== name) return;
      const m = key.match(/^B(\d+)-W([12])$/);
      if (!m) return;
      shifts.push({ type: 'float', key, blockNum: Number(m[1]), weekend: Number(m[2]) });
    });
    shifts.sort((a, b) => a.blockNum - b.blockNum || a.weekend - b.weekend);
    return shifts;
  }, [newDbSwap?.requester_id, dbFellows, callSchedule, nightFloatSchedule]);

  const validSwapTargets = useMemo(() => {
    const myKey = safeStr(newDbSwap?.my_shift_key);
    const requesterId = safeStr(newDbSwap?.requester_id);
    if (!myKey || !requesterId) return [];
    const myType = myKey.split('|')[0];
    const scheduleMap = myType === 'call' ? callSchedule : nightFloatSchedule;
    const otherFellows = asArray(dbFellows).filter(f => f.id !== requesterId);
    const result = [];
    for (const fellow of otherFellows) {
      const shifts = [];
      Object.entries(scheduleMap || {}).forEach(([key, val]) => {
        if (getNameFromAssignment(val) !== fellow.name) return;
        const m = key.match(/^B(\d+)-W([12])$/);
        if (!m) return;
        shifts.push({ type: myType, key, blockNum: Number(m[1]), weekend: Number(m[2]) });
      });
      if (shifts.length) {
        shifts.sort((a, b) => a.blockNum - b.blockNum || a.weekend - b.weekend);
        result.push({ fellow, shifts });
      }
    }
    return result;
  }, [newDbSwap?.requester_id, newDbSwap?.my_shift_key, dbFellows, callSchedule, nightFloatSchedule]);

  // ---- optional UI helpers ----
  const getBlockDetails = useCallback((fellowName, blockNum) => {
    const details = [];
    details.push({ label: 'Rotation', value: schedule?.[fellowName]?.[blockNum - 1] || '—' });
    const clinicDay = clinicDays?.[fellowName];
    if (clinicDay !== undefined && clinicDay !== null) details.push({ label: 'Clinic', value: DAY_NAMES?.[clinicDay] || String(clinicDay) });

    const w1Key = `B${blockNum}-W1`;
    const w2Key = `B${blockNum}-W2`;
    const calls = [];
    if (getNameFromAssignment(callSchedule?.[w1Key]) === fellowName) calls.push('W1');
    if (getNameFromAssignment(callSchedule?.[w2Key]) === fellowName) calls.push('W2');
    if (calls.length) details.push({ label: 'Call', value: calls.join(', ') });

    const floats = [];
    if (getNameFromAssignment(nightFloatSchedule?.[w1Key]) === fellowName) floats.push('W1');
    if (getNameFromAssignment(nightFloatSchedule?.[w2Key]) === fellowName) floats.push('W2');
    if (floats.length) details.push({ label: 'Float', value: floats.join(', ') });

    return details;
  }, [schedule, callSchedule, nightFloatSchedule, clinicDays]);

  const getShiftDateLabel = useCallback((blockNum, weekend) => {
    const weeklyNum = (blockNum - 1) * 2 + weekend;
    const entry = asArray(blockDates).find(b => Number(b.block_number) === weeklyNum);

    // Given a week's start ISO date, walk forward to find Saturday–Sunday
    const fmtWeekend = (startISO) => {
      const d = new Date(`${startISO}T00:00:00`);
      // Advance to the next Saturday (getDay: 0=Sun, 6=Sat)
      const daysUntilSat = (6 - d.getDay() + 7) % 7;
      d.setDate(d.getDate() + daysUntilSat);
      const sat = d;
      const sun = new Date(d);
      sun.setDate(sat.getDate() + 1);
      const fmt = (x) => x.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `${fmt(sat)} – ${fmt(sun)}`;
    };

    if (entry?.start_date) return fmtWeekend(entry.start_date);
    const source = (Array.isArray(localBlockDates) && localBlockDates.length) ? splitLocalWeeks : weeklyBlocks;
    const match = asArray(source).find(b => String(b.block) === `${blockNum}-${weekend}`);
    if (match) return fmtWeekend(match.start);
    return `Block ${blockNum}, Wk ${weekend}`;
  }, [blockDates, splitLocalWeeks, weeklyBlocks]);

  return {
    // status
    loadingDb,
    dbError,
    setDbError,
    submitting,

    // deny inline state
    denyingId,
    setDenyingId,
    denyReason,
    setDenyReason,

    // forms
    newDbReq,
    setNewDbReq,
    newDayOff,
    setNewDayOff,
    newDbSwap,
    setNewDbSwap,
    newDbSwapError,
    setNewDbSwapError,

    // data
    selectableFellows,
    linkedFellowIds,
    blockDates: asArray(blockDates),
    weeklyBlocks: asArray(weeklyBlocks),
    splitLocalWeeks: asArray(splitLocalWeeks),

    // requests (time off)
    pendingRequests: asArray(pendingRequests),
    approvedRequests: asArray(approvedRequests),
    deniedRequests: asArray(deniedRequests),

    // day offs
    pendingDayOffs: asArray(pendingDayOffs),
    approvedDayOffs: asArray(approvedDayOffs),
    deniedDayOffs: asArray(deniedDayOffs),

    // swaps
    pendingPeerSwapRequests: asArray(pendingPeerSwapRequests),
    pendingSwapRequests: asArray(pendingSwapRequests),
    approvedSwapRequests: asArray(approvedSwapRequests),
    deniedSwapRequests: asArray(deniedSwapRequests),

    // actions (time off)
    submitDbRequest,
    approveDbRequest,
    denyDbRequest,
    cancelDbRequest,

    // actions (day off)
    submitDayOff,
    approveDayOff,
    denyDayOff,

    // actions (swaps)
    submitDbSwap,
    peerApproveDbSwap,
    peerDenyDbSwap,
    approveDbSwap,
    denyDbSwap,
    cancelDbSwap,

    // swap form data
    myShifts,
    validSwapTargets,

    // helpers
    getRequestExtras,
    getBlockDetails,
    getShiftDateLabel,

    // refetch
    refetch: fetchRequests,
  };
}