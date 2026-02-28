import { CheckCircle, AlertTriangle, ArrowLeftRight, X } from 'lucide-react';
import { SWAP_RESET, parseSwapReason, fmtSwapBlock } from '../../utils/vacationHelpers';
import SwapPreview from './SwapPreview';

export default function SwapsView({
  pendingSwaps,
  approvedSwaps,
  deniedSwaps,
  dismissedSwapIds, dismissSwap,
  userCanApprove,
  userCanRequest,
  userId,
  submitting,
  denyingId, setDenyingId,
  denyReason, setDenyReason,
  approveDbSwap, denyDbSwap, cancelDbSwap,
  newDbSwap, setNewDbSwap, submitDbSwap, newDbSwapError,
  selectableFellows,
  myShifts, validSwapTargets,
  getBlockDetails, getShiftDateLabel,
  blockDates,
}) {
  return (
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
            // Requester's block: stored column or fall back to parsing from reason/reqKey
            const reqBlockMatch = (parsed.reqKey || r.reason || '').match(/B(\d+)/);
            const swapBlockNum = r.block_number || (reqBlockMatch ? Number(reqBlockMatch[1]) : null);
            // Target's block: bilateral format stores it in tgtKey (e.g. "B4-W2")
            const tgtKeyMatch = parsed.tgtKey?.match(/^B(\d+)-W([12])$/);
            const tgtBlock = tgtKeyMatch ? Number(tgtKeyMatch[1]) : swapBlockNum;
            const toWk = r.to_week_part ?? (tgtKeyMatch ? Number(tgtKeyMatch[2]) : null);
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
                      {fmtSwapBlock(r.block_number, parsed.weekend, blockDates)} - {label}{note}
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
                              placeholder="Denial reason…"
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
                    {r.requested_by === userId && (
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
                {r.requester?.name && r.target?.name && (swapBlockNum || tgtBlock) && (
                  <SwapPreview
                    requester={r.requester.name}
                    target={r.target.name}
                    reqBlock={swapBlockNum}
                    fromWk={r.from_week_part ?? parsed.weekend ?? null}
                    tgtBlock={tgtBlock}
                    toWk={toWk}
                    getBlockDetails={getBlockDetails}
                  />
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
            const label = parsed.swapType
              ? `${parsed.swapType === 'call' ? 'Call' : 'Float'} W${parsed.weekend ?? 1}`
              : 'Rotation swap';
            return (
              <div key={r.id} className="flex items-center justify-between border border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900 p-2 rounded">
                <div className="text-sm">
                  <div className="font-semibold dark:text-green-100 flex items-center gap-1">
                    {r.requester?.name ?? '?'} <ArrowLeftRight className="w-3 h-3 text-green-500" /> {r.target?.name ?? '?'}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-green-200">
                    {fmtSwapBlock(r.block_number, parsed.weekend, blockDates)} — {label}{parsed.note ? ` — ${parsed.note}` : ''}
                  </div>
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
              const swapLabel = parsed.swapType === 'call' ? 'Call' : parsed.swapType === 'float' ? 'Float' : null;
              const fromWk = r.from_week_part ?? parsed.weekend ?? null;
              const toWk = r.to_week_part ?? null;
              const violationLines = r.notes ? r.notes.split('\n').filter(Boolean) : [];

              // Human-readable swap direction: "Austin gives up Call Wk 1 · Alex gives up Call Wk 2"
              let swapDetail;
              if (swapLabel && fromWk) {
                const reqPart = `${r.requester?.name ?? 'Requester'} gives up ${swapLabel} Wk ${fromWk}`;
                const tgtPart = toWk ? ` · ${r.target?.name ?? 'Target'} gives up ${swapLabel} Wk ${toWk}` : '';
                swapDetail = reqPart + tgtPart;
              } else {
                swapDetail = fmtSwapBlock(r.block_number, parsed.weekend, blockDates);
              }

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
                        {swapDetail}{parsed.note ? ` — ${parsed.note}` : ''}
                      </div>
                      {violationLines.length > 0 ? (
                        <div className="mt-1 space-y-0.5">
                          {violationLines.map((line, i) => (
                            <div key={i} className="text-xs text-red-700 dark:text-red-300 leading-tight">
                              ⚠ {line}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-1 text-xs text-gray-400 dark:text-gray-500 italic">No denial reason recorded</div>
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
              {selectableFellows.map(f => <option key={f.id} value={f.id}>{f.name} (PGY-{f.pgy_level})</option>)}
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
                  {s.type === 'call' ? 'Call' : 'Night Float'} — {getShiftDateLabel(s.blockNum, s.weekend)}
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
  );
}
