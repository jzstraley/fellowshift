// LectureList.jsx
// Upcoming lecture agenda grouped by week — the daily-use view for fellows.
// Shows: date chip, time, series badge, title, speaker/presenter, location.
// Past lectures are collapsed under a "Past" toggle.
// TODO: wire to useLectureState or receive lectures/attendance as props.

import { useState, useMemo } from 'react';
import { Calendar, Clock, MapPin, User, ChevronDown, ChevronUp, UserCheck } from 'lucide-react';
import { LECTURE_SERIES } from '../../data/lectureData';

const SERIES_COLOR = {
  [LECTURE_SERIES.CORE_CURRICULUM]:  'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  [LECTURE_SERIES.JOURNAL_CLUB]:     'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  [LECTURE_SERIES.CASE_CONFERENCE]:  'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  [LECTURE_SERIES.BOARD_REVIEW]:     'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  [LECTURE_SERIES.RESEARCH]:         'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
  [LECTURE_SERIES.GUEST_SPEAKER]:    'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  [LECTURE_SERIES.CATH_CONFERENCE]:  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  [LECTURE_SERIES.ECHO_CONFERENCE]:  'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  [LECTURE_SERIES.EP_CONFERENCE]:    'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  [LECTURE_SERIES.M_AND_M]:          'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
};

const today = new Date().toISOString().split('T')[0];

// Returns true when the ±15-minute check-in window is open.
// Respects admin override: checkInOpen === true/false overrides the time window.
function isInCheckInWindow(lecture) {
  if (lecture?.checkInOpen === true) return true;
  if (lecture?.checkInOpen === false) return false;
  if (!lecture?.date || !lecture?.time) return false;
  const now = new Date();
  const start = new Date(`${lecture.date}T${lecture.time}`);
  return Math.abs(now - start) <= 15 * 60 * 1000;
}

function fmt12(time) {
  const [h, m] = time.split(':');
  const hr = parseInt(h);
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
}

function weekLabel(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDay(); // 0=Sun
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (x) => x.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `Week of ${fmt(monday)} – ${fmt(sunday)}`;
}

// Group lectures by ISO week (Mon–Sun)
function groupByWeek(lectures) {
  const groups = {};
  for (const lec of lectures) {
    const label = weekLabel(lec.date);
    if (!groups[label]) groups[label] = [];
    groups[label].push(lec);
  }
  return groups;
}

export default function LectureList({
  lectures = [],
  attendance = [],
  onSelect,
  canManage = false,
  onCheckIn,      // async (lectureId) => void — fellow self-check-in
  myFellowId,     // uuid of the current user's fellow record (null if not a fellow / offline)
}) {
  const [showPast, setShowPast] = useState(false);

  const { upcoming, past } = useMemo(() => {
    const sorted = [...lectures].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
    return {
      upcoming: sorted.filter(l => l.date >= today),
      past:     sorted.filter(l => l.date < today).reverse(), // newest-past first
    };
  }, [lectures]);

  const upcomingGroups = useMemo(() => groupByWeek(upcoming), [upcoming]);
  const pastGroups     = useMemo(() => groupByWeek(past),     [past]);

  // Quick attendance summary for a lecture (admin only)
  const attSummary = (lectureId) => {
    const rows = attendance.filter(a => a.lecture_id === lectureId);
    const present = rows.filter(a => a.status === 'present' || a.status === 'late').length;
    const absent  = rows.filter(a => a.status === 'absent').length;
    return rows.length ? `${present}✓ ${absent}✗` : null;
  };

  const renderLecture = (lec) => {
    const speaker    = lec.speaker?.name || lec.presenter?.name || 'TBD';
    const summary    = canManage ? attSummary(lec.id) : null;
    const isToday    = lec.date === today;
    const inWindow   = isInCheckInWindow(lec);
    const myRow      = myFellowId
      ? attendance.find(a => a.lecture_id === lec.id && a.fellow_id === myFellowId)
      : null;
    const checkedIn  = myRow?.status === 'present' || myRow?.status === 'late';

    return (
      // Outer div so we can place the check-in button as a sibling to the card button
      <div key={lec.id} className="flex items-stretch">
        <button
          onClick={() => onSelect?.(lec)}
          className="flex-1 text-left flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        >
          {/* Date chip */}
          <div className={`flex-shrink-0 w-12 text-center rounded-lg py-1 ${
            isToday ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
          }`}>
            <div className="text-xs font-semibold">
              {new Date(`${lec.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short' })}
            </div>
            <div className="text-lg font-bold leading-none">
              {new Date(`${lec.date}T00:00:00`).getDate()}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${SERIES_COLOR[lec.series] || 'bg-gray-100 text-gray-600'}`}>
                {lec.series}
              </span>
              {isToday && <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold">Today</span>}
              {inWindow && <span className="text-xs text-green-500 dark:text-green-400 font-semibold">● Live</span>}
            </div>
            <div className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">{lec.title}</div>
            <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />{fmt12(lec.time)} · {lec.duration_min || lec.duration || 60} min
              </span>
              {lec.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />{lec.location}
                </span>
              )}
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />{speaker}
              </span>
            </div>
          </div>

          {/* Attendance summary (admin only) */}
          {canManage && summary && (
            <div className="flex-shrink-0 text-xs text-gray-400 dark:text-gray-500 font-mono pt-1">
              {summary}
            </div>
          )}
        </button>

        {/* Check In button — fellows only, during the live window */}
        {!canManage && inWindow && myFellowId && (
          <div className="flex items-center px-3 border-l border-gray-100 dark:border-gray-700">
            {checkedIn ? (
              <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-semibold whitespace-nowrap">
                <UserCheck className="w-3.5 h-3.5" />
                In
              </span>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); onCheckIn?.(lec.id); }}
                className="text-xs px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded whitespace-nowrap"
              >
                Check In
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderGroups = (groups) =>
    Object.entries(groups).map(([label, lecs]) => (
      <div key={label}>
        <div className="px-4 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
          {label}
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {lecs.map(renderLecture)}
        </div>
      </div>
    ));

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
      {/* Upcoming */}
      {upcoming.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
          No upcoming lectures scheduled
        </div>
      ) : (
        renderGroups(upcomingGroups)
      )}

      {/* Past toggle */}
      {past.length > 0 && (
        <>
          <button
            onClick={() => setShowPast(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700"
          >
            <span>{past.length} past lecture{past.length !== 1 ? 's' : ''}</span>
            {showPast ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showPast && (
            <div className="opacity-70">
              {renderGroups(pastGroups)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
