import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { pullCallFloatFromSupabase, pushCallFloatToSupabase } from '../utils/scheduleSupabaseSync';
import { checkAllWorkHourViolations } from '../engine/workHourChecker';
import { blockDates as localBlockDates, allRotationTypes } from '../data/scheduleData';
import {
  DAY_NAMES,
  DAY_OFF_REASONS,
  SWAP_RESET,
  getNameFromAssignment,
  getRelaxedFromAssignment,
  parseSwapReason,
  formatPretty,
} from '../utils/vacationHelpers';

export function useVacationState({
  useDatabase,
  fellows,
  schedule,
  vacations,
  callSchedule,
  nightFloatSchedule,
  setCallSchedule,
  setNightFloatSchedule,
  clinicDays,
  pgyLevels,
  setSchedule,
  profile,
  user,
  userCanApprove,
}) {
  const [dbRequests, setDbRequests] = useState([]);
  const [dbSwapRequests, setDbSwapRequests] = useState([]);
  const [dbFellows, setDbFellows] = useState([]);
  const [loadingDb, setLoadingDb] = useState(!!useDatabase);
  const [dbError, setDbError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [blockDates, setBlockDates] = useState([]);
  const [denyingId, setDenyingId] = useState(null);
  const [denyReason, setDenyReason] = useState('');
  const [dismissedSwapIds, setDismissedSwapIds] = useState(new Set());

  // Form state
  const [newDbReq, setNewDbReq] = useState({ fellow_id: '', start_block_id: '', reason: 'Vacation' });
  const [newDayOff, setNewDayOff] = useState({ fellow_id: '', date: '', reason_type: 'Sick Day' });
  const [newDbSwap, setNewDbSwap] = useState(SWAP_RESET);
  const [newDbSwapError, setNewDbSwapError] = useState(null);

  const dismissSwap = (id) => setDismissedSwapIds(prev => new Set([...prev, id]));

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

  // --- Supabase fetch ---
  const fetchRequests = useCallback(async () => {
    if (!useDatabase) return;
    setLoadingDb(true);
    setDbError(null);
    try {
      let { data: fellowsData, error: fellowsErr } = await supabase
        .from('fellows')
        .select('id, name, pgy_level, program, user_id')
        .eq('institution_id', profile.institution_id)
        .eq('is_active', true)
        .order('name');
      if (fellowsErr) throw fellowsErr;

      if (!fellowsData?.length && userCanApprove) {
        const toInsert = fellows.map(name => ({
          name,
          program: '',
          pgy_level: pgyLevels[name] ?? 1,
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

      const program = profile?.program || profile?.institution?.program;
      let { data: blockDatesData, error: blockDatesErr } = await supabase
        .from('block_dates')
        .select('id, block_number, start_date, end_date, rotation_number, program')
        .eq('institution_id', profile.institution_id)
        .eq('program', program)
        .order('block_number');
      if (blockDatesErr) throw blockDatesErr;

      const expectedBlockCount = localBlockDates?.length ?? 0;
      if ((blockDatesData?.length ?? 0) < expectedBlockCount && userCanApprove) {
        const existingBlockNums = new Set((blockDatesData || []).map(b => b.block_number));
        const toInsert = (localBlockDates || [])
          .filter(b => !existingBlockNums.has(b.block))
          .map(b => ({
            block_number: b.block,
            start_date: b.start,
            end_date: b.end,
            rotation_number: b.rotation ?? 0,
            institution_id: profile.institution_id,
            program,
          }));
        if (toInsert.length) {
          const { data: seeded, error: seedErr } = await supabase
            .from('block_dates')
            .insert(toInsert)
            .select('id, block_number, start_date, end_date, rotation_number, program');
          if (seedErr) throw seedErr;
          if (seeded?.length) {
            blockDatesData = [...(blockDatesData || []), ...seeded]
              .sort((a, b) => a.block_number - b.block_number);
          }
        }
      }
      setBlockDates(blockDatesData || []);

      const { data: requestsData, error: requestsErr } = await supabase
        .from('vacation_requests')
        .select(`
          id, reason, status, notes, created_at, approved_at, requested_by, approved_by,
          fellow:fellows!fellow_id (id, name, pgy_level, program),
          start_block:block_dates!start_block_id (block_number, start_date, end_date, rotation_number),
          end_block:block_dates!end_block_id (block_number, start_date, end_date, rotation_number)
        `)
        .order('created_at', { ascending: false });
      if (requestsErr) throw requestsErr;

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

      const { data: swapsData, error: swapsErr } = await supabase
        .from('swap_requests')
        .select(`
          id, block_number, reason, status, notes, created_at, approved_at, requested_by, approved_by,
          requester:fellows!requester_fellow_id (id, name, pgy_level),
          target:fellows!target_fellow_id (id, name, pgy_level)
        `)
        .order('created_at', { ascending: false });
      if (swapsErr) throw swapsErr;
      setDbSwapRequests(swapsData || []);
    } catch (err) {
      console.error('Error fetching requests:', err);
      setDbError(err.message || String(err));
    } finally {
      setLoadingDb(false);
    }
  }, [useDatabase, profile?.institution_id, userCanApprove, fellows, pgyLevels]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  // --- Vacation actions ---
  const approveDbRequest = async (requestId) => {
    if (!userCanApprove) return;
    setSubmitting(true);
    try {
      const req = dbRequests.find(r => r.id === requestId);
      if (!req) throw new Error('Request not found');
      const { error } = await supabase
        .from('vacation_requests')
        .update({ status: 'approved', approved_by: user.id, approved_at: new Date().toISOString() })
        .eq('id', requestId);
      if (error) throw error;

      const startBlock = req.start_block?.block_number;
      const endBlock = req.end_block?.block_number;
      const fellowId = req.fellow?.id;
      const fellowName = req.fellow?.name;
      if (fellowId && startBlock && endBlock) {
        const affectedBlocks = blockDates.filter(b => b.block_number >= startBlock && b.block_number <= endBlock);
        if (affectedBlocks.length > 0) {
          const assignments = affectedBlocks.map(b => ({
            fellow_id: fellowId, block_date_id: b.id, rotation: 'Vacation', created_by: user.id,
          }));
          const { error: upsertErr } = await supabase
            .from('schedule_assignments')
            .upsert(assignments, { onConflict: 'fellow_id,block_date_id' });
          if (upsertErr) console.error('Error updating schedule_assignments:', upsertErr);
          if (setSchedule && fellowName) {
            setSchedule(prev => {
              const next = { ...prev };
              next[fellowName] = [...(next[fellowName] || [])];
              for (let b = startBlock; b <= endBlock; b++) next[fellowName][b - 1] = 'Vacation';
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
      const { error } = await supabase.from('vacation_requests').update(update).eq('id', requestId);
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
      const { error } = await supabase.from('vacation_requests').update({ status: 'cancelled' }).eq('id', requestId);
      if (error) throw error;
      await fetchRequests();
    } catch (err) {
      console.error('Error cancelling request:', err);
      setDbError(err.message || String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const approveDayOff = async (requestId) => {
    if (!userCanApprove) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('vacation_requests')
        .update({ status: 'approved', approved_by: user.id, approved_at: new Date().toISOString() })
        .eq('id', requestId);
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
      const { error } = await supabase.from('vacation_requests').update({ status: 'denied' }).eq('id', requestId);
      if (error) throw error;
      await fetchRequests();
    } catch (err) {
      setDbError(err.message || String(err));
    } finally {
      setSubmitting(false);
    }
  };

  // --- Swap actions ---
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
      const blockNum = req.block_number;
      const parsed = parseSwapReason(req.reason);
      const swapType = parsed.swapType;
      const weekend = parsed.weekend ?? 1;

      const { error: updErr } = await supabase
        .from('swap_requests')
        .update({ status: 'approved', approved_by: user.id, approved_at: new Date().toISOString() })
        .eq('id', requestId);
      if (updErr) throw updErr;

      if (!swapType) {
        const requesterRot = schedule[requesterName]?.[blockNum - 1] ?? '';
        const targetRot = schedule[targetName]?.[blockNum - 1] ?? '';
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

      const pulled = await pullCallFloatFromSupabase({ institutionId: profile.institution_id });
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
        const cur = getNameFromAssignment(curEntry);
        const relaxed = getRelaxedFromAssignment(curEntry);
        if (cur === requesterName) sched[key] = { name: targetName, relaxed };
        else if (cur === targetName) sched[key] = { name: requesterName, relaxed };
      }

      const pushRes = await pushCallFloatToSupabase({
        callSchedule: dbCall,
        nightFloatSchedule: dbFloat,
        institutionId: profile.institution_id,
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
      const { error } = await supabase.from('swap_requests').update(update).eq('id', requestId);
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
      const { error } = await supabase.from('swap_requests').update({ status: 'cancelled' }).eq('id', requestId);
      if (error) throw error;
      await fetchRequests();
    } catch (err) {
      console.error('Error cancelling swap:', err);
      setDbError(err.message || String(err));
    } finally {
      setSubmitting(false);
    }
  };

  // --- Submit new requests ---
  const submitDbRequest = async () => {
    if (!newDbReq.fellow_id || !newDbReq.start_block_id) return;
    setSubmitting(true);
    setDbError(null);
    try {
      let startBlockDbId = newDbReq.start_block_id;
      if (typeof newDbReq.start_block_id === 'string' && newDbReq.start_block_id.startsWith('local-')) {
        const id = newDbReq.start_block_id.replace('local-', '');
        const [parentStr, partStr] = id.split('-');
        const parentNum = Number(parentStr);
        const partNum = Number(partStr || 1);
        const source = (localBlockDates && localBlockDates.length) ? splitLocalWeeks : weeklyBlocks;
        const match = source.find(b => String(b.block) === `${parentNum}-${partNum}` || b.block === `${parentNum}-${partNum}`);
        if (!match) throw new Error('Selected local block not found');
        const newBlockNumber = parentNum * 2 - 1 + (partNum - 1);
        const toInsert = {
          block_number: newBlockNumber,
          start_date: match.start,
          end_date: match.end,
          institution_id: profile?.institution_id ?? null,
          program: '',
          rotation_number: 0,
          academic_year: '',
        };
        try {
          if (localBlockDates && localBlockDates.length) {
            const parentObj = localBlockDates.find(b => Number(b.block) === parentNum);
            toInsert.rotation_number = parentObj?.rotation ?? 0;
          }
        } catch (e) {}
        try {
          const sd = new Date(match.start + 'T00:00:00');
          const sy = sd.getFullYear();
          const sm = sd.getMonth() + 1;
          const acadStart = (sm >= 7) ? sy : sy - 1;
          toInsert.academic_year = `${acadStart}-${acadStart + 1}`;
        } catch (e) {}
        let insertedId = null;
        try {
          const { data: inserted, error: insertErr } = await supabase
            .from('block_dates').insert(toInsert).select('id').limit(1);
          if (insertErr) throw insertErr;
          insertedId = inserted?.[0]?.id ?? null;
        } catch (insErr) {
          const { data: found, error: findErr } = await supabase
            .from('block_dates').select('id')
            .eq('block_number', newBlockNumber)
            .eq('institution_id', profile?.institution_id ?? null)
            .limit(1);
          if (findErr) throw new Error(findErr.message || 'Could not ensure block date exists.');
          insertedId = found?.[0]?.id ?? null;
          if (!insertedId) throw new Error(insErr.message || 'Could not insert or find block date; ask an approver.');
        }
        startBlockDbId = insertedId;
      }
      const { error } = await supabase.from('vacation_requests').insert({
        fellow_id: newDbReq.fellow_id,
        start_block_id: startBlockDbId,
        end_block_id: startBlockDbId,
        reason: newDbReq.reason,
        status: 'pending',
        requested_by: user.id,
      });
      if (error) throw error;
      setNewDbReq({ fellow_id: '', start_block_id: '', reason: 'Vacation' });
      await fetchRequests();
    } catch (err) {
      console.error('Error submitting request:', err);
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
      if (matchingBlock) {
        blockDateId = matchingBlock.id;
      } else {
        const localMatch = (localBlockDates || []).find(b => {
          const start = new Date(b.start + 'T00:00:00');
          const end = new Date(b.end + 'T00:00:00');
          return selectedDate >= start && selectedDate <= end;
        });
        if (!localMatch) throw new Error('No schedule block found for the selected date.');
        const { data: found, error: findErr } = await supabase
          .from('block_dates').select('id')
          .eq('block_number', localMatch.block)
          .eq('institution_id', profile?.institution_id)
          .limit(1);
        if (findErr) throw findErr;
        if (found?.[0]) blockDateId = found[0].id;
        else throw new Error('Block date not found in database.');
      }
      const { error } = await supabase.from('vacation_requests').insert({
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
      setDbError(err.message || String(err));
    } finally {
      setSubmitting(false);
    }
  };

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
    const tgtParts = target_shift_key.split('|');
    const tgtFellowId = tgtParts[0];
    const tgtBKey = tgtParts[2];
    const tgtM = tgtBKey?.match(/^B(\d+)-W([12])$/);
    if (!tgtM) { setNewDbSwapError('Invalid target shift selection.'); return; }
    const requesterFellow = dbFellows.find(f => f.id === requester_id);
    const targetFellow = dbFellows.find(f => f.id === tgtFellowId);
    if (!requesterFellow || !targetFellow) { setNewDbSwapError('Fellow lookup failed.'); return; }
    if (requester_id === tgtFellowId) { setDbError('Cannot swap with yourself.'); return; }

    setSubmitting(true);
    try {
      const pulled = await pullCallFloatFromSupabase({ institutionId: profile.institution_id });
      if (pulled.error) throw new Error(pulled.error);
      const dbCall = { ...pulled.callSchedule || {} };
      const dbFloat = { ...pulled.nightFloatSchedule || {} };
      const tempCall = { ...dbCall };
      const tempFloat = { ...dbFloat };
      const sched = myType === 'call' ? tempCall : tempFloat;
      sched[myBKey] = { name: targetFellow.name };
      sched[tgtBKey] = { name: requesterFellow.name };

      const violin = checkAllWorkHourViolations({
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
      const hasViolations = violin && violin.length > 0;
      const status = hasViolations ? 'denied' : 'pending';
      const violationNotes = hasViolations
        ? violin.slice(0, 5).map(v => `${v.ruleLabel || v.rule}: ${v.fellow} — ${v.detail || ''}`).join('\n')
        : null;

      const { error: insErr } = await supabase.from('swap_requests').insert({
        requester_fellow_id: requester_id,
        target_fellow_id: tgtFellowId,
        block_number: myBlockNum,
        reason: reasonText,
        status,
        notes: violationNotes,
        requested_by: user.id,
      });
      if (insErr) throw insErr;
      if (hasViolations) setDbError(`Swap rejected: ${violin.length} work-hour violation${violin.length > 1 ? 's' : ''} — see Denied below for details.`);
      setNewDbSwap(SWAP_RESET);
      await fetchRequests();
    } catch (err) {
      console.error('Error submitting swap:', err);
      setDbError(err.message || String(err));
    } finally {
      setSubmitting(false);
    }
  };

  // --- Computed helpers ---
  const getBlockDetails = useCallback((fellowName, blockNum) => {
    const details = [];
    details.push({ label: 'Rotation', value: schedule[fellowName]?.[blockNum - 1] || '—' });
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

  const getShiftDateLabel = useCallback((blockNum, weekend) => {
    const weeklyNum = (blockNum - 1) * 2 + weekend;
    const entry = blockDates.find(b => b.block_number === weeklyNum);
    if (entry?.start_date) {
      const fmt = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `${fmt(entry.start_date)} \u2013 ${fmt(entry.end_date)}`;
    }
    const source = localBlockDates?.length ? splitLocalWeeks : weeklyBlocks;
    const match = source.find(b => String(b.block) === `${blockNum}-${weekend}`);
    if (match) return `${formatPretty(match.start)} \u2013 ${formatPretty(match.end)}`;
    return `Block ${blockNum}, Wk ${weekend}`;
  }, [blockDates, splitLocalWeeks, weeklyBlocks]);

  const getRequestExtras = useCallback((req) => {
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
  }, [schedule, callSchedule, nightFloatSchedule, splitLocalWeeks, weeklyBlocks]);

  // --- Derived fellows ---
  const linkedFellows = useMemo(() => dbFellows.filter(f => f.user_id === user?.id), [dbFellows, user?.id]);
  const linkedFellowIds = useMemo(() => new Set(linkedFellows.map(f => f.id)), [linkedFellows]);
  const selectableFellows = useMemo(
    () => userCanApprove ? dbFellows : (linkedFellows.length ? linkedFellows : dbFellows),
    [userCanApprove, dbFellows, linkedFellows]
  );

  // --- Visibility filters ---
  const isVisibleRequest = useCallback((r) =>
    userCanApprove || r.requested_by === user?.id || linkedFellowIds.has(r.fellow?.id),
    [userCanApprove, user?.id, linkedFellowIds]
  );

  const isVisibleSwap = useCallback((r) =>
    userCanApprove || r.requested_by === user?.id ||
    linkedFellowIds.has(r.requester?.id) || linkedFellowIds.has(r.target?.id),
    [userCanApprove, user?.id, linkedFellowIds]
  );

  // --- Derived request lists ---
  const vacationDbRequests = useMemo(
    () => dbRequests.filter(r => !DAY_OFF_REASONS.includes(r.reason) && isVisibleRequest(r)),
    [dbRequests, isVisibleRequest]
  );
  const dayOffDbRequests = useMemo(
    () => dbRequests.filter(r => DAY_OFF_REASONS.includes(r.reason) && isVisibleRequest(r)),
    [dbRequests, isVisibleRequest]
  );
  const pendingRequests  = useMemo(() => vacationDbRequests.filter(r => r.status === 'pending'),  [vacationDbRequests]);
  const approvedRequests = useMemo(() => vacationDbRequests.filter(r => r.status === 'approved'), [vacationDbRequests]);
  const deniedRequests   = useMemo(() => vacationDbRequests.filter(r => r.status === 'denied'),   [vacationDbRequests]);
  const pendingDayOffs   = useMemo(() => dayOffDbRequests.filter(r => r.status === 'pending'),    [dayOffDbRequests]);
  const approvedDayOffs  = useMemo(() => dayOffDbRequests.filter(r => r.status === 'approved'),   [dayOffDbRequests]);
  const deniedDayOffs    = useMemo(() => dayOffDbRequests.filter(r => r.status === 'denied'),     [dayOffDbRequests]);
  const visibleSwaps  = useMemo(() => dbSwapRequests.filter(isVisibleSwap), [dbSwapRequests, isVisibleSwap]);
  const pendingSwaps  = useMemo(() => visibleSwaps.filter(r => r.status === 'pending'),  [visibleSwaps]);
  const approvedSwaps = useMemo(() => visibleSwaps.filter(r => r.status === 'approved'), [visibleSwaps]);
  const deniedSwaps   = useMemo(() => visibleSwaps.filter(r => r.status === 'denied'),   [visibleSwaps]);

  // --- Shift picker computeds ---
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
    const myWeeklyNum = myBlockNum ? (myBlockNum - 1) * 2 + myWeekend : null;
    const requesterName = dbFellows.find(f => f.id === newDbSwap.requester_id)?.name;

    const isOnVacation = (fellowId, weeklyNum) => {
      if (!weeklyNum) return false;
      return dbRequests.some(r =>
        r.fellow?.id === fellowId &&
        r.status !== 'denied' && r.status !== 'cancelled' &&
        !DAY_OFF_REASONS.includes(r.reason) &&
        (r.start_block?.block_number ?? 0) <= weeklyNum &&
        ((r.end_block ?? r.start_block)?.block_number ?? 0) >= weeklyNum
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
      if (myWeeklyNum && isOnVacation(newDbSwap.requester_id, tgtWeeklyNum)) return;
      if (myBlockNum && isAwayRotation(requesterName, tgtBlockNum)) return;
      if (isOnVacation(fellow.id, myWeeklyNum)) return;
      if (isAwayRotation(name, myBlockNum)) return;
      if (!candidatesMap[fellow.id]) candidatesMap[fellow.id] = { fellow, shifts: [] };
      candidatesMap[fellow.id].shifts.push({ type: swapType, blockNum: tgtBlockNum, weekend: tgtWeekend, key });
    });
    return Object.values(candidatesMap).sort((a, b) => a.fellow.name.localeCompare(b.fellow.name));
  }, [newDbSwap.my_shift_key, newDbSwap.requester_id, dbFellows, callSchedule, nightFloatSchedule, dbRequests, schedule]);

  return {
    // loading / error
    loadingDb, dbError, setDbError,
    submitting,
    blockDates,
    weeklyBlocks, splitLocalWeeks,
    // deny inline state
    denyingId, setDenyingId,
    denyReason, setDenyReason,
    // dismiss
    dismissedSwapIds, dismissSwap,
    // form state
    newDbReq, setNewDbReq,
    newDayOff, setNewDayOff,
    newDbSwap, setNewDbSwap,
    newDbSwapError,
    // actions
    approveDbRequest, denyDbRequest, cancelDbRequest,
    approveDayOff, denyDayOff,
    approveDbSwap, denyDbSwap, cancelDbSwap,
    submitDbRequest, submitDayOff, submitDbSwap,
    // fellows
    selectableFellows, linkedFellowIds,
    // derived lists
    pendingRequests, approvedRequests, deniedRequests,
    pendingDayOffs, approvedDayOffs, deniedDayOffs,
    pendingSwaps, approvedSwaps, deniedSwaps,
    // helpers
    getBlockDetails, getShiftDateLabel, getRequestExtras,
    // shift picker
    myShifts, validSwapTargets,
  };
}
