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
import { toast } from "./Toast";
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
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

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
    checkInOpen: null,  // null=auto, true=forced open, false=forced closed
  });
  const [formErrors, setFormErrors] = useState({});

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

  const validateForm = () => {
    const errors = {};
    if (!formData.title.trim()) errors.title = 'Title is required';
    if (!formData.date)         errors.date  = 'Date is required';
    if (!formData.time)         errors.time  = 'Time is required';
    if (!formData.series)       errors.series = 'Series is required';
    return errors;
  };

  const handleAddLecture = async () => {
    const errors = validateForm();
    if (Object.keys(errors).length) { setFormErrors(errors); return; }
    setFormErrors({});
    if (useDatabase) {
      const ok = await dbState.addLecture({ ...formData, rsvps: {}, reminderSent: false });
      if (!ok) return; // error displayed in modal via dbState.error
    } else {
      const newLecture = { id: `lec${Date.now()}`, ...formData, rsvps: {}, reminderSent: false };
      setLectures([...(propLectures ?? []), newLecture]);
    }
    setShowAddModal(false);
    resetForm();
  };

  const handleUpdateLecture = async () => {
    const errors = validateForm();
    if (Object.keys(errors).length) { setFormErrors(errors); return; }
    setFormErrors({});
    if (useDatabase) {
      const ok = await dbState.updateLecture(editingLecture.id, formData);
      if (!ok) return; // error displayed in modal via dbState.error
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

  const handleDeleteLecture = (id) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    const id = deleteConfirmId;
    setDeleteConfirmId(null);
    try {
      if (useDatabase) {
        await dbState.deleteLecture(id);
      } else {
        setLectures((propLectures ?? []).filter((l) => l.id !== id));
      }
      setSelectedLecture(null);
      toast.success('Lecture deleted.');
    } catch {
      toast.error('Failed to delete lecture.');
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
      checkInOpen: null,
    });
    setFormErrors({});
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
      checkInOpen: lecture.checkInOpen ?? null,
    });
    setFormErrors({});
    setEditingLecture(lecture);
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
    <div className={`mx-auto max-w-3xl sm:max-w-4xl lg:max-w-6xl space-y-3 ${baseClasses}`}>
      {/* Apple Calendar-style Header */}
      <div className="space-y-3">
        {/* Pill-shaped month/year header with navigation */}
        <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
          <button
            onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1))}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors shrink-0"
            title="Previous month"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>

          <div className={`px-4 py-2 rounded-full text-center font-semibold text-sm whitespace-nowrap ${
            darkMode
              ? "bg-gray-700 text-white"
              : "bg-gray-100 text-gray-900"
          }`}>
            <div>{currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
          </div>

          <button
            onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1))}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors shrink-0"
            title="Next month"
          >
            <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>

          {canManageLectures && (
            <button
              onClick={() => setShowAddModal(true)}
              className="hidden sm:flex items-center gap-1 px-3 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-full shrink-0"
              title="Add lecture"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          )}
        </div>

        {/* iOS-style Segmented Control for view modes */}
        <div className="flex gap-1 p-1 rounded-full bg-gray-100 dark:bg-gray-700 w-full overflow-x-auto sm:w-auto sm:mx-auto">
          {VIEW_MODES.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setViewMode(key)}
              className={`flex-shrink-0 sm:flex-none px-3 py-2.5 text-xs font-medium rounded-full transition-all whitespace-nowrap ${
                viewMode === key
                  ? "bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm"
                  : darkMode
                  ? "text-gray-400 hover:text-gray-300"
                  : "text-gray-600 hover:text-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Mobile Add Lecture button */}
        {canManageLectures && (
          <button
            onClick={() => setShowAddModal(true)}
            className="sm:hidden w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Lecture
          </button>
        )}

        {/* Loading indicator */}
        {useDatabase && dbState.loading && (
          <div className="flex items-center justify-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Updating...
          </div>
        )}
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

      {/* Calendar View — Apple Calendar style with day summary */}
      {viewMode === "calendar" && (() => {
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
        const selectedDateForSummary = selectedDate || today;
        const selectedDayLectures = getLecturesForDate(selectedDateForSummary).sort((a, b) => a.time.localeCompare(b.time));
        const selectedDayDate = new Date(`${selectedDateForSummary}T00:00:00`);

        return (
          <div className="space-y-3">
            {/* Calendar Grid */}
            <div className={`rounded-2xl overflow-hidden ${cardClasses}`}>
              {/* Weekday Headers */}
              <div className="grid grid-cols-7 gap-0 p-4 pb-2 border-b border-gray-200 dark:border-gray-700">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div
                    key={day}
                    className="text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
                  >
                    {day.slice(0, 1)}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-0 p-4 pt-3">
                {calendarDays.map((day, idx) => {
                  const dateStr = formatDateStr(day.date);
                  const dayLectures = getLecturesForDate(dateStr);
                  const isToday = formatDateStr(new Date()) === dateStr;
                  const isCurrentMonth = day.isCurrentMonth;
                  const isSelected = selectedDate === dateStr;

                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedDate(dateStr)}
                      className={`aspect-square flex flex-col items-center p-1.5 rounded-lg cursor-pointer transition-all ${
                        !isCurrentMonth
                          ? "text-gray-300 dark:text-gray-700"
                          : ""
                      } ${
                        isToday
                          ? "bg-blue-600 text-white font-semibold"
                          : isSelected
                          ? "bg-gray-200 dark:bg-gray-700"
                          : "hover:bg-gray-100 dark:hover:bg-gray-800"
                      }`}
                    >
                      <div className={`text-base sm:text-sm font-semibold ${
                        isToday ? "text-white" : isCurrentMonth ? "text-gray-900 dark:text-gray-100" : ""
                      }`}>
                        {day.date.getDate()}
                      </div>
                      <div className="flex-1 w-full overflow-hidden flex items-end">
                        <div className="space-y-0.5 w-full">
                          {dayLectures.slice(0, 2).map((lec) => (
                            <div
                              key={lec.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedLecture(lec);
                              }}
                              className={`text-[10px] px-1 py-0.5 rounded truncate font-medium min-w-0 cursor-pointer ${
                                isToday
                                  ? "bg-white bg-opacity-30 text-white"
                                  : `${getSeriesColor(lec.series)} text-white opacity-90 hover:opacity-100`
                              }`}
                              title={lec.title}
                            >
                              {lec.title.split(' ')[0]}
                            </div>
                          ))}
                          {dayLectures.length > 2 && (
                            <div className={`text-[9px] font-medium ${
                              isToday ? "text-white opacity-75" : "text-gray-500 dark:text-gray-400"
                            }`}>
                              +{dayLectures.length - 2}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Day Summary — selected day's lectures */}
            {selectedDate && (
              <div className={`rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden`}>
                <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {selectedDayDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </div>
                </div>
                {selectedDayLectures.length === 0 ? (
                  <div className="px-4 py-4 text-center text-sm text-gray-400 dark:text-gray-500">
                    No lectures scheduled
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {selectedDayLectures.map((lec) => {
                      const speaker = lec.speaker?.name || lec.presenter?.name || getSpeakerName(lec.speakerId) || 'TBD';

                      return (
                        <button
                          key={lec.id}
                          onClick={() => setSelectedLecture(lec)}
                          className="w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                        >
                          {/* Date chip */}
                          <div className="flex-shrink-0 w-12 text-center rounded-lg py-1 bg-blue-600 text-white">
                            <div className="text-xs font-semibold">
                              {selectedDayDate.toLocaleDateString('en-US', { month: 'short' })}
                            </div>
                            <div className="text-lg font-bold leading-none">
                              {selectedDayDate.getDate()}
                            </div>
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${SERIES_COLOR[lec.series] || 'bg-gray-100 text-gray-600'}`}>
                                {lec.series}
                              </span>
                            </div>
                            <div className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">{lec.title}</div>
                            <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />{formatTime(lec.time)} · {lec.duration_min || lec.duration || 60} min
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
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* List View */}
      {viewMode === "list" && (() => {
        const sorted = [...lectures].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
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

        return (
          <div className={`rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden`}>
            {sorted.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                No lectures scheduled
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {sorted.map((lec) => {
                  const speaker = lec.speaker?.name || lec.presenter?.name || getSpeakerName(lec.speakerId) || 'TBD';

                  return (
                    <button
                      key={lec.id}
                      onClick={() => setSelectedLecture(lec)}
                      className="w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      {/* Date chip */}
                      <div className="flex-shrink-0 w-12 text-center rounded-lg py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
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
                          {lec.recurrence !== RECURRENCE.NONE && (
                            <RefreshCw className="w-3 h-3 text-gray-400" />
                          )}
                        </div>
                        <div className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">{lec.title}</div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />{formatTime(lec.time)} · {lec.duration_min || lec.duration || 60} min
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
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

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

              {/* Attendance Section — admins/chiefs/PDs only */}
              {useDatabase && canManageLectures && (
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

                  {/* Admin: summary + controls */}
                  {(() => {
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

              {/* RSVP Section — hidden for now */}
              {false && <div>
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
              }

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

      {/* Delete confirmation modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4">
          <div className={`w-full max-w-sm rounded-lg shadow-xl p-5 ${darkMode ? "bg-gray-800" : "bg-white"}`}>
            <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-1">Delete lecture?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-sm font-semibold rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm font-semibold rounded bg-red-600 hover:bg-red-700 text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
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
                className="flex items-center justify-center w-11 h-11 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 space-y-2 max-h-[70vh] overflow-y-auto">
              {/* Title */}
              <div>
                <label className="block text-xs font-semibold mb-0.5">Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => {
                    setFormData({ ...formData, title: e.target.value });
                    if (formErrors.title) setFormErrors(prev => ({ ...prev, title: undefined }));
                  }}
                  className={`w-full px-3 py-2 text-sm border rounded ${inputClasses} ${formErrors.title ? 'border-red-500' : ''}`}
                  placeholder="Lecture title"
                />
                {formErrors.title && <p className="text-xs text-red-500 mt-0.5">{formErrors.title}</p>}
              </div>

              {/* Series */}
              <div>
                <label className="block text-xs font-semibold mb-0.5">Series *</label>
                <select
                  value={formData.series}
                  onChange={(e) => {
                    setFormData({ ...formData, series: e.target.value });
                    if (formErrors.series) setFormErrors(prev => ({ ...prev, series: undefined }));
                  }}
                  className={`w-full px-3 py-2 text-sm border rounded ${inputClasses} ${formErrors.series ? 'border-red-500' : ''}`}
                >
                  {Object.values(LECTURE_SERIES).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                {formErrors.series && <p className="text-xs text-red-500 mt-0.5">{formErrors.series}</p>}
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold mb-0.5">Date *</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => {
                      setFormData({ ...formData, date: e.target.value });
                      if (formErrors.date) setFormErrors(prev => ({ ...prev, date: undefined }));
                    }}
                    className={`w-full px-3 py-2 text-sm border rounded ${inputClasses} ${formErrors.date ? 'border-red-500' : ''}`}
                  />
                  {formErrors.date && <p className="text-xs text-red-500 mt-0.5">{formErrors.date}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-0.5">Time *</label>
                  <input
                    type="time"
                    value={formData.time}
                    onChange={(e) => {
                      setFormData({ ...formData, time: e.target.value });
                      if (formErrors.time) setFormErrors(prev => ({ ...prev, time: undefined }));
                    }}
                    className={`w-full px-3 py-2 text-sm border rounded ${inputClasses} ${formErrors.time ? 'border-red-500' : ''}`}
                  />
                  {formErrors.time && <p className="text-xs text-red-500 mt-0.5">{formErrors.time}</p>}
                </div>
              </div>

              {/* Duration & Location */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold mb-0.5">
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
                  <label className="block text-xs font-semibold mb-0.5">Location</label>
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
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold mb-0.5">
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
                  <label className="block text-xs font-semibold mb-0.5">
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
                <label className="block text-xs font-semibold mb-0.5">Recurrence</label>
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
                <label className="block text-xs font-semibold mb-0.5">Notes</label>
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

              {/* Check-In Override */}
              <div>
                <label className="block text-xs font-semibold mb-0.5">Check-In Window Override</label>
                <div className="flex gap-2">
                  {[
                    { value: null,  label: 'Auto',   desc: '±15 min around start', cls: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600' },
                    { value: true,  label: 'Open',   desc: 'Force open now',        cls: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50' },
                    { value: false, label: 'Closed', desc: 'Force closed',          cls: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50' },
                  ].map(opt => (
                    <button
                      key={String(opt.value)}
                      type="button"
                      title={opt.desc}
                      onClick={() => setFormData({ ...formData, checkInOpen: opt.value })}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded border transition-colors ${
                        formData.checkInOpen === opt.value
                          ? `${opt.cls} ring-2 ring-offset-1 ring-current border-transparent`
                          : 'border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  {formData.checkInOpen === true  && 'Check-in is forced open regardless of time.'}
                  {formData.checkInOpen === false && 'Check-in is forced closed regardless of time.'}
                  {formData.checkInOpen === null  && 'Check-in opens automatically ±15 min around the lecture start time.'}
                </p>
              </div>

              {/* DB error inside modal */}
              {useDatabase && dbState.error && (
                <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded p-2">
                  {dbState.error}
                </div>
              )}

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
                  disabled={dbState.submitting}
                  className="px-4 py-2 text-sm font-semibold rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 flex items-center gap-1.5"
                >
                  {dbState.submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editingLecture ? "Save Changes" : "Add Lecture"}
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