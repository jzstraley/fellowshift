// src/components/CalendarView.jsx
import React, { useEffect, useMemo, useState } from "react";
import { blockDates, pgyLevels } from "../data/scheduleData";
import { getRotationColor, formatDate } from "../utils/scheduleUtils";
import { useAuth } from "../context/AuthContext";

// ── helpers ────────────────────────────────────────────────────────────────

const toISODate = (d) => {
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, "0");
  const dd   = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function buildDays(startStr, endStr) {
  const days = [];
  const end  = new Date(endStr + "T23:59:59");
  const cur  = new Date(startStr + "T12:00:00");
  while (cur <= end) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

// Split flat day array into week rows (Sunday-anchored)
function splitIntoWeeks(days) {
  if (!days.length) return [];
  const weeks = [];
  let week = [];
  days.forEach((day) => {
    if (day.getDay() === 0 && week.length > 0) {
      weeks.push(week);
      week = [];
    }
    week.push(day);
  });
  if (week.length > 0) weeks.push(week);
  return weeks;
}

// Pre-build date → blockIndex map
function buildDateToBlockIdx() {
  const map = {};
  blockDates.forEach((bd, i) => {
    const cur = new Date(bd.start + "T12:00:00");
    const end = new Date(bd.end   + "T23:59:59");
    while (cur <= end) {
      map[toISODate(cur)] = i;
      cur.setDate(cur.getDate() + 1);
    }
  });
  return map;
}

const DATE_TO_BLOCK_IDX = buildDateToBlockIdx();

// Group blockDates by rotation number → [{ rotation, blocks: [bd, bd] }, ...]
const ROTATION_GROUPS = (() => {
  const map = {};
  blockDates.forEach((bd) => {
    if (!map[bd.rotation]) map[bd.rotation] = [];
    map[bd.rotation].push(bd);
  });
  return Object.entries(map)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([rotation, blocks]) => ({ rotation: Number(rotation), blocks }));
})();

function getInitialRotation() {
  const today = new Date().toISOString().split("T")[0];
  const bd    = blockDates.find((b) => today >= b.start && today <= b.end);
  return bd ? bd.rotation : 1;
}

const PGY_BORDER = { 4: "border-l-blue-400", 5: "border-l-green-400", 6: "border-l-purple-500" };
const PGY_LABEL  = { 4: "text-blue-400",      5: "text-green-400",     6: "text-purple-400"    };

// ── component ──────────────────────────────────────────────────────────────

