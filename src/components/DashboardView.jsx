// src/components/DashboardView.jsx
import { useMemo } from "react";
import {
  Clock,
  FileText,
  AlertTriangle,
  ChevronRight,
  BookOpen,
  Stethoscope,
  Sun,
  Moon,
  Sunrise,
  Send,
  ArrowLeftRight,
  CalendarDays,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getRotationColor } from "../utils/scheduleUtils";

export default function DashboardView({
  fellows,
  schedule,
  callSchedule,
  nightFloatSchedule,
  blockDates,
  lectures,
  vacations,
  swapRequests,
  workHourViolations,
  setActiveView,
}) {
  const { profile, canApprove } = useAuth();

  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  // Time-of-day greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  const GreetingIcon = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 6 || hour >= 20) return Moon;
    if (hour < 12) return Sunrise;
    return Sun;
  }, []);

  // Match current user to a fellow name
  const myName = useMemo(() => {
    if (!profile?.full_name) return null;
    const name = profile.full_name.trim();
    if (fellows.includes(name)) return name;
    const lastName = name.split(" ").pop();
    return fellows.find((f) => f === lastName) || null;
  }, [profile, fellows]);

  // Find the current and next block
  const { currentBlock, currentBlockIdx } = useMemo(() => {
    let cur = null;
    let curIdx = -1;
    for (let i = 0; i < blockDates.length; i++) {
      if (today >= blockDates[i].start && today <= blockDates[i].end) {
        cur = blockDates[i];
        curIdx = i;
        break;
      }
    }
    return { currentBlock: cur, currentBlockIdx: curIdx };
  }, [blockDates, today]);

  // My current rotation
  const myRotation =
    myName && currentBlockIdx >= 0
      ? schedule[myName]?.[currentBlockIdx]
      : null;
  const myNextRotation =
    myName && currentBlockIdx >= 0 && currentBlockIdx + 1 < blockDates.length
      ? schedule[myName]?.[currentBlockIdx + 1]
      : null;

  // My upcoming call/float
  const myNextDuty = useMemo(() => {
    if (!myName) return null;
    for (let i = 0; i < blockDates.length; i++) {
      if (blockDates[i].end < today) continue;
      for (const w of ["W1", "W2"]) {
        const key = `B${i + 1}-${w}`;
        if (callSchedule[key] === myName)
          return { type: "Call", block: i + 1, weekend: w };
        if (nightFloatSchedule[key] === myName)
          return { type: "Night Float", block: i + 1, weekend: w };
      }
    }
    return null;
  }, [myName, callSchedule, nightFloatSchedule, blockDates, today]);

  // My own pending requests (for non-admin users)
  const myPendingRequests = useMemo(() => {
    if (!myName) return { vacations: [], swaps: [] };
    const myVacations = (vacations || []).filter(
      (v) => v.fellow === myName && v.status === "pending"
    );
    const mySwaps = (swapRequests || []).filter(
      (s) =>
        (s.requester === myName || s.target === myName) && s.status === "pending"
    );
    return { vacations: myVacations, swaps: mySwaps };
  }, [vacations, swapRequests, myName]);

  // All pending requests counts (for admins)
  const pendingVacations = useMemo(
    () => (vacations || []).filter((v) => v.status === "pending").length,
    [vacations]
  );
  const pendingSwaps = useMemo(
    () => (swapRequests || []).filter((s) => s.status === "pending").length,
    [swapRequests]
  );

  // Upcoming lectures (next 3)
  const upcomingLectures = useMemo(() => {
    return (lectures || [])
      .filter((l) => l.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 3);
  }, [lectures, today]);

  // Year progress
  const yearProgress = useMemo(() => {
    if (!blockDates.length) return 0;
    if (currentBlockIdx < 0) return 0;
    return Math.round(((currentBlockIdx + 1) / blockDates.length) * 100);
  }, [currentBlockIdx, blockDates]);

  // Days remaining in current block
  const daysLeftInBlock = useMemo(() => {
    if (!currentBlock) return null;
    const end = new Date(currentBlock.end + "T23:59:59");
    const now = new Date();
    const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    return diff >= 0 ? diff : 0;
  }, [currentBlock]);

  const fmtDate = (dateStr) => {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const isAdmin = canApprove?.() ?? false;

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Greeting Header */}
      <div className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-800 p-5 text-white shadow-lg">
        <div className="flex items-center gap-3 mb-1">
          <GreetingIcon className="w-6 h-6 opacity-90" />
          <h1 className="text-xl font-bold">
            {greeting}
            {myName ? `, ${myName}` : ""}
          </h1>
        </div>
        {currentBlock ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-blue-100">
            <span>
              Block {currentBlock.block} of {blockDates.length}
            </span>
            <span className="hidden sm:inline">|</span>
            <span>
              {fmtDate(currentBlock.start)} – {fmtDate(currentBlock.end)}
            </span>
            {daysLeftInBlock !== null && (
              <>
                <span className="hidden sm:inline">|</span>
                <span>
                  {daysLeftInBlock} day{daysLeftInBlock !== 1 ? "s" : ""} left
                </span>
              </>
            )}
          </div>
        ) : null}

        {/* Year Progress Bar */}
        {currentBlockIdx >= 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-blue-200 mb-1">
              <span>Academic Year Progress</span>
              <span>{yearProgress}%</span>
            </div>
            <div className="w-full h-1.5 bg-blue-400/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-white/80 rounded-full transition-all duration-500"
                style={{ width: `${yearProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Card 1: My Schedule / Current Rotation */}
        <button
          onClick={() => setActiveView("schedule")}
          className="group text-left rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                <Stethoscope className="w-4 h-4" />
              </div>
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                My Schedule
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition-colors" />
          </div>

          {myName ? (
            <div className="space-y-3">
              {myRotation && (
                <div>
                  <div className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-medium mb-1">
                    Current Rotation
                  </div>
                  <span
                    className={`inline-block px-3 py-1 rounded-md text-xs font-bold ${getRotationColor(myRotation)}`}
                  >
                    {myRotation}
                  </span>
                </div>
              )}
              {myNextRotation && (
                <div>
                  <div className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-medium mb-1">
                    Up Next
                  </div>
                  <span
                    className={`inline-block px-3 py-1 rounded-md text-xs font-bold opacity-75 ${getRotationColor(myNextRotation)}`}
                  >
                    {myNextRotation}
                  </span>
                </div>
              )}
              {myNextDuty && (
                <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                  <div
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md ${
                      myNextDuty.type === "Call"
                        ? "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
                        : "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400"
                    }`}
                  >
                    <Clock className="w-3 h-3" />
                    {myNextDuty.type} — Block {myNextDuty.block},{" "}
                    {myNextDuty.weekend}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-gray-400 dark:text-gray-500">
              {currentBlock
                ? `Block ${currentBlock.block}: ${fmtDate(currentBlock.start)} – ${fmtDate(currentBlock.end)}`
                : "Schedule not yet started"}
            </div>
          )}
        </button>

        {/* Card 2: Requests — different views for admin vs fellow */}
        <button
          onClick={() => setActiveView("vacRequests")}
          className="group text-left rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm hover:shadow-md hover:border-amber-300 dark:hover:border-amber-600 transition-all duration-200"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                <FileText className="w-4 h-4" />
              </div>
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                {isAdmin ? "Pending Approvals" : "My Requests"}
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-amber-500 transition-colors" />
          </div>

          {isAdmin ? (
            // Admin: show counts needing approval
            pendingVacations + pendingSwaps > 0 ? (
              <div className="space-y-2">
                {pendingVacations > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs font-bold">
                      {pendingVacations}
                    </span>
                    <span className="text-xs text-gray-600 dark:text-gray-300">
                      vacation request{pendingVacations !== 1 ? "s" : ""} to
                      review
                    </span>
                  </div>
                )}
                {pendingSwaps > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs font-bold">
                      {pendingSwaps}
                    </span>
                    <span className="text-xs text-gray-600 dark:text-gray-300">
                      swap request{pendingSwaps !== 1 ? "s" : ""} to review
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                All caught up — no pending approvals
              </div>
            )
          ) : // Fellow: show their own requests
          myPendingRequests.vacations.length +
              myPendingRequests.swaps.length >
            0 ? (
            <div className="space-y-2">
              {myPendingRequests.vacations.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs font-bold">
                    {myPendingRequests.vacations.length}
                  </span>
                  <span className="text-xs text-gray-600 dark:text-gray-300">
                    vacation request
                    {myPendingRequests.vacations.length !== 1 ? "s" : ""}{" "}
                    awaiting approval
                  </span>
                </div>
              )}
              {myPendingRequests.swaps.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs font-bold">
                    {myPendingRequests.swaps.length}
                  </span>
                  <span className="text-xs text-gray-600 dark:text-gray-300">
                    swap request
                    {myPendingRequests.swaps.length !== 1 ? "s" : ""} awaiting
                    approval
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-gray-400 dark:text-gray-500">
              No pending requests — tap to submit one
            </div>
          )}
        </button>

        {/* Card 3: Upcoming Lectures */}
        <button
          onClick={() => setActiveView("lectures")}
          className="group text-left rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-600 transition-all duration-200"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                <BookOpen className="w-4 h-4" />
              </div>
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                Upcoming Lectures
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-emerald-500 transition-colors" />
          </div>
          {upcomingLectures.length > 0 ? (
            <div className="space-y-2">
              {upcomingLectures.map((lec) => (
                <div key={lec.id} className="flex items-start gap-2.5 text-xs">
                  <span className="shrink-0 px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 font-medium">
                    {fmtDate(lec.date)}
                  </span>
                  <span className="text-gray-600 dark:text-gray-300 truncate">
                    {lec.title}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-gray-400 dark:text-gray-500">
              No upcoming lectures scheduled
            </div>
          )}
        </button>

        {/* Card 4: Admin gets Violations, Non-admin gets Quick Links */}
        {isAdmin ? (
          <button
            onClick={() => setActiveView("violations")}
            className="group text-left rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm hover:shadow-md hover:border-red-300 dark:hover:border-red-600 transition-all duration-200"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  ACGME Violations
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-red-500 transition-colors" />
            </div>
            {workHourViolations.length > 0 ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-xs font-bold">
                  {workHourViolations.length}
                </span>
                <span className="text-xs text-gray-600 dark:text-gray-300">
                  active violation
                  {workHourViolations.length !== 1 ? "s" : ""} detected
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                Compliant — no violations
              </div>
            )}
          </button>
        ) : (
          // Non-admin: Quick Actions card
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400">
                <TrendingUp className="w-4 h-4" />
              </div>
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                Quick Links
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setActiveView("vacRequests")}
                className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-violet-50 dark:hover:bg-violet-900/20 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                Request Time Off
              </button>
              <button
                onClick={() => setActiveView("vacRequests")}
                className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-violet-50 dark:hover:bg-violet-900/20 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                Swap Rotation
              </button>
              <button
                onClick={() => setActiveView("calendar")}
                className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-violet-50 dark:hover:bg-violet-900/20 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
              >
                <CalendarDays className="w-3.5 h-3.5" />
                Full Calendar
              </button>
              <button
                onClick={() => setActiveView("stats")}
                className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-violet-50 dark:hover:bg-violet-900/20 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                View Stats
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
