// VacationsView.jsx
// Notes:
// 1) Auth flags are booleans from AuthContext.
// 2) swap_requests has no weekend column, weekend is encoded in reason.
// 3) callSchedule/nightFloatSchedule values can be string OR { name, relaxed }.
//
// This rewrite assumes you already applied DB scoping columns + indexes:
// - block_dates has NOT NULL program + academic_year
// - vacation_requests has institution_id + program + academic_year (NOT NULL) and is populated
// - swap_requests has institution_id + program + academic_year (NOT NULL) and is populated
// - block_dates unique index: (institution_id, program, academic_year, block_number)

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CheckCircle, AlertTriangle, Loader2, ArrowLeftRight, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { pullCallFloatFromSupabase, pushCallFloatToSupabase } from '../utils/scheduleSupabaseSync';
import { checkAllWorkHourViolations } from '../engine/workHourChecker';
import { blockDates as localBlockDates, allRotationTypes } from '../data/scheduleData';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_OFF_REASONS = ['Sick Day', 'Personal Day', 'Conference', 'CME'];
const SWAP_RESET = { requester_id: '', my_shift_key: '', target_shift_key: '', reason: '' };

// ---- helpers ----
// Academic year like "2025-2026", July 1 -> June 30
const getAcademicYear = (d = new Date()) => {
  const y = d.getFullYear();
  const m = d.getMonth(); // 0=Jan ... 6=Jul
  const start = m >= 6 ? y : y - 1;
  return `${start}-${start + 1}`;
};

const resolveProgram = (profile) => {
  return (
    profile?.program ??
    profile?.institution?.program ??
    profile?.institution_program ??
    null
  );
};

const resolveAcademicYear = (profile) => {
  return (
    profile?.academic_year ??
    profile?.institution?.academic_year ??
    getAcademicYear()
  );
};

// Hard fail if missing required context for block_dates
const requireBlockDatesContext = (profile) => {
  const program = resolveProgram(profile);
  const academic_year = resolveAcademicYear(profile);

  if (!profile?.institution_id) {
    throw new Error('Missing institution_id on profile, cannot query block_dates.');
  }
  if (!program) {
    throw new Error('Missing program on profile/institution, cannot query block_dates.');
  }
  if (!academic_year) {
    throw new Error('Missing academic_year, cannot query block_dates.');
  }

  return { institution_id: profile.institution_id, program, academic_year };
};

// Supports two reason encodings:
// Legacy:    `{type}|W{1|2}|note`
// Bilateral: `{type}|req:B{block}-W{wknd}|tgt:B{block2}-W{wknd2}|note`
const parseSwapReason = (reason) => {
  const out = { swapType: null, weekend: null, reqKey: null, tgtKey: null, note: '' };
  if (!reason || typeof reason !== 'string') return out;
  if (!reason.includes('|')) { out.note = reason; return out; }

  const parts = reason.split('|');
  const type = parts[0];
  if (type === 'call' || type === 'float') out.swapType = type;

  const reqPart = parts.find(p => p.startsWith('req:'));
  const tgtPart = parts.find(p => p.startsWith('tgt:'));
  if (reqPart && tgtPart) {
    out.reqKey = reqPart.replace('req:', '');
    out.tgtKey = tgtPart.replace('tgt:', '');
    const rm = out.reqKey.match(/^B\d+-W([12])$/);
    if (rm) out.weekend = Number(rm[1]);
    out.note = parts
      .filter(p => p !== type && !p.startsWith('req:') && !p.startsWith('tgt:'))
      .join('|');
    return out;
  }

  const w = parts[1] || '';
  if (w.startsWith('W')) {
    const n = Number(w.replace('W', ''));
    if (n === 1 || n === 2) out.weekend = n;
  }
  out.note = parts.slice(2).join('|') || '';
  return out;
};

const fmtDate = (d) => d
  ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  : null;