export default function CalendarView({ fellows, schedule, vacations = [], dateCallMap }) {
  const { profile, canManage } = useAuth();

  // Auto-select the logged-in fellow if they are a fellow (not admin/PD/chief)
  const linkedFellow = useMemo(() => {
    if (canManage) return null; // managers see everyone by default
    const name = profile?.full_name?.trim();
    return name && fellows.includes(name) ? name : null;
  }, [profile, canManage, fellows]);

  const [selectedRotation, setSelectedRotation] = useState(getInitialRotation);
  const [fellowFilter,     setFellowFilter]     = useState("all");
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => toISODate(new Date()));
  const [highlightedFellow, setHighlightedFellow] = useState(null);
  const [highlightedBlockIdx, setHighlightedBlockIdx] = useState(null);

  // Once profile loads, snap to the linked fellow (only if user hasn't manually picked someone)
  useEffect(() => {
    if (linkedFellow) setFellowFilter((prev) => prev === "all" ? linkedFellow : prev);
  }, [linkedFellow]);

  const rotGroup = ROTATION_GROUPS.find((g) => g.rotation === selectedRotation)
    ?? ROTATION_GROUPS[0];

  // All days across both blocks in this rotation
  const allDays = useMemo(() => {
    const first = rotGroup.blocks[0];
    const last  = rotGroup.blocks[rotGroup.blocks.length - 1];
    return buildDays(first.start, last.end);
  }, [rotGroup]);

  const weeks = useMemo(() => splitIntoWeeks(allDays), [allDays]);

  // Find the index in weeks where the second block starts (for visual divider)
  const block2StartISO = rotGroup.blocks[1]?.start;
  const block2StartWeekIdx = useMemo(() => {
    if (!block2StartISO || rotGroup.blocks.length < 2) return -1;
    return weeks.findIndex((w) => w.some((d) => toISODate(d) === block2StartISO));
  }, [weeks, block2StartISO]);

  const fellowsByPGY = useMemo(() => ({
    4: fellows.filter((f) => pgyLevels[f] === 4),
    5: fellows.filter((f) => pgyLevels[f] === 5),
    6: fellows.filter((f) => pgyLevels[f] === 6),
  }), [fellows]);

  // Precompute vacation set for O(1) checks
  const vacationSet = useMemo(() => {
    const s = new Set();
    (vacations || []).forEach((v) => {
      if (v.reason !== "Vacation") return;
      if ((v.status ?? '').toLowerCase() !== "approved") return;
      for (let b = v.startBlock; b <= v.endBlock; b++) {
        s.add(`${v.fellow}#${b}`);
      }
    });
    return s;
  }, [vacations]);

  // Precompute vacation dates for calendar highlighting
  const vacationDateSet = useMemo(() => {
    const s = new Set();
    (vacations || []).forEach((v) => {
      if (v.reason !== "Vacation") return;
      if ((v.status ?? '').toLowerCase() !== "approved") return;
      // Find the date range for this vacation using block dates
      let startDate = null;
      let endDate = null;
      for (let b = v.startBlock; b <= v.endBlock; b++) {
        const bd = blockDates[b - 1]; // blocks are 1-indexed
        if (bd && !startDate) startDate = new Date(bd.start + "T00:00:00");
        if (bd) endDate = new Date(bd.end + "T23:59:59");
      }
      // Add all dates in the range
      if (startDate && endDate) {
        const cur = new Date(startDate);
        while (cur <= endDate) {
          s.add(`${v.fellow}#${toISODate(cur)}`);
          cur.setDate(cur.getDate() + 1);
        }
      }
    });
    return s;
  }, [vacations]);

  const isDateInVacation = (fellow, dateISO) => vacationDateSet.has(`${fellow}#${dateISO}`);
  const isBlockInVacationFast = (fellow, blockNumber) => vacationSet.has(`${fellow}#${blockNumber}`);

  // Generate calendar grid for the current month
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay();
    const days = [];

    for (let i = 0; i < startPad; i++) {
      const d = new Date(year, month, -startPad + i + 1);
      days.push({ date: d, isCurrentMonth: false });
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

  const getCellInfo = (fellow, date) => {
    const dateISO   = toISODate(date);
    const dow       = date.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const blockIdx  = DATE_TO_BLOCK_IDX[dateISO];
    const rotation  = blockIdx !== undefined ? (schedule?.[fellow]?.[blockIdx] ?? null) : null;
    const isNights  = rotation?.toLowerCase() === "nights";

    const dayData = dateCallMap?.[dateISO];
    if (dayData?.call  === fellow) return { label: "Call",  color: "bg-red-500 text-white" };
    if (dayData?.float === fellow) return { label: "Float", color: "bg-orange-500 text-white" };

    if (isNights) {
      return dow === 6
        ? { label: "—", color: "" }
        : { label: "Nts", color: "bg-black text-white dark:bg-gray-900" };
    }

    if (isWeekend) return { label: "—", color: "" };
    if (rotation)  return { label: rotation, color: getRotationColor(rotation) };
    return { label: "", color: "" };
  };

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-xl md:max-w-2xl lg:max-w-4xl xl:max-w-6xl space-y-4 px-4 md:px-0">

      {/* ── Toolbar ── */}
      <div className="space-y-2 sm:space-y-0 sm:flex sm:items-center sm:gap-3 sm:flex-wrap">

        {/* Fellow filter */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap w-20 sm:w-auto">
            Fellow:
          </label>
          <select
            value={fellowFilter}
            onChange={(e) => setFellowFilter(e.target.value)}
            className="flex-1 sm:flex-none px-3 py-2 text-sm font-semibold rounded border min-h-[44px] bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 border-gray-300 dark:border-gray-600"
          >
            <option value="all">All Fellows</option>
            {[4, 5, 6].flatMap((pgy) =>
              fellowsByPGY[pgy].map((f) => (
                <option key={f} value={f}>{f} (PGY-{pgy})</option>
              ))
            )}
          </select>
        </div>

        {/* Legend — mobile only */}
        <div className="flex flex-wrap gap-2 items-center sm:hidden">
          <span className="font-bold text-xs text-gray-700 dark:text-gray-300">Legend:</span>
          <span className="px-2 py-1 text-xs bg-red-500 text-white rounded font-semibold">Call</span>
          <span className="px-2 py-1 text-xs bg-orange-500 text-white rounded font-semibold">Float</span>
          <span className="px-2 py-1 text-xs bg-black dark:bg-gray-900 text-white dark:text-white rounded font-semibold">Nights</span>
        </div>
      </div>

      {/* ── Month Calendar with Day Summary ── */}
      <div className="space-y-2 max-h-[calc(100vh-240px)] overflow-y-auto hide-scrollbar">
        {/* Month/Year header with navigation */}
        <div className="flex items-center justify-center gap-1 sm:gap-2 flex-wrap">
          <button
            onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1))}
            className="flex items-center justify-center p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors shrink-0"
            title="Previous month"
          >
            <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="px-3 py-1 rounded-full text-center font-semibold text-xs whitespace-nowrap bg-teal-500 dark:bg-teal-600 text-white">
            {currentMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </div>

          <button
            onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1))}
            className="flex items-center justify-center p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors shrink-0"
            title="Next month"
          >
            <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Calendar Grid + Day Summary Container */}
        <div className="flex flex-col lg:flex-row gap-4">

        {/* Calendar Grid */}
        <div className="flex-1 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-0 p-2 pb-1 border-b border-gray-200 dark:border-gray-700">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div
                key={day}
                className="text-center text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase"
              >
                {day.slice(0, 1)}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-0 p-2 pt-1">
            {calendarDays.map((day, idx) => {
              const dateISO = toISODate(day.date);
              const isCurrentMonth = day.isCurrentMonth;
              const isSelected = selectedDate === dateISO;
              const blockIdx = blockDates.findIndex(bd => dateISO >= bd.start && dateISO <= bd.end);

              // Get info for selected fellow or count for all
              let cellContent = null;
              let cellBgColor = "";
              let borderHighlight = "";

              // Determine which fellow to display (from dropdown filter or highlighted from list)
              // Only show highlighted fellow if we're in the same block they were selected in
              const displayFellow = fellowFilter !== "all" ? fellowFilter : (highlightedFellow && highlightedBlockIdx === blockIdx ? highlightedFellow : null);

              if (displayFellow) {
                // Check for call/float first (overrides rotation)
                const dayData = dateCallMap?.[dateISO] || {};
                if (dayData.call === displayFellow) {
                  cellContent = "Call";
                  cellBgColor = "bg-orange-500";
                  borderHighlight = "";
                } else if (dayData.float === displayFellow) {
                  cellContent = "Float";
                  cellBgColor = "bg-orange-500";
                  borderHighlight = "";
                } else {
                  // Show selected fellow's rotation
                  const rotation = blockIdx >= 0 ? (schedule[displayFellow]?.[blockIdx] ?? null) : null;
                  const isVac = isBlockInVacationFast(displayFellow, blockIdx >= 0 ? blockIdx + 1 : 0);
                  if (isVac) {
                    cellContent = "Vac";
                    cellBgColor = "bg-yellow-500";
                  } else if (rotation) {
                    cellContent = rotation;
                    cellBgColor = getRotationColor(rotation);
                  }
                }
              } else {
                // Show count of all fellows
                const dayFellowCount = fellows.filter(f => {
                  const rot = schedule[f]?.[blockIdx >= 0 ? blockIdx : blockDates.findIndex(bd => toISODate(day.date) >= bd.start && toISODate(day.date) <= bd.end)] ?? "";
                  return rot && rot !== "";
                }).length;
                if (dayFellowCount > 0 && isCurrentMonth) {
                  cellContent = dayFellowCount;
                }
              }

              // Check for vacation dates
              let vacationBgColor = "";
              if (fellowFilter !== "all") {
                if (isDateInVacation(fellowFilter, dateISO)) {
                  vacationBgColor = "bg-yellow-200 dark:bg-yellow-900/40";
                }
              }

              return (
                <button
                  key={idx}
                  onClick={() => {
                    setSelectedDate(dateISO);
                    // Clear highlight if clicking on a different block
                    if (highlightedBlockIdx !== null && blockIdx !== highlightedBlockIdx) {
                      setHighlightedFellow(null);
                      setHighlightedBlockIdx(null);
                    }
                  }}
                  className={`aspect-square flex flex-col items-center justify-center p-0.5 rounded cursor-pointer sm:border sm:border-gray-200 sm:dark:border-gray-700 transition-all ${vacationBgColor} ${
                    highlightedBlockIdx !== null && blockIdx === highlightedBlockIdx ? "shadow-lg shadow-teal-400/50 dark:shadow-teal-500/50" : ""
                  } ${
                    isSelected ? "bg-teal-500 dark:bg-teal-600" : ""
                  }`}
                >
                  <div
                    className={`${cellContent === "Call" || cellContent === "Float" ? "w-full h-full border-2 border-black dark:border-white" : "w-3/4 h-3/4"} flex flex-col items-center justify-center rounded transition-all text-[12px] sm:text-[9px] font-semibold ${
                      !isCurrentMonth
                        ? "text-gray-300 dark:text-gray-700"
                        : ""
                    } ${
                      cellBgColor
                        ? cellBgColor
                        : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-900 dark:text-gray-100"
                    }`}
                  >
                    <div>{day.date.getDate()}</div>
                    {cellContent && (
                      <div className={`text-[8px] ${cellBgColor ? "text-white font-bold" : "text-gray-500 dark:text-gray-400"}`}>
                        {cellContent}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Day Summary — Stacked fellow rotations */}
        {(() => {
          const selectedDay = new Date(`${selectedDate}T00:00:00`);
          const dayOfWeek = selectedDay.getDay();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
          const selectedDayLabel = selectedDay.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
          const blockIdx = blockDates.findIndex(bd => selectedDate >= bd.start && selectedDate <= bd.end);

          // For weekends, get call/float/nights assignments
          const callFloatData = dateCallMap?.[selectedDate] || {};
          const callFellow = callFloatData.call;
          const floatFellow = callFloatData.float;

          // Find fellow with Nights rotation on Sunday night
          let nightsFellow = null;
          if (dayOfWeek === 0) { // Sunday
            nightsFellow = fellows.find((f) => {
              const rot = schedule[f]?.[blockIdx] ?? "";
              return rot === "Nights";
            }) || null;
          }

          return (
            <div className={`rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden lg:w-72 lg:flex-shrink-0`}>
              <div className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-700 bg-teal-500 dark:bg-teal-600">
                <div className="text-xs font-semibold text-white">
                  {selectedDayLabel}
                </div>
              </div>
              <div>
                {isWeekend ? (
                  // Weekend: show call/float (Sat) and nights (Sun)
                  <>
                    {!callFellow && !floatFellow && !nightsFellow ? (
                      <div className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500">No assignments</div>
                    ) : (
                      <>
                        {callFellow && (
                          <div
                            onClick={() => {
                              if (highlightedFellow === callFellow) {
                                setHighlightedFellow(null);
                                setHighlightedBlockIdx(null);
                              } else {
                                setHighlightedFellow(callFellow);
                                setHighlightedBlockIdx(blockIdx);
                              }
                            }}
                            className={`px-3 py-1.5 flex items-center justify-between border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer ${
                              highlightedFellow === callFellow ? "bg-teal-100 dark:bg-teal-900/30 ring-1 ring-teal-400 dark:ring-teal-500" : ""
                            }`}
                          >
                            <div className="font-semibold text-xs text-gray-900 dark:text-gray-100">{callFellow}</div>
                            <div className="px-2 py-0.5 text-[10px] font-semibold rounded text-white bg-red-500">Call</div>
                          </div>
                        )}
                        {floatFellow && (
                          <div
                            onClick={() => {
                              if (highlightedFellow === floatFellow) {
                                setHighlightedFellow(null);
                                setHighlightedBlockIdx(null);
                              } else {
                                setHighlightedFellow(floatFellow);
                                setHighlightedBlockIdx(blockIdx);
                              }
                            }}
                            className={`px-3 py-1.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer ${nightsFellow ? "border-b border-gray-100 dark:border-gray-700" : ""} ${
                              highlightedFellow === floatFellow ? "bg-teal-100 dark:bg-teal-900/30 ring-1 ring-teal-400 dark:ring-teal-500" : ""
                            }`}
                          >
                            <div className="font-semibold text-xs text-gray-900 dark:text-gray-100">{floatFellow}</div>
                            <div className="px-2 py-0.5 text-[10px] font-semibold rounded text-white bg-orange-500">Float</div>
                          </div>
                        )}
                        {nightsFellow && (
                          <div
                            onClick={() => {
                              if (highlightedFellow === nightsFellow) {
                                setHighlightedFellow(null);
                                setHighlightedBlockIdx(null);
                              } else {
                                setHighlightedFellow(nightsFellow);
                                setHighlightedBlockIdx(blockIdx);
                              }
                            }}
                            className={`px-3 py-1.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer ${
                              highlightedFellow === nightsFellow ? "bg-teal-100 dark:bg-teal-900/30 ring-1 ring-teal-400 dark:ring-teal-500" : ""
                            }`}
                          >
                            <div className="font-semibold text-xs text-gray-900 dark:text-gray-100">{nightsFellow}</div>
                            <div className="px-2 py-0.5 text-[10px] font-semibold rounded text-white bg-black dark:bg-gray-900 dark:text-white">Nights</div>
                          </div>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  // Weekday: show all fellows with rotations
                  <>
                    {fellows.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-gray-400 dark:text-gray-500">No fellows</div>
                    ) : (
                      [4, 5, 6].map((pgy) => {
                        const pgyFellows = fellows.filter((f) => pgyLevels[f] === pgy);
                        if (pgyFellows.length === 0) return null;

                        return (
                          <div key={pgy}>
                            <div className="px-3 py-1 bg-gray-100 dark:bg-gray-700 border-t border-b border-gray-200 dark:border-gray-600 text-xs font-semibold text-gray-700 dark:text-gray-300">
                              PGY-{pgy}
                            </div>
                            <div>
                              {pgyFellows.map((fellow, idx) => {
                                const rotation = blockIdx >= 0 ? (schedule[fellow]?.[blockIdx] ?? "") : "";
                                const rotColor = rotation ? getRotationColor(rotation) : "bg-gray-100 dark:bg-gray-700";
                                const isVac = isBlockInVacationFast(fellow, blockIdx >= 0 ? blockIdx + 1 : 0);
                                const isLast = idx === pgyFellows.length - 1;

                                return (
                                  <div
                                    key={fellow}
                                    onClick={() => {
                                      if (highlightedFellow === fellow) {
                                        setHighlightedFellow(null);
                                        setHighlightedBlockIdx(null);
                                      } else {
                                        setHighlightedFellow(fellow);
                                        setHighlightedBlockIdx(blockIdx);
                                      }
                                    }}
                                    className={`px-3 py-1.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer ${
                                      highlightedFellow === fellow ? "bg-teal-100 dark:bg-teal-900/30 ring-1 ring-teal-400 dark:ring-teal-500" : ""
                                    } ${
                                      !isLast ? "border-b border-gray-100 dark:border-gray-700" : ""
                                    }`}
                                  >
                                    <div className="font-semibold text-xs text-gray-900 dark:text-gray-100">{fellow}</div>
                                    {isVac ? (
                                      <div className="px-2 py-0.5 text-[10px] font-semibold rounded text-white bg-yellow-500">
                                        Vacation
                                      </div>
                                    ) : rotation ? (
                                      <div className={`px-2 py-0.5 text-[10px] font-semibold rounded text-white ${rotColor}`}>
                                        {rotation}
                                      </div>
                                    ) : (
                                      <div className="text-xs text-gray-400 dark:text-gray-500">—</div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })()}
        </div>
      </div>
    </div>
  );
}
