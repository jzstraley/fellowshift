// PresenterSchedule.jsx
// Year-long presenter assignment table for PDs.
// Rows = fellows, cols = lecture slots where a fellow is presenter or speaker.
// Shows: total assigned count per fellow, unassigned lecture count.
// Clicking a cell opens the lecture; clicking a fellow opens their full list.
// TODO: "Auto-assign" button that distributes unassigned lectures evenly by PGY.

import { useMemo, useState } from 'react';
import { AlertTriangle, User, BookOpen } from 'lucide-react';
import { LECTURE_SERIES } from '../../data/lectureData';

const SERIES_DOT = {
  [LECTURE_SERIES.CORE_CURRICULUM]: 'bg-blue-500',
  [LECTURE_SERIES.JOURNAL_CLUB]:    'bg-green-500',
  [LECTURE_SERIES.CASE_CONFERENCE]: 'bg-purple-500',
  [LECTURE_SERIES.BOARD_REVIEW]:    'bg-yellow-500',
  [LECTURE_SERIES.RESEARCH]:        'bg-pink-500',
  [LECTURE_SERIES.GUEST_SPEAKER]:   'bg-red-500',
  [LECTURE_SERIES.CATH_CONFERENCE]: 'bg-cyan-500',
  [LECTURE_SERIES.ECHO_CONFERENCE]: 'bg-teal-500',
  [LECTURE_SERIES.EP_CONFERENCE]:   'bg-indigo-500',
  [LECTURE_SERIES.M_AND_M]:         'bg-orange-500',
};

function fmtDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function PresenterSchedule({
  lectures = [],   // from useLectureState
  fellows = [],    // fellow objects: { id, name, pgy_level }
  onSelectLecture, // (lecture) => void
  canManage = false,
}) {
  const [selectedFellow, setSelectedFellow] = useState(null);

  // Build per-fellow assignment list
  const fellowAssignments = useMemo(() => {
    const map = new Map();
    for (const f of fellows) map.set(f.id, { fellow: f, lectures: [] });

    for (const lec of lectures) {
      if (lec.presenter_fellow_id && map.has(lec.presenter_fellow_id)) {
        map.get(lec.presenter_fellow_id).lectures.push(lec);
      }
      // Also capture if presenter is stored as a name string (legacy local mode)
      if (lec.presenterFellow) {
        const match = fellows.find(f => f.name === lec.presenterFellow);
        if (match && map.has(match.id)) {
          // avoid double-add if already linked by id
          const existing = map.get(match.id).lectures;
          if (!existing.find(l => l.id === lec.id)) existing.push(lec);
        }
      }
    }

    return [...map.values()].sort((a, b) => {
      // sort by PGY asc then name
      if (a.fellow.pgy_level !== b.fellow.pgy_level) return a.fellow.pgy_level - b.fellow.pgy_level;
      return a.fellow.name.localeCompare(b.fellow.name);
    });
  }, [lectures, fellows]);

  const unassignedLectures = useMemo(
    () => lectures.filter(l => !l.presenter_fellow_id && !l.presenterFellow),
    [lectures]
  );

  // If a fellow is selected, show their full list
  const selected = selectedFellow ? fellowAssignments.find(a => a.fellow.id === selectedFellow) : null;

  return (
    <div className="space-y-4">
      {/* Unassigned warning */}
      {unassignedLectures.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {unassignedLectures.length} lecture{unassignedLectures.length !== 1 ? 's' : ''} without a presenter assigned
          {/* TODO: Add auto-assign button here */}
        </div>
      )}

      {/* Summary table */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
        <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-2">
          <BookOpen className="w-3.5 h-3.5" />
          Presenter Assignments
        </div>

        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {fellowAssignments.map(({ fellow, lectures: assigned }) => {
            const isSelected = fellow.id === selectedFellow;
            return (
              <button
                key={fellow.id}
                onClick={() => setSelectedFellow(isSelected ? null : fellow.id)}
                className="w-full text-left flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                {/* Fellow */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{fellow.name}</span>
                    {fellow.pgy_level && (
                      <span className="text-xs text-gray-400">PGY-{fellow.pgy_level}</span>
                    )}
                  </div>
                </div>

                {/* Assignment dots (up to 8) */}
                <div className="flex items-center gap-1 flex-wrap justify-end max-w-[140px]">
                  {assigned.slice(0, 8).map(lec => (
                    <div
                      key={lec.id}
                      title={`${fmtDate(lec.date)} — ${lec.title}`}
                      className={`w-2.5 h-2.5 rounded-full ${SERIES_DOT[lec.series] || 'bg-gray-400'}`}
                    />
                  ))}
                  {assigned.length > 8 && (
                    <span className="text-xs text-gray-400">+{assigned.length - 8}</span>
                  )}
                  {assigned.length === 0 && (
                    <span className="text-xs text-gray-300 dark:text-gray-600 italic">none</span>
                  )}
                </div>

                {/* Count badge */}
                <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  assigned.length === 0
                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                    : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                }`}>
                  {assigned.length}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Expanded fellow detail */}
      {selected && (
        <div className="rounded-xl border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 overflow-hidden">
          <div className="px-4 py-2 border-b border-blue-100 dark:border-blue-700 text-sm font-semibold text-blue-900 dark:text-blue-200">
            {selected.fellow.name} — {selected.lectures.length} assignment{selected.lectures.length !== 1 ? 's' : ''}
          </div>
          <div className="divide-y divide-blue-100 dark:divide-blue-800">
            {selected.lectures.length === 0 && (
              <div className="px-4 py-3 text-xs text-blue-400">No assigned lectures</div>
            )}
            {selected.lectures.map(lec => (
              <button
                key={lec.id}
                onClick={() => onSelectLecture?.(lec)}
                className="w-full text-left flex items-center gap-3 px-4 py-2.5 hover:bg-blue-100/50 dark:hover:bg-blue-800/30 transition-colors"
              >
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${SERIES_DOT[lec.series] || 'bg-gray-400'}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{lec.title}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{fmtDate(lec.date)} · {lec.series}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
