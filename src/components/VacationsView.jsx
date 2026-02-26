import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CheckCircle, AlertTriangle, Loader2, ArrowLeftRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { pullCallFloatFromSupabase, pushCallFloatToSupabase } from '../utils/scheduleSupabaseSync';
import { checkAllWorkHourViolations } from '../engine/workHourChecker';
import { blockDates as localBlockDates, allRotationTypes } from '../data/scheduleData';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
  const { profile, user, canApprove, canRequest, isProgramDirector, isChiefFellow, isAdmin } = useAuth();

  // Sub-view toggle: 'timeoff' or 'swaps'
  const [subView, setSubView] = useState('timeoff');

  // Supabase-backed state
  const [dbRequests, setDbRequests] = useState([]);
  const [dbSwapRequests, setDbSwapRequests] = useState([]);
  const [dbFellows, setDbFellows] = useState([]);
  // Start in loading state when Supabase is ready so the empty-state doesn't flash before the spinner
  const [loadingDb, setLoadingDb] = useState(!!(isSupabaseConfigured && user && profile));
  const [dbError, setDbError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [blockDates, setBlockDates] = useState([]);

  const useDatabase = isSupabaseConfigured && user && profile;

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

  // Fetch vacation requests and fellows from Supabase
  const fetchRequests = useCallback(async () => {
    if (!useDatabase) return;

    setLoadingDb(true);
    setDbError(null);

    try {
      // Fetch fellows for this institution
      let { data: fellowsData, error: fellowsErr } = await supabase
        .from('fellows')
        .select('id, name, pgy_level, program, user_id')
        .eq('institution_id', profile.institution_id)
        .eq('is_active', true)
        .order('name');

      if (fellowsErr) throw fellowsErr;

      // Auto-seed fellows from local data if the table is empty
      if (!fellowsData?.length && canApprove?.()) {
        const toInsert = fellows.map(name => ({
          name,
          // satisfy DB NOT NULL `program` column when auto-seeding
          program: '',
          pgy_level: pgyLevels[name] ?? null,
          institution_id: profile.institution_id,
          is_active: true,
        }));
        const { data: seeded, error: seedErr } = await supabase
          .from('fellows')
          .insert(toInsert)
          .select('id, name, pgy_level, program, user_id');
        if (seedErr) throw new Error(`Could not auto-populate fellows list: ${seedErr.message}`);
        if (seeded?.length) fellowsData = seeded;
      }

      setDbFellows(fellowsData || []);

      // Fetch block dates for dropdowns
      let { data: blockDatesData, error: blockDatesErr } = await supabase
        .from('block_dates')
        .select('id, block_number, start_date, end_date')
        .eq('institution_id', profile.institution_id)
        .order('block_number');

      if (blockDatesErr) throw blockDatesErr;

      // Auto-seed block_dates from local scheduleData if the table is empty
      if (!blockDatesData?.length && canApprove?.()) {
        const toInsert = localBlockDates.map(b => ({
          block_number: b.block,
          start_date: b.start,
          end_date: b.end,
          institution_id: profile.institution_id,
        }));
        const { data: seeded, error: seedErr } = await supabase
          .from('block_dates')
          .insert(toInsert)
          .select('id, block_number, start_date, end_date');
        if (!seedErr && seeded?.length) blockDatesData = seeded;
      }

      setBlockDates(blockDatesData || []);

      // Fetch vacation requests joined with fellow info and block dates
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
          fellow:fellows!fellow_id (id, name, pgy_level, program),
          start_block:block_dates!start_block_id (block_number, start_date, end_date),
          end_block:block_dates!end_block_id (block_number, start_date, end_date)
        `)
        .order('created_at', { ascending: false });

      if (requestsErr) throw requestsErr;
      // Enrich requests with requester profile info for display
      let enrichedRequests = requestsData || [];
      try {
        const requesterIds = [...new Set((requestsData || []).map(r => r.requested_by).filter(Boolean))];
        if (requesterIds.length) {
          const { data: profilesData, error: profilesErr } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', requesterIds);
          if (!profilesErr && profilesData) {
            const profMap = {};
            profilesData.forEach(p => { profMap[p.id] = p; });
            enrichedRequests = (requestsData || []).map(r => ({ ...r, requested_by_profile: profMap[r.requested_by] }));
          }
        }
      } catch (e) {
        // ignore enrichment failures; fall back to raw requests
      }
      setDbRequests(enrichedRequests || []);

      // Fetch swap requests
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
          requester:fellows!requester_fellow_id (id, name, pgy_level),
          target:fellows!target_fellow_id (id, name, pgy_level)
        `)
        .order('created_at', { ascending: false });

      if (swapsErr) throw swapsErr;
      setDbSwapRequests(swapsData || []);
    } catch (err) {
      console.error('Error fetching requests:', err);
      setDbError(err.message);
    } finally {
      setLoadingDb(false);
    }
  }, [useDatabase, profile?.institution_id]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // --- Supabase approve/deny vacations ---
  const approveDbRequest = async (requestId) => {
    if (!canApprove()) return;
    setSubmitting(true);
    try {
      // Find the full request so we have fellow + block range
      const req = dbRequests.find(r => r.id === requestId);
      if (!req) throw new Error('Request not found');

      const { error } = await supabase
        .from('vacation_requests')
        .update({
          status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (error) throw error;

      // Write 'Vacation' into schedule_assignments for every block in the range
      const startBlock = req.start_block?.block_number;
      const endBlock = req.end_block?.block_number;
      const fellowId = req.fellow?.id;
      const fellowName = req.fellow?.name;

      if (fellowId && startBlock && endBlock) {
        const affectedBlocks = blockDates.filter(
          b => b.block_number >= startBlock && b.block_number <= endBlock
        );
        if (affectedBlocks.length > 0) {
          const assignments = affectedBlocks.map(b => ({
            fellow_id: fellowId,
            block_date_id: b.id,
            rotation: 'Vacation',
            created_by: user.id,
          }));
          const { error: upsertErr } = await supabase
            .from('schedule_assignments')
            .upsert(assignments, { onConflict: 'fellow_id,block_date_id' });
          if (upsertErr) console.error('Error updating schedule_assignments:', upsertErr);

          // Mirror into local React state so all views update immediately
          if (setSchedule && fellowName) {
            setSchedule(prev => {
              const next = { ...prev };
              next[fellowName] = [...(next[fellowName] || [])];
              for (let b = startBlock; b <= endBlock; b++) {
                next[fellowName][b - 1] = 'Vacation';
              }
              return next;
            });
          }
        }
      }

      await fetchRequests();
    } catch (err) {
      console.error('Error approving request:', err);
      setDbError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const denyDbRequest = async (requestId) => {
    if (!canApprove()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('vacation_requests')
        .update({ status: 'denied' })
        .eq('id', requestId);

      if (error) throw error;
      await fetchRequests();
    } catch (err) {
      console.error('Error denying request:', err);
      setDbError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // --- Supabase approve/deny swaps ---
  const approveDbSwap = async (requestId) => {
    if (!canApprove()) return;
    setSubmitting(true);
    try {
      const req = dbSwapRequests.find(r => r.id === requestId);
      if (!req) throw new Error('Swap request not found');

      const requesterId = req.requester?.id;
      const targetId = req.target?.id;
      const requesterName = req.requester?.name;
      const targetName = req.target?.name;
      const blockNum = req.block_number;

      // Parse swap type/weekend if encoded into reason (format: `${type}|W<1|2>|optional text`)
      let swapType = null;
      let weekend = 1;
      if (req.reason && typeof req.reason === 'string' && req.reason.includes('|')) {
        const parts = req.reason.split('|');
        if (parts[0] === 'call' || parts[0] === 'float') swapType = parts[0];
        if (parts[1] && parts[1].startsWith('W')) weekend = Number(parts[1].replace('W', '')) || 1;
      }

      // If no swapType, fall back to rotation swap behavior
      if (!swapType) {
        // Read current rotations from local schedule (source of truth at approve time)
        const requesterRot = schedule[requesterName]?.[blockNum - 1] ?? '';
        const targetRot = schedule[targetName]?.[blockNum - 1] ?? '';

        const { error } = await supabase
          .from('swap_requests')
          .update({
            status: 'approved',
            approved_by: user.id,
            approved_at: new Date().toISOString(),
          })
          .eq('id', requestId);

        if (error) throw error;

        // Swap in schedule_assignments
        const blockDate = blockDates.find(b => b.block_number === blockNum);
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

          // Mirror swap into local React state
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
        setSubmitting(false);
        return;
      }

      // ----- swapType present: handle call/float swap -----
      // Mark request approved first
      const { error: updErr } = await supabase
        .from('swap_requests')
        .update({
          status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (updErr) throw updErr;

      // Pull latest call/float assignments
      const pulled = await pullCallFloatFromSupabase({ institutionId: profile.institution_id });
      if (pulled.error) throw new Error(pulled.error);
      const dbCall = pulled.callSchedule || {};
      const dbFloat = pulled.nightFloatSchedule || {};

      const key = `B${blockNum}-W${weekend}`;

      // Swap entries at key between requesterName and targetName
      if (swapType === 'call') {
        const curEntry = dbCall[key];
        const cur = curEntry ? (typeof curEntry === 'object' ? curEntry.name : curEntry) : null;
        const curRelaxed = curEntry && typeof curEntry === 'object' ? !!curEntry.relaxed : false;
        if (cur === requesterName) dbCall[key] = { name: targetName, relaxed: curRelaxed };
        else if (cur === targetName) dbCall[key] = { name: requesterName, relaxed: curRelaxed };
      } else if (swapType === 'float') {
        const curEntry = dbFloat[key];
        const cur = curEntry ? (typeof curEntry === 'object' ? curEntry.name : curEntry) : null;
        const curRelaxed = curEntry && typeof curEntry === 'object' ? !!curEntry.relaxed : false;
        if (cur === requesterName) dbFloat[key] = { name: targetName, relaxed: curRelaxed };
        else if (cur === targetName) dbFloat[key] = { name: requesterName, relaxed: curRelaxed };
      }

      // Push updated call/float assignments to Supabase
      const pushRes = await pushCallFloatToSupabase({ callSchedule: dbCall, nightFloatSchedule: dbFloat, institutionId: profile.institution_id, userId: user.id });
      if (pushRes.error) console.error('Error pushing call/float after swap:', pushRes.error);

      // Mirror into local React state if setters are provided
      if (setCallSchedule) setCallSchedule(dbCall);
      if (setNightFloatSchedule) setNightFloatSchedule(dbFloat);

      await fetchRequests();
      setSubmitting(false);
      return;
      
    } catch (err) {
      console.error('Error approving swap:', err);
      setDbError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const denyDbSwap = async (requestId) => {
    if (!canApprove()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('swap_requests')
        .update({ status: 'denied' })
        .eq('id', requestId);

      if (error) throw error;
      await fetchRequests();
    } catch (err) {
      console.error('Error denying swap:', err);
      setDbError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // --- Supabase new vacation request ---
  const [newDbReq, setNewDbReq] = useState({ fellow_id: '', start_block_id: '', reason: 'Vacation' });

  const submitDbRequest = async () => {
    if (!newDbReq.fellow_id || !newDbReq.start_block_id) return;
    setSubmitting(true);
    setDbError(null);
    try {
      // If the selected start_block_id refers to a local block (value like 'local-<block>'),
      // insert that block into `block_dates` first and use the returned id.
      let startBlockDbId = newDbReq.start_block_id;
      if ((!blockDates || blockDates.length === 0) && typeof newDbReq.start_block_id === 'string' && newDbReq.start_block_id.startsWith('local-')) {
        const id = newDbReq.start_block_id.replace('local-', '');
        // id is like '3-1' -> parent 3, part 1 (first week) or part 2 (second week)
        const [parentStr, partStr] = id.split('-');
        const parentNum = Number(parentStr);
        const partNum = Number(partStr || 1);
        const source = (localBlockDates && localBlockDates.length) ? splitLocalWeeks : weeklyBlocks;
        const match = source.find(b => String(b.block) === `${parentNum}-${partNum}` || b.block === `${parentNum}-${partNum}`);
        if (!match) throw new Error('Selected local block not found');

        // Compute new sequential block_number for one-week rows: parent*2 -1 for first week, parent*2 for second
        const newBlockNumber = parentNum * 2 - 1 + (partNum - 1);

        // Prepare insertion for a single-week block row
        const toInsert = {
          block_number: newBlockNumber,
          start_date: match.start,
          end_date: match.end,
          institution_id: profile?.institution_id ?? null,
          program: '',
        };
        // attach rotation_number if available from localBlockDates
        try {
          let rotationNumber = 0;
          if (localBlockDates && localBlockDates.length) {
            const parentObj = localBlockDates.find(b => Number(b.block) === parentNum);
            rotationNumber = parentObj?.rotation ?? 0;
          }
          toInsert.rotation_number = rotationNumber;
        } catch (e) {
          toInsert.rotation_number = 0;
        }
        // compute academic year string from start date (e.g. '2026-2027')
        try {
          const sd = new Date(match.start + 'T00:00:00');
          const sy = sd.getFullYear();
          const sm = sd.getMonth() + 1;
          const acadStart = (sm >= 7) ? sy : sy - 1;
          toInsert.academic_year = `${acadStart}-${acadStart + 1}`;
        } catch (e) {
          toInsert.academic_year = '';
        }

        // Try to insert; if it fails because the row exists, query for the existing id
        let insertedId = null;
        try {
          const { data: inserted, error: insertErr } = await supabase
            .from('block_dates')
            .insert(toInsert)
            .select('id')
            .limit(1);
          if (insertErr) throw insertErr;
          insertedId = inserted && inserted[0] && inserted[0].id;
        } catch (insErr) {
          // Try to find existing block by block_number and institution
          const { data: found, error: findErr } = await supabase
            .from('block_dates')
            .select('id')
            .eq('block_number', newBlockNumber)
            .eq('institution_id', profile?.institution_id ?? null)
            .limit(1);
          if (findErr) {
            throw new Error(findErr.message || 'Could not ensure block date exists.');
          }
          if (found && found[0] && found[0].id) insertedId = found[0].id;
          else throw new Error(insErr.message || 'Could not insert or find block date; ask an approver.');
        }

        startBlockDbId = insertedId;
      }

      const { error } = await supabase
        .from('vacation_requests')
        .insert({
          fellow_id: newDbReq.fellow_id,
          start_block_id: startBlockDbId,
          end_block_id: startBlockDbId,
          reason: newDbReq.reason,
          status: 'pending',
          requested_by: user.id,
        });

      if (error) throw error;

      setNewDbReq({ fellow_id: '', start_block_id: '', week_part: 1, reason: 'Vacation' });
      await fetchRequests();
    } catch (err) {
      console.error('Error submitting request:', err);
      setDbError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // (removed approver seed button - not needed when using local split weeks)

  // --- Supabase new day-off request ---
  const DAY_OFF_REASONS = ['Sick Day', 'Personal Day', 'Conference', 'CME'];
  const [newDayOff, setNewDayOff] = useState({ fellow_id: '', date: '', reason_type: 'Sick Day' });

  const approveDayOff = async (requestId) => {
    if (!canApprove()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('vacation_requests')
        .update({ status: 'approved', approved_by: user.id, approved_at: new Date().toISOString() })
        .eq('id', requestId);
      if (error) throw error;
      await fetchRequests();
    } catch (err) {
      setDbError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const denyDayOff = async (requestId) => {
    if (!canApprove()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('vacation_requests')
        .update({ status: 'denied' })
        .eq('id', requestId);
      if (error) throw error;
      await fetchRequests();
    } catch (err) {
      setDbError(err.message);
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

      // Find the block_date that contains the selected date
      let blockDateId = null;
      const matchingBlock = blockDates.find(b => {
        const start = new Date(b.start_date + 'T00:00:00');
        const end = new Date(b.end_date + 'T00:00:00');
        return selectedDate >= start && selectedDate <= end;
      });

      if (matchingBlock) {
        blockDateId = matchingBlock.id;
      } else {
        // Try local block dates
        const localMatch = (localBlockDates || []).find(b => {
          const start = new Date(b.start + 'T00:00:00');
          const end = new Date(b.end + 'T00:00:00');
          return selectedDate >= start && selectedDate <= end;
        });
        if (!localMatch) throw new Error('No schedule block found for the selected date.');
        const { data: found } = await supabase
          .from('block_dates')
          .select('id')
          .eq('block_number', localMatch.block)
          .eq('institution_id', profile?.institution_id)
          .limit(1);
        if (found?.[0]) blockDateId = found[0].id;
        else throw new Error('Block date not found in database.');
      }

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
        });
      if (error) throw error;

      setNewDayOff({ fellow_id: '', date: '', reason_type: 'Sick Day' });
      await fetchRequests();
    } catch (err) {
      setDbError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // --- Supabase new swap request ---
  const [newDbSwap, setNewDbSwap] = useState({ requester_id: '', target_id: '', block_number: 1, reason: '', swap_type: 'call', weekend: 1 });
  // Require swap type (call|float) and weekend (1 or 2)
  const [newDbSwapError, setNewDbSwapError] = useState(null);
  const submitDbSwap = async () => {
    setDbError(null);
    setNewDbSwapError(null);
    if (!newDbSwap.requester_id || !newDbSwap.target_id) return;
    if (newDbSwap.requester_id === newDbSwap.target_id) {
      setDbError('Cannot swap with yourself.');
      return;
    }
    if (!newDbSwap.swap_type || !['call', 'float'].includes(newDbSwap.swap_type)) {
      setNewDbSwapError('Select swap type: call or float');
      return;
    }
    if (![1,2].includes(Number(newDbSwap.weekend))) {
      setNewDbSwapError('Select weekend W1 or W2');
      return;
    }

    setSubmitting(true);
    try {
      // Pull latest call/float assignments from DB to validate against current state
      const pulled = await pullCallFloatFromSupabase({ institutionId: profile.institution_id });
      if (pulled.error) throw new Error(pulled.error);
      const dbCall = pulled.callSchedule || {};
      const dbFloat = pulled.nightFloatSchedule || {};

      const key = `B${newDbSwap.block_number}-W${newDbSwap.weekend}`;

      // Create temp copies
      const tempCall = { ...dbCall };
      const tempFloat = { ...dbFloat };

      // Resolve names for requester/target
      const requester = dbFellows.find(f => f.id === newDbSwap.requester_id)?.name;
      const target = dbFellows.find(f => f.id === newDbSwap.target_id)?.name;

      if (!requester || !target) throw new Error('Fellow lookup failed');

      if (newDbSwap.swap_type === 'call') {
        const requesterHas = tempCall[key] && (tempCall[key].name === requester || tempCall[key] === requester);
        const targetHas = tempCall[key] && (tempCall[key].name === target || tempCall[key] === target);
        if (requesterHas || targetHas) {
          const current = tempCall[key] ? (typeof tempCall[key] === 'object' ? tempCall[key].name : tempCall[key]) : null;
          if (current === requester) tempCall[key] = { name: target };
          else if (current === target) tempCall[key] = { name: requester };
        }
      } else {
        const requesterHas = tempFloat[key] && (tempFloat[key].name === requester || tempFloat[key] === requester);
        const targetHas = tempFloat[key] && (tempFloat[key].name === target || tempFloat[key] === target);
        if (requesterHas || targetHas) {
          const current = tempFloat[key] ? (typeof tempFloat[key] === 'object' ? tempFloat[key].name : tempFloat[key]) : null;
          if (current === requester) tempFloat[key] = { name: target };
          else if (current === target) tempFloat[key] = { name: requester };
        }
      }

      // Run violation checker using current local schedule + temp call/float schedules
      const violin = checkAllWorkHourViolations({
        fellows: fellows,
        schedule,
        callSchedule: tempCall,
        nightFloatSchedule: tempFloat,
        blockDates: (blockDates && blockDates.length) ? blockDates.map(b => ({ block: b.block_number, start: b.start_date, end: b.end_date, rotation: b.block_number })) : localBlockDates,
        vacations: vacations,
      });

      if (violin && violin.length > 0) {
        // Auto-reject: insert swap with status 'denied' and explain in reason
        const reasonText = `${newDbSwap.swap_type}|W${newDbSwap.weekend}|${newDbSwap.reason || ''}`;
        const { error } = await supabase
          .from('swap_requests')
          .insert({
            requester_fellow_id: newDbSwap.requester_id,
            target_fellow_id: newDbSwap.target_id,
            block_number: newDbSwap.block_number,
            reason: reasonText,
            status: 'denied',
            requested_by: user.id,
          });
        if (error) throw error;
        setDbError('Swap rejected: would cause work-hour violations.');
        await fetchRequests();
        setNewDbSwap({ requester_id: '', target_id: '', block_number: 1, reason: '' });
        return;
      }

      // No violations — submit pending swap. Encode type/weekend into reason string to avoid DB schema changes.
      const reasonText = `${newDbSwap.swap_type}|W${newDbSwap.weekend}|${newDbSwap.reason || ''}`;
      const { error: insErr } = await supabase
        .from('swap_requests')
        .insert({
          requester_fellow_id: newDbSwap.requester_id,
          target_fellow_id: newDbSwap.target_id,
          block_number: newDbSwap.block_number,
          reason: reasonText,
          status: 'pending',
          requested_by: user.id,
        });
      if (insErr) throw insErr;

      setNewDbSwap({ requester_id: '', target_id: '', block_number: 1, reason: '' });
      await fetchRequests();
    } catch (err) {
      console.error('Error submitting swap:', err);
      setDbError(err.message || String(err));
    } finally {
      setSubmitting(false);
    }
  };

  // Keep weekend selection in sync with available weekends for Supabase form
  useEffect(() => {
    const target = dbFellows.find(f => f.id === newDbSwap.target_id)?.name;
    const avail = getAvailableWeekendsFor(target, newDbSwap.block_number, newDbSwap.swap_type);
    if (!avail || avail.length === 0) return; // leave as-is
    if (!avail.includes(Number(newDbSwap.weekend))) {
      setNewDbSwap(prev => ({ ...prev, weekend: avail[0] }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newDbSwap.target_id, newDbSwap.block_number, newDbSwap.swap_type, dbFellows]);

  // --- Local-only fallback (original logic) ---
  const [newReq, setNewReq] = useState({ fellow: fellows[0] || '', startBlock: '', endBlock: '', reason: 'Vacation', status: 'pending' });
  const [newSwap, setNewSwap] = useState({ requester: fellows[0] || '', target: fellows[1] || '', block: 1, reason: '', swap_type: 'call', weekend: 1 });

  // Helper: return available weekend numbers [1,2] where `name` holds call/float for `blockNum`
  const getAvailableWeekendsFor = (name, blockNum, type = 'call') => {
    if (!name || !blockNum) return [];
    const key1 = `B${blockNum}-W1`;
    const key2 = `B${blockNum}-W2`;
    const avail = [];
    if (type === 'call') {
      if (callSchedule[key1] && ((typeof callSchedule[key1] === 'object' && callSchedule[key1].name === name) || callSchedule[key1] === name)) avail.push(1);
      if (callSchedule[key2] && ((typeof callSchedule[key2] === 'object' && callSchedule[key2].name === name) || callSchedule[key2] === name)) avail.push(2);
    } else {
      if (nightFloatSchedule[key1] && ((typeof nightFloatSchedule[key1] === 'object' && nightFloatSchedule[key1].name === name) || nightFloatSchedule[key1] === name)) avail.push(1);
      if (nightFloatSchedule[key2] && ((typeof nightFloatSchedule[key2] === 'object' && nightFloatSchedule[key2].name === name) || nightFloatSchedule[key2] === name)) avail.push(2);
    }
    return avail;
  };

  // When no block dates are available, provide weekly Monday–Sunday blocks (next 26 weeks)
  const weeklyBlocks = useMemo(() => {
    // If localBlockDates is present and non-empty we don't generate weekly blocks here
    if (localBlockDates && localBlockDates.length) return [];

    const weeks = [];
    const today = new Date();
    // find next Monday (if today is Monday, use this week)
    const day = today.getDay();
    const daysUntilMonday = (day === 1) ? 0 : ((8 - day) % 7);
    const firstMonday = new Date(today);
    firstMonday.setDate(today.getDate() + daysUntilMonday);

    for (let i = 0; i < 26; i++) {
      const start = new Date(firstMonday);
      start.setDate(firstMonday.getDate() + i * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 6); // Sunday
      const pad = (n) => n.toString().padStart(2, '0');
      const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      weeks.push({ block: i + 1, start: fmt(start), end: fmt(end) });
    }
    return weeks;
  }, [localBlockDates]);

  // If `localBlockDates` exist, split each two-week block into two one-week entries
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
      // Skip the second half for block 1 if it doesn't have enough days
      if (Number(b.block) !== 1) {
        weeks.push({ block: `${b.block}-2`, parentBlock: b.block, start: fmt(secondStart), end: fmt(secondEnd), part: 2 });
      }
    });
    return weeks;
  }, [localBlockDates]);

  const formatPretty = (isoDate) => {
    const d = new Date(isoDate + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const approveRequest = (idx) => {
    if (!isAdmin) return;
    const pendingVacations = vacations.filter(v => !v.status || v.status === 'pending');
    const req = pendingVacations[idx];
    if (!req) return;

    if (setSchedule) {
      setSchedule((prev) => {
        const next = { ...prev };
        next[req.fellow] = [...(next[req.fellow] || [])];
        for (let b = req.startBlock; b <= req.endBlock; b++) {
          next[req.fellow][b - 1] = 'Vacation';
        }
        return next;
      });
    }

    const updatedVacations = vacations.map(v =>
      v === req ? { ...v, status: 'approved' } : v
    );
    setVacations(updatedVacations);
  };

  const denyRequest = (idx) => {
    if (!isAdmin) return;
    const pendingVacations = vacations.filter(v => !v.status || v.status === 'pending');
    const req = pendingVacations[idx];
    if (!req) return;
    const next = vacations.filter(v => v !== req);
    setVacations(next);
  };

  const submitNewRequest = () => {
    if (!newReq.fellow || !newReq.startBlock) return;
    const req = { ...newReq, endBlock: newReq.startBlock };
    setVacations([...(vacations || []), req]);
    setNewReq({ fellow: fellows[0] || '', startBlock: '', endBlock: '', reason: 'Vacation', status: 'pending' });
  };

  // --- Local swap logic ---
  const approveSwap = (idx) => {
    if (!isAdmin) return;
    const pending = swapRequests.filter(s => s.status === 'pending');
    const req = pending[idx];
    if (!req) return;

    if (setSchedule) {
      setSchedule((prev) => {
        const next = { ...prev };
        const blockIdx = req.block - 1;
        const reqArr = [...(next[req.requester] || [])];
        const tgtArr = [...(next[req.target] || [])];
        const temp = reqArr[blockIdx];
        reqArr[blockIdx] = tgtArr[blockIdx];
        tgtArr[blockIdx] = temp;
        next[req.requester] = reqArr;
        next[req.target] = tgtArr;
        return next;
      });
    }

    setSwapRequests(swapRequests.map(s =>
      s === req ? { ...s, status: 'approved' } : s
    ));
  };

  const denySwap = (idx) => {
    if (!isAdmin) return;
    const pending = swapRequests.filter(s => s.status === 'pending');
    const req = pending[idx];
    if (!req) return;
    setSwapRequests(swapRequests.filter(s => s !== req));
  };

  const submitNewSwap = () => {
    if (!newSwap.requester || !newSwap.target || newSwap.requester === newSwap.target) return;
    // Validate swap type/weekend
    if (!newSwap.swap_type || !['call','float'].includes(newSwap.swap_type)) return;
    if (![1,2].includes(Number(newSwap.weekend))) return;

    // Simulate swap on local call/float schedules and run violation checker
    const key = `B${newSwap.block}-W${newSwap.weekend}`;
    const tempCall = { ...(callSchedule || {}) };
    const tempFloat = { ...(nightFloatSchedule || {}) };
    const requester = newSwap.requester;
    const target = newSwap.target;

    if (newSwap.swap_type === 'call') {
      const cur = tempCall[key] ? (typeof tempCall[key] === 'object' ? tempCall[key].name : tempCall[key]) : null;
      if (cur === requester) tempCall[key] = { name: target };
      else if (cur === target) tempCall[key] = { name: requester };
    } else {
      const cur = tempFloat[key] ? (typeof tempFloat[key] === 'object' ? tempFloat[key].name : tempFloat[key]) : null;
      if (cur === requester) tempFloat[key] = { name: target };
      else if (cur === target) tempFloat[key] = { name: requester };
    }

    const violin = checkAllWorkHourViolations({
      fellows,
      schedule,
      callSchedule: tempCall,
      nightFloatSchedule: tempFloat,
      blockDates: (blockDates && blockDates.length) ? blockDates.map(b => ({ block: b.block_number, start: b.start_date, end: b.end_date, rotation: b.block_number })) : localBlockDates,
      vacations,
    });

    if (violin && violin.length > 0) {
      // Auto-deny locally
      setSwapRequests([...(swapRequests || []), { ...newSwap, status: 'denied' }]);
      setNewSwap({ requester: fellows[0] || '', target: fellows[1] || '', block: 1, reason: '', swap_type: 'call', weekend: 1 });
      return;
    }

    setSwapRequests([...(swapRequests || []), { ...newSwap, status: 'pending' }]);
    setNewSwap({ requester: fellows[0] || '', target: fellows[1] || '', block: 1, reason: '', swap_type: 'call', weekend: 1 });
  };

  // Keep weekend selection in sync for local form
  useEffect(() => {
    const avail = getAvailableWeekendsFor(newSwap.target, newSwap.block, newSwap.swap_type);
    if (!avail || avail.length === 0) return;
    if (!avail.includes(Number(newSwap.weekend))) {
      setNewSwap(prev => ({ ...prev, weekend: avail[0] }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newSwap.target, newSwap.block, newSwap.swap_type]);

  // --- Helper: get call/float/clinic info for a fellow at a block ---
  const getBlockDetails = useCallback((fellowName, blockNum) => {
    const details = [];
    const rotation = schedule[fellowName]?.[blockNum - 1] || '—';
    details.push({ label: 'Rotation', value: rotation });

    // Clinic day
    const clinicDay = clinicDays[fellowName];
    if (clinicDay !== undefined) {
      details.push({ label: 'Clinic', value: DAY_NAMES[clinicDay] });
    }

    // Call assignments for this block
    const w1Key = `B${blockNum}-W1`;
    const w2Key = `B${blockNum}-W2`;
    const calls = [];
    if (callSchedule[w1Key] === fellowName) calls.push('W1');
    if (callSchedule[w2Key] === fellowName) calls.push('W2');
    if (calls.length > 0) details.push({ label: 'Call', value: calls.join(', ') });

    // Night float assignments for this block
    const floats = [];
    if (nightFloatSchedule[w1Key] === fellowName) floats.push('W1');
    if (nightFloatSchedule[w2Key] === fellowName) floats.push('W2');
    if (floats.length > 0) details.push({ label: 'Float', value: floats.join(', ') });

    return details;
  }, [schedule, callSchedule, nightFloatSchedule, clinicDays]);

  // --- Swap preview component (shows both fellows' details at the selected block) ---
  const SwapPreview = ({ requester, target, block }) => {
    if (!requester || !target || requester === target) return null;
    const reqDetails = getBlockDetails(requester, block);
    const tgtDetails = getBlockDetails(target, block);

    return (
      <div className="mt-2 p-2 rounded border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 text-xs">
        <div className="font-semibold mb-1 dark:text-blue-200">Swap Preview — Block {block}</div>
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
  if (useDatabase) {
    const vacationDbRequests = dbRequests.filter(r => !DAY_OFF_REASONS.includes(r.reason));
    const dayOffDbRequests = dbRequests.filter(r => DAY_OFF_REASONS.includes(r.reason));

    const pendingRequests = vacationDbRequests.filter(r => r.status === 'pending');
    const approvedRequests = vacationDbRequests.filter(r => r.status === 'approved');
    const deniedRequests = vacationDbRequests.filter(r => r.status === 'denied');

    const pendingDayOffs = dayOffDbRequests.filter(r => r.status === 'pending');
    const approvedDayOffs = dayOffDbRequests.filter(r => r.status === 'approved');
    const deniedDayOffs = dayOffDbRequests.filter(r => r.status === 'denied');

    const pendingSwaps = dbSwapRequests.filter(r => r.status === 'pending');
    const approvedSwaps = dbSwapRequests.filter(r => r.status === 'approved');
    const deniedSwaps = dbSwapRequests.filter(r => r.status === 'denied');

    const userCanApprove = canApprove();
    const userCanRequest = canRequest?.() ?? true;

    // Admins/approvers can select any fellow.
    // Fellows filter to their own linked record; fall back to all institution fellows when
    // user_id hasn't been linked yet (e.g., auto-seeded records have no user_id).
    const linkedFellows = dbFellows.filter(f => f.user_id === user?.id);
    const selectableFellows = userCanApprove
      ? dbFellows
      : (linkedFellows.length > 0 ? linkedFellows : dbFellows);
    const newDbSwapTargetName = dbFellows.find(f => f.id === newDbSwap.target_id)?.name;
    const newDbSwapAvailableWeekends = getAvailableWeekendsFor(
      newDbSwapTargetName,
      newDbSwap.block_number,
      newDbSwap.swap_type
    );
    const newDbSwapWeekendOptions = (newDbSwapAvailableWeekends && newDbSwapAvailableWeekends.length > 0)
      ? newDbSwapAvailableWeekends
      : [1, 2];

    const fmtDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;

    const formatBlockRange = (req) => {
      const startDate = req.start_block?.start_date;
      const endDate = (req.end_block ?? req.start_block)?.end_date;
      if (startDate && endDate && startDate !== endDate) return `${fmtDate(startDate)} \u2013 ${fmtDate(endDate)}`;
      if (startDate) return fmtDate(startDate);
      const start = req.start_block?.block_number ?? '?';
      const end = req.end_block?.block_number ?? '?';
      return start === end ? `Week ${start}` : `Weeks ${start}\u2013${end}`;
    };

    const fmtSwapBlock = (blockNum, weekend) => {
      if (!blockNum) return '\u2014';
      if (weekend) {
        const weeklyNum = (blockNum - 1) * 2 + weekend;
        const entry = blockDates.find(b => b.block_number === weeklyNum);
        if (entry?.start_date) {
          return entry.start_date !== entry.end_date
            ? `${fmtDate(entry.start_date)} \u2013 ${fmtDate(entry.end_date)}`
            : fmtDate(entry.start_date);
        }
      }
      const w1 = blockDates.find(b => b.block_number === (blockNum - 1) * 2 + 1);
      const w2 = blockDates.find(b => b.block_number === blockNum * 2);
      if (w1?.start_date && w2?.end_date) return `${fmtDate(w1.start_date)} \u2013 ${fmtDate(w2.end_date)}`;
      if (w1?.start_date) return fmtDate(w1.start_date);
      return `Block ${blockNum}${weekend ? `, Wk ${weekend}` : ''}`;
    };

    const getRequestExtras = (req) => {
      const bnum = Number(req.start_block?.block_number || 0);
      if (!bnum) return {};
      const parent = Math.ceil(bnum / 2);
      const part = (bnum % 2 === 1) ? 1 : 2;

      // rotation number/name: prefer schedule lookup (name), fall back to localBlockDates rotation number
      let rotationNumber = null;
      let rotationName = null;
      try {
        // Try to get rotation name from the schedule for this fellow and parent block
        const fellowName = req.fellow?.name || (req.fellow && req.fellow.name) || req.requested_by;
        if (fellowName && schedule && schedule[fellowName]) {
          rotationName = schedule[fellowName][parent - 1] || null;
        }
        const localParent = (localBlockDates || []).find(b => Number(b.block) === parent);
        rotationNumber = localParent?.rotation ?? req.start_block?.rotation_number ?? req.start_block?.rotation ?? null;
        if (!rotationName && rotationNumber) {
          // fallback: map rotationNumber to a name using allRotationTypes if available
          // allRotationTypes is in scope (imported via scheduleData)
          try {
            rotationName = allRotationTypes[rotationNumber] || null;
          } catch (e) {
            rotationName = null;
          }
        }
      } catch (e) {
        rotationNumber = req.start_block?.rotation_number ?? null;
      }

      // dates: prefer DB start/end (one-week row) else find in splitLocalWeeks
      let start = req.start_block?.start_date;
      let end = req.start_block?.end_date;
      if (!start || !end) {
        const source = (localBlockDates && localBlockDates.length) ? splitLocalWeeks : weeklyBlocks;
        const match = source.find(b => String(b.block) === `${parent}-${part}` || b.block === `${parent}-${part}`);
        if (match) {
          start = match.start; end = match.end;
        }
      }

      // call/float assignments use keys like B{parent}-W{part}
      const key = `B${parent}-W${part}`;
      const callRaw = callSchedule?.[key];
      const floatRaw = nightFloatSchedule?.[key];
      const callAssigned = (callRaw && typeof callRaw === 'object' ? callRaw.name : callRaw) || '—';
      const floatAssigned = (floatRaw && typeof floatRaw === 'object' ? floatRaw.name : floatRaw) || '—';

      return { parent, part, rotationNumber, rotationName, start, end, callAssigned, floatAssigned };
    };

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">Requests</h3>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {isAdmin?.() ? 'Admin' : isProgramDirector() ? 'Program Director' : isChiefFellow() ? 'Chief Fellow' : profile?.role}
          </div>
        </div>

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
                        {formatBlockRange(r)} — {r.reason}
                      </div>
                      {(() => {
                        const ex = getRequestExtras(r);
                        return (
                          <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                            <div>Rotation: {ex.rotationName || (ex.rotationNumber ? (allRotationTypes[ex.rotationNumber] || ex.rotationNumber) : '—')}</div>
                            <div>Week: {ex.part ? (ex.part === 1 ? '1st week' : '2nd week') : '—'}</div>
                            <div>Dates: {ex.start ? `${new Date(ex.start + 'T00:00:00').toLocaleDateString()} — ${new Date(ex.end + 'T00:00:00').toLocaleDateString()}` : '—'}</div>
                            <div>Call: {ex.callAssigned}{ex.callAssigned && ex.callAssigned !== '—' ? (ex.callAssigned === r.fellow?.name ? ' (requested fellow on call)' : '') : ''}</div>
                            <div>Float: {ex.floatAssigned}{ex.floatAssigned && ex.floatAssigned !== '—' ? (ex.floatAssigned === r.fellow?.name ? ' (requested fellow on float)' : '') : ''}</div>
                            <div className="mt-1">Submitted {r.created_at ? new Date(r.created_at).toLocaleString() : '—'}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Submitted by: {r.requested_by_profile?.full_name ?? r.requested_by ?? '—'}</div>
                          </div>
                        );
                      })()}
                    </div>
                    {userCanApprove && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => approveDbRequest(r.id)}
                          disabled={submitting}
                          className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded text-xs flex items-center gap-1"
                        >
                          <CheckCircle className="w-3 h-3" /> Approve
                        </button>
                        <button
                          onClick={() => denyDbRequest(r.id)}
                          disabled={submitting}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded text-xs flex items-center gap-1"
                        >
                          <AlertTriangle className="w-3 h-3" /> Deny
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Approved Vacations */}
            <div className="bg-white dark:bg-gray-700 rounded border dark:border-gray-600 p-3">
              <div className="mb-2 font-semibold dark:text-gray-100">
                Approved Vacations ({approvedRequests.length})
              </div>
              {approvedRequests.length === 0 && (
                <div className="text-xs text-gray-500 dark:text-gray-400">No approved vacations</div>
              )}
              <div className="space-y-2">
                {approvedRequests.map((r) => (
                  <div key={r.id} className="flex items-center justify-between border border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900 p-2 rounded">
                    <div className="text-sm">
                      <div className="font-semibold dark:text-green-100">
                        {r.fellow?.name ?? 'Unknown Fellow'}
                        <span className="ml-2 text-xs font-normal text-green-600 dark:text-green-300">
                          PGY-{r.fellow?.pgy_level}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 dark:text-green-200">
                        {formatBlockRange(r)} — {r.reason}
                      </div>
                      {r.approved_at && (
                        <div className="text-xs text-gray-400 dark:text-green-300 mt-0.5">
                          Approved {new Date(r.approved_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    <div className="px-3 py-1 bg-green-600 text-white rounded text-xs">
                      Approved
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Denied Requests */}
            {deniedRequests.length > 0 && (
              <div className="bg-white dark:bg-gray-700 rounded border dark:border-gray-600 p-3">
                <div className="mb-2 font-semibold dark:text-gray-100">
                  Denied Requests ({deniedRequests.length})
                </div>
                <div className="space-y-2">
                  {deniedRequests.map((r) => (
                    <div key={r.id} className="flex items-center justify-between border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/30 p-2 rounded">
                      <div className="text-sm">
                        <div className="font-semibold dark:text-red-100">
                          {r.fellow?.name ?? 'Unknown Fellow'}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-red-200">
                          {formatBlockRange(r)} — {r.reason}
                        </div>
                      </div>
                      <div className="px-3 py-1 bg-red-600 text-white rounded text-xs">
                        Denied
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Create New Time Off Request */}
            {userCanRequest && <div className="bg-white dark:bg-gray-700 rounded border dark:border-gray-600 p-3">
              <div className="mb-2 font-semibold dark:text-gray-100">Create New Time Off Request</div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <select
                  className="p-2 border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100"
                  value={newDbReq.fellow_id}
                  onChange={(e) => setNewDbReq({ ...newDbReq, fellow_id: e.target.value })}
                >
                  <option value="">Select Fellow</option>
                  {selectableFellows.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} (PGY-{f.pgy_level})
                    </option>
                  ))}
                </select>
                <select
                  className="p-2 border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100"
                  value={newDbReq.start_block_id}
                  onChange={(e) => setNewDbReq({ ...newDbReq, start_block_id: e.target.value })}
                >
                  <option value="">Start Week</option>
                  {blockDates.length > 0 ? (
                    blockDates.map((b) => (
                      <option key={b.id} value={b.id}>
                        {new Date(b.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} — {new Date(b.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} (Block {b.block_number})
                      </option>
                    ))
                  ) : (
                    (localBlockDates && localBlockDates.length ? splitLocalWeeks : weeklyBlocks).map((b) => (
                      <option key={b.block} value={`local-${b.block}`}>
                        {formatPretty(b.start)} — {formatPretty(b.end)} (Week {b.block})
                      </option>
                    ))
                  )}
                </select>
                {/* week_part removed — selection is per-week via local-<block>-<part> options */}
                <input
                  className="p-2 border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100"
                  placeholder="Reason"
                  value={newDbReq.reason}
                  onChange={(e) => setNewDbReq({ ...newDbReq, reason: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={submitDbRequest}
                  disabled={submitting || !newDbReq.fellow_id || !newDbReq.start_block_id}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-xs"
                >
                  {submitting ? 'Submitting...' : 'Add Request'}
                </button>
                {/* no seed button; users pick first/second week from each block */}
              </div>
              {blockDates.length === 0 && (
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Block dates are not available in the database; showing local first/second-week options from scheduleData for selection.</div>
              )}
            </div>}
          </>
        ) : subView === 'dayoff' ? (
          /* ============== DAY OFF SUB-VIEW (Supabase) ============== */
          <>
            {/* Pending Day Off Requests */}
            <div className="bg-white dark:bg-gray-700 rounded border dark:border-gray-600 p-3">
              <div className="mb-2 font-semibold dark:text-gray-100">
                Pending Day Off Requests ({pendingDayOffs.length})
              </div>
              {pendingDayOffs.length === 0 && (
                <div className="text-xs text-gray-500 dark:text-gray-400">No pending day off requests</div>
              )}
              <div className="space-y-2">
                {pendingDayOffs.map((r) => (
                  <div key={r.id} className="flex items-center justify-between border dark:border-gray-600 dark:bg-gray-800 p-2 rounded">
                    <div className="text-sm">
                      <div className="font-semibold dark:text-gray-100">
                        {r.fellow?.name ?? 'Unknown Fellow'}
                        <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">PGY-{r.fellow?.pgy_level}</span>
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        {r.reason}{r.notes ? ` — ${new Date(r.notes + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        Submitted {r.created_at ? new Date(r.created_at).toLocaleString() : '—'}
                        {r.requested_by_profile?.full_name ? ` by ${r.requested_by_profile.full_name}` : ''}
                      </div>
                    </div>
                    {userCanApprove && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => approveDayOff(r.id)}
                          disabled={submitting}
                          className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded text-xs flex items-center gap-1"
                        >
                          <CheckCircle className="w-3 h-3" /> Approve
                        </button>
                        <button
                          onClick={() => denyDayOff(r.id)}
                          disabled={submitting}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded text-xs flex items-center gap-1"
                        >
                          <AlertTriangle className="w-3 h-3" /> Deny
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Approved Day Off Requests */}
            <div className="bg-white dark:bg-gray-700 rounded border dark:border-gray-600 p-3">
              <div className="mb-2 font-semibold dark:text-gray-100">
                Approved Day Off Requests ({approvedDayOffs.length})
              </div>
              {approvedDayOffs.length === 0 && (
                <div className="text-xs text-gray-500 dark:text-gray-400">No approved day off requests</div>
              )}
              <div className="space-y-2">
                {approvedDayOffs.map((r) => (
                  <div key={r.id} className="flex items-center justify-between border border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900 p-2 rounded">
                    <div className="text-sm">
                      <div className="font-semibold dark:text-green-100">
                        {r.fellow?.name ?? 'Unknown Fellow'}
                        <span className="ml-2 text-xs font-normal text-green-600 dark:text-green-300">PGY-{r.fellow?.pgy_level}</span>
                      </div>
                      <div className="text-xs text-gray-600 dark:text-green-200">
                        {r.reason}{r.notes ? ` — ${new Date(r.notes + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
                      </div>
                      {r.approved_at && (
                        <div className="text-xs text-gray-400 dark:text-green-300 mt-0.5">
                          Approved {new Date(r.approved_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    <div className="px-3 py-1 bg-green-600 text-white rounded text-xs">Approved</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Denied Day Off Requests */}
            {deniedDayOffs.length > 0 && (
              <div className="bg-white dark:bg-gray-700 rounded border dark:border-gray-600 p-3">
                <div className="mb-2 font-semibold dark:text-gray-100">
                  Denied Day Off Requests ({deniedDayOffs.length})
                </div>
                <div className="space-y-2">
                  {deniedDayOffs.map((r) => (
                    <div key={r.id} className="flex items-center justify-between border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/30 p-2 rounded">
                      <div className="text-sm">
                        <div className="font-semibold dark:text-red-100">{r.fellow?.name ?? 'Unknown Fellow'}</div>
                        <div className="text-xs text-gray-600 dark:text-red-200">
                          {r.reason}{r.notes ? ` — ${new Date(r.notes + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
                        </div>
                      </div>
                      <div className="px-3 py-1 bg-red-600 text-white rounded text-xs">Denied</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Create New Day Off Request */}
            {userCanRequest && (
              <div className="bg-white dark:bg-gray-700 rounded border dark:border-gray-600 p-3">
                <div className="mb-2 font-semibold dark:text-gray-100">Request a Day Off</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <select
                    className="p-2 border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100"
                    value={newDayOff.fellow_id}
                    onChange={(e) => setNewDayOff({ ...newDayOff, fellow_id: e.target.value })}
                  >
                    <option value="">Select Fellow</option>
                    {selectableFellows.map((f) => (
                      <option key={f.id} value={f.id}>{f.name} (PGY-{f.pgy_level})</option>
                    ))}
                  </select>
                  <input
                    type="date"
                    className="p-2 border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100"
                    value={newDayOff.date}
                    onChange={(e) => setNewDayOff({ ...newDayOff, date: e.target.value })}
                  />
                  <select
                    className="p-2 border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100"
                    value={newDayOff.reason_type}
                    onChange={(e) => setNewDayOff({ ...newDayOff, reason_type: e.target.value })}
                  >
                    <option value="Sick Day">Sick Day</option>
                    <option value="Personal Day">Personal Day</option>
                    <option value="Conference">Conference</option>
                    <option value="CME">CME</option>
                  </select>
                </div>
                <div className="mt-2">
                  <button
                    onClick={submitDayOff}
                    disabled={submitting || !newDayOff.fellow_id || !newDayOff.date}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-xs"
                  >
                    {submitting ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          /* ============== SWAPS SUB-VIEW (Supabase) ============== */
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
                {pendingSwaps.map((r) => (
                  <div key={r.id} className="border dark:border-gray-600 dark:bg-gray-800 p-2 rounded">
                    <div className="flex items-center justify-between">
                      <div className="text-sm">
                        <div className="font-semibold dark:text-gray-100 flex items-center gap-1">
                          {r.requester?.name ?? '?'}
                          <ArrowLeftRight className="w-3 h-3 text-blue-500" />
                          {r.target?.name ?? '?'}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          {fmtSwapBlock(r.block_number, r.weekend)}{r.reason ? ` \u2014 ${r.reason}` : ''}
                        </div>
                        <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                          Submitted {r.created_at ? new Date(r.created_at).toLocaleString() : '\u2014'}
                        </div>
                      </div>
                      {userCanApprove && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => approveDbSwap(r.id)}
                            disabled={submitting}
                            className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded text-xs flex items-center gap-1"
                          >
                            <CheckCircle className="w-3 h-3" /> Approve
                          </button>
                          <button
                            onClick={() => denyDbSwap(r.id)}
                            disabled={submitting}
                            className="px-3 py-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded text-xs flex items-center gap-1"
                          >
                            <AlertTriangle className="w-3 h-3" /> Deny
                          </button>
                        </div>
                      )}
                    </div>
                    {r.requester?.name && r.target?.name && (
                      <SwapPreview requester={r.requester.name} target={r.target.name} block={r.block_number} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Approved Swaps */}
            <div className="bg-white dark:bg-gray-700 rounded border dark:border-gray-600 p-3">
              <div className="mb-2 font-semibold dark:text-gray-100">
                Approved Swaps ({approvedSwaps.length})
              </div>
              {approvedSwaps.length === 0 && (
                <div className="text-xs text-gray-500 dark:text-gray-400">No approved swaps</div>
              )}
              <div className="space-y-2">
                {approvedSwaps.map((r) => (
                  <div key={r.id} className="flex items-center justify-between border border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900 p-2 rounded">
                    <div className="text-sm">
                      <div className="font-semibold dark:text-green-100 flex items-center gap-1">
                        {r.requester?.name ?? '?'}
                        <ArrowLeftRight className="w-3 h-3 text-green-500" />
                        {r.target?.name ?? '?'}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-green-200">
                        {fmtSwapBlock(r.block_number, r.weekend)}{r.reason ? ` \u2014 ${r.reason}` : ''}
                      </div>
                      {r.approved_at && (
                        <div className="text-xs text-gray-400 dark:text-green-300 mt-0.5">
                          Approved {new Date(r.approved_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    <div className="px-3 py-1 bg-green-600 text-white rounded text-xs">Approved</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Denied Swaps */}
            {deniedSwaps.length > 0 && (
              <div className="bg-white dark:bg-gray-700 rounded border dark:border-gray-600 p-3">
                <div className="mb-2 font-semibold dark:text-gray-100">
                  Denied Swaps ({deniedSwaps.length})
                </div>
                <div className="space-y-2">
                  {deniedSwaps.map((r) => (
                    <div key={r.id} className="flex items-center justify-between border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/30 p-2 rounded">
                      <div className="text-sm">
                        <div className="font-semibold dark:text-red-100 flex items-center gap-1">
                          {r.requester?.name ?? '?'}
                          <ArrowLeftRight className="w-3 h-3 text-red-400" />
                          {r.target?.name ?? '?'}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-red-200">
                          {fmtSwapBlock(r.block_number, r.weekend)}{r.reason ? ` \u2014 ${r.reason}` : ''}
                        </div>
                      </div>
                      <div className="px-3 py-1 bg-red-600 text-white rounded text-xs">Denied</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Create New Swap Request */}
            {userCanRequest && <div className="bg-white dark:bg-gray-700 rounded border dark:border-gray-600 p-3">
              <div className="mb-2 font-semibold dark:text-gray-100">Request Schedule Swap</div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <select
                  className="p-2 border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100"
                  value={newDbSwap.requester_id}
                  onChange={(e) => setNewDbSwap({ ...newDbSwap, requester_id: e.target.value })}
                >
                  <option value="">Your Fellow</option>
                  {selectableFellows.map((f) => (
                    <option key={f.id} value={f.id}>{f.name} (PGY-{f.pgy_level})</option>
                  ))}
                </select>
                <select
                  className="p-2 border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100"
                  value={newDbSwap.target_id}
                  onChange={(e) => setNewDbSwap({ ...newDbSwap, target_id: e.target.value })}
                >
                  <option value="">Swap With</option>
                  {dbFellows.filter(f => f.id !== newDbSwap.requester_id).map((f) => (
                    <option key={f.id} value={f.id}>{f.name} (PGY-{f.pgy_level})</option>
                  ))}
                </select>
                <select
                  className="p-2 border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100"
                  value={newDbSwap.swap_type}
                  onChange={(e) => setNewDbSwap({ ...newDbSwap, swap_type: e.target.value })}
                >
                  <option value="call">Call (weekend in-house)</option>
                  <option value="float">Night Float (sat nights)</option>
                </select>
                <select
                  className="p-2 border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100"
                  value={newDbSwap.weekend}
                  onChange={(e) => setNewDbSwap({ ...newDbSwap, weekend: Number(e.target.value) })}
                >
                  {newDbSwapWeekendOptions.includes(1) && <option value={1}>Weekend W1</option>}
                  {newDbSwapWeekendOptions.includes(2) && <option value={2}>Weekend W2</option>}
                </select>
                <input
                  type="number"
                  className="p-2 border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100"
                  min={1}
                  max={26}
                  placeholder="Block #"
                  value={newDbSwap.block_number}
                  onChange={(e) => setNewDbSwap({ ...newDbSwap, block_number: Number(e.target.value) })}
                />
                <input
                  className="p-2 border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100"
                  placeholder="Reason (optional)"
                  value={newDbSwap.reason}
                  onChange={(e) => setNewDbSwap({ ...newDbSwap, reason: e.target.value })}
                />
              </div>
              {newDbSwapError && (
                <div className="text-xs text-red-600 dark:text-red-400 mt-1">{newDbSwapError}</div>
              )}
              <div className="mt-2">
                <button
                  onClick={submitDbSwap}
                  disabled={submitting || !newDbSwap.requester_id || !newDbSwap.target_id}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-xs"
                >
                  {submitting ? 'Submitting...' : 'Request Swap'}
                </button>
              </div>
            </div>}
          </>
        )}
      </div>
    );
  }

  // =====================================================================
  // RENDER: Local-only fallback (original behavior)
  // =====================================================================
  const availableLocalBlocks = (localBlockDates && localBlockDates.length)
    ? splitLocalWeeks.map(w => ({ block: w.block, start: w.start, end: w.end }))
    : weeklyBlocks;
  // In local fallback mode there is no real auth, so default to allowing requests
  const userCanRequest = profile ? (canRequest?.() ?? true) : true;
  const userCanApproveLocal = profile ? (canApprove?.() ?? false) : false;
  const localFmtRange = (startBlock, endBlock) => {
    const fmt = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;
    const startEntry = availableLocalBlocks?.find(b => String(b.block) === String(startBlock));
    const endEntry = availableLocalBlocks?.find(b => String(b.block) === String(endBlock));
    const start = startEntry?.start ?? startEntry?.start_date;
    const end = endEntry?.end ?? endEntry?.end_date;
    if (start && end && start !== end) return `${fmt(start)} \u2013 ${fmt(end)}`;
    if (start) return fmt(start);
    return startBlock === endBlock ? `Week ${startBlock}` : `Weeks ${startBlock}\u2013${endBlock}`;
  };
  const pendingVacations = vacations.filter(v => !v.status || v.status === 'pending');
  const approvedVacations = vacations.filter(v => v.status === 'approved');
  const pendingSwapsLocal = swapRequests.filter(s => s.status === 'pending');
  const approvedSwapsLocal = swapRequests.filter(s => s.status === 'approved');
  const newSwapAvailableWeekends = getAvailableWeekendsFor(newSwap.target, newSwap.block, newSwap.swap_type);
  const newSwapWeekendOptions = (newSwapAvailableWeekends && newSwapAvailableWeekends.length > 0)
    ? newSwapAvailableWeekends
    : [1, 2];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">Requests</h3>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {profile ? (isAdmin?.() ? 'Admin' : isProgramDirector() ? 'Program Director' : isChiefFellow() ? 'Chief Fellow' : profile.role) : 'Local mode'}
        </div>
      </div>

      <SubViewTabs />

      {subView === 'timeoff' ? (
        <>
          {/* Pending Requests */}
          <div className="bg-white dark:bg-gray-700 rounded border dark:border-gray-600 p-3">
            <div className="mb-2 font-semibold dark:text-gray-100">Pending Requests</div>
            {pendingVacations.length === 0 && <div className="text-xs text-gray-500 dark:text-gray-400">No pending requests</div>}
            <div className="space-y-2">
              {pendingVacations.map((v, idx) => (
                <div key={idx} className="flex items-center justify-between border dark:border-gray-600 dark:bg-gray-800 p-2 rounded">
                  <div className="text-sm">
                    <div className="font-semibold dark:text-gray-100">{v.fellow}</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">{localFmtRange(v.startBlock, v.endBlock)}{v.reason ? ` \u2014 ${v.reason}` : ''}</div>
                    {v.created_at && <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Submitted {new Date(v.created_at).toLocaleString()}</div>}
                  </div>
                  {userCanApproveLocal && (
                    <div className="flex items-center gap-2">
                      <button onClick={() => approveRequest(idx)} className="px-3 py-1 bg-green-600 text-white rounded text-xs flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Approve
                      </button>
                      <button onClick={() => denyRequest(idx)} className="px-3 py-1 bg-red-600 text-white rounded text-xs flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Deny
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Approved Vacations */}
          <div className="bg-white dark:bg-gray-700 rounded border dark:border-gray-600 p-3">
            <div className="mb-2 font-semibold dark:text-gray-100">Approved Vacations</div>
            {approvedVacations.length === 0 && <div className="text-xs text-gray-500 dark:text-gray-400">No approved vacations</div>}
            <div className="space-y-2">
              {approvedVacations.map((v, idx) => (
                <div key={idx} className="flex items-center justify-between border border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900 p-2 rounded">
                  <div className="text-sm">
                    <div className="font-semibold dark:text-green-100">{v.fellow}</div>
                    <div className="text-xs text-gray-600 dark:text-green-200">{localFmtRange(v.startBlock, v.endBlock)}{v.reason ? ` \u2014 ${v.reason}` : ''}</div>
                  </div>
                  <div className="px-3 py-1 bg-green-600 text-white rounded text-xs">
                    Approved
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Create New Time Off Request */}
          {userCanRequest && <div className="bg-white dark:bg-gray-700 rounded border dark:border-gray-600 p-3">
            <div className="mb-2 font-semibold dark:text-gray-100">Create New Time Off Request</div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <select className="p-2 border dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100" value={newReq.fellow} onChange={(e) => setNewReq({ ...newReq, fellow: e.target.value })}>
                {fellows.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
              {availableLocalBlocks && availableLocalBlocks.length ? (
                <select className="p-2 border dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100" value={String(newReq.startBlock)} onChange={(e) => setNewReq({ ...newReq, startBlock: e.target.value, endBlock: e.target.value })}>
                  <option value="">Select Week</option>
                  {availableLocalBlocks.map((b) => (
                    <option key={b.block} value={String(b.block)}>
                      {formatPretty(b.start)} — {formatPretty(b.end)} (Week {b.block})
                    </option>
                  ))}
                </select>
              ) : (
                <input type="number" className="p-2 border dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100" min={1} max={26} placeholder="Block #" value={newReq.startBlock} onChange={(e) => setNewReq({ ...newReq, startBlock: e.target.value, endBlock: e.target.value })} />
              )}
              <input className="p-2 border dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100" placeholder="Reason" value={newReq.reason} onChange={(e) => setNewReq({ ...newReq, reason: e.target.value })} />
            </div>
            <div className="mt-2">
              <button onClick={submitNewRequest} className="px-3 py-1 bg-blue-600 text-white rounded text-xs">Add Request</button>
            </div>
          </div>}
        </>
      ) : subView === 'dayoff' ? (
        /* ============== DAY OFF SUB-VIEW (Local) ============== */
        <div className="bg-white dark:bg-gray-700 rounded border dark:border-gray-600 p-3">
          <div className="mb-2 font-semibold dark:text-gray-100">Day Off Requests</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Day off requests require a database connection. Please sign in to submit or view day off requests.</div>
        </div>
      ) : (
        /* ============== SWAPS SUB-VIEW (Local) ============== */
        <>
          {/* Pending Swaps */}
          <div className="bg-white dark:bg-gray-700 rounded border dark:border-gray-600 p-3">
            <div className="mb-2 font-semibold dark:text-gray-100">Pending Swaps ({pendingSwapsLocal.length})</div>
            {pendingSwapsLocal.length === 0 && <div className="text-xs text-gray-500 dark:text-gray-400">No pending swap requests</div>}
            <div className="space-y-2">
              {pendingSwapsLocal.map((s, idx) => (
                <div key={idx} className="border dark:border-gray-600 dark:bg-gray-800 p-2 rounded">
                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      <div className="font-semibold dark:text-gray-100 flex items-center gap-1">
                        {s.requester}
                        <ArrowLeftRight className="w-3 h-3 text-blue-500" />
                        {s.target}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        {localFmtRange(s.block, s.block)}{s.reason ? ` \u2014 ${s.reason}` : ''}
                      </div>
                    </div>
                    {userCanApproveLocal && (
                      <div className="flex items-center gap-2">
                        <button onClick={() => approveSwap(idx)} className="px-3 py-1 bg-green-600 text-white rounded text-xs flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Approve
                        </button>
                        <button onClick={() => denySwap(idx)} className="px-3 py-1 bg-red-600 text-white rounded text-xs flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Deny
                        </button>
                      </div>
                    )}
                  </div>
                  <SwapPreview requester={s.requester} target={s.target} block={s.block} />
                </div>
              ))}
            </div>
          </div>

          {/* Approved Swaps */}
          <div className="bg-white dark:bg-gray-700 rounded border dark:border-gray-600 p-3">
            <div className="mb-2 font-semibold dark:text-gray-100">Approved Swaps ({approvedSwapsLocal.length})</div>
            {approvedSwapsLocal.length === 0 && <div className="text-xs text-gray-500 dark:text-gray-400">No approved swaps</div>}
            <div className="space-y-2">
              {approvedSwapsLocal.map((s, idx) => (
                <div key={idx} className="flex items-center justify-between border border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900 p-2 rounded">
                  <div className="text-sm">
                    <div className="font-semibold dark:text-green-100 flex items-center gap-1">
                      {s.requester}
                      <ArrowLeftRight className="w-3 h-3 text-green-500" />
                      {s.target}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-green-200">
                      {localFmtRange(s.block, s.block)}{s.reason ? ` \u2014 ${s.reason}` : ''}
                    </div>
                  </div>
                  <div className="px-3 py-1 bg-green-600 text-white rounded text-xs">Approved</div>
                </div>
              ))}
            </div>
          </div>

          {/* Create New Swap Request */}
          {userCanRequest && <div className="bg-white dark:bg-gray-700 rounded border dark:border-gray-600 p-3">
            <div className="mb-2 font-semibold dark:text-gray-100">Request Schedule Swap</div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <select className="p-2 border dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100" value={newSwap.requester} onChange={(e) => setNewSwap({ ...newSwap, requester: e.target.value })}>
                {fellows.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
              <select className="p-2 border dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100" value={newSwap.target} onChange={(e) => setNewSwap({ ...newSwap, target: e.target.value })}>
                {fellows.filter(f => f !== newSwap.requester).map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
              <select className="p-2 border dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100" value={newSwap.swap_type} onChange={(e) => setNewSwap({ ...newSwap, swap_type: e.target.value })}>
                <option value="call">Call (weekend)</option>
                <option value="float">Night Float (sat night)</option>
              </select>
              <select
                className="p-2 border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100"
                value={newSwap.weekend}
                onChange={(e) => setNewSwap({ ...newSwap, weekend: Number(e.target.value) })}
              >
                {newSwapWeekendOptions.includes(1) && <option value={1}>Weekend W1</option>}
                {newSwapWeekendOptions.includes(2) && <option value={2}>Weekend W2</option>}
              </select>
              <input type="number" className="p-2 border dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100" min={1} max={26} value={newSwap.block} onChange={(e) => setNewSwap({ ...newSwap, block: Number(e.target.value) })} />
              <input className="p-2 border dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100" placeholder="Reason (optional)" value={newSwap.reason} onChange={(e) => setNewSwap({ ...newSwap, reason: e.target.value })} />
            </div>

            {/* Live swap preview */}
            <SwapPreview requester={newSwap.requester} target={newSwap.target} block={newSwap.block} />

            <div className="mt-2">
              <button
                onClick={submitNewSwap}
                disabled={!newSwap.requester || !newSwap.target || newSwap.requester === newSwap.target}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-xs"
              >
                Request Swap
              </button>
            </div>
          </div>}
        </>
      )}
    </div>
  );
}
