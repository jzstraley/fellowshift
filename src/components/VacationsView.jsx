import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

export default function VacationsView({
  fellows = [],
  schedule = {},
  vacations = [],
  setSchedule,
  setVacations,
  isAdmin = true,
}) {
  const { profile, user, canApprove, isFellow, isProgramDirector, isChiefFellow } = useAuth();

  // Supabase-backed state
  const [dbRequests, setDbRequests] = useState([]);
  const [dbFellows, setDbFellows] = useState([]);
  const [loadingDb, setLoadingDb] = useState(false);
  const [dbError, setDbError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const useDatabase = isSupabaseConfigured && user && profile;

  // Fetch vacation requests and fellows from Supabase
  const fetchRequests = useCallback(async () => {
    if (!useDatabase) return;

    setLoadingDb(true);
    setDbError(null);

    try {
      // Fetch fellows for this institution
      const { data: fellowsData, error: fellowsErr } = await supabase
        .from('fellows')
        .select('id, name, pgy_level, program')
        .eq('institution_id', profile.institution_id)
        .eq('is_active', true)
        .order('name');

      if (fellowsErr) throw fellowsErr;
      setDbFellows(fellowsData || []);

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
    } catch (err) {
      console.error('Error fetching vacation requests:', err);
      setDbError(err.message);
    } finally {
      setLoadingDb(false);
    }
  }, [useDatabase, profile?.institution_id]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // --- Supabase approve/deny ---
  const approveDbRequest = async (requestId) => {
    if (!canApprove()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('vacation_requests')
        .update({
          status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (error) throw error;
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

  // --- Supabase new request ---
  const [newDbReq, setNewDbReq] = useState({ fellow_id: '', start_block: 1, end_block: 1, reason: 'Vacation' });

  const submitDbRequest = async () => {
    if (!newDbReq.fellow_id) return;
    setSubmitting(true);
    setDbError(null);
    try {
      // Look up block_date IDs for the selected block numbers
      const { data: blocks, error: blocksErr } = await supabase
        .from('block_dates')
        .select('id, block_number')
        .eq('institution_id', profile.institution_id)
        .in('block_number', [newDbReq.start_block, newDbReq.end_block]);

      if (blocksErr) throw blocksErr;

      const startBlockRow = blocks.find(b => b.block_number === newDbReq.start_block);
      const endBlockRow = blocks.find(b => b.block_number === newDbReq.end_block);

      if (!startBlockRow || !endBlockRow) {
        setDbError('Could not find block dates. Make sure block dates are configured.');
        setSubmitting(false);
        return;
      }

      const { error } = await supabase
        .from('vacation_requests')
        .insert({
          fellow_id: newDbReq.fellow_id,
          start_block_id: startBlockRow.id,
          end_block_id: endBlockRow.id,
          reason: newDbReq.reason,
          status: 'pending',
          requested_by: user.id,
        });

      if (error) throw error;

      setNewDbReq({ fellow_id: '', start_block: 1, end_block: 1, reason: 'Vacation' });
      await fetchRequests();
    } catch (err) {
      console.error('Error submitting request:', err);
      setDbError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // --- Local-only fallback (original logic) ---
  const [newReq, setNewReq] = useState({ fellow: fellows[0] || '', startBlock: 1, endBlock: 1, reason: 'Vacation', status: 'pending' });

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

  // =====================================================================
  // RENDER: Supabase-backed view
  // =====================================================================
  if (useDatabase) {
    const pendingRequests = dbRequests.filter(r => r.status === 'pending');
    const approvedRequests = dbRequests.filter(r => r.status === 'approved');
    const deniedRequests = dbRequests.filter(r => r.status === 'denied');

    const userCanApprove = canApprove();
    const userIsFellow = isFellow();

    // Fellows can only select themselves; directors/chiefs can select any fellow
    const selectableFellows = userIsFellow
      ? dbFellows.filter(f => f.user_id === user.id)
      : dbFellows;

    const formatBlockRange = (req) => {
      const start = req.start_block?.block_number ?? '?';
      const end = req.end_block?.block_number ?? '?';
      return start === end ? `Block ${start}` : `Blocks ${start}–${end}`;
    };

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">Vacation Requests</h3>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {isProgramDirector() ? 'Program Director' : isChiefFellow() ? 'Chief Fellow' : profile?.role}
          </div>
        </div>

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
        ) : (
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

            {/* Create New Request */}
            <div className="bg-white dark:bg-gray-700 rounded border dark:border-gray-600 p-3">
              <div className="mb-2 font-semibold dark:text-gray-100">Create New Request</div>
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
                <input
                  type="number"
                  className="p-2 border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100"
                  min={1}
                  max={26}
                  placeholder="Start Block"
                  value={newDbReq.start_block}
                  onChange={(e) => setNewDbReq({ ...newDbReq, start_block: Number(e.target.value) })}
                />
                <input
                  type="number"
                  className="p-2 border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100"
                  min={1}
                  max={26}
                  placeholder="End Block"
                  value={newDbReq.end_block}
                  onChange={(e) => setNewDbReq({ ...newDbReq, end_block: Number(e.target.value) })}
                />
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
                  disabled={submitting || !newDbReq.fellow_id}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-xs"
                >
                  {submitting ? 'Submitting...' : 'Add Request'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // =====================================================================
  // RENDER: Local-only fallback (original behavior)
  // =====================================================================
  const pendingVacations = vacations.filter(v => !v.status || v.status === 'pending');
  const approvedVacations = vacations.filter(v => v.status === 'approved');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">Vacation Requests</h3>
        <div className="text-sm text-gray-600">Admin controls enabled</div>
      </div>

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

      <div className="bg-white dark:bg-gray-700 rounded border dark:border-gray-600 p-3">
        <div className="mb-2 font-semibold dark:text-gray-100">Create New Request</div>
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
      </div>
    </div>
  );
}
