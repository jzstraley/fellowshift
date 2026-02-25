import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CheckCircle, AlertTriangle, Loader2, ArrowLeftRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { blockDates as localBlockDates } from '../data/scheduleData';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function VacationsView({
  fellows = [],
  schedule = {},
  vacations = [],
  swapRequests = [],
  callSchedule = {},
  nightFloatSchedule = {},
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
  const [loadingDb, setLoadingDb] = useState(false);
  const [dbError, setDbError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [blockDates, setBlockDates] = useState([]);

  const useDatabase = isSupabaseConfigured && user && profile;

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
      setDbRequests(requestsData || []);

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
  const [newDbReq, setNewDbReq] = useState({ fellow_id: '', start_block_id: '', end_block_id: '', reason: 'Vacation' });

  const submitDbRequest = async () => {
    if (!newDbReq.fellow_id || !newDbReq.start_block_id || !newDbReq.end_block_id) return;
    setSubmitting(true);
    setDbError(null);
    try {
      const { error } = await supabase
        .from('vacation_requests')
        .insert({
          fellow_id: newDbReq.fellow_id,
          start_block_id: newDbReq.start_block_id,
          end_block_id: newDbReq.end_block_id,
          reason: newDbReq.reason,
          status: 'pending',
          requested_by: user.id,
        });

      if (error) throw error;

      setNewDbReq({ fellow_id: '', start_block_id: '', end_block_id: '', reason: 'Vacation' });
      await fetchRequests();
    } catch (err) {
      console.error('Error submitting request:', err);
      setDbError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // --- Supabase new swap request ---
  const [newDbSwap, setNewDbSwap] = useState({ requester_id: '', target_id: '', block_number: 1, reason: '' });

  const submitDbSwap = async () => {
    if (!newDbSwap.requester_id || !newDbSwap.target_id) return;
    if (newDbSwap.requester_id === newDbSwap.target_id) {
      setDbError('Cannot swap with yourself.');
      return;
    }
    setSubmitting(true);
    setDbError(null);
    try {
      const { error } = await supabase
        .from('swap_requests')
        .insert({
          requester_fellow_id: newDbSwap.requester_id,
          target_fellow_id: newDbSwap.target_id,
          block_number: newDbSwap.block_number,
          reason: newDbSwap.reason || null,
          status: 'pending',
          requested_by: user.id,
        });

      if (error) throw error;
      setNewDbSwap({ requester_id: '', target_id: '', block_number: 1, reason: '' });
      await fetchRequests();
    } catch (err) {
      console.error('Error submitting swap:', err);
      setDbError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // --- Local-only fallback (original logic) ---
  const [newReq, setNewReq] = useState({ fellow: fellows[0] || '', startBlock: 1, endBlock: 1, reason: 'Vacation', status: 'pending' });
  const [newSwap, setNewSwap] = useState({ requester: fellows[0] || '', target: fellows[1] || '', block: 1, reason: '' });

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
    if (!newReq.fellow) return;
    setVacations([...(vacations || []), { ...newReq }]);
    setNewReq({ fellow: fellows[0] || '', startBlock: 1, endBlock: 1, reason: 'Vacation', status: 'pending' });
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
    setSwapRequests([...(swapRequests || []), { ...newSwap, status: 'pending' }]);
    setNewSwap({ requester: fellows[0] || '', target: fellows[1] || '', block: 1, reason: '' });
  };

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
              <div key={d.label} className="text-gray-600 dark:text-gray-400">
                {d.label}: <span className="font-medium dark:text-gray-300">{d.value}</span>
              </div>
            ))}
          </div>
          <div>
            <div className="font-medium dark:text-gray-200">{target}</div>
            {tgtDetails.map(d => (
              <div key={d.label} className="text-gray-600 dark:text-gray-400">
                {d.label}: <span className="font-medium dark:text-gray-300">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // --- Sub-view toggle tabs ---
  const SubViewTabs = () => (
    <div className="flex gap-1 mb-3">
      <button
        onClick={() => setSubView('timeoff')}
        className={`px-3 py-1.5 text-xs font-semibold rounded ${
          subView === 'timeoff'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
        }`}
      >
        Time Off
      </button>
      <button
        onClick={() => setSubView('swaps')}
        className={`px-3 py-1.5 text-xs font-semibold rounded flex items-center gap-1 ${
          subView === 'swaps'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
        }`}
      >
        <ArrowLeftRight className="w-3 h-3" /> Swaps
      </button>
    </div>
  );

  // =====================================================================
  // RENDER: Supabase-backed view
  // =====================================================================
  if (useDatabase) {
    const pendingRequests = dbRequests.filter(r => r.status === 'pending');
    const approvedRequests = dbRequests.filter(r => r.status === 'approved');
    const deniedRequests = dbRequests.filter(r => r.status === 'denied');

    const pendingSwaps = dbSwapRequests.filter(r => r.status === 'pending');
    const approvedSwaps = dbSwapRequests.filter(r => r.status === 'approved');
    const deniedSwaps = dbSwapRequests.filter(r => r.status === 'denied');

    const userCanApprove = canApprove();
    const userCanRequest = canRequest?.() ?? true;

    // Admins/approvers can select any fellow; regular fellows can only select themselves
    const selectableFellows = userCanApprove
      ? dbFellows
      : dbFellows.filter(f => f.user_id === user?.id);

    const formatBlockRange = (req) => {
      const start = req.start_block?.block_number ?? '?';
      const end = req.end_block?.block_number ?? '?';
      return start === end ? `Block ${start}` : `Blocks ${start}–${end}`;
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
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        Submitted {new Date(r.created_at).toLocaleDateString()}
                      </div>
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
                  <option value="">Start Date</option>
                  {blockDates.map((b) => (
                    <option key={b.id} value={b.id}>
                      {new Date(b.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </option>
                  ))}
                </select>
                <select
                  className="p-2 border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100"
                  value={newDbReq.end_block_id}
                  onChange={(e) => setNewDbReq({ ...newDbReq, end_block_id: e.target.value })}
                >
                  <option value="">End Date</option>
                  {blockDates.map((b) => (
                    <option key={b.id} value={b.id}>
                      {new Date(b.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </option>
                  ))}
                </select>
                <input
                  className="p-2 border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100"
                  placeholder="Reason"
                  value={newDbReq.reason}
                  onChange={(e) => setNewDbReq({ ...newDbReq, reason: e.target.value })}
                />
              </div>
              <div className="mt-2">
                <button
                  onClick={submitDbRequest}
                  disabled={submitting || !newDbReq.fellow_id || !newDbReq.start_block_id || !newDbReq.end_block_id}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-xs"
                >
                  {submitting ? 'Submitting...' : 'Add Request'}
                </button>
              </div>
            </div>}
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
                          Block {r.block_number}{r.reason ? ` — ${r.reason}` : ''}
                        </div>
                        <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                          Submitted {new Date(r.created_at).toLocaleDateString()}
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
                        Block {r.block_number}{r.reason ? ` — ${r.reason}` : ''}
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
                          Block {r.block_number}{r.reason ? ` — ${r.reason}` : ''}
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
  const userCanRequest = canRequest?.() ?? true;
  const pendingVacations = vacations.filter(v => !v.status || v.status === 'pending');
  const approvedVacations = vacations.filter(v => v.status === 'approved');
  const pendingSwapsLocal = swapRequests.filter(s => s.status === 'pending');
  const approvedSwapsLocal = swapRequests.filter(s => s.status === 'approved');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">Requests</h3>
        <div className="text-sm text-gray-600 dark:text-gray-400">Admin controls enabled</div>
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
                    <div className="text-xs text-gray-600 dark:text-gray-400">Blocks {v.startBlock}–{v.endBlock} — {v.reason}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => approveRequest(idx)} className="px-3 py-1 bg-green-600 text-white rounded text-xs flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Approve
                    </button>
                    <button onClick={() => denyRequest(idx)} className="px-3 py-1 bg-red-600 text-white rounded text-xs flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Deny
                    </button>
                  </div>
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
                    <div className="text-xs text-gray-600 dark:text-green-200">Blocks {v.startBlock}–{v.endBlock} — {v.reason}</div>
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
              <input type="number" className="p-2 border dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100" min={1} max={26} value={newReq.startBlock} onChange={(e) => setNewReq({ ...newReq, startBlock: Number(e.target.value) })} />
              <input type="number" className="p-2 border dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100" min={1} max={26} value={newReq.endBlock} onChange={(e) => setNewReq({ ...newReq, endBlock: Number(e.target.value) })} />
              <input className="p-2 border dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100" value={newReq.reason} onChange={(e) => setNewReq({ ...newReq, reason: e.target.value })} />
            </div>
            <div className="mt-2">
              <button onClick={submitNewRequest} className="px-3 py-1 bg-blue-600 text-white rounded text-xs">Add Request</button>
            </div>
          </div>}
        </>
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
                        Block {s.block}{s.reason ? ` — ${s.reason}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => approveSwap(idx)} className="px-3 py-1 bg-green-600 text-white rounded text-xs flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Approve
                      </button>
                      <button onClick={() => denySwap(idx)} className="px-3 py-1 bg-red-600 text-white rounded text-xs flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Deny
                      </button>
                    </div>
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
                      Block {s.block}{s.reason ? ` — ${s.reason}` : ''}
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