export default function VacationsView({
  fellows = [],
  schedule = {},
  vacations = [],
  swapRequests = [],
  callSchedule = {},
  nightFloatSchedule = {},
  setCallSchedule,
  setNightFloatSchedule,
  clinicDays = {},
  pgyLevels = {},
  setSchedule,
  setVacations,
  setSwapRequests,
}) {
  const auth = useAuth?.() || {};
  const {
    profile,
    user,
    canApprove,
    canRequest,
    isProgramDirector,
    isChiefFellow,
    isAdmin,
  } = auth;

  const userCanApprove = !!canApprove;
  const userCanRequest = !!canRequest;

  const useDatabase = !!(isSupabaseConfigured && user && profile);

  const program =
    profile?.program ??
    profile?.institution?.program ??
    profile?.institution_program ??
    null;

  const academic_year =
    profile?.academic_year ??
    profile?.institution?.academic_year ??
    getAcademicYear();

  const institutionId = profile?.institution_id ?? null;

  const [subView, setSubView] = useState('timeoff');

  // Client-side dismissed denied-swap IDs (hide without deleting)
  const [dismissedSwapIds, setDismissedSwapIds] = useState(new Set());
  const dismissSwap = (id) => setDismissedSwapIds(prev => new Set([...prev, id]));

  const [denyingId, setDenyingId] = useState(null);
  const [denyReason, setDenyReason] = useState('');

  // Supabase-backed state
  const [dbRequests, setDbRequests] = useState([]);
  const [dbSwapRequests, setDbSwapRequests] = useState([]);
  const [dbFellows, setDbFellows] = useState([]);
  const [blockDates, setBlockDates] = useState([]);

  const [loadingDb, setLoadingDb] = useState(false);
  const [dbError, setDbError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const SubViewTabs = () => (
    <div className="inline-flex rounded border dark:border-gray-600 overflow-hidden">
      <button
        type="button"
        onClick={() => setSubView('timeoff')}
        className={`px-3 py-1 text-xs font-medium ${
          subView === 'timeoff'
            ? 'bg-blue-600 text-white'
            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200'
        }`}
      >
        Time Off
      </button>
      <button
        type="button"
        onClick={() => setSubView('dayoff')}
        className={`px-3 py-1 text-xs font-medium border-l dark:border-gray-600 ${
          subView === 'dayoff'
            ? 'bg-blue-600 text-white'
            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200'
        }`}
      >
        Day Off
      </button>
      <button
        type="button"
        onClick={() => setSubView('swaps')}
        className={`px-3 py-1 text-xs font-medium border-l dark:border-gray-600 ${
          subView === 'swaps'
            ? 'bg-blue-600 text-white'
            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200'
        }`}
      >
        Swaps
      </button>
    </div>
  );

  // --- Local block helpers ---
  const weeklyBlocks = useMemo(() => {
    if (localBlockDates && localBlockDates.length) return [];
    const weeks = [];
    const today = new Date();
    const day = today.getDay();
    const daysUntilMonday = (day === 1) ? 0 : ((8 - day) % 7);
    const firstMonday = new Date(today);
    firstMonday.setDate(today.getDate() + daysUntilMonday);

    for (let i = 0; i < 26; i++) {
      const start = new Date(firstMonday);
      start.setDate(firstMonday.getDate() + i * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      const pad = (n) => n.toString().padStart(2, '0');
      const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      weeks.push({ block: i + 1, start: fmt(start), end: fmt(end) });
    }
    return weeks;
  }, []);

  const splitLocalWeeks = useMemo(() => {
    if (!localBlockDates || !localBlockDates.length) return [];
    const weeks = [];
    localBlockDates.forEach((b) => {
      const start = new Date(b.start + 'T00:00:00');
      const pad = (n) => n.toString().padStart(2, '0');
      const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const firstStart = new Date(start);
      const firstEnd = new Date(firstStart);
      firstEnd.setDate(firstStart.getDate() + 6);
      const secondStart = new Date(firstStart);
      secondStart.setDate(firstStart.getDate() + 7);
      const secondEnd = new Date(secondStart);
      secondEnd.setDate(secondStart.getDate() + 6);
      weeks.push({ block: `${b.block}-1`, parentBlock: b.block, start: fmt(firstStart), end: fmt(firstEnd), part: 1 });
      if (Number(b.block) !== 1) {
        weeks.push({ block: `${b.block}-2`, parentBlock: b.block, start: fmt(secondStart), end: fmt(secondEnd), part: 2 });
      }
    });
    return weeks;
  }, []);

  const formatPretty = (isoDate) => {
    const d = new Date(isoDate + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // --- Fetch everything scoped correctly ---
  const fetchRequests = useCallback(async () => {
    if (!useDatabase) return;

    if (!institutionId) {
      setDbError('Missing institution_id on profile.');
      return;
    }
    if (!program) {
      setDbError('Missing program on profile, cannot scope queries.');
      return;
    }
    if (!academic_year) {
      setDbError('Missing academic_year context, cannot scope queries.');
      return;
    }

    setLoadingDb(true);
    setDbError(null);

    try {
      // Fellows
      let { data: fellowsData, error: fellowsErr } = await supabase
        .from('fellows')
        .select('id, name, pgy_level, program, user_id')
        .eq('institution_id', institutionId)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (fellowsErr) throw fellowsErr;

      // Auto-seed fellows if empty (approvers only)
      if (!fellowsData?.length && userCanApprove) {
        const toInsert = fellows.map(name => ({
          name,
          institution_id: institutionId,
          is_active: true,
          program: program,
          pgy_level: pgyLevels[name] ?? 1,
        }));

        const { data: seeded, error: seedErr } = await supabase
          .from('fellows')
          .insert(toInsert)
          .select('id, name, pgy_level, program, user_id');

        if (seedErr) throw new Error(`Could not auto-populate fellows list: ${seedErr.message}`);
        fellowsData = seeded || [];
      }

      setDbFellows(fellowsData || []);

// 1) Fetch block_dates for dropdowns
const { institution_id, program, academic_year } = requireBlockDatesContext(profile);

let { data: blockDatesData, error: blockDatesErr } = await supabase
  .from('block_dates')
  .select('id, block_number, start_date, end_date, rotation_number, program, academic_year')
  .eq('institution_id', institution_id)
  .eq('program', program)
  .eq('academic_year', academic_year)
  .order('block_number', { ascending: true });

if (blockDatesErr) throw blockDatesErr;

// 2) Auto-seed block_dates if missing (approvers only)
const expectedBlockCount = localBlockDates?.length ?? 0;

if ((blockDatesData?.length ?? 0) < expectedBlockCount && userCanApprove) {
  const existingBlockNums = new Set((blockDatesData || []).map(b => Number(b.block_number)));

  const toUpsert = (localBlockDates || [])
    .filter(b => !existingBlockNums.has(Number(b.block)))
    .map(b => ({
      block_number: Number(b.block),
      start_date: b.start,
      end_date: b.end,
      rotation_number: b.rotation ?? 0,
      institution_id,
      program,
      academic_year, // CRITICAL: must be present
    }));

  if (toUpsert.length) {
    // You should have unique index: (institution_id, program, academic_year, block_number)
    const { data: seeded, error: seedErr } = await supabase
      .from('block_dates')
      .upsert(toUpsert, { onConflict: 'institution_id,program,academic_year,block_number' })
      .select('id, block_number, start_date, end_date, rotation_number, program, academic_year');

    if (seedErr) throw seedErr;

    // Merge and sort
    const merged = [...(blockDatesData || []), ...(seeded || [])];
    const byKey = new Map();
    for (const row of merged) {
      const k = `${row.institution_id ?? institution_id}|${row.program}|${row.academic_year}|${row.block_number}`;
      byKey.set(k, row);
    }
    blockDatesData = Array.from(byKey.values()).sort(
      (a, b) => Number(a.block_number) - Number(b.block_number)
    );
  }
}

setBlockDates(blockDatesData || []);

      // Vacation + day-off requests (scoped)
      const { data: requestsData, error: requestsErr } = await supabase
        .from('vacation_requests')
        .select(`
          id,
          reason,
          status,
          notes,
          created_at,
          approved_at,
          requested_by,
          approved_by,
          institution_id,
          program,
          academic_year,
          fellow:fellows!fellow_id (id, name, pgy_level, program),
          start_block:block_dates!start_block_id (id, block_number, start_date, end_date, rotation_number, program, academic_year),
          end_block:block_dates!end_block_id (id, block_number, start_date, end_date, rotation_number, program, academic_year)
        `)
        .eq('institution_id', institutionId)
        .eq('program', program)
        .eq('academic_year', academic_year)
        .order('created_at', { ascending: false });

      if (requestsErr) throw requestsErr;

      // Enrich with requester profile info (best-effort)
      let enrichedRequests = requestsData || [];
      try {
        const requesterIds = [...new Set((requestsData || []).map(r => r.requested_by).filter(Boolean))];
        if (requesterIds.length) {
          const { data: profilesData, error: profilesErr } = await supabase
            .from('profiles')
            .select('id, username, full_name, email')
            .in('id', requesterIds);
          if (!profilesErr && profilesData) {
            const profMap = {};
            profilesData.forEach(p => { profMap[p.id] = p; });
            enrichedRequests = (requestsData || []).map(r => ({ ...r, requested_by_profile: profMap[r.requested_by] }));
          }
        }
      } catch (e) {}

      setDbRequests(enrichedRequests || []);

      // Swap requests (scoped)
      const { data: swapsData, error: swapsErr } = await supabase
        .from('swap_requests')
        .select(`
          id,
          block_number,
          reason,
          status,
          notes,
          created_at,
          approved_at,
          requested_by,
          approved_by,
          institution_id,
          program,
          academic_year,
          requester:fellows!requester_fellow_id (id, name, pgy_level),
          target:fellows!target_fellow_id (id, name, pgy_level)
        `)
        .eq('institution_id', institutionId)
        .eq('program', program)
        .eq('academic_year', academic_year)
        .order('created_at', { ascending: false });

      if (swapsErr) throw swapsErr;
      setDbSwapRequests(swapsData || []);
    } catch (err) {
      console.error('Error fetching requests:', err);
      setDbError(err.message || String(err));
    } finally {
      setLoadingDb(false);
    }
  }, [
    useDatabase,
    institutionId,
    program,
    academic_year,
    userCanApprove,
    fellows,
    pgyLevels,
  ]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // --- Approve/Deny vacation requests ---
  const approveDbRequest = async (requestId) => {
    if (!userCanApprove) return;
    setSubmitting(true);
    try {
      const req = dbRequests.find(r => r.id === requestId);
      if (!req) throw new Error('Request not found');

      const { error } = await supabase
        .from('vacation_requests')
        .update({
          status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .eq('institution_id', institutionId)
        .eq('program', program)
        .eq('academic_year', academic_year);

      if (error) throw error;

      const startWeek = req.start_block?.block_number;
      const endWeek = (req.end_block ?? req.start_block)?.block_number;
      const fellowId = req.fellow?.id;
      const fellowName = req.fellow?.name;

      if (fellowId && startWeek && endWeek && blockDates.length) {
        const affectedWeeks = blockDates.filter(
          b => Number(b.block_number) >= Number(startWeek) && Number(b.block_number) <= Number(endWeek)
        );

        if (affectedWeeks.length > 0) {
          const assignments = affectedWeeks.map(b => ({
            fellow_id: fellowId,
            block_date_id: b.id,
            rotation: 'Vacation',
            created_by: user.id,
          }));

          const { error: upsertErr } = await supabase
            .from('schedule_assignments')
            .upsert(assignments, { onConflict: 'fellow_id,block_date_id' });

          if (upsertErr) console.error('Error updating schedule_assignments:', upsertErr);

          if (setSchedule && fellowName) {
            setSchedule(prev => {
              const next = { ...prev };
              next[fellowName] = [...(next[fellowName] || [])];
              for (let w = Number(startWeek); w <= Number(endWeek); w++) next[fellowName][w - 1] = 'Vacation';
              return next;
            });
          }
        }
      }

      await fetchRequests();
    } catch (err) {
      console.error('Error approving request:', err);
      setDbError(err.message || String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const denyDbRequest = async (requestId, reason = '') => {
    if (!userCanApprove) return;
    setSubmitting(true);
    try {
      const update = { status: 'denied' };
      if (reason) update.notes = reason;

      const { error } = await supabase
        .from('vacation_requests')
        .update(update)
        .eq('id', requestId)
        .eq('institution_id', institutionId)
        .eq('program', program)
        .eq('academic_year', academic_year);

      if (error) throw error;

      setDenyingId(null);
      setDenyReason('');
      await fetchRequests();
    } catch (err) {
      console.error('Error denying request:', err);
      setDbError(err.message || String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const cancelDbRequest = async (requestId) => {
    const req = dbRequests.find(r => r.id === requestId);
    if (!req || req.requested_by !== user?.id) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('vacation_requests')
        .update({ status: 'cancelled' })
        .eq('id', requestId)
        .eq('institution_id', institutionId)
        .eq('program', program)
        .eq('academic_year', academic_year);

      if (error) throw error;
      await fetchRequests();
    } catch (err) {
      console.error('Error cancelling request:', err);
      setDbError(err.message || String(err));
    } finally {
      setSubmitting(false);
    }
  };

  // --- Approve/Deny swaps ---
  const approveDbSwap = async (requestId) => {
    if (!userCanApprove) return;
    setSubmitting(true);

    try {
      const req = dbSwapRequests.find(r => r.id === requestId);
      if (!req) throw new Error('Swap request not found');

      const requesterId = req.requester?.id;
      const targetId = req.target?.id;
      const requesterName = req.requester?.name;
      const targetName = req.target?.name;
      const blockNum = Number(req.block_number);

      const parsed = parseSwapReason(req.reason);
      const swapType = parsed.swapType;
      const weekend = parsed.weekend ?? 1;

      const { error: updErr } = await supabase
        .from('swap_requests')
        .update({
          status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .eq('institution_id', institutionId)
        .eq('program', program)
        .eq('academic_year', academic_year);

      if (updErr) throw updErr;

      // Rotation swap
      if (!swapType) {
        const requesterRot = schedule[requesterName]?.[blockNum - 1] ?? '';
        const targetRot = schedule[targetName]?.[blockNum - 1] ?? '';

        const blockDate = blockDates.find(b => Number(b.block_number) === blockNum);
        if (requesterId && targetId && blockDate) {
          const { error: upsertErr } = await supabase
            .from('schedule_assignments')
            .upsert(
              [
                { fellow_id: requesterId, block_date_id: blockDate.id, rotation: targetRot, created_by: user.id },
                { fellow_id: targetId, block_date_id: blockDate.id, rotation: requesterRot, created_by: user.id },
              ],
              { onConflict: 'fellow_id,block_date_id' }
            );

          if (upsertErr) console.error('Error swapping schedule_assignments:', upsertErr);

          if (setSchedule && requesterName && targetName) {
            setSchedule(prev => {
              const next = { ...prev };
              const idx = blockNum - 1;
              next[requesterName] = [...(next[requesterName] || [])];
              next[targetName] = [...(next[targetName] || [])];
              next[requesterName][idx] = targetRot;
              next[targetName][idx] = requesterRot;
              return next;
            });
          }
        }

        await fetchRequests();
        return;
      }

      // Call/float swap
      const pulled = await pullCallFloatFromSupabase({ institutionId });
      if (pulled.error) throw new Error(pulled.error);

      const dbCall = pulled.callSchedule || {};
      const dbFloat = pulled.nightFloatSchedule || {};

      const sched = swapType === 'call' ? dbCall : dbFloat;

      if (parsed.reqKey && parsed.tgtKey) {
        const reqEntry = sched[parsed.reqKey];
        const tgtEntry = sched[parsed.tgtKey];
        sched[parsed.reqKey] = { name: targetName, relaxed: getRelaxedFromAssignment(reqEntry) };
        sched[parsed.tgtKey] = { name: requesterName, relaxed: getRelaxedFromAssignment(tgtEntry) };
      } else {
        const key = `B${blockNum}-W${weekend}`;
        const curEntry = sched[key];
        const relaxed = getRelaxedFromAssignment(curEntry);
        const cur = getNameFromAssignment(curEntry);
        if (cur === requesterName) sched[key] = { name: targetName, relaxed };
        else if (cur === targetName) sched[key] = { name: requesterName, relaxed };
      }

      const pushRes = await pushCallFloatToSupabase({
        callSchedule: dbCall,
        nightFloatSchedule: dbFloat,
        institutionId,
        userId: user.id,
      });
      if (pushRes.error) console.error('Error pushing call/float after swap:', pushRes.error);

      if (setCallSchedule) setCallSchedule(dbCall);
      if (setNightFloatSchedule) setNightFloatSchedule(dbFloat);

      await fetchRequests();
    } catch (err) {
      console.error('Error approving swap:', err);
      setDbError(err.message || String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const denyDbSwap = async (requestId, reason = '') => {
    if (!userCanApprove) return;
    setSubmitting(true);
    try {
      const update = { status: 'denied' };
      if (reason) update.notes = reason;

      const { error } = await supabase
        .from('swap_requests')
        .update(update)
        .eq('id', requestId)
        .eq('institution_id', institutionId)
        .eq('program', program)
        .eq('academic_year', academic_year);

      if (error) throw error;

      setDenyingId(null);
      setDenyReason('');
      await fetchRequests();
    } catch (err) {
      console.error('Error denying swap:', err);
      setDbError(err.message || String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const cancelDbSwap = async (requestId) => {
    const req = dbSwapRequests.find(r => r.id === requestId);
    if (!req || req.requested_by !== user?.id) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('swap_requests')
        .update({ status: 'cancelled' })
        .eq('id', requestId)
        .eq('institution_id', institutionId)
        .eq('program', program)
        .eq('academic_year', academic_year);

      if (error) throw error;
      await fetchRequests();
    } catch (err) {
      console.error('Error cancelling swap:', err);
      setDbError(err.message || String(err));
    } finally {
      setSubmitting(false);
    }
  };

  // --- New time off request (weekly) ---
  const [newDbReq, setNewDbReq] = useState({ fellow_id: '', start_block_id: '', reason: 'Vacation' });

const submitDbRequest = async () => {
  if (!newDbReq.fellow_id || !newDbReq.start_block_id) return;

  setSubmitting(true);
  setDbError(null);

  try {
    // ---- required scope (DO NOT rely on outer closure vars) ----
    const institution_id = profile?.institution_id;
    const program =
      profile?.program ??
      profile?.institution?.program ??
      profile?.institution_program ??
      null;
    const academic_year =
      profile?.academic_year ??
      profile?.institution?.academic_year ??
      getAcademicYear();

    if (!institution_id) throw new Error('Missing institution_id on profile.');
    if (!program) throw new Error('Missing program context.');
    if (!academic_year) throw new Error('Missing academic_year context.');

    let startBlockDbId = newDbReq.start_block_id;

    // ---- ensure local-* block exists in block_dates ----
    if (typeof startBlockDbId === 'string' && startBlockDbId.startsWith('local-')) {
      const localKey = startBlockDbId.replace('local-', ''); // e.g. "3-1"
      const [parentStr, partStr] = String(localKey).split('-');
      const parentNum = Number(parentStr);
      const partNum = Number(partStr || 1);

      if (!parentNum || (partNum !== 1 && partNum !== 2)) {
        throw new Error('Invalid local block key');
      }

      const source = (localBlockDates && localBlockDates.length) ? splitLocalWeeks : weeklyBlocks;
      const match = source.find(
        b => String(b.block) === `${parentNum}-${partNum}` || b.block === `${parentNum}-${partNum}`
      );
      if (!match) throw new Error('Selected local block not found');

      // weekly numbering
      const weeklyNum = (parentNum - 1) * 2 + partNum;

      // rotation_number best-effort
      let rotation_number = 0;
      try {
        if (localBlockDates?.length) {
          const parentObj = localBlockDates.find(b => Number(b.block) === parentNum);
          rotation_number = parentObj?.rotation ?? 0;
        }
      } catch (_) {}

      const toUpsert = {
        institution_id,
        program,
        academic_year,
        block_number: weeklyNum,
        start_date: match.start,
        end_date: match.end,
        rotation_number,
      };

      // 1) upsert
      const up = await supabase
        .from('block_dates')
        .upsert([toUpsert], { onConflict: 'institution_id,program,academic_year,block_number' })
        .select('id');

      if (up.error) throw up.error;

      // 2) grab id from upsert response or fallback lookup
      let ensuredId = up.data?.[0]?.id ?? null;
      if (!ensuredId) {
        const find = await supabase
          .from('block_dates')
          .select('id')
          .eq('institution_id', institution_id)
          .eq('program', program)
          .eq('academic_year', academic_year)
          .eq('block_number', weeklyNum)
          .limit(1);

        if (find.error) throw find.error;
        ensuredId = find.data?.[0]?.id ?? null;
      }

      if (!ensuredId) throw new Error('Could not ensure block_dates row exists');
      startBlockDbId = ensuredId;
    }

    // ---- insert vacation request ----
    const ins = await supabase
      .from('vacation_requests')
      .insert({
        fellow_id: newDbReq.fellow_id,
        start_block_id: startBlockDbId,
        end_block_id: startBlockDbId,
        reason: newDbReq.reason,
        status: 'pending',
        requested_by: user.id,

        // include scope if your table requires it
        institution_id,
        program,
        academic_year,
      });

    if (ins.error) throw ins.error;

    setNewDbReq({ fellow_id: '', start_block_id: '', reason: 'Vacation' });
    await fetchRequests();
  } catch (err) {
    console.error('Error submitting request:', err);
    setDbError(err.message || String(err));
  } finally {
    setSubmitting(false);
  }
};

  // --- New day-off request (date) ---
  const [newDayOff, setNewDayOff] = useState({ fellow_id: '', date: '', reason_type: 'Sick Day' });

  const approveDayOff = async (requestId) => {
    if (!userCanApprove) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('vacation_requests')
        .update({ status: 'approved', approved_by: user.id, approved_at: new Date().toISOString() })
        .eq('id', requestId)
        .eq('institution_id', institutionId)
        .eq('program', program)
        .eq('academic_year', academic_year);

      if (error) throw error;
      await fetchRequests();
    } catch (err) {
      setDbError(err.message || String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const denyDayOff = async (requestId) => {
    if (!userCanApprove) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('vacation_requests')
        .update({ status: 'denied' })
        .eq('id', requestId)
        .eq('institution_id', institutionId)
        .eq('program', program)
        .eq('academic_year', academic_year);

      if (error) throw error;
      await fetchRequests();
    } catch (err) {
      setDbError(err.message || String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const submitDayOff = async () => {
    if (!newDayOff.fellow_id || !newDayOff.date) return;
    setSubmitting(true);
    setDbError(null);

    try {
      const selectedDate = new Date(newDayOff.date + 'T00:00:00');
      let blockDateId = null;

      const matchingBlock = blockDates.find(b => {
        const start = new Date(b.start_date + 'T00:00:00');
        const end = new Date(b.end_date + 'T00:00:00');
        return selectedDate >= start && selectedDate <= end;
      });

      if (matchingBlock) blockDateId = matchingBlock.id;

      if (!blockDateId) throw new Error('No schedule week found for the selected date. Check block_dates seeding.');

      const { error } = await supabase
        .from('vacation_requests')
        .insert({
          fellow_id: newDayOff.fellow_id,
          start_block_id: blockDateId,
          end_block_id: blockDateId,
          reason: newDayOff.reason_type,
          notes: newDayOff.date,
          status: 'pending',
          requested_by: user.id,
          institution_id: institutionId,
          program,
          academic_year,
        });

      if (error) throw error;

      setNewDayOff({ fellow_id: '', date: '', reason_type: 'Sick Day' });
      await fetchRequests();
    } catch (err) {
      setDbError(err.message || String(err));
    } finally {
      setSubmitting(false);
    }
  };

  // --- New swap request (smart shift picker) ---
  const [newDbSwap, setNewDbSwap] = useState(SWAP_RESET);
  const [newDbSwapError, setNewDbSwapError] = useState(null);

  // Shift date label for a B{block}-W{wknd} slot
  const getShiftDateLabel = useCallback((blockNum, weekend) => {
    const weeklyNum = (blockNum - 1) * 2 + weekend;
    const entry = blockDates.find(b => Number(b.block_number) === Number(weeklyNum));
    if (entry?.start_date) {
      const fmt = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `${fmt(entry.start_date)} - ${fmt(entry.end_date)}`;
    }
    const source = localBlockDates?.length ? splitLocalWeeks : weeklyBlocks;
    const match = source.find(b => String(b.block) === `${blockNum}-${weekend}`);
    if (match) return `${formatPretty(match.start)} - ${formatPretty(match.end)}`;
    return `Block ${blockNum}, Wk ${weekend}`;
  }, [blockDates, splitLocalWeeks, weeklyBlocks]);

  const myShifts = useMemo(() => {
    const name = dbFellows.find(f => f.id === newDbSwap.requester_id)?.name;
    if (!name) return [];
    const shifts = [];
    ['call', 'float'].forEach(type => {
      const sched = type === 'call' ? callSchedule : nightFloatSchedule;
      Object.entries(sched || {}).forEach(([key, val]) => {
        if (getNameFromAssignment(val) !== name) return;
        const m = key.match(/^B(\d+)-W([12])$/);
        if (!m) return;
        shifts.push({ type, blockNum: Number(m[1]), weekend: Number(m[2]), key });
      });
    });
    return shifts.sort((a, b) => a.blockNum - b.blockNum || a.weekend - b.weekend);
  }, [newDbSwap.requester_id, dbFellows, callSchedule, nightFloatSchedule]);

  const validSwapTargets = useMemo(() => {
    if (!newDbSwap.my_shift_key) return [];
    const [swapType, myBKey] = newDbSwap.my_shift_key.split('|');
    const myM = myBKey?.match(/^B(\d+)-W([12])$/);
    const myBlockNum = myM ? Number(myM[1]) : null;
    const myWeekend = myM ? Number(myM[2]) : null;
    const myWeeklyNum = (myBlockNum && myWeekend) ? (myBlockNum - 1) * 2 + myWeekend : null;

    const requesterName = dbFellows.find(f => f.id === newDbSwap.requester_id)?.name;

    const isOnVacation = (fellowId, weeklyNum) => {
      if (!weeklyNum) return false;
      return dbRequests.some(r =>
        r.fellow?.id === fellowId &&
        r.status !== 'denied' && r.status !== 'cancelled' &&
        !DAY_OFF_REASONS.includes(r.reason) &&
        (Number(r.start_block?.block_number ?? 0) <= Number(weeklyNum)) &&
        (Number((r.end_block ?? r.start_block)?.block_number ?? 0) >= Number(weeklyNum))
      );
    };

    const isAwayRotation = (name, blockNum) =>
      ['Vacation', 'Away', 'Research'].includes(schedule?.[name]?.[blockNum - 1]);

    const candidatesMap = {};
    const sched = swapType === 'call' ? callSchedule : nightFloatSchedule;

    Object.entries(sched || {}).forEach(([key, val]) => {
      const name = getNameFromAssignment(val);
      if (!name || name === requesterName) return;

      const m = key.match(/^B(\d+)-W([12])$/);
      if (!m) return;

      const fellow = dbFellows.find(f => f.name === name);
      if (!fellow || fellow.id === newDbSwap.requester_id) return;

      const tgtBlockNum = Number(m[1]);
      const tgtWeekend = Number(m[2]);
      const tgtWeeklyNum = (tgtBlockNum - 1) * 2 + tgtWeekend;

      // Basic availability filter
      if (myWeeklyNum && isOnVacation(newDbSwap.requester_id, tgtWeeklyNum)) return;
      if (myBlockNum && requesterName && isAwayRotation(requesterName, tgtBlockNum)) return;
      if (isOnVacation(fellow.id, myWeeklyNum)) return;
      if (myBlockNum && isAwayRotation(name, myBlockNum)) return;

      if (!candidatesMap[fellow.id]) candidatesMap[fellow.id] = { fellow, shifts: [] };
      candidatesMap[fellow.id].shifts.push({ type: swapType, blockNum: tgtBlockNum, weekend: tgtWeekend, key });
    });

    return Object.values(candidatesMap).sort((a, b) => a.fellow.name.localeCompare(b.fellow.name));
  }, [newDbSwap.my_shift_key, newDbSwap.requester_id, dbFellows, callSchedule, nightFloatSchedule, dbRequests, schedule]);

  const submitDbSwap = async () => {
    setDbError(null);
    setNewDbSwapError(null);

    const { requester_id, my_shift_key, target_shift_key, reason } = newDbSwap;
    if (!requester_id || !my_shift_key || !target_shift_key) {
      setNewDbSwapError('Select your shift and a swap partner.');
      return;
    }

    const [myType, myBKey] = my_shift_key.split('|');
    const myM = myBKey?.match(/^B(\d+)-W([12])$/);
    if (!myM) { setNewDbSwapError('Invalid shift selection.'); return; }
    const myBlockNum = Number(myM[1]);
    const myWeekend = Number(myM[2]);

    const tgtParts = target_shift_key.split('|');
    const tgtFellowId = tgtParts[0];
    const tgtBKey = tgtParts[2];
    const tgtM = tgtBKey?.match(/^B(\d+)-W([12])$/);
    if (!tgtM) { setNewDbSwapError('Invalid target shift selection.'); return; }
    const tgtBlockNum = Number(tgtM[1]);
    const tgtWeekend = Number(tgtM[2]);

    const requesterFellow = dbFellows.find(f => f.id === requester_id);
    const targetFellow = dbFellows.find(f => f.id === tgtFellowId);
    if (!requesterFellow || !targetFellow) { setNewDbSwapError('Fellow lookup failed.'); return; }
    if (requester_id === tgtFellowId) { setDbError('Cannot swap with yourself.'); return; }

    setSubmitting(true);
    try {
      const pulled = await pullCallFloatFromSupabase({ institutionId });
      if (pulled.error) throw new Error(pulled.error);

      const dbCall = { ...(pulled.callSchedule || {}) };
      const dbFloat = { ...(pulled.nightFloatSchedule || {}) };

      // Simulate bilateral swap for violation check
      const tempCall = { ...dbCall };
      const tempFloat = { ...dbFloat };
      const sched = myType === 'call' ? tempCall : tempFloat;
      sched[myBKey] = { name: targetFellow.name };
      sched[tgtBKey] = { name: requesterFellow.name };

      const violations = checkAllWorkHourViolations({
        fellows,
        schedule,
        callSchedule: tempCall,
        nightFloatSchedule: tempFloat,
        blockDates: blockDates.length
          ? blockDates.map(b => ({ block: b.block_number, start: b.start_date, end: b.end_date, rotation: b.rotation_number ?? b.block_number }))
          : localBlockDates,
        vacations,
      });

      const reasonText = `${myType}|req:${myBKey}|tgt:${tgtBKey}|${reason || ''}`;
      const hasViolations = violations && violations.length > 0;
      const status = hasViolations ? 'denied' : 'pending';

      const violationNotes = hasViolations
        ? violations.slice(0, 5).map(v => `${v.ruleLabel || v.rule}: ${v.fellow} - ${v.detail || ''}`).join('\n')
        : null;

      const { error: insErr } = await supabase
        .from('swap_requests')
        .insert({
          requester_fellow_id: requester_id,
          target_fellow_id: tgtFellowId,
          block_number: myBlockNum,
          reason: reasonText,
          status,
          notes: violationNotes,
          requested_by: user.id,
          institution_id: institutionId,
          program,
          academic_year,
        });

      if (insErr) throw insErr;

      if (hasViolations) {
        setDbError(`Swap rejected: ${violations.length} work-hour violation${violations.length > 1 ? 's' : ''}. See Denied for details.`);
      }

      setNewDbSwap(SWAP_RESET);
      await fetchRequests();
    } catch (err) {
      console.error('Error submitting swap:', err);
      setDbError(err.message || String(err));
    } finally {
      setSubmitting(false);
    }
  };

  // --- Helper: get call/float/clinic info for a fellow at a block ---
  const getBlockDetails = useCallback((fellowName, blockNum) => {
    const details = [];
    const rotation = schedule[fellowName]?.[blockNum - 1] || '—';
    details.push({ label: 'Rotation', value: rotation });

    const clinicDay = clinicDays[fellowName];
    if (clinicDay !== undefined) details.push({ label: 'Clinic', value: DAY_NAMES[clinicDay] });

    const w1Key = `B${blockNum}-W1`;
    const w2Key = `B${blockNum}-W2`;

    const calls = [];
    if (getNameFromAssignment(callSchedule[w1Key]) === fellowName) calls.push('W1');
    if (getNameFromAssignment(callSchedule[w2Key]) === fellowName) calls.push('W2');
    if (calls.length) details.push({ label: 'Call', value: calls.join(', ') });

    const floats = [];
    if (getNameFromAssignment(nightFloatSchedule[w1Key]) === fellowName) floats.push('W1');
    if (getNameFromAssignment(nightFloatSchedule[w2Key]) === fellowName) floats.push('W2');
    if (floats.length) details.push({ label: 'Float', value: floats.join(', ') });

    return details;
  }, [schedule, callSchedule, nightFloatSchedule, clinicDays]);

  const SwapPreview = ({ requester, target, block }) => {
    if (!requester || !target || requester === target) return null;
    const reqDetails = getBlockDetails(requester, block);
    const tgtDetails = getBlockDetails(target, block);

    return (
      <div className="mt-2 p-2 rounded border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 text-xs">
        <div className="font-semibold mb-1 dark:text-blue-200">Swap Preview, Block {block}</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="font-medium dark:text-gray-200">{requester}</div>
            {reqDetails.map(d => (
              <div key={d.label} className="text-gray-600 dark:text-gray-400 text-xs">
                {d.label}: <span className="font-medium dark:text-gray-200">{d.value}</span>
              </div>
            ))}
          </div>
          <div>
            <div className="font-medium dark:text-gray-200">{target}</div>
            {tgtDetails.map(d => (
              <div key={d.label} className="text-gray-600 dark:text-gray-400 text-xs">
                {d.label}: <span className="font-medium dark:text-gray-200">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ======= Supabase UI =======
  if (useDatabase) {
    const linkedFellows = dbFellows.filter(f => f.user_id === user?.id);
    const linkedFellowIds = new Set(linkedFellows.map(f => f.id));

    const isVisibleRequest = (r) =>
      userCanApprove ||
      r.requested_by === user?.id ||
      linkedFellowIds.has(r.fellow?.id);

    const isVisibleSwap = (r) =>
      userCanApprove ||
      r.requested_by === user?.id ||
      linkedFellowIds.has(r.requester?.id) ||
      linkedFellowIds.has(r.target?.id);

    const vacationDbRequests = dbRequests.filter(r => !DAY_OFF_REASONS.includes(r.reason) && isVisibleRequest(r));
    const dayOffDbRequests = dbRequests.filter(r => DAY_OFF_REASONS.includes(r.reason) && isVisibleRequest(r));

    const pendingRequests = vacationDbRequests.filter(r => r.status === 'pending');
    const approvedRequests = vacationDbRequests.filter(r => r.status === 'approved');
    const deniedRequests = vacationDbRequests.filter(r => r.status === 'denied');

    const pendingDayOffs = dayOffDbRequests.filter(r => r.status === 'pending');
    const approvedDayOffs = dayOffDbRequests.filter(r => r.status === 'approved');
    const deniedDayOffs = dayOffDbRequests.filter(r => r.status === 'denied');

    const visibleSwaps = dbSwapRequests.filter(isVisibleSwap);
    const pendingSwaps = visibleSwaps.filter(r => r.status === 'pending');
    const approvedSwaps = visibleSwaps.filter(r => r.status === 'approved');
    const deniedSwaps = visibleSwaps.filter(r => r.status === 'denied');

    const selectableFellows = userCanApprove ? dbFellows : (linkedFellows.length ? linkedFellows : dbFellows);

    const formatBlockRange = (req) => {
      const startDate = req.start_block?.start_date;
      const endDate = (req.end_block ?? req.start_block)?.end_date;
      if (startDate && endDate && startDate !== endDate) return `${fmtDate(startDate)} - ${fmtDate(endDate)}`;
      if (startDate) return fmtDate(startDate);
      const start = req.start_block?.block_number ?? '?';
      const end = req.end_block?.block_number ?? '?';
      return start === end ? `Week ${start}` : `Weeks ${start}-${end}`;
    };

    const fmtSwapBlock = (blockNum, weekend) => {
      if (!blockNum) return '—';
      if (weekend) {
        const weeklyNum = (blockNum - 1) * 2 + weekend;
        const entry = blockDates.find(b => Number(b.block_number) === Number(weeklyNum));
        if (entry?.start_date) {
          return entry.start_date !== entry.end_date
            ? `${fmtDate(entry.start_date)} - ${fmtDate(entry.end_date)}`
            : fmtDate(entry.start_date);
        }
      }
      const w1 = blockDates.find(b => Number(b.block_number) === (blockNum - 1) * 2 + 1);
      const w2 = blockDates.find(b => Number(b.block_number) === blockNum * 2);
      if (w1?.start_date && w2?.end_date) return `${fmtDate(w1.start_date)} - ${fmtDate(w2.end_date)}`;
      if (w1?.start_date) return fmtDate(w1.start_date);
      return `Block ${blockNum}${weekend ? `, Wk ${weekend}` : ''}`;
    };

    const getRequestExtras = (req) => {
      const bnum = Number(req.start_block?.block_number || 0);
      if (!bnum) return {};
      const parent = Math.ceil(bnum / 2);
      const part = (bnum % 2 === 1) ? 1 : 2;

      let rotationNumber = null;
      let rotationName = null;

      try {
        const fellowName = req.fellow?.name;
        if (fellowName && schedule && schedule[fellowName]) rotationName = schedule[fellowName][parent - 1] || null;
        const localParent = (localBlockDates || []).find(b => Number(b.block) === parent);
        rotationNumber = localParent?.rotation ?? req.start_block?.rotation_number ?? null;
        if (!rotationName && rotationNumber) rotationName = allRotationTypes?.[rotationNumber] || null;
      } catch (e) {}

      let start = req.start_block?.start_date;
      let end = req.start_block?.end_date;

      if (!start || !end) {
        const source = (localBlockDates && localBlockDates.length) ? splitLocalWeeks : weeklyBlocks;
        const match = source.find(b => String(b.block) === `${parent}-${part}` || b.block === `${parent}-${part}`);
        if (match) { start = match.start; end = match.end; }
      }

      const key = `B${parent}-W${part}`;
      const callAssigned = getNameFromAssignment(callSchedule?.[key]) || '—';
      const floatAssigned = getNameFromAssignment(nightFloatSchedule?.[key]) || '—';

      return { parent, part, rotationNumber, rotationName, start, end, callAssigned, floatAssigned };
    };

    return (
      <div className="space-y-3">
        <h3 className="text-lg font-bold">Requests</h3>

        <SubViewTabs />

        {dbError && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded p-3 text-sm text-red-700 dark:text-red-300">
            {dbError}
          </div>
        )}

        {loadingDb ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span className="ml-2 text-sm text-gray-500">Loading requests...</span>
          </div>
        ) : subView === 'timeoff' ? (
          <>
            {/* Pending Requests */}
            <div className="bg-white dark:bg-gray-700 rounded border dark:border-gray-600 p-3">
              <div className="mb-2 font-semibold dark:text-gray-100">
                Pending Requests ({pendingRequests.length})
              </div>
              {pendingRequests.length === 0 && (
                <div className="text-xs text-gray-500 dark:text-gray-400">No pending requests</div>
              )}
              <div className="space-y-2">
                {pendingRequests.map((r) => (
                  <div key={r.id} className="flex items-center justify-between border dark:border-gray-600 dark:bg-gray-800 p-2 rounded">
                    <div className="text-sm">
                      <div className="font-semibold dark:text-gray-100">
                        {r.fellow?.name ?? 'Unknown Fellow'}
                        <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                          PGY-{r.fellow?.pgy_level}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        {formatBlockRange(r)} - {r.reason}
                      </div>
                      {(() => {
                        const ex = getRequestExtras(r);
                        const rotLabel =
                          ex.rotationName ||
                          (ex.rotationNumber ? (allRotationTypes?.[ex.rotationNumber] || String(ex.rotationNumber)) : '—');

                        const dateLine = ex.start
                          ? `${new Date(ex.start + 'T00:00:00').toLocaleDateString()} - ${new Date(ex.end + 'T00:00:00').toLocaleDateString()}`
                          : '—';

                        return (
                          <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                            <div>Rotation: {rotLabel}</div>
                            <div>Week: {ex.part ? (ex.part === 1 ? '1st week' : '2nd week') : '—'}</div>
                            <div>Dates: {dateLine}</div>
                            <div>Call: {ex.callAssigned}</div>
                            <div>Float: {ex.floatAssigned}</div>
                            <div className="mt-1">Submitted {r.created_at ? new Date(r.created_at).toLocaleString() : '—'}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Submitted by: {r.requested_by_profile?.username ?? r.requested_by_profile?.email ?? '—'}
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    <div className="flex items-center gap-2">
                      {userCanApprove && (
                        <>
                          <button
                            onClick={() => approveDbRequest(r.id)}
                            disabled={submitting}
                            className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded text-xs flex items-center gap-1"
                          >
                            <CheckCircle className="w-3 h-3" /> Approve
                          </button>

                          {denyingId === r.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                className="p-1 border rounded text-xs w-44 dark:bg-gray-700 dark:border-gray-500 dark:text-gray-100"
                                placeholder="Denial reason..."
                                value={denyReason}
                                onChange={e => setDenyReason(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') denyDbRequest(r.id, denyReason);
                                  if (e.key === 'Escape') { setDenyingId(null); setDenyReason(''); }
                                }}
                                autoFocus
                              />
                              <button
                                onClick={() => denyDbRequest(r.id, denyReason)}
                                disabled={submitting}
                                className="px-2 py-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded text-xs"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => { setDenyingId(null); setDenyReason(''); }}
                                className="px-2 py-1 bg-gray-400 hover:bg-gray-500 text-white rounded text-xs"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setDenyingId(r.id); setDenyReason(''); }}
                              disabled={submitting}
                              className="px-3 py-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded text-xs flex items-center gap-1"
                            >
                              <AlertTriangle className="w-3 h-3" /> Deny
                            </button>
                          )}
                        </>
                      )}

                      {r.requested_by === user?.id && (
                        <button
                          onClick={() => cancelDbRequest(r.id)}
                          disabled={submitting}
                          className="px-3 py-1 bg-gray-500 hover:bg-gray-600 disabled:opacity-50 text-white rounded text-xs flex items-center gap-1"
                        >
                          <X className="w-3 h-3" /> Cancel
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Approved Vacations */}
            <div className="bg-white dark:bg-gray-700 rounded border dark:border-gray-600 p-3">
              <div className="mb-2 font-semibold dark:text-gray-100">Approved Vacations ({approvedRequests.length})</div>
              {approvedRequests.length === 0 && <div className="text-xs text-gray-500 dark:text-gray-400">No approved vacations</div>}
              <div className="space-y-2">
                {approvedRequests.map((r) => (
                  <div key={r.id} className="flex items-center justify-between border border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900 p-2 rounded">
                    <div className="text-sm">
                      <div className="font-semibold dark:text-green-100">
                        {r.fellow?.name ?? 'Unknown Fellow'}
                        <span className="ml-2 text-xs font-normal text-green-600 dark:text-green-300">PGY-{r.fellow?.pgy_level}</span>
                      </div>
                      <div className="text-xs text-gray-600 dark:text-green-200">{formatBlockRange(r)} - {r.reason}</div>
                      {r.approved_at && <div className="text-xs text-gray-400 dark:text-green-300 mt-0.5">Approved {new Date(r.approved_at).toLocaleDateString()}</div>}
                    </div>
                    <div className="px-3 py-1 bg-green-600 text-white rounded text-xs">Approved</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Denied Requests */}
            {deniedRequests.length > 0 && (
              <div className="bg-white dark:bg-gray-700 rounded border dark:border-gray-600 p-3">
                <div className="mb-2 font-semibold dark:text-gray-100">Denied Requests ({deniedRequests.length})</div>
                <div className="space-y-2">
                  {deniedRequests.map((r) => (
                    <div key={r.id} className="flex items-center justify-between border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/30 p-2 rounded">
                      <div className="text-sm">
                        <div className="font-semibold dark:text-red-100">{r.fellow?.name ?? 'Unknown Fellow'}</div>
                        <div className="text-xs text-gray-600 dark:text-red-200">{formatBlockRange(r)} - {r.reason}</div>
                        {r.notes && <div className="text-xs text-red-700 dark:text-red-300 mt-0.5">⚠ {r.notes}</div>}
                      </div>
                      <div className="px-3 py-1 bg-red-600 text-white rounded text-xs">Denied</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Create New Time Off Request */}
            {userCanRequest && (
              <div className="bg-white dark:bg-gray-700 rounded border dark:border-gray-600 p-3">
                <div className="mb-2 font-semibold dark:text-gray-100">Create New Time Off Request</div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <select
                    className="p-2 border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100"
                    value={newDbReq.fellow_id}
                    onChange={e => setNewDbReq({ ...newDbReq, fellow_id: e.target.value })}
                  >
                    <option value="">Select Fellow</option>
                    {selectableFellows.map(f => (
                      <option key={f.id} value={f.id}>{f.name} (PGY-{f.pgy_level})</option>
                    ))}
                  </select>

                  <select
                    className="p-2 border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100"
                    value={newDbReq.start_block_id}
                    onChange={e => setNewDbReq({ ...newDbReq, start_block_id: e.target.value })}
                  >
                    <option value="">Select Week</option>
                    {blockDates.map(b => (
                      <option key={b.id} value={b.id}>
                        {fmtDate(b.start_date)} - {fmtDate(b.end_date)} (Week {b.block_number})
                      </option>
                    ))}
                  </select>

                  <input
                    className="p-2 border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100"
                    placeholder="Reason"
                    value={newDbReq.reason}
                    onChange={e => setNewDbReq({ ...newDbReq, reason: e.target.value })}
                  />
                </div>

                <button
                  onClick={submitDbRequest}
                  disabled={submitting || !newDbReq.fellow_id || !newDbReq.start_block_id}
                  className="mt-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-xs"
                >
                  {submitting ? 'Submitting...' : 'Add Request'}
                </button>
              </div>
            )}
          </>
        ) : subView === 'dayoff' ? (
          <>
            {/* Pending Day Off Requests */}
            <div className="bg-white dark:bg-gray-700 rounded border dark:border-gray-600 p-3">
              <div className="mb-2 font-semibold dark:text-gray-100">Pending Day Off Requests ({pendingDayOffs.length})</div>
              {pendingDayOffs.length === 0 && <div className="text-xs text-gray-500 dark:text-gray-400">No pending day off requests</div>}
              <div className="space-y-2">
                {pendingDayOffs.map((r) => (
                  <div key={r.id} className="flex items-center justify-between border dark:border-gray-600 dark:bg-gray-800 p-2 rounded">
                    <div className="text-sm">
                      <div className="font-semibold dark:text-gray-100">
                        {r.fellow?.name ?? 'Unknown Fellow'}
                        <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">PGY-{r.fellow?.pgy_level}</span>
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        {r.reason}{r.notes ? ` - ${new Date(r.notes + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        Submitted {r.created_at ? new Date(r.created_at).toLocaleString() : '—'}
                        {(r.requested_by_profile?.username || r.requested_by_profile?.email)
                          ? ` by ${r.requested_by_profile.username || r.requested_by_profile.email}`
                          : ''}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {userCanApprove && (
                        <>
                          <button onClick={() => approveDayOff(r.id)} disabled={submitting} className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded text-xs flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Approve
                          </button>
                          <button onClick={() => denyDayOff(r.id)} disabled={submitting} className="px-3 py-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded text-xs flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Deny
                          </button>
                        </>
                      )}

                      {r.requested_by === user?.id && (
                        <button onClick={() => cancelDbRequest(r.id)} disabled={submitting} className="px-3 py-1 bg-gray-500 hover:bg-gray-600 disabled:opacity-50 text-white rounded text-xs flex items-center gap-1">
                          <X className="w-3 h-3" /> Cancel
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Approved Day Off Requests */}
            <div className="bg-white dark:bg-gray-700 rounded border dark:border-gray-600 p-3">
              <div className="mb-2 font-semibold dark:text-gray-100">Approved Day Off Requests ({approvedDayOffs.length})</div>
              {approvedDayOffs.length === 0 && <div className="text-xs text-gray-500 dark:text-gray-400">No approved day off requests</div>}
              <div className="space-y-2">
                {approvedDayOffs.map((r) => (
                  <div key={r.id} className="flex items-center justify-between border border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900 p-2 rounded">
                    <div className="text-sm">
                      <div className="font-semibold dark:text-green-100">
                        {r.fellow?.name ?? 'Unknown Fellow'}
                        <span className="ml-2 text-xs font-normal text-green-600 dark:text-green-300">PGY-{r.fellow?.pgy_level}</span>
                      </div>
                      <div className="text-xs text-gray-600 dark:text-green-200">
                        {r.reason}{r.notes ? ` - ${new Date(r.notes + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
                      </div>
                      {r.approved_at && <div className="text-xs text-gray-400 dark:text-green-300 mt-0.5">Approved {new Date(r.approved_at).toLocaleDateString()}</div>}
                    </div>
                    <div className="px-3 py-1 bg-green-600 text-white rounded text-xs">Approved</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Denied Day Off Requests */}
            {deniedDayOffs.length > 0 && (
              <div className="bg-white dark:bg-gray-700 rounded border dark:border-gray-600 p-3">
                <div className="mb-2 font-semibold dark:text-gray-100">Denied Day Off Requests ({deniedDayOffs.length})</div>
                <div className="space-y-2">
                  {deniedDayOffs.map((r) => (
                    <div key={r.id} className="flex items-center justify-between border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/30 p-2 rounded">
                      <div className="text-sm">
                        <div className="font-semibold dark:text-red-100">{r.fellow?.name ?? 'Unknown Fellow'}</div>
                        <div className="text-xs text-gray-600 dark:text-red-200">
                          {r.reason}{r.notes ? ` - ${new Date(r.notes + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
                        </div>
                      </div>
                      <div className="px-3 py-1 bg-red-600 text-white rounded text-xs">Denied</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Request a Day Off */}
            {userCanRequest && (
              <div className="bg-white dark:bg-gray-700 rounded border dark:border-gray-600 p-3">
                <div className="mb-2 font-semibold dark:text-gray-100">Request a Day Off</div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <select className="p-2 border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100" value={newDayOff.fellow_id} onChange={e => setNewDayOff({ ...newDayOff, fellow_id: e.target.value })}>
                    <option value="">Select Fellow</option>
                    {selectableFellows.map(f => <option key={f.id} value={f.id}>{f.name} (PGY-{f.pgy_level})</option>)}
                  </select>

                  <input type="date" className="p-2 border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100" value={newDayOff.date} onChange={e => setNewDayOff({ ...newDayOff, date: e.target.value })} />

                  <select className="p-2 border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100" value={newDayOff.reason_type} onChange={e => setNewDayOff({ ...newDayOff, reason_type: e.target.value })}>
                    <option value="Sick Day">Sick Day</option>
                    <option value="Personal Day">Personal Day</option>
                    <option value="Conference">Conference</option>
                    <option value="CME">CME</option>
                  </select>
                </div>

                <button onClick={submitDayOff} disabled={submitting || !newDayOff.fellow_id || !newDayOff.date} className="mt-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-xs">
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Pending Swaps */}
            <div className="bg-white dark:bg-gray-700 rounded border dark:border-gray-600 p-3">
              <div className="mb-2 font-semibold dark:text-gray-100">
                Pending Swaps ({pendingSwaps.length})
              </div>

              {pendingSwaps.length === 0 && (
                <div className="text-xs text-gray-500 dark:text-gray-400">No pending swap requests</div>
              )}

              <div className="space-y-2">
                {pendingSwaps.map((r) => {
                  const parsed = parseSwapReason(r.reason);
                  const label = parsed.swapType
                    ? `${parsed.swapType.toUpperCase()} W${parsed.weekend ?? 1}`
                    : 'Rotation swap';
                  const note = parsed.note ? ` - ${parsed.note}` : '';
                  return (
                    <div key={r.id} className="border dark:border-gray-600 dark:bg-gray-800 p-2 rounded">
                      <div className="flex items-center justify-between">
                        <div className="text-sm">
                          <div className="font-semibold dark:text-gray-100 flex items-center gap-1">
                            {r.requester?.name ?? '?'}
                            <ArrowLeftRight className="w-3 h-3 text-blue-500" />
                            {r.target?.name ?? '?'}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            {fmtSwapBlock(Number(r.block_number), parsed.weekend)} - {label}{note}
                          </div>
                          <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                            Submitted {r.created_at ? new Date(r.created_at).toLocaleString() : '—'}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {userCanApprove && (
                            <>
                              <button
                                onClick={() => approveDbSwap(r.id)}
                                disabled={submitting}
                                className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded text-xs flex items-center gap-1"
                              >
                                <CheckCircle className="w-3 h-3" /> Approve
                              </button>

                              {denyingId === r.id ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    className="p-1 border rounded text-xs w-44 dark:bg-gray-700 dark:border-gray-500 dark:text-gray-100"
                                    placeholder="Denial reason..."
                                    value={denyReason}
                                    onChange={e => setDenyReason(e.target.value)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') denyDbSwap(r.id, denyReason);
                                      if (e.key === 'Escape') { setDenyingId(null); setDenyReason(''); }
                                    }}
                                    autoFocus
                                  />
                                  <button onClick={() => denyDbSwap(r.id, denyReason)} disabled={submitting} className="px-2 py-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded text-xs">Confirm</button>
                                  <button onClick={() => { setDenyingId(null); setDenyReason(''); }} className="px-2 py-1 bg-gray-400 hover:bg-gray-500 text-white rounded text-xs">Cancel</button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => { setDenyingId(r.id); setDenyReason(''); }}
                                  disabled={submitting}
                                  className="px-3 py-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded text-xs flex items-center gap-1"
                                >
                                  <AlertTriangle className="w-3 h-3" /> Deny
                                </button>
                              )}
                            </>
                          )}

                          {r.requested_by === user?.id && (
                            <button
                              onClick={() => cancelDbSwap(r.id)}
                              disabled={submitting}
                              className="px-3 py-1 bg-gray-500 hover:bg-gray-600 disabled:opacity-50 text-white rounded text-xs flex items-center gap-1"
                            >
                              <X className="w-3 h-3" /> Cancel
                            </button>
                          )}
                        </div>
                      </div>

                      {r.requester?.name && r.target?.name && (
                        <SwapPreview requester={r.requester.name} target={r.target.name} block={Number(r.block_number)} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Approved Swaps */}
            <div className="bg-white dark:bg-gray-700 rounded border dark:border-gray-600 p-3">
              <div className="mb-2 font-semibold dark:text-gray-100">Approved Swaps ({approvedSwaps.length})</div>
              {approvedSwaps.length === 0 && <div className="text-xs text-gray-500 dark:text-gray-400">No approved swaps</div>}
              <div className="space-y-2">
                {approvedSwaps.map((r) => {
                  const parsed = parseSwapReason(r.reason);
                  const label = parsed.swapType ? `${parsed.swapType === 'call' ? 'Call' : 'Float'} W${parsed.weekend ?? 1}` : 'Rotation swap';
                  return (
                    <div key={r.id} className="flex items-center justify-between border border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900 p-2 rounded">
                      <div className="text-sm">
                        <div className="font-semibold dark:text-green-100 flex items-center gap-1">
                          {r.requester?.name ?? '?'} <ArrowLeftRight className="w-3 h-3 text-green-500" /> {r.target?.name ?? '?'}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-green-200">{fmtSwapBlock(Number(r.block_number), parsed.weekend)} - {label}{parsed.note ? ` - ${parsed.note}` : ''}</div>
                        {r.approved_at && <div className="text-xs text-gray-400 dark:text-green-300 mt-0.5">Approved {new Date(r.approved_at).toLocaleDateString()}</div>}
                      </div>
                      <div className="px-3 py-1 bg-green-600 text-white rounded text-xs">Approved</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Denied Swaps */}
            {deniedSwaps.filter(r => !dismissedSwapIds.has(r.id)).length > 0 && (
              <div className="bg-white dark:bg-gray-700 rounded border dark:border-gray-600 p-3">
                <div className="mb-2 font-semibold dark:text-gray-100 text-red-700 dark:text-red-400">
                  Denied Swaps ({deniedSwaps.filter(r => !dismissedSwapIds.has(r.id)).length})
                </div>
                <div className="space-y-2">
                  {deniedSwaps.filter(r => !dismissedSwapIds.has(r.id)).map((r) => {
                    const parsed = parseSwapReason(r.reason);
                    const label = parsed.swapType ? `${parsed.swapType === 'call' ? 'Call' : 'Float'} W${parsed.weekend ?? 1}` : 'Rotation swap';
                    const violationLines = r.notes ? String(r.notes).split('\n').filter(Boolean) : [];
                    return (
                      <div key={r.id} className="border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-2 rounded text-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="font-medium dark:text-gray-100">{r.requester?.name ?? '?'}</span>
                              <ArrowLeftRight className="w-3 h-3 text-red-400 shrink-0" />
                              <span className="font-medium dark:text-gray-100">{r.target?.name ?? '?'}</span>
                              <span className="ml-1 text-xs text-red-600 dark:text-red-400 font-medium">Denied</span>
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {fmtSwapBlock(Number(r.block_number), parsed.weekend)} - {label}{parsed.note ? ` - ${parsed.note}` : ''}
                            </div>
                            {violationLines.length > 0 && (
                              <div className="mt-1 space-y-0.5">
                                {violationLines.map((line, i) => (
                                  <div key={i} className="text-xs text-red-700 dark:text-red-300 leading-tight">
                                    ⚠ {line}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => dismissSwap(r.id)}
                            className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5 rounded"
                            title="Hide from view"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Request Schedule Swap */}
            {userCanRequest && (
              <div className="bg-white dark:bg-gray-700 rounded border dark:border-gray-600 p-3">
                <div className="mb-2 font-semibold dark:text-gray-100">Request Schedule Swap</div>

                <div className="space-y-2">
                  <select
                    className="w-full p-2 border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100"
                    value={newDbSwap.requester_id}
                    onChange={e => setNewDbSwap({ ...SWAP_RESET, requester_id: e.target.value })}
                  >
                    <option value="">Select your fellow</option>
                    {selectableFellows.map(f => (
                      <option key={f.id} value={f.id}>{f.name} (PGY-{f.pgy_level})</option>
                    ))}
                  </select>

                  <select
                    className="w-full p-2 border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100 disabled:opacity-50"
                    value={newDbSwap.my_shift_key}
                    onChange={e => setNewDbSwap(prev => ({ ...prev, my_shift_key: e.target.value, target_shift_key: '' }))}
                    disabled={!newDbSwap.requester_id}
                  >
                    <option value="">
                      {!newDbSwap.requester_id
                        ? 'First select your fellow above'
                        : myShifts.length === 0
                        ? 'No assigned call/float shifts found'
                        : 'Choose your shift to swap away'}
                    </option>
                    {myShifts.map(s => (
                      <option key={`${s.type}|${s.key}`} value={`${s.type}|${s.key}`}>
                        {s.type === 'call' ? 'Call' : 'Night Float'} - {getShiftDateLabel(s.blockNum, s.weekend)}
                      </option>
                    ))}
                  </select>

                  <select
                    className="w-full p-2 border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100 disabled:opacity-50"
                    value={newDbSwap.target_shift_key}
                    onChange={e => setNewDbSwap(prev => ({ ...prev, target_shift_key: e.target.value }))}
                    disabled={!newDbSwap.my_shift_key}
                  >
                    <option value="">
                      {!newDbSwap.my_shift_key
                        ? 'First pick your shift above'
                        : validSwapTargets.length === 0
                        ? 'No eligible swap partners for this shift'
                        : 'Who takes your shift (you take one of theirs)'}
                    </option>
                    {validSwapTargets.map(({ fellow, shifts }) => (
                      <optgroup key={fellow.id} label={`${fellow.name} (PGY-${fellow.pgy_level})`}>
                        {shifts.map(s => (
                          <option key={`${fellow.id}|${s.type}|${s.key}`} value={`${fellow.id}|${s.type}|${s.key}`}>
                            Their {s.type === 'call' ? 'Call' : 'Float'}: {getShiftDateLabel(s.blockNum, s.weekend)}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>

                  <input
                    className="w-full p-2 border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100"
                    placeholder="Reason (optional)"
                    value={newDbSwap.reason}
                    onChange={e => setNewDbSwap(prev => ({ ...prev, reason: e.target.value }))}
                  />
                </div>

                {newDbSwapError && <div className="text-xs text-red-600 dark:text-red-400 mt-1">{newDbSwapError}</div>}

                <button
                  onClick={submitDbSwap}
                  disabled={submitting || !newDbSwap.requester_id || !newDbSwap.my_shift_key || !newDbSwap.target_shift_key}
                  className="mt-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-xs"
                >
                  {submitting ? 'Submitting...' : 'Request Swap'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // ======= Local-only fallback UI =======
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-bold">Requests</h3>
      <SubViewTabs />
      <div className="bg-white dark:bg-gray-700 rounded border dark:border-gray-600 p-3 text-xs text-gray-500 dark:text-gray-400">
        Local-only fallback mode.
      </div>
    </div>
  );
}