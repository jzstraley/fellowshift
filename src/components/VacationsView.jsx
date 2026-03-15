// VacationsView.jsx
// Notes:
// 1) Auth flags are plain booleans from AuthContext — no function-call normalization needed.
// 2) Swap "weekend" is NOT a DB column (you encode it in reason). Parse it for display + logic.
// 3) callSchedule / nightFloatSchedule values can be string OR {name, relaxed}. Handle both everywhere.

import { useState, useCallback, useMemo } from 'react';
import { Loader2, Search, X as XIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { useVacationState } from '../hooks/useVacationState';
import SubViewTabs from './vacations/SubViewTabs';
import TimeOffView from './vacations/TimeOffView';
import DayOffView from './vacations/DayOffView';
import SwapsView from './vacations/SwapsView';

export default function VacationsView({
  fellows = [],
  schedule = {},
  vacations = [],
  setVacations,
  setSwapRequests,
  callSchedule = {},
  nightFloatSchedule = {},
  setCallSchedule,
  setNightFloatSchedule,
  clinicDays = {},
  pgyLevels = {},
  setSchedule,
}) {
  const { profile, user, canApprove, canRequest, programId, academicYearId } = useAuth();
  const userCanApprove = canApprove;
  const userCanRequest = canRequest;

  const [subView, setSubView] = useState('timeoff');
  const [fellowFilter, setFellowFilter] = useState('');
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest' | 'oldest'

  const useDatabase = isSupabaseConfigured && user && profile;

  const state = useVacationState({
    useDatabase,
    programId,
    academicYearId,
    fellows,
    schedule,
    vacations,
    setVacations,
    setSwapRequests,
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
    userCanRequest,
  });

  const [dismissedSwapIds, setDismissedSwapIds] = useState(new Set());
  const dismissSwap = useCallback((id) => setDismissedSwapIds(prev => new Set([...prev, id])), []);

  // ======= Supabase UI =======
  if (useDatabase) {
    const commonProps = {
      userCanApprove,
      userCanRequest,
      userId: user?.id,
      submitting: state.submitting,
      selectableFellows: state.selectableFellows,
    };

    // Filter + sort helpers applied to any request array
    const filterFellow = (name) => !fellowFilter || (name ?? '').toLowerCase().includes(fellowFilter.toLowerCase());

    const applyFilter = (arr) => {
      let out = (arr ?? []).filter(r => {
        if (subView === 'swaps') {
          return filterFellow(r?.requester?.name) || filterFellow(r?.target?.name);
        }
        return filterFellow(r?.fellow?.name);
      });
      if (sortOrder === 'oldest') out = [...out].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      else out = [...out].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      return out;
    };

    return (
      <div className="mx-auto max-w-xl md:max-w-2xl lg:max-w-4xl xl:max-w-6xl space-y-3 px-4 md:px-0">
        <h3 className="text-lg font-bold">Requests</h3>

        <SubViewTabs
          subView={subView}
          setSubView={setSubView}
          pendingTimeOff={state.pendingRequests?.length ?? 0}
          pendingDayOff={state.pendingDayOffs?.length ?? 0}
          pendingSwaps={(state.pendingPeerSwapRequests?.length ?? 0) + (state.pendingSwapRequests?.length ?? 0)}
        />

        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={fellowFilter}
              onChange={e => setFellowFilter(e.target.value)}
              placeholder="Filter by fellow name…"
              className="w-full pl-8 pr-8 py-1.5 text-sm rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400"
            />
            {fellowFilter && (
              <button
                onClick={() => setFellowFilter('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <select
            value={sortOrder}
            onChange={e => setSortOrder(e.target.value)}
            className="py-1.5 px-2 text-sm rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>

        {!programId && !userCanApprove && (
          <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded p-3 text-sm text-yellow-800 dark:text-yellow-300">
            No program scope found — your account may not have a program membership yet. Requests cannot be loaded until this is set up.
          </div>
        )}

        {state.dbError && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded p-3 text-sm text-red-700 dark:text-red-300">
            {state.dbError}
          </div>
        )}

        {state.loadingDb ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span className="ml-2 text-sm text-gray-500">Loading requests...</span>
          </div>
        ) : subView === 'timeoff' ? (
          <TimeOffView
            {...commonProps}
            pendingRequests={applyFilter(state.pendingRequests)}
            approvedRequests={applyFilter(state.approvedRequests)}
            deniedRequests={applyFilter(state.deniedRequests)}
            denyingId={state.denyingId} setDenyingId={state.setDenyingId}
            denyReason={state.denyReason} setDenyReason={state.setDenyReason}
            approveDbRequest={state.approveDbRequest}
            denyDbRequest={state.denyDbRequest}
            cancelDbRequest={state.cancelDbRequest}
            getRequestExtras={state.getRequestExtras}
            newDbReq={state.newDbReq} setNewDbReq={state.setNewDbReq}
            submitDbRequest={state.submitDbRequest}
            blockDates={state.blockDates}
            parentBlockDates={state.blockDates}
            splitLocalWeeks={state.splitLocalWeeks}
            weeklyBlocks={state.weeklyBlocks}
            getBlockDetails={state.getBlockDetails}
          />
        ) : subView === 'dayoff' ? (
          <DayOffView
            {...commonProps}
            pendingDayOffs={applyFilter(state.pendingDayOffs)}
            approvedDayOffs={applyFilter(state.approvedDayOffs)}
            deniedDayOffs={applyFilter(state.deniedDayOffs)}
            approveDayOff={state.approveDayOff}
            denyDayOff={state.denyDayOff}
            cancelDbRequest={state.cancelDbRequest}
            newDayOff={state.newDayOff} setNewDayOff={state.setNewDayOff}
            submitDayOff={state.submitDayOff}
          />
        ) : (
          <SwapsView
            {...commonProps}
            pendingPeerSwaps={applyFilter(state.pendingPeerSwapRequests)}
            pendingSwaps={applyFilter(state.pendingSwapRequests)}
            approvedSwaps={applyFilter(state.approvedSwapRequests)}
            deniedSwaps={applyFilter(state.deniedSwapRequests)}
            dismissedSwapIds={dismissedSwapIds} dismissSwap={dismissSwap}
            denyingId={state.denyingId} setDenyingId={state.setDenyingId}
            denyReason={state.denyReason} setDenyReason={state.setDenyReason}
            peerApproveDbSwap={state.peerApproveDbSwap}
            peerDenyDbSwap={state.peerDenyDbSwap}
            approveDbSwap={state.approveDbSwap}
            denyDbSwap={state.denyDbSwap}
            cancelDbSwap={state.cancelDbSwap}
            newDbSwap={state.newDbSwap} setNewDbSwap={state.setNewDbSwap}
            submitDbSwap={state.submitDbSwap}
            newDbSwapError={state.newDbSwapError}
            myShifts={state.myShifts}
            validSwapTargets={state.validSwapTargets}
            getBlockDetails={state.getBlockDetails}
            getShiftDateLabel={state.getShiftDateLabel}
            blockDates={state.blockDates}
            parentBlockDates={state.blockDates}
            isMyFellow={(id) => state.linkedFellowIds.has(id)}
          />
        )}
      </div>
    );
  }

  // ======= Local-only fallback UI =======
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-bold">Requests</h3>
      <SubViewTabs subView={subView} setSubView={setSubView} />
      <div className="bg-white dark:bg-gray-700 rounded border dark:border-gray-600 p-3 text-xs text-gray-500 dark:text-gray-400">
        Local-only fallback mode.
      </div>
    </div>
  );
}
