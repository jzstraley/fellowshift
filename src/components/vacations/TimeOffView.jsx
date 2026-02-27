// src/components/vacations/TimeOffView.jsx
// Rewritten to be predictable and role-correct.
// - Pending: requester can cancel, leaders can approve/deny/cancel
// - Approved: ONLY leaders can cancel (with in-app modal popup, not window.confirm)
// - Denied: requester can cancel, leaders can cancel (optional; keeps UI consistent)
// - Uses getRequestExtras / formatBlockRange for display but never crashes if missing.

import React, { useMemo, useState } from "react";

function Badge({ children, className = "" }) {
  return (
    <div className={`px-3 py-1 rounded text-xs font-semibold ${className}`}>
      {children}
    </div>
  );
}

function Button({ children, className = "", disabled, onClick, title, variant = "default" }) {
  const base =
    "px-2 py-1 rounded border text-xs disabled:opacity-50 transition-colors";
  const variants = {
    default:
      "bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border-gray-200 dark:border-gray-600",
    danger:
      "bg-white dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-950/40 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300",
    approve:
      "bg-white dark:bg-gray-800 hover:bg-green-50 dark:hover:bg-green-950/40 border-green-300 dark:border-green-700 text-green-800 dark:text-green-200",
  };
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${variants[variant] || variants.default} ${className}`}
    >
      {children}
    </button>
  );
}

function ConfirmModal({
  open,
  title = "Confirm",
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  busy = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={busy ? undefined : onCancel}
      />
      <div className="relative w-[min(92vw,460px)] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-xl">
        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {title}
        </div>
        {message ? (
          <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            {message}
          </div>
        ) : null}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="px-3 py-1.5 rounded border text-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 border-gray-200 dark:border-gray-600"
          >
            {cancelText}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="px-3 py-1.5 rounded bg-red-600 text-white text-sm hover:opacity-90 disabled:opacity-50"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

function safeStr(v) {
  return typeof v === "string" ? v : "";
}

function defaultFormatBlockRange(r, getRequestExtras) {
  try {
    const ex = getRequestExtras ? getRequestExtras(r) : null;
    if (ex?.start && ex?.end) return `${ex.start} to ${ex.end}`;
  } catch (_) {}

  // fallback to block numbers if joined block_dates exist
  const sb = r?.start_block?.block_number;
  const eb = r?.end_block?.block_number;
  if (sb && eb) return `Week ${sb}${sb === eb ? "" : ` to ${eb}`}`;

  return "Unknown dates";
}

function RequestCard({
  r,
  submitting,
  userCanApprove,
  userId,
  getRequestExtras,
  formatBlockRange,
  onApprove,
  onDeny,
  onCancel,
  showApprove,
  showDeny,
  showCancel,
  rightBadge,
  rightBadgeClass,
  extraRight,
}) {
  const fellowName = r?.fellow?.name ?? "Unknown Fellow";
  const pgy = r?.fellow?.pgy_level ?? "?";

  const rangeText = (formatBlockRange || ((x) => defaultFormatBlockRange(x, getRequestExtras)))(r);
  const reason = safeStr(r?.reason) || "Vacation";
  const approvedAt = r?.approved_at ? new Date(r.approved_at).toLocaleDateString() : null;

  return (
    <div className="flex items-center justify-between rounded border p-2">
      <div className="text-sm">
        <div className="font-semibold">
          {fellowName}
          <span className="ml-2 text-xs font-normal opacity-80">
            PGY-{pgy}
          </span>
        </div>

        <div className="text-xs opacity-80">
          {rangeText} {" — "} {reason}
        </div>

        {approvedAt ? (
          <div className="text-xs opacity-70 mt-0.5">Approved {approvedAt}</div>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        {showApprove ? (
          <Button
            variant="approve"
            disabled={submitting}
            onClick={() => onApprove?.(r.id)}
            title="Approve request"
          >
            Approve
          </Button>
        ) : null}

        {showDeny ? (
          <Button
            variant="danger"
            disabled={submitting}
            onClick={() => onDeny?.(r.id)}
            title="Deny request"
          >
            Deny
          </Button>
        ) : null}

        {showCancel ? (
          <Button
            variant="danger"
            disabled={submitting}
            onClick={() => onCancel?.(r)}
            title="Cancel request"
          >
            Cancel
          </Button>
        ) : null}

        {extraRight}

        {rightBadge ? (
          <Badge className={rightBadgeClass}>{rightBadge}</Badge>
        ) : null}
      </div>
    </div>
  );
}

export default function TimeOffView({
  // auth / ui
  userCanApprove = false,
  userCanRequest = true,
  userId,

  // state
  submitting = false,

  // data
  pendingRequests = [],
  approvedRequests = [],
  deniedRequests = [],

  // actions
  approveDbRequest,
  denyDbRequest,
  cancelDbRequest,

  // helpers
  getRequestExtras,

  // form wiring (kept but not rewritten here; you can keep your existing "New Request" UI elsewhere)
  newDbReq,
  setNewDbReq,
  submitDbRequest,
  blockDates,
  parentBlockDates,
  splitLocalWeeks,
  weeklyBlocks,
  selectableFellows,
}) {
  const [denyOpen, setDenyOpen] = useState(false);
  const [denyTargetId, setDenyTargetId] = useState(null);
  const [denyText, setDenyText] = useState("");

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null); // { id, label, isApproved }

  const formatBlockRange = useMemo(() => {
    return (r) => defaultFormatBlockRange(r, getRequestExtras);
  }, [getRequestExtras]);

  const openDeny = (id) => {
    setDenyTargetId(id);
    setDenyText("");
    setDenyOpen(true);
  };

  const openCancel = (r, isApproved) => {
    const label = `${r?.fellow?.name ?? "Unknown"}: ${formatBlockRange(r)} (${safeStr(r?.reason) || "Vacation"})`;
    setCancelTarget({ id: r?.id, label, isApproved: !!isApproved });
    setCancelOpen(true);
  };

  const canCancelNonApproved = (r) => {
    // requesters can cancel their own pending/denied (your hook enforces requested_by match if non-leader)
    // leaders can cancel too
    return userCanApprove || safeStr(r?.requested_by) === safeStr(userId);
  };

return (
  <div className="space-y-3">
    {/* Pending */}
    <div className="bg-white dark:bg-gray-700 rounded border dark:border-gray-600 p-3">
      <div className="mb-2 font-semibold dark:text-gray-100">
        Pending Vacations ({pendingRequests.length})
      </div>

      {pendingRequests.length === 0 ? (
        <div className="text-xs text-gray-500 dark:text-gray-400">No pending vacations</div>
      ) : (
        <div className="space-y-2">
          {pendingRequests.map((r) => (
            <div
              key={r.id}
              className="border border-yellow-200 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/40 rounded p-2"
            >
              <RequestCard
                r={r}
                submitting={submitting}
                userCanApprove={userCanApprove}
                userId={userId}
                getRequestExtras={getRequestExtras}
                formatBlockRange={formatBlockRange}
                onApprove={approveDbRequest}
                onDeny={openDeny}
                onCancel={() => openCancel(r, false)}
                showApprove={userCanApprove}
                showDeny={userCanApprove}
                showCancel={canCancelNonApproved(r)}
                rightBadge="Pending"
                rightBadgeClass="bg-yellow-600 text-white"
              />
            </div>
          ))}
        </div>
      )}
    </div>

    {/* Approved */}
    <div className="bg-white dark:bg-gray-700 rounded border dark:border-gray-600 p-3">
      <div className="mb-2 font-semibold dark:text-gray-100">
        Approved Vacations ({approvedRequests.length})
      </div>

      {approvedRequests.length === 0 ? (
        <div className="text-xs text-gray-500 dark:text-gray-400">No approved vacations</div>
      ) : (
        <div className="space-y-2">
          {approvedRequests.map((r) => (
            <div
              key={r.id}
              className="border border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/40 rounded p-2"
            >
              <RequestCard
                r={r}
                submitting={submitting}
                userCanApprove={userCanApprove}
                userId={userId}
                getRequestExtras={getRequestExtras}
                formatBlockRange={formatBlockRange}
                onCancel={() => openCancel(r, true)}
                showCancel={userCanApprove} // leadership only
                rightBadge="Approved"
                rightBadgeClass="bg-green-600 text-white"
              />
            </div>
          ))}
        </div>
      )}
    </div>

    {/* Denied */}
    <div className="bg-white dark:bg-gray-700 rounded border dark:border-gray-600 p-3">
      <div className="mb-2 font-semibold dark:text-gray-100">
        Denied Vacations ({deniedRequests.length})
      </div>

      {deniedRequests.length === 0 ? (
        <div className="text-xs text-gray-500 dark:text-gray-400">No denied vacations</div>
      ) : (
        <div className="space-y-2">
          {deniedRequests.map((r) => (
            <div
              key={r.id}
              className="border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/30 rounded p-2"
            >
              <RequestCard
                r={r}
                submitting={submitting}
                userCanApprove={userCanApprove}
                userId={userId}
                getRequestExtras={getRequestExtras}
                formatBlockRange={formatBlockRange}
                onCancel={() => openCancel(r, false)}
                showCancel={canCancelNonApproved(r)}
                rightBadge="Denied"
                rightBadgeClass="bg-red-600 text-white"
              />
            </div>
          ))}
        </div>
      )}
    </div>

    {/* Deny Modal */}
    <ConfirmModal
      open={denyOpen}
      title="Deny vacation request?"
      message={
        <div className="space-y-2">
          <div className="text-sm">
            Add an optional note. This will set the request to denied.
          </div>
          <textarea
            value={denyText}
            onChange={(e) => setDenyText(e.target.value)}
            rows={3}
            className="w-full rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 p-2 text-sm"
            placeholder="Reason for denial (optional)"
          />
        </div>
      }
      confirmText="Deny"
      cancelText="Cancel"
      busy={submitting}
      onCancel={() => {
        setDenyOpen(false);
        setDenyTargetId(null);
        setDenyText("");
      }}
      onConfirm={async () => {
        if (!denyTargetId) return;
        await denyDbRequest?.(denyTargetId, denyText);
        setDenyOpen(false);
        setDenyTargetId(null);
        setDenyText("");
      }}
    />

    {/* Cancel Modal */}
    <ConfirmModal
      open={cancelOpen}
      title={cancelTarget?.isApproved ? "Cancel approved vacation?" : "Cancel vacation request?"}
      message={cancelTarget?.label ? cancelTarget.label : "This will cancel the request."}
      confirmText="Yes, cancel"
      cancelText="No"
      busy={submitting}
      onCancel={() => {
        setCancelOpen(false);
        setCancelTarget(null);
      }}
      onConfirm={async () => {
        const id = cancelTarget?.id;
        if (!id) return;
        await cancelDbRequest?.(id);
        setCancelOpen(false);
        setCancelTarget(null);
      }}
    />


    {/* New Request */}
{/* New Request */}
<div className="bg-white dark:bg-gray-700 rounded border dark:border-gray-600 p-3">
  <div className="flex items-center justify-between mb-2">
    <div className="font-semibold dark:text-gray-100">New Vacation Request</div>
  </div>

  {!userCanRequest ? (
    <div className="text-xs text-gray-500 dark:text-gray-400">
      You do not have permission to submit requests.
    </div>
  ) : (
    <div className="space-y-3">
      {/* Reason quick buttons */}
      <div className="flex flex-wrap gap-2">
        {["Vacation"].map((label) => {
          const active = (newDbReq?.reason ?? "Vacation") === label;
          return (
            <button
              key={label}
              type="button"
              disabled={submitting}
              onClick={() => setNewDbReq((p) => ({ ...(p || {}), reason: label }))}
              className={
                "px-3 py-1.5 rounded border text-xs transition-colors disabled:opacity-50 " +
                (active
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-600 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-100")
              }
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Fellow */}
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-300 mb-1">
            Fellow
          </label>
          <select
            value={newDbReq?.fellow_id ?? ""}
            disabled={submitting}
            onChange={(e) => setNewDbReq((p) => ({ ...(p || {}), fellow_id: e.target.value }))}
            className="w-full rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-2 text-sm"
          >
            <option value="">Select</option>
{(selectableFellows || []).map((f, idx) => (
  <option key={`${f.id ?? f.name ?? 'f'}-${idx}`} value={f.id}>
    {f.name}
  </option>
))}
          </select>
          {(!selectableFellows || selectableFellows.length === 0) && (
            <div className="mt-1 text-xs text-yellow-700 dark:text-yellow-300">
              No selectable fellows loaded.
            </div>
          )}
        </div>

        {/* Start block */}
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-300 mb-1">
            Start week
          </label>
          <select
            value={newDbReq?.start_block_id ?? ""}
            disabled={submitting}
            onChange={(e) => setNewDbReq((p) => ({ ...(p || {}), start_block_id: e.target.value }))}
            className="w-full rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-2 text-sm"
          >
            <option value="">Select</option>
{(weeklyBlocks || []).map((b, idx) => (
  <option key={`${b.id ?? b.label ?? 'w'}-${idx}`} value={b.id}>
    {b.label}
  </option>
))}
          </select>
          {(!weeklyBlocks || weeklyBlocks.length === 0) && (
            <div className="mt-1 text-xs text-yellow-700 dark:text-yellow-300">
              No weeks available. Check block dates loading.
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-end gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={() => setNewDbReq({ fellow_id: "", start_block_id: "", reason: "Vacation" })}
            className="px-3 py-2 rounded border border-gray-200 dark:border-gray-600 text-sm hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
          >
            Reset
          </button>
          <button
            type="button"
            disabled={
              submitting ||
              !(newDbReq?.fellow_id) ||
              !(newDbReq?.start_block_id)
            }
            onClick={submitDbRequest}
            className="px-3 py-2 rounded bg-blue-600 text-white text-sm hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit"}
          </button>
        </div>
      </div>
    </div>
  )}
</div>

  </div>
);
}