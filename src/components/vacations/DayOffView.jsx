// DayOffView.js

import { useState } from 'react';
import { CheckCircle, AlertTriangle, X, ChevronDown, ChevronRight } from 'lucide-react';

export default function DayOffView({
  pendingDayOffs,
  approvedDayOffs,
  deniedDayOffs,
  userCanApprove,
  userCanRequest,
  userId,
  submitting,
  approveDayOff, denyDayOff, cancelDbRequest,
  newDayOff, setNewDayOff, submitDayOff,
  selectableFellows,
}) {
  const [denyingId, setDenyingId] = useState(null);
  const [denyReason, setDenyReason] = useState('');
  const [historicalOpen, setHistoricalOpen] = useState(false);
  const [historicalTab, setHistoricalTab] = useState('approved'); // 'approved' | 'denied'

  const historicalRequests = historicalTab === 'approved' ? approvedDayOffs : deniedDayOffs;

  const fmtDayDate = (notes) =>
    notes
      ? new Date(notes + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
      : null;

  return (
    <div className="space-y-3">
      {/* Pending Day Off Requests */}
      <div className="bg-white dark:bg-gray-700 rounded border dark:border-gray-600 p-3">
        <div className="mb-2 font-semibold dark:text-gray-100">Pending Day Off Requests ({pendingDayOffs.length})</div>
        {pendingDayOffs.length === 0 && <div className="text-xs text-gray-500 dark:text-gray-400">No pending day off requests</div>}
        <div className="space-y-2">
          {pendingDayOffs.map((r) => (
            <div key={r.id} className="flex flex-col gap-2 border dark:border-gray-600 dark:bg-gray-800 p-2 rounded">
              <div className="text-sm">
                <div className="font-semibold dark:text-gray-100">
                  {r.fellow?.name ?? 'Unknown Fellow'}
                  <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">PGY-{r.fellow?.pgy_level}</span>
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  {r.reason}{r.notes ? ` — ${fmtDayDate(r.notes)}` : ''}
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  Submitted {r.created_at ? new Date(r.created_at).toLocaleString() : '—'}
                  {(r.requested_by_profile?.username || r.requested_by_profile?.email)
                    ? ` by ${r.requested_by_profile.username || r.requested_by_profile.email}`
                    : ''}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {userCanApprove && (
                  <>
                    <button onClick={() => approveDayOff(r.id)} disabled={submitting} className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded text-xs flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Approve
                    </button>
                    {denyingId === r.id ? (
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1 w-full sm:w-auto">
                        <input
                          type="text"
                          className="p-1 border rounded text-xs w-full sm:w-44 dark:bg-gray-700 dark:border-gray-500 dark:text-gray-100"
                          placeholder="Denial reason…"
                          value={denyReason}
                          onChange={e => setDenyReason(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { denyDayOff(r.id, denyReason); setDenyingId(null); setDenyReason(''); }
                            if (e.key === 'Escape') { setDenyingId(null); setDenyReason(''); }
                          }}
                          autoFocus
                        />
                        <div className="flex gap-1">
                          <button onClick={() => { denyDayOff(r.id, denyReason); setDenyingId(null); setDenyReason(''); }} disabled={submitting} className="flex-1 sm:flex-none px-2 py-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded text-xs">Confirm</button>
                          <button onClick={() => { setDenyingId(null); setDenyReason(''); }} className="flex-1 sm:flex-none px-2 py-1 bg-gray-400 hover:bg-gray-500 text-white rounded text-xs">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => { setDenyingId(r.id); setDenyReason(''); }} disabled={submitting} className="px-3 py-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded text-xs flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Deny
                      </button>
                    )}
                  </>
                )}
                {r.requested_by === userId && (
                  <button onClick={() => cancelDbRequest(r.id)} disabled={submitting} className="px-3 py-1 bg-gray-500 hover:bg-gray-600 disabled:opacity-50 text-white rounded text-xs flex items-center gap-1">
                    <X className="w-3 h-3" /> Cancel
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Request a Day Off */}
      {userCanRequest && (
        <div className="bg-white dark:bg-gray-700 rounded border dark:border-gray-600 p-3">
          <div className="mb-2 font-semibold dark:text-gray-100">Request a Day Off</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <select
              className="p-2 border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100"
              value={newDayOff.fellow_id}
              onChange={e => setNewDayOff({ ...newDayOff, fellow_id: e.target.value })}
            >
              <option value="">Select Fellow</option>
              {selectableFellows.map(f => <option key={f.id} value={f.id}>{f.name} (PGY-{f.pgy_level})</option>)}
            </select>
            <input
              type="date"
              className="p-2 border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100"
              value={newDayOff.date}
              onChange={e => setNewDayOff({ ...newDayOff, date: e.target.value })}
            />
            <select
              className="p-2 border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100"
              value={newDayOff.reason_type}
              onChange={e => setNewDayOff({ ...newDayOff, reason_type: e.target.value })}
            >
              <option value="Sick Day">Sick Day</option>
              <option value="Conference">Conference</option>
              <option value="Board Exam">Board Exam</option>
              <option value="FLEX Day">Flex Day</option>
            </select>
          </div>
          <button
            onClick={submitDayOff}
            disabled={submitting || !newDayOff.fellow_id || !newDayOff.date}
            className="mt-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-xs"
          >
            {submitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </div>
      )}

      {/* Historical (Approved/Denied) — Tabbed */}
      <div className="bg-white dark:bg-gray-700 rounded border dark:border-gray-600">
        <button
          type="button"
          onClick={() => setHistoricalOpen(o => !o)}
          className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-600/50 transition-colors"
        >
          <span className="text-sm font-semibold dark:text-gray-100">History</span>
          {historicalOpen ? <ChevronDown /> : <ChevronRight />}
        </button>

        {historicalOpen && (
          <>
            <div className="flex items-center gap-0 border-t border-gray-200 dark:border-gray-600">
              <button
                type="button"
                onClick={() => setHistoricalTab('approved')}
                className={`flex-1 px-3 py-2.5 text-sm font-semibold text-center transition-colors ${
                  historicalTab === 'approved'
                    ? 'text-green-600 dark:text-green-400 border-b-2 border-green-600 dark:border-green-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                Approved {approvedDayOffs.length > 0 && <span className="text-xs">({approvedDayOffs.length})</span>}
              </button>
              <button
                type="button"
                onClick={() => setHistoricalTab('denied')}
                className={`flex-1 px-3 py-2.5 text-sm font-semibold text-center transition-colors ${
                  historicalTab === 'denied'
                    ? 'text-red-600 dark:text-red-400 border-b-2 border-red-600 dark:border-red-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                Denied {deniedDayOffs.length > 0 && <span className="text-xs">({deniedDayOffs.length})</span>}
              </button>
            </div>

            <div className="px-3 py-3 border-t border-gray-100 dark:border-gray-600 space-y-2">
              {historicalRequests.length === 0 ? (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  No {historicalTab} day off requests
                </div>
              ) : (
                historicalRequests.map((r) => (
                  <div
                    key={r.id}
                    className={`flex items-center justify-between border p-2 rounded ${
                      historicalTab === 'approved'
                        ? 'border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900'
                        : 'border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/30'
                    }`}
                  >
                    <div className="text-sm">
                      <div className={`font-semibold ${
                        historicalTab === 'approved'
                          ? 'dark:text-green-100'
                          : 'dark:text-red-100'
                      }`}>
                        {r.fellow?.name ?? 'Unknown Fellow'}
                        <span className={`ml-2 text-xs font-normal ${
                          historicalTab === 'approved'
                            ? 'text-green-600 dark:text-green-300'
                            : 'text-red-600 dark:text-red-300'
                        }`}>PGY-{r.fellow?.pgy_level}</span>
                      </div>
                      <div className={`text-xs ${
                        historicalTab === 'approved'
                          ? 'text-gray-600 dark:text-green-200'
                          : 'text-gray-600 dark:text-red-200'
                      }`}>
                        {r.reason}{r.notes ? ` — ${fmtDayDate(r.notes)}` : ''}
                      </div>
                    </div>
                    <div className={`px-3 py-1 text-white rounded text-xs ${
                      historicalTab === 'approved'
                        ? 'bg-green-600'
                        : 'bg-red-600'
                    }`}>
                      {historicalTab === 'approved' ? 'Approved' : 'Denied'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
