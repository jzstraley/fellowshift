// DayOffView.js

import { CheckCircle, AlertTriangle, X } from 'lucide-react';

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
  const fmtDayDate = (notes) =>
    notes
      ? new Date(notes + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
      : null;

  return (
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
                  {r.reason}{r.notes ? ` — ${fmtDayDate(r.notes)}` : ''}
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
                  {r.reason}{r.notes ? ` — ${fmtDayDate(r.notes)}` : ''}
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
                    {r.reason}{r.notes ? ` — ${fmtDayDate(r.notes)}` : ''}
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
              <option value="Personal Day">Personal Day</option>
              <option value="Conference">Conference</option>
              <option value="CME">CME</option>
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
    </>
  );
}
