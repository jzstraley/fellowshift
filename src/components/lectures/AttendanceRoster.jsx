// AttendanceRoster.jsx
// Attendance roster modal — visible to admin/PD/chief only.
// Lists all active fellows with their status for a given lecture.
// Admins can manually set each fellow's status and finalize (mark remaining as absent).

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';

const STATUS_CONFIG = {
  present: { label: 'Present', short: 'P', active: 'bg-green-600 text-white',  idle: 'hover:bg-green-100 dark:hover:bg-green-900/30 hover:text-green-700' },
  late:    { label: 'Late',    short: 'L', active: 'bg-yellow-500 text-white', idle: 'hover:bg-yellow-100 dark:hover:bg-yellow-900/30 hover:text-yellow-700' },
  excused: { label: 'Excused', short: 'E', active: 'bg-blue-600 text-white',   idle: 'hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-700' },
  absent:  { label: 'Absent',  short: 'A', active: 'bg-red-600 text-white',    idle: 'hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-700' },
};

const PGY_COLOR = {
  1: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  2: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  3: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
};

function fmt12(time) {
  if (!time) return '';
  const [h, m] = time.split(':');
  const hr = parseInt(h);
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
}

export default function AttendanceRoster({
  lecture,
  attendance = [],      // rows from lecture_attendance for this lecture only
  fellows = [],         // all active fellows
  onUpsert,             // async (fellowId, status, notes) => void
  onFinalize,           // async () => void — marks remaining fellows as absent
  onClose,
  submitting = false,
}) {
  const [expandedFellow, setExpandedFellow] = useState(null);
  const [noteInputs, setNoteInputs]         = useState({});  // fellowId → string

  // Map fellowId → attendance row for O(1) lookups
  const attMap = Object.fromEntries(attendance.map(a => [a.fellow_id, a]));

  // Sort fellows: PGY level asc, then name asc
  const sortedFellows = [...fellows].sort((a, b) => {
    const pa = a.pgy_level ?? 99;
    const pb = b.pgy_level ?? 99;
    return pa !== pb ? pa - pb : a.name.localeCompare(b.name);
  });

  // Summary counts
  const counts = sortedFellows.reduce(
    (acc, f) => {
      const status = attMap[f.id]?.status;
      acc[status ?? 'none'] = (acc[status ?? 'none'] || 0) + 1;
      return acc;
    },
    { present: 0, late: 0, excused: 0, absent: 0, none: 0 },
  );

  const handleSetStatus = async (fellowId, status) => {
    const notes = noteInputs[fellowId] ?? attMap[fellowId]?.notes ?? null;
    await onUpsert?.(fellowId, status, notes || null);
  };

  const handleNoteBlur = async (fellowId) => {
    const row = attMap[fellowId];
    if (!row) return; // no status yet — note will be saved when status is clicked
    await onUpsert?.(fellowId, row.status, noteInputs[fellowId] ?? row.notes ?? null);
  };

  const handleFinalize = async () => {
    if (!window.confirm(
      `Mark all ${counts.none} fellow${counts.none !== 1 ? 's' : ''} with no record as Absent?`
    )) return;
    await onFinalize?.();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-lg shadow-xl flex flex-col max-h-[90vh]">

          {/* Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-start justify-between gap-3 flex-shrink-0">
            <div>
              <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">
                Attendance
              </div>
              <h3 className="font-bold text-gray-900 dark:text-gray-100 leading-tight">
                {lecture.title}
              </h3>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {new Date(`${lecture.date}T00:00:00`).toLocaleDateString('en-US', {
                  weekday: 'short', month: 'short', day: 'numeric',
                })}
                {' · '}{fmt12(lecture.time)} · {lecture.duration || 60} min
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex-shrink-0 mt-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Summary bar */}
          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3 flex-shrink-0">
            <div className="flex items-center gap-3 text-xs flex-wrap">
              <span className="text-green-600 dark:text-green-400 font-semibold">
                {counts.present}✓ present
              </span>
              {counts.late > 0 && (
                <span className="text-yellow-600 dark:text-yellow-400 font-semibold">{counts.late} late</span>
              )}
              {counts.excused > 0 && (
                <span className="text-blue-600 dark:text-blue-400 font-semibold">{counts.excused} excused</span>
              )}
              <span className="text-red-600 dark:text-red-400 font-semibold">{counts.absent}✗ absent</span>
              {counts.none > 0 && (
                <span className="text-gray-400 dark:text-gray-500 font-semibold">{counts.none} no record</span>
              )}
            </div>
            {counts.none > 0 && (
              <button
                onClick={handleFinalize}
                disabled={submitting}
                className="text-xs px-2.5 py-1 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded font-semibold disabled:opacity-50 flex items-center gap-1 flex-shrink-0"
              >
                {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
                Finalize
              </button>
            )}
          </div>

          {/* Fellow list */}
          <div className="overflow-y-auto flex-1 divide-y divide-gray-100 dark:divide-gray-700">
            {sortedFellows.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                No active fellows found
              </div>
            )}
            {sortedFellows.map(fellow => {
              const row = attMap[fellow.id];
              const currentStatus = row?.status ?? null;
              const isExpanded = expandedFellow === fellow.id;
              const noteVal = noteInputs[fellow.id] ?? row?.notes ?? '';
              const showNotes = currentStatus === 'excused' || noteVal;

              return (
                <div key={fellow.id} className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    {/* PGY chip */}
                    {fellow.pgy_level && (
                      <span className={`text-xs px-1.5 py-0.5 rounded font-semibold flex-shrink-0 ${
                        PGY_COLOR[fellow.pgy_level] || 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        PGY{fellow.pgy_level}
                      </span>
                    )}

                    {/* Name */}
                    <span className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {fellow.name}
                    </span>

                    {/* Status buttons */}
                    <div className="flex gap-1 flex-shrink-0">
                      {Object.entries(STATUS_CONFIG).map(([status, cfg]) => (
                        <button
                          key={status}
                          onClick={() => handleSetStatus(fellow.id, status)}
                          disabled={submitting}
                          title={cfg.label}
                          className={`text-xs w-6 h-6 rounded font-bold transition-colors disabled:opacity-50 ${
                            currentStatus === status
                              ? cfg.active
                              : `bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 ${cfg.idle}`
                          }`}
                        >
                          {cfg.short}
                        </button>
                      ))}
                    </div>

                    {/* Notes toggle */}
                    {showNotes && (
                      <button
                        onClick={() => setExpandedFellow(isExpanded ? null : fellow.id)}
                        className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0 underline underline-offset-2"
                      >
                        notes
                      </button>
                    )}
                  </div>

                  {/* Notes input (expanded) */}
                  {isExpanded && (
                    <div className="mt-1.5">
                      <input
                        type="text"
                        value={noteVal}
                        onChange={e => setNoteInputs(prev => ({ ...prev, [fellow.id]: e.target.value }))}
                        onBlur={() => handleNoteBlur(fellow.id)}
                        placeholder="Reason / notes..."
                        className="w-full text-xs px-2 py-1.5 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 placeholder-gray-400"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex justify-end flex-shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
