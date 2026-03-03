// src/components/LectureCalendarView.jsx
import React, { useState, useMemo, useEffect } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  User,
  Users,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Bell,
  Mail,
  RefreshCw,
  Loader2,
  ClipboardList,
  UserCheck,
} from "lucide-react";
import { LECTURE_SERIES, RECURRENCE, RSVP_STATUS } from "../data/lectureData";
import { useAuth } from "../context/AuthContext";
import { isSupabaseConfigured } from "../lib/supabaseClient";
import { useLectureState } from "./lectures/useLectureState";
import LectureList from "./lectures/LectureList";
import PresenterSchedule from "./lectures/PresenterSchedule";
import AttendanceRoster from "./lectures/AttendanceRoster";

export default function LectureCalendarView({
  lectures: propLectures,
  setLectures,
  speakers: propSpeakers,
  setSpeakers,
  topics,
  fellows: propFellows,
  onSendReminder,
  darkMode,
  canManageLectures = false,
}) {
  const { user, profile, programId } = useAuth();
  const useDatabase = isSupabaseConfigured && !!user;

  const dbState = useLectureState({
    useDatabase,
    institutionId: profile?.institution_id,
    programId,
    user,
    userCanApprove: canManageLectures,
    setLectures,
    setSpeakers,
  });

  // Prefer DB data when Supabase is configured, fall back to props
  const lectures  = useDatabase ? dbState.lectures  : (propLectures  ?? []);
  const speakers  = useDatabase ? dbState.speakers  : (propSpeakers  ?? []);
  // fellows: DB gives objects; props give name strings — normalize to objects
  const fellowObjects = useMemo(() => {
    if (useDatabase && dbState.fellows.length) return dbState.fellows;
    return (propFellows ?? []).map((f) =>
      typeof f === 'string' ? { id: f, name: f, pgy_level: null } : f
    );
  }, [useDatabase, dbState.fellows, propFellows]);
  // Keep plain string array for existing RSVP UI
  const fellows = useMemo(() =>
    fellowObjects.map((f) => f.name),
    [fellowObjects]
  );

  const [viewMode, setViewMode] = useState("calendar"); // calendar, agenda, list, presenter, manage
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedLecture, setSelectedLecture] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLecture, setEditingLecture] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [attendanceRosterLecture, setAttendanceRosterLecture] = useState(null);

  // Listen for keyboard nav events (←/→ arrow keys)
  useEffect(() => {
    const handleNav = (e) => {
      const dir = e.detail?.direction;
      if (dir) {
        setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + dir));
      }
    };
    window.addEventListener("fellowshift:nav", handleNav);
    return () => window.removeEventListener("fellowshift:nav", handleNav);
  }, []);

  // Listen for escape to close modals
  useEffect(() => {
    const handleEscape = () => {
      if (editingLecture || showAddModal) {
        setEditingLecture(null);
        setShowAddModal(false);
      }
      if (selectedLecture) setSelectedLecture(null);
    };
    window.addEventListener("fellowshift:escape", handleEscape);
    return () => window.removeEventListener("fellowshift:escape", handleEscape);
  }, [editingLecture, showAddModal, selectedLecture]);

  // ── Attendance helpers ────────────────────────────────────────────────────
  // Returns true when the check-in window is open for a lecture.
  // check_in_open === true  → admin has manually opened it
  // check_in_open === false → admin has manually closed it
  // check_in_open === null  → auto: ±15 minutes around lecture start time
  const isInCheckInWindow = (lecture) => {
    if (lecture?.checkInOpen === true) return true;
    if (lecture?.checkInOpen === false) return false;
    if (!lecture?.date || !lecture?.time) return false;
    const now = new Date();
    const start = new Date(`${lecture.date}T${lecture.time}`);
    return Math.abs(now - start) <= 15 * 60 * 1000;
  };

  const handleCheckIn = async (lectureId) => {
    await dbState.checkIn(lectureId);
  };

  // Admin toggle: null (auto) ↔ true (force open). To force-close use false.
  const handleToggleCheckInWindow = async (lecture) => {
    const newVal = lecture.checkInOpen === true ? null : true;
    await dbState.updateLecture(lecture.id, { ...lecture, checkInOpen: newVal });
    setSelectedLecture(prev =>
      prev?.id === lecture.id ? { ...prev, checkInOpen: newVal } : prev,
    );
  };

  // Form state for add/edit
  const [formData, setFormData] = useState({
    title: "",
    topicId: "",
    speakerId: "",
    presenterFellowId: "",
    date: "",
    time: "12:00",
    duration: 60,
    location: "",
    series: LECTURE_SERIES.CORE_CURRICULUM,
    recurrence: RECURRENCE.NONE,
    notes: "",
  });

  // Get lectures for a specific date
  const getLecturesForDate = (dateStr) => {
    return lectures.filter((l) => l.date === dateStr);
  };

  // Calendar grid generation
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay();
    const days = [];

    // Previous month padding
    for (let i = 0; i < startPad; i++) {
      const d = new Date(year, month, -startPad + i + 1);
      days.push({ date: d, isCurrentMonth: false });
    }

    // Current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }

    // Next month padding
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }

    return days;
  }, [currentMonth]);

  const formatDateStr = (date) => {
    return date.toISOString().split("T")[0];
  };

  const formatTime = (time) => {
    const [h, m] = time.split(":");
    const hour = parseInt(h);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${m} ${ampm}`;
  };

  const getSeriesColor = (series) => {
    const colors = {
      [LECTURE_SERIES.CORE_CURRICULUM]: "bg-blue-500",
      [LECTURE_SERIES.JOURNAL_CLUB]: "bg-green-500",
      [LECTURE_SERIES.CASE_CONFERENCE]: "bg-purple-500",
      [LECTURE_SERIES.BOARD_REVIEW]: "bg-yellow-500",
      [LECTURE_SERIES.RESEARCH]: "bg-pink-500",
      [LECTURE_SERIES.GUEST_SPEAKER]: "bg-red-500",
      [LECTURE_SERIES.CATH_CONFERENCE]: "bg-cyan-500",
      [LECTURE_SERIES.ECHO_CONFERENCE]: "bg-teal-500",
      [LECTURE_SERIES.EP_CONFERENCE]: "bg-indigo-500",
      [LECTURE_SERIES.M_AND_M]: "bg-orange-500",
    };
    return colors[series] || "bg-gray-500";
  };

  const handleAddLecture = async () => {
    if (useDatabase) {
      await dbState.addLecture({ ...formData, rsvps: {}, reminderSent: false });
    } else {
      const newLecture = { id: `lec${Date.now()}`, ...formData, rsvps: {}, reminderSent: false };
      setLectures([...(propLectures ?? []), newLecture]);
    }
    setShowAddModal(false);
    resetForm();
  };

  const handleUpdateLecture = async () => {
    if (useDatabase) {
      await dbState.updateLecture(editingLecture.id, formData);
    } else {
      setLectures(
        (propLectures ?? []).map((l) =>
          l.id === editingLecture.id ? { ...l, ...formData } : l
        )
      );
    }
    setEditingLecture(null);
    resetForm();
  };

  const handleDeleteLecture = async (id) => {
    if (confirm("Delete this lecture?")) {
      if (useDatabase) {
        await dbState.deleteLecture(id);
      } else {
        setLectures((propLectures ?? []).filter((l) => l.id !== id));
      }
      setSelectedLecture(null);
    }
  };

  const handleRSVP = async (lectureId, fellow, status) => {
    // lecture_rsvps is a separate table not yet wired to the hook — local-only for now
    setLectures(
      (propLectures ?? []).map((l) =>
        l.id === lectureId
          ? { ...l, rsvps: { ...l.rsvps, [fellow]: status } }
          : l
      )
    );
  };

  const resetForm = () => {
    setFormData({
      title: "",
      topicId: "",
      speakerId: "",
      presenterFellowId: "",
      date: "",
      time: "12:00",
      duration: 60,
      location: "",
      series: LECTURE_SERIES.CORE_CURRICULUM,
      recurrence: RECURRENCE.NONE,
      notes: "",
    });
  };

  const openEditModal = (lecture) => {
    setFormData({
      title: lecture.title,
      topicId: lecture.topicId || "",
      speakerId: lecture.speakerId || "",
      presenterFellowId: lecture.presenterFellowId || "",
      date: lecture.date,
      time: lecture.time,
      duration: lecture.duration,
      location: lecture.location,
      series: lecture.series,
      recurrence: lecture.recurrence,
      notes: lecture.notes || "",
    });
    setEditingLecture(lecture);
  };

  const getRsvpCounts = (lecture) => {
    const rsvps = lecture.rsvps || {};
    return {
      attending: Object.values(rsvps).filter((r) => r === RSVP_STATUS.ATTENDING).length,
      notAttending: Object.values(rsvps).filter((r) => r === RSVP_STATUS.NOT_ATTENDING).length,
      maybe: Object.values(rsvps).filter((r) => r === RSVP_STATUS.MAYBE).length,
      pending: fellows.length - Object.keys(rsvps).length,
    };
  };

  const getSpeakerName = (speakerId) => {
    const speaker = speakers.find((s) => s.id === speakerId);
    return speaker?.name || "TBD";
  };

  const baseClasses = darkMode
    ? "bg-gray-900 text-gray-100"
    : "bg-white text-gray-800";

  const cardClasses = darkMode
    ? "bg-gray-800 border-gray-700"
    : "bg-white border-gray-300";

  const inputClasses = darkMode
    ? "bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400"
    : "bg-white border-gray-300 text-gray-800";

  const VIEW_MODES = [
    { key: "calendar",  label: "Calendar" },
    { key: "agenda",    label: "Agenda" },
    { key: "list",      label: "List" },
    { key: "presenter", label: "Presenters" },
    { key: "manage",    label: "Manage" },
  ];

  return (
    <div className={`space-y-4 ${baseClasses}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Lecture Calendar
          {useDatabase && dbState.loading && (
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
          )}
        </h2>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* View Toggle — scrollable on narrow phones */}
          <div className="flex rounded overflow-hidden border border-gray-300 dark:border-gray-600 overflow-x-auto flex-1 sm:flex-none">
            {VIEW_MODES.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setViewMode(key)}
                className={`px-3 py-2 text-xs font-semibold shrink-0 ${
                  viewMode === key
                    ? "bg-blue-600 text-white"
                    : darkMode
                    ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {canManageLectures && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded shrink-0"
            >
              <Plus className="w-3 h-3" />
              Add Lecture
            </button>
          )}
        </div>
      </div>

      {/* DB error banner */}
      {useDatabase && dbState.error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded p-3 text-sm text-red-700 dark:text-red-300">
          {dbState.error}
        </div>
      )}

      {/* Agenda View — upcoming lectures grouped by week */}
      {viewMode === "agenda" && (
        <LectureList
          lectures={lectures}
          attendance={dbState.attendance ?? []}
          onSelect={setSelectedLecture}
          canManage={canManageLectures}
          onCheckIn={handleCheckIn}
          myFellowId={dbState.myFellowId}
        />
      )}

      {/* Presenter Schedule — year-long assignment table */}
      {viewMode === "presenter" && (
        <PresenterSchedule
          lectures={lectures}
          fellows={fellowObjects}
          onSelectLecture={setSelectedLecture}
          canManage={canManageLectures}
        />
      )}

      {/* Calendar View */}
      {viewMode === "calendar" && (
        <div className={`rounded border-2 ${cardClasses}`}>
          {/* Month Navigation */}
          <div className="flex items-center justify-between p-3 border-b border-gray-300 dark:border-gray-600">
            <button
              onClick={() =>
                setCurrentMonth(
                  new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1)
                )
              }
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h3 className="font-bold">
              {currentMonth.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </h3>
            <button
              onClick={() =>
                setCurrentMonth(
                  new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1)
                )
              }
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 border-b border-gray-300 dark:border-gray-600">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div
                key={day}
                className="p-2 text-center text-xs font-bold text-gray-500"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, idx) => {
              const dateStr = formatDateStr(day.date);
              const dayLectures = getLecturesForDate(dateStr);
              const isToday =
                formatDateStr(new Date()) === dateStr;

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`min-h-[80px] p-1 border-r border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 ${
                    !day.isCurrentMonth ? "opacity-40" : ""
                  } ${selectedDate === dateStr ? "bg-blue-50 dark:bg-blue-900/30" : ""}`}
                >
                  <div
                    className={`text-xs font-semibold mb-1 ${
                      isToday
                        ? "bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center"
                        : ""
                    }`}
                  >
                    {day.date.getDate()}
                  </div>
                  <div className="space-y-0.5">
                    {dayLectures.slice(0, 3).map((lec) => (
                      <div
                        key={lec.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLecture(lec);
                        }}
                        className={`text-xs px-1 py-0.5 rounded text-white truncate ${getSeriesColor(
                          lec.series
                        )}`}
                        title={lec.title}
                      >
                        {formatTime(lec.time)} {lec.title}
                      </div>
                    ))}
                    {dayLectures.length > 3 && (
                      <div className="text-xs text-gray-500">
                        +{dayLectures.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* List View */}
      {viewMode === "list" && (
        <div className={`rounded border-2 ${cardClasses}`}>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {lectures
              .sort((a, b) => new Date(a.date) - new Date(b.date))
              .map((lec) => {
                const counts = getRsvpCounts(lec);
                return (
                  <div
                    key={lec.id}
                    onClick={() => setSelectedLecture(lec)}
                    className="p-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`text-xs px-2 py-0.5 rounded text-white ${getSeriesColor(
                              lec.series
                            )}`}
                          >
                            {lec.series}
                          </span>
                          {lec.recurrence !== RECURRENCE.NONE && (
                            <RefreshCw className="w-3 h-3 text-gray-400" />
                          )}
                        </div>
                        <h4 className="font-semibold text-base">{lec.title}</h4>
                        <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(lec.date).toLocaleDateString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTime(lec.time)}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {lec.location}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {lec.speakerId
                              ? getSpeakerName(lec.speakerId)
                              : lec.presenterFellow || "TBD"}
                          </span>
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <div className="text-green-600">✓ {counts.attending}</div>
                        <div className="text-red-600">✗ {counts.notAttending}</div>
                        <div className="text-yellow-600">? {counts.maybe}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Manage View - Topics & Speakers */}
      {viewMode === "manage" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Series Legend */}
          <div className={`rounded border-2 p-3 ${cardClasses}`}>
            <h3 className="font-bold text-base mb-3">Lecture Series</h3>
            <div className="grid grid-cols-2 gap-2">
              {Object.values(LECTURE_SERIES).map((series) => (
                <div key={series} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded ${getSeriesColor(series)}`} />
                  <span className="text-sm">{series}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Stats */}
          <div className={`rounded border-2 p-3 ${cardClasses}`}>
            <h3 className="font-bold text-base mb-3">Quick Stats</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">Total Lectures:</span>
                <span className="ml-2 font-bold">{lectures.length}</span>
              </div>
              <div>
                <span className="text-gray-500">This Month:</span>
                <span className="ml-2 font-bold">
                  {
                    lectures.filter((l) => {
                      const d = new Date(l.date);
                      return (
                        d.getMonth() === currentMonth.getMonth() &&
                        d.getFullYear() === currentMonth.getFullYear()
                      );
                    }).length
                  }
                </span>
              </div>
              <div>
                <span className="text-gray-500">Recurring:</span>
                <span className="ml-2 font-bold">
                  {lectures.filter((l) => l.recurrence !== RECURRENCE.NONE).length}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Speakers:</span>
                <span className="ml-2 font-bold">{speakers.length}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Selected Lecture Detail Modal */}
      {selectedLecture && (
        <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
          <div
            className={`w-full max-w-lg rounded-lg shadow-xl ${
              darkMode ? "bg-gray-800" : "bg-white"
            }`}
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-bold">{selectedLecture.title}</h3>
              <button
                onClick={() => setSelectedLecture(null)}
                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Lecture Info */}
              <div className="space-y-2 text-base">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded text-white ${getSeriesColor(
                      selectedLecture.series
                    )}`}
                  >
                    {selectedLecture.series}
                  </span>
                  {selectedLecture.recurrence !== RECURRENCE.NONE && (
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <RefreshCw className="w-3 h-3" />
                      {selectedLecture.recurrence}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    {new Date(selectedLecture.date).toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    {formatTime(selectedLecture.time)} ({selectedLecture.duration} min)
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    {selectedLecture.location}
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    {selectedLecture.speakerId
                      ? getSpeakerName(selectedLecture.speakerId)
                      : selectedLecture.presenterFellow || "TBD"}
                  </div>
                </div>

                {selectedLecture.notes && (
                  <div className="text-xs text-gray-500 italic">
                    {selectedLecture.notes}
                  </div>
                )}
              </div>

              {/* Attendance Section */}
              {useDatabase && (
                <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <ClipboardList className="w-4 h-4" />
                    Attendance
                    {isInCheckInWindow(selectedLecture) && (
                      <span className="text-xs text-green-500 dark:text-green-400 font-semibold">
                        ● Live
                      </span>
                    )}
                  </h4>

                  {/* Fellow: self-check-in */}
                  {!canManageLectures && dbState.myFellowId && (() => {
                    const myRow = (dbState.attendance ?? []).find(
                      a => a.lecture_id === selectedLecture.id && a.fellow_id === dbState.myFellowId,
                    );
                    if (myRow) {
                      return (
                        <div className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                          <UserCheck className="w-4 h-4" />
                          Marked {myRow.status}
                        </div>
                      );
                    }
                    if (isInCheckInWindow(selectedLecture)) {
                      return (
                        <button
                          onClick={() => handleCheckIn(selectedLecture.id)}
                          disabled={dbState.submitting}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded disabled:opacity-50"
                        >
                          {dbState.submitting
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <UserCheck className="w-3 h-3" />}
                          Check In
                        </button>
                      );
                    }
                    return (
                      <div className="text-xs text-gray-400 dark:text-gray-500">
                        Check-in window is not open
                      </div>
                    );
                  })()}

                  {/* Admin: summary + controls */}
                  {canManageLectures && (() => {
                    const rows = (dbState.attendance ?? []).filter(
                      a => a.lecture_id === selectedLecture.id,
                    );
                    const present = rows.filter(a => ['present', 'late'].includes(a.status)).length;
                    const total = dbState.fellows.length;
                    return (
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {rows.length
                            ? `${present} of ${total} present`
                            : `0 of ${total} recorded`}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleCheckInWindow(selectedLecture)}
                            disabled={dbState.submitting}
                            className={`text-xs px-2 py-1 rounded font-semibold disabled:opacity-50 transition-colors ${
                              selectedLecture.checkInOpen === true
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                          >
                            {selectedLecture.checkInOpen === true ? '● Open' : 'Open Check-in'}
                          </button>
                          <button
                            onClick={() => setAttendanceRosterLecture(selectedLecture)}
                            className="flex items-center gap-1 text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded font-semibold hover:opacity-80"
                          >
                            <ClipboardList className="w-3 h-3" />
                            Roster
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* RSVP Section */}
              <div>
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  RSVPs
                </h4>
                <div className="max-h-48 overflow-y-auto">
                  <table className="w-full text-xs">
                    <tbody>
                      {fellows.map((fellow) => {
                        const status =
                          selectedLecture.rsvps?.[fellow] || RSVP_STATUS.PENDING;
                        return (
                          <tr
                            key={fellow}
                            className="border-b border-gray-100 dark:border-gray-700"
                          >
                            <td className="py-1.5 font-medium">{fellow}</td>
                            <td className="py-1.5">
                              <div className="flex gap-1">
                                <button
                                  onClick={() =>
                                    handleRSVP(
                                      selectedLecture.id,
                                      fellow,
                                      RSVP_STATUS.ATTENDING
                                    )
                                  }
                                  className={`p-2 rounded ${
                                    status === RSVP_STATUS.ATTENDING
                                      ? "bg-green-500 text-white"
                                      : "bg-gray-200 dark:bg-gray-700 hover:bg-green-200"
                                  }`}
                                  title="Attending"
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() =>
                                    handleRSVP(
                                      selectedLecture.id,
                                      fellow,
                                      RSVP_STATUS.NOT_ATTENDING
                                    )
                                  }
                                  className={`p-2 rounded ${
                                    status === RSVP_STATUS.NOT_ATTENDING
                                      ? "bg-red-500 text-white"
                                      : "bg-gray-200 dark:bg-gray-700 hover:bg-red-200"
                                  }`}
                                  title="Not Attending"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() =>
                                    handleRSVP(
                                      selectedLecture.id,
                                      fellow,
                                      RSVP_STATUS.MAYBE
                                    )
                                  }
                                  className={`p-2 rounded ${
                                    status === RSVP_STATUS.MAYBE
                                      ? "bg-yellow-500 text-white"
                                      : "bg-gray-200 dark:bg-gray-700 hover:bg-yellow-200"
                                  }`}
                                  title="Maybe"
                                >
                                  <HelpCircle className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                {canManageLectures ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        openEditModal(selectedLecture);
                        setSelectedLecture(null);
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-xs font-semibold rounded"
                    >
                      <Edit2 className="w-3 h-3" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteLecture(selectedLecture.id)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-600 hover:bg-red-200 text-xs font-semibold rounded"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </button>
                  </div>
                ) : <div />}
                <button
                  onClick={() => onSendReminder?.(selectedLecture)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded"
                >
                  <Mail className="w-3 h-3" />
                  Send Reminder
                </button>
              </div>
            </div>
          </div>
          </div>
        </div>
      )}

      {/* Attendance Roster Modal — admin/PD/chief only */}
      {attendanceRosterLecture && (
        <AttendanceRoster
          lecture={attendanceRosterLecture}
          attendance={(dbState.attendance ?? []).filter(
            a => a.lecture_id === attendanceRosterLecture.id,
          )}
          fellows={dbState.fellows}
          onUpsert={async (fellowId, status, notes) => {
            await dbState.upsertAttendance(attendanceRosterLecture.id, fellowId, status, notes);
          }}
          onFinalize={async () => {
            await dbState.finalizeAttendance(attendanceRosterLecture.id);
          }}
          onClose={() => setAttendanceRosterLecture(null)}
          submitting={dbState.submitting}
        />
      )}

      {/* Add/Edit Modal */}
      {canManageLectures && (showAddModal || editingLecture) && (
        <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
          <div
            className={`w-full max-w-lg rounded-lg shadow-xl ${
              darkMode ? "bg-gray-800" : "bg-white"
            }`}
          >
            <div className={`p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between sticky top-0 ${darkMode ? "bg-gray-800" : "bg-white"}`}>
              <h3 className="font-bold">
                {editingLecture ? "Edit Lecture" : "Add New Lecture"}
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingLecture(null);
                  resetForm();
                }}
                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-semibold mb-1">Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className={`w-full px-3 py-2 text-sm border rounded ${inputClasses}`}
                  placeholder="Lecture title"
                />
              </div>

              {/* Series */}
              <div>
                <label className="block text-xs font-semibold mb-1">Series *</label>
                <select
                  value={formData.series}
                  onChange={(e) =>
                    setFormData({ ...formData, series: e.target.value })
                  }
                  className={`w-full px-3 py-2 text-sm border rounded ${inputClasses}`}
                >
                  {Object.values(LECTURE_SERIES).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Date *</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) =>
                      setFormData({ ...formData, date: e.target.value })
                    }
                    className={`w-full px-3 py-2 text-sm border rounded ${inputClasses}`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Time *</label>
                  <input
                    type="time"
                    value={formData.time}
                    onChange={(e) =>
                      setFormData({ ...formData, time: e.target.value })
                    }
                    className={`w-full px-3 py-2 text-sm border rounded ${inputClasses}`}
                  />
                </div>
              </div>

              {/* Duration & Location */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Duration (min)
                  </label>
                  <input
                    type="number"
                    value={formData.duration}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        duration: parseInt(e.target.value) || 60,
                      })
                    }
                    className={`w-full px-3 py-2 text-sm border rounded ${inputClasses}`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) =>
                      setFormData({ ...formData, location: e.target.value })
                    }
                    className={`w-full px-3 py-2 text-sm border rounded ${inputClasses}`}
                    placeholder="Conference Room A"
                  />
                </div>
              </div>

              {/* Speaker / Presenter */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Speaker (Attending)
                  </label>
                  <select
                    value={formData.speakerId}
                    onChange={(e) =>
                      setFormData({ ...formData, speakerId: e.target.value })
                    }
                    className={`w-full px-3 py-2 text-sm border rounded ${inputClasses}`}
                  >
                    <option value="">-- None --</option>
                    {speakers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Presenter (Fellow)
                  </label>
                  <select
                    value={formData.presenterFellowId}
                    onChange={(e) =>
                      setFormData({ ...formData, presenterFellowId: e.target.value })
                    }
                    className={`w-full px-3 py-2 text-sm border rounded ${inputClasses}`}
                  >
                    <option value="">-- None --</option>
                    {fellowObjects.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Recurrence */}
              <div>
                <label className="block text-xs font-semibold mb-1">Recurrence</label>
                <select
                  value={formData.recurrence}
                  onChange={(e) =>
                    setFormData({ ...formData, recurrence: e.target.value })
                  }
                  className={`w-full px-3 py-2 text-sm border rounded ${inputClasses}`}
                >
                  <option value={RECURRENCE.NONE}>None (one-time)</option>
                  <option value={RECURRENCE.WEEKLY}>Weekly</option>
                  <option value={RECURRENCE.BIWEEKLY}>Bi-weekly</option>
                  <option value={RECURRENCE.MONTHLY}>Monthly</option>
                  <option value={RECURRENCE.FIRST_OF_MONTH}>First of month</option>
                  <option value={RECURRENCE.LAST_OF_MONTH}>Last of month</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  className={`w-full px-3 py-2 text-sm border rounded ${inputClasses}`}
                  rows={2}
                  placeholder="Additional notes..."
                />
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingLecture(null);
                    resetForm();
                  }}
                  className="px-4 py-2 text-sm font-semibold rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={editingLecture ? handleUpdateLecture : handleAddLecture}
                  disabled={!formData.title || !formData.date}
                  className="px-4 py-2 text-sm font-semibold rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                >
                  {editingLecture ? "Update" : "Add"} Lecture
                </button>
              </div>
            </div>
          </div>
          </div>
        </div>
      )}
    </div>
  );
}