// VacationsView.jsx
// Notes:
// 1) Auth flags are plain booleans from AuthContext — no function-call normalization needed.
// 2) Swap "weekend" is NOT a DB column (you encode it in reason). Parse it for display + logic.
// 3) callSchedule / nightFloatSchedule values can be string OR {name, relaxed}. Handle both everywhere.

import { useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
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

  const useDatabase = isSupabaseConfigured && user && profile;

  const state = useVacationState({
    useDatabase,
    programId,
    academicYearId,
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

    return (
      <div className="space-y-3">
        <h3 className="text-lg font-bold">Requests</h3>

        <SubViewTabs subView={subView} setSubView={setSubView} />

        {!programId && (
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
            pendingRequests={state.pendingRequests}
            approvedRequests={state.approvedRequests}
            deniedRequests={state.deniedRequests}
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
          />
        ) : subView === 'dayoff' ? (
          <DayOffView
            {...commonProps}
            pendingDayOffs={state.pendingDayOffs}
            approvedDayOffs={state.approvedDayOffs}
            deniedDayOffs={state.deniedDayOffs}
            approveDayOff={state.approveDayOff}
            denyDayOff={state.denyDayOff}
            cancelDbRequest={state.cancelDbRequest}
            newDayOff={state.newDayOff} setNewDayOff={state.setNewDayOff}
            submitDayOff={state.submitDayOff}
          />
        ) : (
          <SwapsView
            {...commonProps}
            pendingSwaps={state.pendingSwapRequests}
            approvedSwaps={state.approvedSwapRequests}
            deniedSwaps={state.deniedSwapRequests}
            dismissedSwapIds={dismissedSwapIds} dismissSwap={dismissSwap}
            denyingId={state.denyingId} setDenyingId={state.setDenyingId}
            denyReason={state.denyReason} setDenyReason={state.setDenyReason}
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
