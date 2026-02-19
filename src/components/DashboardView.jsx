// src/components/DashboardView.jsx
import { useMemo } from "react";
import { Calendar, Clock, FileText, AlertTriangle, ChevronRight, BookOpen } from "lucide-react";
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

  // Match current user to a fellow name
  const myName = useMemo(() => {
    if (!profile?.full_name) return null;
    const name = profile.full_name.trim();
    // Try exact match first, then last-name match
    if (fellows.includes(name)) return name;
    const lastName = name.split(" ").pop();
    return fellows.find((f) => f === lastName) || null;
  }, [profile, fellows]);

  // Find the current and next block
  const { currentBlock, nextBlock, currentBlockIdx } = useMemo(() => {
    let cur = null;
    let nxt = null;
    let curIdx = -1;
    for (let i = 0; i < blockDates.length; i++) {
      if (today >= blockDates[i].start && today <= blockDates[i].end) {
        cur = blockDates[i];
        curIdx = i;
        if (i + 1 < blockDates.length) nxt = blockDates[i + 1];
        break;
      }
      if (today < blockDates[i].start) {
        nxt = blockDates[i];
        break;
      }
    }
    return { currentBlock: cur, nextBlock: nxt, currentBlockIdx: curIdx };
  }, [blockDates, today]);

  // My current rotation
  const myRotation = myName && currentBlockIdx >= 0 ? schedule[myName]?.[currentBlockIdx] : null;
  const myNextRotation = myName && currentBlockIdx >= 0 && currentBlockIdx + 1 < blockDates.length
    ? schedule[myName]?.[currentBlockIdx + 1]
    : null;

  // My upcoming call/float
  const myNextDuty = useMemo(() => {
    if (!myName) return null;
    for (let i = 0; i < blockDates.length; i++) {
      if (blockDates[i].end < today) continue;
      for (const w of ["W1", "W2"]) {
        const key = `B${i + 1}-${w}`;
        if (callSchedule[key] === myName) return { type: "Call", block: i + 1, weekend: w };
        if (nightFloatSchedule[key] === myName) return { type: "Float", block: i + 1, weekend: w };
      }
    }
    return null;
  }, [myName, callSchedule, nightFloatSchedule, blockDates, today]);

  // Pending requests counts
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

  const fmtDate = (dateStr) => {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const isAdmin = canApprove?.() ?? false;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Greeting */}
      <div className="text-lg font-bold dark:text-gray-100">
        {myName ? `Welcome, ${myName}` : "Dashboard"}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Card 1: My Duties */}
        <button
          onClick={() => setActiveView("schedule")}
          className="text-left rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-600 dark:text-gray-300">
              <Calendar className="w-4 h-4" />
              My Schedule
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </div>

          {myName ? (
            <div className="space-y-2">
              {currentBlock && (
                <div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">Current (Block {currentBlock.block})</div>
                  <span className={`inline-block mt-0.5 px-2 py-0.5 rounded text-xs font-semibold ${getRotationColor(myRotation)}`}>
                    {myRotation || "—"}
                  </span>
                  <span className="ml-2 text-[10px] text-gray-400">{fmtDate(currentBlock.start)} – {fmtDate(currentBlock.end)}</span>
                </div>
              )}
              {myNextRotation && (
                <div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">Next</div>
                  <span className={`inline-block mt-0.5 px-2 py-0.5 rounded text-xs font-semibold ${getRotationColor(myNextRotation)}`}>
                    {myNextRotation}
                  </span>
                </div>
              )}
              {myNextDuty && (
                <div className="pt-1 border-t border-gray-100 dark:border-gray-700">
                  <span className={`text-xs font-semibold ${myNextDuty.type === "Call" ? "text-red-600" : "text-purple-600"}`}>
                    Upcoming {myNextDuty.type}: Block {myNextDuty.block} {myNextDuty.weekend}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-gray-400 dark:text-gray-500">
              {currentBlock
                ? `Block ${currentBlock.block}: ${fmtDate(currentBlock.start)} – ${fmtDate(currentBlock.end)}`
                : "Schedule not yet started"}
            </div>
          )}
        </button>

        {/* Card 2: Pending Requests */}
        <button
          onClick={() => setActiveView("vacRequests")}
          className="text-left rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-600 dark:text-gray-300">
              <FileText className="w-4 h-4" />
              Requests
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </div>
          {pendingVacations + pendingSwaps > 0 ? (
            <div className="space-y-1">
              {pendingVacations > 0 && (
                <div className="text-xs">
                  <span className="font-semibold text-amber-600 dark:text-amber-400">{pendingVacations}</span>{" "}
                  <span className="text-gray-500 dark:text-gray-400">pending vacation{pendingVacations !== 1 ? "s" : ""}</span>
                </div>
              )}
              {pendingSwaps > 0 && (
                <div className="text-xs">
                  <span className="font-semibold text-amber-600 dark:text-amber-400">{pendingSwaps}</span>{" "}
                  <span className="text-gray-500 dark:text-gray-400">pending swap{pendingSwaps !== 1 ? "s" : ""}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-gray-400 dark:text-gray-500">No pending requests</div>
          )}
        </button>

        {/* Card 3: Upcoming Lectures */}
        <button
          onClick={() => setActiveView("lectures")}
          className="text-left rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-600 dark:text-gray-300">
              <BookOpen className="w-4 h-4" />
              Upcoming Lectures
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </div>
          {upcomingLectures.length > 0 ? (
            <div className="space-y-1.5">
              {upcomingLectures.map((lec) => (
                <div key={lec.id} className="flex items-start gap-2 text-xs">
                  <span className="text-gray-400 dark:text-gray-500 shrink-0 w-12">{fmtDate(lec.date)}</span>
                  <span className="text-gray-700 dark:text-gray-200 truncate">{lec.title}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-gray-400 dark:text-gray-500">No upcoming lectures</div>
          )}
        </button>

        {/* Card 4: Violations (admin only) */}
        {isAdmin && (
          <button
            onClick={() => setActiveView("violations")}
            className="text-left rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-600 dark:text-gray-300">
                <AlertTriangle className="w-4 h-4" />
                ACGME Violations
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </div>
            {workHourViolations.length > 0 ? (
              <div className="text-xs">
                <span className="font-semibold text-red-600 dark:text-red-400">{workHourViolations.length}</span>{" "}
                <span className="text-gray-500 dark:text-gray-400">active violation{workHourViolations.length !== 1 ? "s" : ""}</span>
              </div>
            ) : (
              <div className="text-xs text-green-600 dark:text-green-400 font-medium">All clear</div>
            )}
          </button>
        )}

        {/* Card 4 alt: Quick links for non-admin */}
        {!isAdmin && (
          <button
            onClick={() => setActiveView("calendar")}
            className="text-left rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-600 dark:text-gray-300">
                <Clock className="w-4 h-4" />
                Calendar
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </div>
            <div className="text-xs text-gray-400 dark:text-gray-500">View full year calendar</div>
          </button>
        )}
      </div>
    </div>
  );
}
