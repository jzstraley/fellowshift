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

export default function CalendarView({ fellows, schedule, dateCallMap }) {
  const { profile, canManage } = useAuth();

  // Auto-select the logged-in fellow if they are a fellow (not admin/PD/chief)
  const linkedFellow = useMemo(() => {
    if (canManage) return null; // managers see everyone by default
    const name = profile?.full_name?.trim();
    return name && fellows.includes(name) ? name : null;
  }, [profile, canManage, fellows]);

  const [selectedRotation, setSelectedRotation] = useState(getInitialRotation);
  const [fellowFilter,     setFellowFilter]     = useState("all");

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

  const filteredFellowsByPGY = useMemo(() => {
    if (fellowFilter === "all") return fellowsByPGY;
    return {
      4: fellowsByPGY[4].filter((f) => f === fellowFilter),
      5: fellowsByPGY[5].filter((f) => f === fellowFilter),
      6: fellowsByPGY[6].filter((f) => f === fellowFilter),
    };
  }, [fellowsByPGY, fellowFilter]);

  const today = new Date().toISOString().split("T")[0];

  const getCellInfo = (fellow, date) => {
    const dateISO   = toISODate(date);
    const dow       = date.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const blockIdx  = DATE_TO_BLOCK_IDX[dateISO];
    const rotation  = blockIdx !== undefined ? (schedule?.[fellow]?.[blockIdx] ?? null) : null;
    const isNights  = rotation?.toLowerCase() === "nights";

    const dayData = dateCallMap?.[dateISO];
    if (dayData?.call  === fellow) return { label: "Call",  color: "bg-red-500 text-white" };
    if (dayData?.float === fellow) return { label: "Float", color: "bg-purple-600 text-white" };

    if (isNights) {
      return dow === 6
        ? { label: "—", color: "" }
        : { label: "Nts", color: "bg-black text-white dark:bg-gray-900" };
    }

    if (isWeekend) return { label: "—", color: "" };
    if (rotation)  return { label: rotation, color: getRotationColor(rotation) };
    return { label: "", color: "" };
  };

  // ── render one fellow card ──────────────────────────────────────────────

  const renderFellowCard = (fellow) => {
    const pgy = pgyLevels[fellow];

    return (
      <div
        key={fellow}
        className={`rounded-lg border border-gray-200 dark:border-gray-600 border-l-4 ${PGY_BORDER[pgy] ?? "border-l-gray-400"} overflow-hidden shadow-sm bg-white dark:bg-gray-800`}
      >
        {/* Card header */}
        <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 flex items-baseline gap-1.5">
          <span className="font-bold text-sm text-gray-900 dark:text-white">{fellow}</span>
          <span className={`text-[10px] font-semibold ${PGY_LABEL[pgy] ?? "text-gray-400"}`}>
            PGY-{pgy}
          </span>
        </div>

        {/* Week grids */}
        <div className="p-2 space-y-2">
          {/* Day-name header */}
          <div className="grid grid-cols-7 mb-0.5">
            {DAY_NAMES.map((d) => (
              <div key={d} className="text-center text-[9px] font-semibold text-gray-400 dark:text-gray-500">
                {d}
              </div>
            ))}
          </div>

          {weeks.map((weekDays, wi) => {
            const isBlock1Start = wi === 0;
            const isBlock2Start = wi === block2StartWeekIdx;
            return (
              <React.Fragment key={wi}>
                {/* Block label — shown before the first week of each block */}
                {(isBlock1Start || isBlock2Start) && (
                  <div className={`text-[9px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest px-0.5
                    ${isBlock2Start ? "border-t border-dashed border-gray-200 dark:border-gray-600 pt-2 mt-1" : ""}
                  `}>
                    {isBlock1Start
                      ? `Block ${rotGroup.blocks[0].block} · ${formatDate(rotGroup.blocks[0].start)}`
                      : `Block ${rotGroup.blocks[1].block} · ${formatDate(rotGroup.blocks[1].start)}`}
                  </div>
                )}

                {/* 7-column day grid */}
                <div className="grid grid-cols-7 gap-0.5">
                  {Array.from({ length: 7 }).map((_, col) => {
                    const offset = wi === 0 ? weekDays[0].getDay() : 0;
                    const dayIdx = col - offset;
                    const day    = dayIdx >= 0 && dayIdx < weekDays.length ? weekDays[dayIdx] : null;

                    if (!day) {
                      return <div key={col} className="h-14 rounded bg-gray-50 dark:bg-gray-700/30" />;
                    }

                    const iso       = toISODate(day);
                    const isToday   = iso === today;
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                    const { label, color } = getCellInfo(fellow, day);
                    const showLabel = label && label !== "—";

                    return (
                      <div
                        key={col}
                        className={`relative flex flex-col items-center justify-start pt-1 h-14 rounded
                          ${isWeekend ? "bg-yellow-50 dark:bg-yellow-900/20" : "bg-gray-50 dark:bg-gray-700/40"}
                          ${isToday ? "ring-2 ring-blue-500 ring-inset" : ""}
                        `}
                      >
                        <span className={`text-[9px] font-semibold leading-none
                          ${isToday ? "text-blue-500 dark:text-blue-400" : "text-gray-500 dark:text-gray-400"}
                        `}>
                          {day.getDate()}
                        </span>

                        {showLabel ? (
                          <div className={`mt-1 mx-0.5 px-0.5 py-0.5 rounded text-[8px] font-bold leading-tight text-center w-[calc(100%-4px)] truncate ${color}`}>
                            {label.length > 4 ? label.slice(0, 4) : label}
                          </div>
                        ) : (
                          <div className="mt-1 text-[10px] text-gray-200 dark:text-gray-600 leading-none">—</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  };

  // ── render ────────────────────────────────────────────────────────────────

  const anyVisible = [4, 5, 6].some((p) => filteredFellowsByPGY[p].length > 0);

  return (
    <div className="space-y-4">

      {/* ── Toolbar ── */}
      <div className="space-y-2 sm:space-y-0 sm:flex sm:items-center sm:gap-3 sm:flex-wrap">

        {/* Rotation selector */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap w-20 sm:w-auto">
            Rotation:
          </label>
          <select
            value={selectedRotation}
            onChange={(e) => setSelectedRotation(Number(e.target.value))}
            className="flex-1 sm:flex-none px-3 py-2 text-sm font-semibold rounded border min-h-[44px] bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 border-gray-300 dark:border-gray-600"
          >
            {ROTATION_GROUPS.map(({ rotation, blocks }) => {
              const first = blocks[0];
              const last  = blocks[blocks.length - 1];
              const isCurrent = blocks.some((b) => {
                const t = new Date().toISOString().split("T")[0];
                return t >= b.start && t <= b.end;
              });
              const blockNums = blocks.map((b) => `Block ${b.block}`).join(" + ");
              return (
                <option key={rotation} value={rotation}>
                  Rotation {rotation} · {blockNums} · {formatDate(first.start)}–{formatDate(last.end)}
                  {isCurrent ? " ★ Current" : ""}
                </option>
              );
            })}
          </select>
        </div>

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

        {/* Legend */}
        <div className="flex flex-wrap gap-2 items-center sm:ml-auto">
          <span className="font-bold text-sm text-gray-700 dark:text-gray-300">Legend:</span>
          <span className="px-2 py-1 text-xs bg-red-500 text-white rounded font-semibold">Call</span>
          <span className="px-2 py-1 text-xs bg-purple-600 text-white rounded font-semibold">Float</span>
          <span className="px-2 py-1 text-xs bg-black dark:bg-gray-900 text-white rounded font-semibold">Nights</span>
        </div>
      </div>

      {/* ── Cards ── */}
      {!anyVisible ? (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500 text-sm">
          No fellows match the current filter.
        </div>
      ) : fellowFilter !== "all" ? (
        // Single fellow — centered, capped width
        <div className="flex justify-center">
          <div className="w-full max-w-sm">
            {renderFellowCard(fellowFilter)}
          </div>
        </div>
      ) : (
        [4, 5, 6].map((pgy) => {
          const pgyFellows = filteredFellowsByPGY[pgy];
          if (!pgyFellows.length) return null;
          return (
            <div key={pgy}>
              <h3 className="text-xs font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2 px-0.5">
                PGY-{pgy}
              </h3>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {pgyFellows.map(renderFellowCard)}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
