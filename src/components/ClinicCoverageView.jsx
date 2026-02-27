// src/components/ClinicCoverageView.jsx
import React, { useMemo, useState } from "react";
import { Calendar, AlertTriangle, CheckCircle, ChevronLeft, ChevronRight } from "lucide-react";
import {
  optimizeClinicCoverage,
  getWeekRange,
} from "../utils/clinicUtils";
import { useAuth } from "../context/AuthContext";

// PGY-4 fellows who can't cover clinic in blocks 1-4 (first 8 weeks)
const FIRST_YEAR_EXCLUSION_BLOCKS = 4; // Blocks 1-4

const formatClinicDate = (date) =>
  date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

export default function ClinicCoverageView({
  fellows,
  schedule,
  clinicDays,
  pgyLevels,
  blockDates,
}) {
  const { canApprove, isSupabaseConfigured } = useAuth();
  const showPrivileged = !isSupabaseConfigured || canApprove;

const CANNOT_COVER_ROTATIONS = [
  "Cath","Cath 2","Cath 3","ICU","Floor A","Floor B","Nights","Vac","Vacation",""
];

    // Generate clinic coverage for all blocks - WEEKLY (2 per block)
  const clinicCoverage = useMemo(() => {
    return optimizeClinicCoverage({
      fellows,
      schedule,
      clinicDays,
      pgyLevels,
      blockDates,
      cannotCoverRotations: CANNOT_COVER_ROTATIONS,
      firstYearExclusionBlocks: FIRST_YEAR_EXCLUSION_BLOCKS,
      pgy6ExclusionStartBlock: 21,
      targetPerFellow: 4,
      seed: 7,
      iters: 200,
      restarts: 3,
    });
  }, [fellows, schedule, clinicDays, pgyLevels, blockDates]);

  const { entries: coverageEntries, counts: coverageStats } = clinicCoverage;

  // Month navigation for the clinic calendar
  const [currentMonth, setCurrentMonth] = useState(new Date(2026, 6, 1)); // July 2026

  // Build 42-cell calendar grid (same pattern as lectures view)
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay(); // 0=Sun
    const days = [];
    for (let i = 0; i < startPad; i++) {
      days.push({ date: new Date(year, month, -startPad + i + 1), isCurrentMonth: false });
    }
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }
    return days;
  }, [currentMonth]);

  // Build lookup: "YYYY-M-D" → coverage entries whose clinicDate falls on that day
  const coverageByDate = useMemo(() => {
    const map = new Map();
    coverageEntries.forEach((entry) => {
      const d = entry.clinicDate;
      if (!d) return;
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(entry);
    });
    return map;
  }, [coverageEntries]);

  // For a given calendar date, compute who is in clinic
  const getClinicInfoForDate = (date) => {
    const dow = date.getDay(); // 1=Mon..5=Fri
    if (dow === 0 || dow === 6) return null;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const dateStr = `${y}-${m}-${d}`;
    const block = blockDates.find((bd) => dateStr >= bd.start && dateStr <= bd.end);
    if (!block) return null;
    const blockIdx = block.block - 1;
    const coverageKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const coverages = coverageByDate.get(coverageKey) || [];
    const inClinic = [];
    fellows.forEach((fellow) => {
      if (clinicDays[fellow] === dow) {
        const rotation = schedule[fellow]?.[blockIdx] || "";
        if (rotation !== "Nights") {
          inClinic.push({ fellow, pgy: pgyLevels[fellow] });
        }
      }
    });
    return { inClinic, coverages };
  };

    // clinicDay: 1=Mon..5=Fri (matches JS getDay() for Mon-Fri)
  const clinicDayName = (day) => {
    const names = { 0: "None", 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri" };
    return names[day] || "?";
  };

  const getRotationColor = (rot) => {
    if (!rot || rot === "") return "bg-gray-200 text-gray-500";
    const r = String(rot).toLowerCase();
    if (r === "nights") return "bg-black text-white";
    if (r === "icu") return "bg-red-600 text-white";
    if (r.includes("floor")) return "bg-orange-500 text-white";
    if (r.includes("cath")) return "bg-blue-500 text-white";
    if (r.includes("echo")) return "bg-cyan-500 text-white";
    if (r.includes("nuclear")) return "bg-yellow-400 text-gray-900";
    if (r === "ep") return "bg-green-500 text-white";
    if (r.includes("ai")) return "bg-purple-400 text-white";
    if (r.includes("research")) return "bg-pink-300 text-gray-900";
    if (r === "admin" || r === "spc") return "bg-gray-400 text-white";
    if (r === "structural") return "bg-teal-500 text-white";
    if (r === "vascular") return "bg-rose-500 text-white";
    if (r === "cts") return "bg-amber-600 text-white";
    return "bg-blue-200 text-gray-800";
  };

  const getPGYColor = (pgy) => {
    if (pgy === 4) return "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 border-blue-300 dark:border-blue-700";
    if (pgy === 5) return "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100 border-green-300 dark:border-green-700";
    if (pgy === 6) return "bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-100 border-purple-300 dark:border-purple-700";
    return "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-500";
  };

  const noCoverageCount = coverageEntries.filter((e) => !e.coverer).length;

  const statsByPGY = {
    4: fellows.filter((f) => pgyLevels[f] === 4),
    5: fellows.filter((f) => pgyLevels[f] === 5),
    6: fellows.filter((f) => pgyLevels[f] === 6),
  };

  const totalAssignments = coverageEntries.filter((e) => e.coverer).length;
  const targetTotal = fellows.length * 4;

  return (
    <div className="space-y-4">
      {/* Summary — admins/chiefs/PDs only */}
      {showPrivileged && (
        <div className="bg-white dark:bg-gray-800 rounded border-2 border-gray-400 dark:border-gray-600 p-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-4">
              <div className="text-base dark:text-gray-200">
                <span className="font-bold">{coverageEntries.length}</span> weekly coverage slots
              </div>

              <div className="text-base text-gray-600 dark:text-gray-400">
                Assigned: <span className="font-bold">{totalAssignments}</span> (Target total:{" "}
                <span className="font-bold">{targetTotal}</span>)
              </div>

              {noCoverageCount > 0 ? (
                <div className="flex items-center gap-1 text-red-600 text-base font-bold">
                  <AlertTriangle className="w-4 h-4" />
                  {noCoverageCount} missing
                </div>
              ) : (
                <div className="flex items-center gap-1 text-green-600 text-base font-bold">
                  <CheckCircle className="w-4 h-4" />
                  All covered
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Monthly Clinic Calendar */}
      <div className="bg-white dark:bg-gray-800 rounded border-2 border-gray-400 dark:border-gray-600 overflow-hidden">
        {/* Month navigation header */}
        <div className="flex items-center justify-between px-3 py-2 bg-gray-100 dark:bg-gray-700 border-b-2 border-gray-400 dark:border-gray-600">
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
          >
            <ChevronLeft className="w-4 h-4 dark:text-gray-200" />
          </button>
          <h3 className="font-bold text-base flex items-center gap-2 dark:text-gray-100">
            <Calendar className="w-4 h-4" />
            {currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })} — Clinic
          </h3>
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
          >
            <ChevronRight className="w-4 h-4 dark:text-gray-200" />
          </button>
        </div>

        {/* Calendar — scrollable on narrow screens */}
        <div className="overflow-x-auto">
          <div className="min-w-[420px]">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 border-b border-gray-300 dark:border-gray-600">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="p-1 text-center text-xs font-bold text-gray-500 dark:text-gray-400">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7">
              {calendarDays.map((day, idx) => {
                const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6;
                const info = day.isCurrentMonth && !isWeekend ? getClinicInfoForDate(day.date) : null;

                return (
                  <div
                    key={idx}
                    className={`min-h-[64px] p-1 border-r border-b border-gray-200 dark:border-gray-700 ${
                      !day.isCurrentMonth
                        ? "opacity-30 bg-gray-50 dark:bg-gray-900"
                        : isWeekend
                        ? "bg-gray-50 dark:bg-gray-900"
                        : ""
                    }`}
                  >
                    <div className={`text-xs font-semibold mb-0.5 ${isWeekend ? "text-gray-400 dark:text-gray-600" : "dark:text-gray-200"}`}>
                      {day.date.getDate()}
                    </div>

                    {info && (
                      <div className="space-y-0.5">
                        {/* Fellows normally in clinic */}
                        {info.inClinic.map(({ fellow, pgy }) => (
                          <div
                            key={fellow}
                            className={`text-[10px] px-1 py-0.5 rounded truncate font-semibold ${getPGYColor(pgy)}`}
                            title={`${fellow} — regular clinic`}
                          >
                            {fellow}
                          </div>
                        ))}
                        {/* Coverage entries: coverer (or uncovered) for nights fellows */}
                        {info.coverages.map((entry, i) =>
                          entry.coverer ? (
                            <div
                              key={i}
                              className="text-[10px] px-1 py-0.5 rounded truncate font-semibold bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-300"
                              title={`${entry.coverer} covers clinic for ${entry.absent} (on Nights)`}
                            >
                              {entry.coverer}*
                            </div>
                          ) : (
                            <div
                              key={i}
                              className="text-[10px] px-1 py-0.5 rounded truncate font-semibold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                              title={`${entry.absent} on Nights — no coverage assigned`}
                            >
                              !{entry.absent}
                            </div>
                          )
                        )}
                      </div>
                    )}

                    {/* No block (outside academic year) */}
                    {day.isCurrentMonth && !isWeekend && !info && (
                      <div className="text-[9px] text-gray-300 dark:text-gray-600">—</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex flex-wrap gap-3 text-xs text-gray-600 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <span className="px-1 rounded bg-blue-100 text-blue-800 border border-blue-300 text-[10px] font-semibold">Name</span>
            <span className="px-1 rounded bg-green-100 text-green-800 border border-green-300 text-[10px] font-semibold">Name</span>
            <span className="px-1 rounded bg-purple-100 text-purple-800 border border-purple-300 text-[10px] font-semibold">Name</span>
            regular clinic
          </span>
          <span className="flex items-center gap-1">
            <span className="px-1 rounded bg-amber-100 text-amber-900 text-[10px] font-semibold">Name*</span>
            covering for nights fellow
          </span>
          <span className="flex items-center gap-1">
            <span className="px-1 rounded bg-red-100 text-red-700 text-[10px] font-semibold">!Name</span>
            uncovered
          </span>
        </div>
      </div>

      {/* Coverage Table */}
      <div className="bg-white dark:bg-gray-800 rounded border-2 border-gray-400 dark:border-gray-600 overflow-hidden">
        <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700 border-b-2 border-gray-400 dark:border-gray-600">
          <h3 className="font-bold text-base flex items-center gap-2 dark:text-gray-100">
            <Calendar className="w-4 h-4" />
            Weekly Clinic Coverage for Nights
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            Week slots are blockStart-anchored and clamped to block end dates
          </p>
        </div>

        {/* ── Mobile: one card per entry ── */}
        <div className="md:hidden p-2 space-y-1.5">
          {coverageEntries.map((entry, idx) => {
            const { weekStart, weekEnd } = getWeekRange(
              entry.blockStart,
              entry.blockEnd,
              entry.week
            );
            const clinicDate = entry.clinicDate;

            const cardBorder = !entry.coverer
              ? "border-red-300 dark:border-red-700"
              : entry.relaxedSameClinicDay
              ? "border-yellow-300 dark:border-yellow-700"
              : entry.relaxedBackToBack
              ? "border-amber-300 dark:border-amber-700"
              : "border-gray-200 dark:border-gray-700";

            const cardBg = !entry.coverer
              ? "bg-red-50 dark:bg-red-950/40"
              : entry.relaxedSameClinicDay
              ? "bg-yellow-50 dark:bg-yellow-950/40"
              : entry.relaxedBackToBack
              ? "bg-amber-50 dark:bg-amber-950/40"
              : idx % 2 === 0
              ? "bg-white dark:bg-gray-900"
              : "bg-gray-50 dark:bg-gray-800";

            return (
              <div key={idx} className={`rounded border text-xs overflow-hidden ${cardBorder}`}>
                {/* Card header: block + week + date range */}
                <div className={`flex items-center justify-between px-2 py-1 ${cardBg} border-b ${cardBorder}`}>
                  <div className="flex items-center gap-1.5 font-bold dark:text-gray-100">
                    <span>Blk {entry.block} · W{entry.week}</span>
                    {entry.relaxedSameClinicDay && (
                      <span className="px-1 rounded text-[10px] font-bold bg-yellow-200 text-yellow-900">RELAX</span>
                    )}
                    {!entry.relaxedSameClinicDay && entry.relaxedBackToBack && (
                      <span className="px-1 rounded text-[10px] font-bold bg-amber-200 text-amber-900">B2B</span>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">
                    {weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })}–
                    {weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>

                {/* Card body: absent → covered */}
                <div className={`px-2 py-1.5 grid grid-cols-2 gap-x-2 items-center ${cardBg}`}>
                  {/* Left: absent fellow + clinic date */}
                  <div className="flex flex-col min-w-0">
                    <span className="px-1.5 py-0.5 rounded bg-black text-white font-semibold truncate self-start max-w-full">
                      {entry.absent}
                    </span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                      Nights → {clinicDayName(entry.absentClinicDay)}
                      {clinicDate ? ` ${clinicDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
                    </span>
                  </div>

                  {/* Right: coverer info */}
                  <div className="flex flex-col min-w-0">
                    {entry.coverer ? (
                      <>
                        <span className={`px-1.5 py-0.5 rounded font-semibold truncate self-start max-w-full ${getRotationColor(entry.covererRotation)}`}>
                          {entry.coverer}
                        </span>
                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                          <span className="text-[10px] text-gray-500 dark:text-gray-400">
                            ({clinicDayName(entry.covererClinicDay)})
                          </span>
                          {entry.covererRotation && (
                            <span className={`px-1 py-0.5 rounded text-[10px] font-semibold ${getRotationColor(entry.covererRotation)}`}>
                              {entry.covererRotation}
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <span className="flex items-center gap-1 text-red-600 font-bold">
                        <AlertTriangle className="w-3 h-3" />
                        NONE
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Desktop: full table ── */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-200 dark:bg-gray-700">
              <tr className="border-b border-gray-400 dark:border-gray-600">
                <th className="px-1 py-1 text-left font-bold dark:text-gray-100">Blk</th>
                <th className="px-1 py-1 text-left font-bold dark:text-gray-100">Week</th>
                <th className="px-1 py-1 text-left font-bold dark:text-gray-100">On Nights</th>
                <th className="px-1 py-1 text-left font-bold dark:text-gray-100">Clinic Date</th>
                <th className="px-1 py-1 text-center font-bold dark:text-gray-100">→</th>
                <th className="px-1 py-1 text-left font-bold dark:text-gray-100">Covered By</th>
                <th className="px-1 py-1 text-left font-bold dark:text-gray-100">Their Rot</th>
              </tr>
            </thead>

            <tbody>
              {coverageEntries.map((entry, idx) => {
                const rowBg = !entry.coverer
                  ? "bg-red-50 dark:bg-red-950/40"
                  : entry.relaxedSameClinicDay
                  ? "bg-yellow-50 dark:bg-yellow-950/40"
                  : entry.relaxedBackToBack
                  ? "bg-amber-50 dark:bg-amber-950/40"
                  : idx % 2 === 0
                  ? "bg-white dark:bg-gray-900"
                  : "bg-gray-50 dark:bg-gray-800";

                const { weekStart, weekEnd } = getWeekRange(
                  entry.blockStart,
                  entry.blockEnd,
                  entry.week
                );

                const clinicDate = entry.clinicDate;

                return (
                  <tr key={idx} className={`border-b border-gray-200 dark:border-gray-700 ${rowBg}`}>
                    <td className="px-1 py-1 font-bold text-gray-900 dark:text-gray-100">{entry.block}</td>

                    <td className="px-1 py-1 text-gray-600 dark:text-gray-400">
                      <div className="flex items-center gap-1">
                        <div>W{entry.week}</div>
                        {entry.relaxedSameClinicDay && (
                          <span className="px-1 rounded text-[10px] font-bold bg-yellow-200 text-yellow-900">
                            RELAX
                          </span>
                        )}
                        {!entry.relaxedSameClinicDay && entry.relaxedBackToBack && (
                          <span className="px-1 rounded text-[10px] font-bold bg-amber-200 text-amber-900">
                            B2B
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        {`${weekStart.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}-${weekEnd.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}`}
                      </div>
                    </td>

                    <td className="px-1 py-1">
                      <span className="px-1.5 py-0.5 rounded bg-black text-white font-semibold">{entry.absent}</span>
                      <span
                        className={`ml-1 px-1 py-0.5 rounded text-[10px] font-semibold ${getRotationColor(
                          "Nights"
                        )}`}
                      >
                        Nts
                      </span>
                    </td>

                    <td className="px-1 py-1 text-left text-gray-700 dark:text-gray-300">
                      <div className="font-semibold">{clinicDayName(entry.absentClinicDay)}</div>
                      <div className="text-[10px] text-gray-500 dark:text-gray-400">{formatClinicDate(clinicDate)}</div>
                    </td>

                    <td className="px-1 py-1 text-center text-gray-400 dark:text-gray-500">→</td>

                    <td className="px-1 py-1">
                      {entry.coverer ? (
                        <span>
                          <span className={`px-1.5 py-0.5 rounded font-semibold ${getRotationColor(entry.covererRotation)}`}>{entry.coverer}</span>
                          <span className="text-[10px] text-gray-400 ml-1">
                            ({clinicDayName(entry.covererClinicDay)})
                          </span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-600 font-bold">
                          <AlertTriangle className="w-3 h-3" />
                          NONE
                        </span>
                      )}
                    </td>

                    <td className="px-1 py-1">
                      {entry.covererRotation ? (
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${getRotationColor(
                            entry.covererRotation
                          )}`}
                        >
                          {entry.covererRotation}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Coverage Stats by PGY - chiefs/PDs/admins only */}
      {showPrivileged && <div className="bg-white dark:bg-gray-800 rounded border-2 border-gray-400 dark:border-gray-600 overflow-hidden">
        <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700 border-b-2 border-gray-400 dark:border-gray-600">
          <h3 className="font-bold text-base dark:text-gray-100">Coverage Load Distribution</h3>
          <p className="text-xs text-gray-600 dark:text-gray-400">Target: 4 per fellow</p>
        </div>

        <div className="p-3 space-y-3">
          {[4, 5, 6].map((pgy) => (
            <div key={pgy}>
              <div className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">PGY-{pgy}</div>
              <div className="flex flex-wrap gap-2">
                {statsByPGY[pgy].map((fellow) => {
                  const count = coverageStats?.[fellow] || 0;
                  const isOverTarget = count > 4;
                  const isUnderTarget = count < 4;

                  return (
                    <div
                      key={fellow}
                      className={`px-3 py-2 rounded border-2 min-w-[110px] ${
                        isOverTarget
                          ? "bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-700"
                          : isUnderTarget
                          ? "bg-yellow-50 dark:bg-yellow-950/40 border-yellow-300 dark:border-yellow-700"
                          : getPGYColor(pgy)
                      }`}
                    >
                      <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">{fellow}</div>
                      <div className="flex items-baseline gap-1">
                        <span
                          className={`text-xl font-bold ${
                            isOverTarget ? "text-red-600" : isUnderTarget ? "text-yellow-600" : "text-gray-900 dark:text-gray-100"
                          }`}
                        >
                          {count}
                        </span>
                        <span className="text-[11px] text-gray-600 dark:text-gray-400">covers</span>
                      </div>
                      <div className="text-[10px] text-gray-600 dark:text-gray-400">
                        Clinic: {clinicDayName(clinicDays[fellow])}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="text-xs text-gray-600 dark:text-gray-400">
            <span className="font-bold">Rules:</span> PGY-4s excluded blocks 1-4 • PGY-6s excluded blocks 21+ •
            B2B avoided unless needed • Same clinic day avoided unless needed
          </div>
        </div>
      </div>}
    </div>
  );
}
