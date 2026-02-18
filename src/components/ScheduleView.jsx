// src/components/ScheduleView.jsx
import React, { useMemo, useState } from "react";
import { blockDates as defaultBlockDates, pgyLevels, clinicDays as defaultClinicDays } from "../data/scheduleData";
import {
  getRotationColor,
  getPGYColor,
  getBlockDisplay,
  formatDate,
} from "../utils/scheduleUtils";

const PGYDividerRow = ({ pgy, colSpan }) => (
  <tr>
    <td
      colSpan={colSpan}
      className="sticky left-0 z-20 bg-white dark:bg-gray-800 border-y-2 border-gray-400 dark:border-gray-600 px-2 py-1 text-sm font-extrabold text-gray-700 dark:text-gray-200"
    >
      PGY-{pgy}
    </td>
  </tr>
);

export default function ScheduleView({
  fellows,
  schedule,
  vacations,
  workHourViolations = [],
  clinicDays = defaultClinicDays,
  blockDates = defaultBlockDates,
}) {
  // Highlight state
  const [highlight, setHighlight] = useState(null);
  // { type: "fellow", fellow } | { type: "rotation", rotation } | { type: "col", idx }

  const toggleHighlight = (next) => {
    setHighlight((prev) => {
      if (!prev) return next;
      const same =
        prev.type === next.type &&
        prev.fellow === next.fellow &&
        prev.rotation === next.rotation &&
        prev.idx === next.idx;
      return same ? null : next;
    });
  };

  const isRowHot = (f) => highlight?.type === "fellow" && highlight.fellow === f;
  const isColHot = (i) => highlight?.type === "col" && highlight.idx === i;
  const isRotHot = (r) =>
    highlight?.type === "rotation" && highlight.rotation === r;

  const rotationGroups = useMemo(() => {
    const groups = [];
    let currentRotation = null;
    let startIdx = 0;

    blockDates.forEach((bd, idx) => {
      if (bd.rotation !== currentRotation) {
        if (currentRotation !== null) {
          groups.push({
            rotation: currentRotation,
            start: startIdx,
            end: idx - 1,
          });
        }
        currentRotation = bd.rotation;
        startIdx = idx;
      }
    });
    groups.push({
      rotation: currentRotation,
      start: startIdx,
      end: blockDates.length - 1,
    });
    return groups;
  }, []);

  // Precompute vacation set for O(1) checks: keys like "Fellow#blockNumber"
  const vacationSet = useMemo(() => {
    const s = new Set();
    (vacations || []).forEach((v) => {
      if (v.reason !== "Vacation") return;
      for (let b = v.startBlock; b <= v.endBlock; b++) {
        s.add(`${v.fellow}#${b}`);
      }
    });
    return s;
  }, [vacations]);

  const isBlockInVacationFast = (fellow, blockNumber) => vacationSet.has(`${fellow}#${blockNumber}`);

  // Precompute violation lookup: "Fellow#block" → array of violations
  const violationMap = useMemo(() => {
    const m = new Map();
    (workHourViolations || []).forEach(v => {
      if (v.block) {
        const key = `${v.fellow}#${v.block}`;
        if (!m.has(key)) m.set(key, []);
        m.get(key).push(v);
      }
    });
    return m;
  }, [workHourViolations]);

  // Precompute clinic indicators per block: fellow has clinic day(s) in that block
  // clinicDays maps fellow -> day-of-week (1=Mon..5=Fri)
  // A block spans ~2 weeks, so the fellow's clinic day always falls in it
  // We mark it so the cell can show a ▼ indicator
  const clinicBlockSet = useMemo(() => {
    const s = new Set();
    if (!clinicDays) return s;
    fellows.forEach((f) => {
      const day = clinicDays[f];
      if (!day) return;
      // Every block spans 2 weeks, so the fellow's weekly clinic day always appears
      for (let i = 0; i < blockDates.length; i++) {
        // Nights rotation = no clinic that block
        const rot = schedule[f]?.[i];
        if (rot === "Nights") continue;
        s.add(`${f}#${i}`);
      }
    });
    return s;
  }, [fellows, clinicDays, blockDates, schedule]);

  // Collect unique rotation names from the schedule for the dropdown
  const allRotations = useMemo(() => {
    const rotSet = new Set();
    Object.values(schedule).forEach((blocks) => {
      blocks.forEach((rot) => {
        if (rot) rotSet.add(rot);
      });
    });
    return Array.from(rotSet).sort();
  }, [schedule]);

  // Group fellows by PGY
  const fellowsByPGY = useMemo(
    () => ({
      4: fellows.filter((f) => pgyLevels[f] === 4),
      5: fellows.filter((f) => pgyLevels[f] === 5),
      6: fellows.filter((f) => pgyLevels[f] === 6),
    }),
    [fellows]
  );

  const colSpan = 1 + blockDates.length;

  const renderFellowRow = (fellow, isLastInGroup) => {
    const pgy = pgyLevels[fellow];

    const hotRow = isRowHot(fellow);
    const fadeRow = highlight && !hotRow && highlight.type === "fellow";

    return (
      <tr
        key={fellow}
        className={`border-b ${
          isLastInGroup ? "border-b-4 border-gray-400" : "border-gray-300"
        } hover:bg-gray-50 dark:hover:bg-gray-700 ${fadeRow ? "opacity-40" : "opacity-100"}`}
      >
        <td
          className={`sticky left-0 z-10 bg-white dark:bg-gray-800 border-r-2 border-gray-400 dark:border-gray-600 px-2 py-1 font-semibold text-gray-800 dark:text-gray-100 border-l-4 ${getPGYColor(
            pgy
          )} cursor-pointer ${hotRow ? "ring-2 ring-blue-500" : ""}`}
          onClick={() => {
            toggleHighlight({ type: "fellow", fellow });
          }}
          title="Click to highlight this fellow (click again to clear)"
        >
          <div className="flex items-center gap-1">
            <span className="truncate">{fellow}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">PGY{pgy}</span>
          </div>
        </td>

        {schedule[fellow]?.map((rot, idx) => {
          const blockNumber = idx + 1;
          const isVac = isBlockInVacationFast(fellow, blockNumber);

          const hotCol = isColHot(idx);
          const hotRot = isRotHot(rot);

          const hotCell =
            (highlight?.type === "fellow" && hotRow) ||
            (highlight?.type === "col" && hotCol) ||
            (highlight?.type === "rotation" && hotRot);

          const fadeCell = highlight && !hotCell;

          // Vacation styling: muted gradient + watermark name
          const vacStyle = isVac
            ? "bg-gradient-to-br from-gray-200 to-gray-100 dark:from-gray-600 dark:to-gray-700 text-gray-700 dark:text-gray-200 opacity-95"
            : "";

          return (
            <td
              key={idx}
              className={`border-r border-gray-200 dark:border-gray-700 px-0.5 py-0.5 text-center transition-opacity ${
                fadeCell ? "opacity-30" : "opacity-100"
              } cursor-pointer`}
            >
              <div
                className={`relative px-1 py-1 rounded text-[11px] font-semibold whitespace-nowrap transition-all ${
                  isVac ? "" : getRotationColor(rot)
                } ${vacStyle} ${
                  hotRot ? "ring-2 ring-amber-400" : ""
                } ${hotCol ? "outline outline-1 outline-gray-500" : ""}`}
                title="Click to highlight this rotation"
                onClick={(e) => {
                  toggleHighlight({ type: "rotation", rotation: rot });
                  e.stopPropagation();
                }}
              >
                <div className="relative">
                  {getBlockDisplay(fellow, idx, schedule, vacations)}
                  {clinicBlockSet.has(`${fellow}#${idx}`) && (
                    <span
                      className="absolute -bottom-0.5 -left-0.5 text-[7px] leading-none text-gray-600 dark:text-gray-300 opacity-70"
                      title={`Clinic (${["","Mon","Tue","Wed","Thu","Fri"][clinicDays[fellow]] || ""})`}
                    >
                      ▼
                    </span>
                  )}
                  {violationMap.has(`${fellow}#${blockNumber}`) && (
                    <span
                      className="absolute -top-1 -right-1 w-0 h-0 border-t-[6px] border-t-red-500 border-l-[6px] border-l-transparent"
                      title={violationMap.get(`${fellow}#${blockNumber}`).map(v => v.detail).join('\n')}
                    />
                  )}
                </div>
              </div>
            </td>
          );
        })}
      </tr>
    );
  };

  return (
    <div className="space-y-2">
      {highlight && (
        <div className="bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-600 rounded p-2 text-sm text-gray-800 dark:text-gray-200 flex items-center justify-between gap-2">
          <div className="truncate">
            Highlighting:{" "}
            {highlight.type === "fellow" && `Fellow ${highlight.fellow}`}
            {highlight.type === "rotation" && `Rotation ${highlight.rotation}`}
            {highlight.type === "col" && `Block ${highlight.idx + 1}`}
            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
              (click again to clear)
            </span>
          </div>
          <button
            type="button"
            className="px-2 py-1 text-xs font-semibold rounded border bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200"
            onClick={() => setHighlight(null)}
          >
            Clear
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="text-sm text-gray-700 dark:text-gray-300 font-semibold">
          Click a name, header, or cell to highlight. Use the dropdown to filter by rotation.
        </div>

        <select
          value={highlight?.type === "rotation" ? highlight.rotation : ""}
          onChange={(e) => {
            const val = e.target.value;
            if (val) {
              setHighlight({ type: "rotation", rotation: val });
            } else {
              setHighlight(null);
            }
          }}
          className="px-3 py-2 text-sm font-semibold rounded border min-h-[44px] bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600"
        >
          <option value="">All Rotations</option>
          {allRotations.map((rot) => (
            <option key={rot} value={rot}>
              {rot}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded border-2 border-gray-400 dark:border-gray-600 overflow-hidden">
        <div
          className="overflow-auto max-h-[calc(100vh-260px)]"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <table className="min-w-full text-xs border-separate border-spacing-0">
            <thead>
              {/* Rotation groups header row (sticky) */}
              <tr className="bg-gray-100 dark:bg-gray-700 sticky top-0 z-30">
                <th className="sticky top-0 left-0 z-40 bg-gray-100 dark:bg-gray-700 border-r-2 border-gray-400 dark:border-gray-600 px-2 py-1 w-24 min-w-[96px]"></th>
                {rotationGroups.map((group, idx) => (
                  <th
                    key={idx}
                    colSpan={group.end - group.start + 1}
                    className="sticky top-0 z-30 bg-gray-100 dark:bg-gray-700 border-r-2 border-gray-400 dark:border-gray-600 px-1 py-1 text-center font-bold dark:text-gray-200"
                  >
                    Rot {group.rotation}
                  </th>
                ))}
              </tr>

              {/* Block header row (sticky under first header row) */}
              <tr className="bg-gray-200 dark:bg-gray-700 border-b-2 border-gray-400 dark:border-gray-600 sticky top-[26px] z-30">
                <th className="sticky left-0 top-[26px] z-40 bg-gray-200 dark:bg-gray-700 border-r-2 border-gray-400 dark:border-gray-600 px-2 py-1 text-left font-bold min-w-[96px] dark:text-gray-100">
                  Fellow
                </th>
                {blockDates.map((bd, i) => (
                  <th
                    key={i}
                    onClick={() => {
                      toggleHighlight({ type: "col", idx: i });
                    }}
                    className={`sticky top-[26px] z-30 bg-gray-200 dark:bg-gray-700 border-r border-gray-300 dark:border-gray-600 px-1 py-1 text-center min-w-[60px] cursor-pointer ${
                      isColHot(i) ? "ring-2 ring-blue-500" : ""
                    }`}
                    title="Click to highlight this block column (click again to clear)"
                  >
                    <div className="font-bold dark:text-gray-100">{bd.block}</div>
                    <div className="text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap font-semibold">
                      {formatDate(bd.start)}-{formatDate(bd.end)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              <PGYDividerRow pgy={4} colSpan={colSpan} />
              {fellowsByPGY[4].map((fellow, idx) =>
                renderFellowRow(fellow, idx === fellowsByPGY[4].length - 1)
              )}

              <PGYDividerRow pgy={5} colSpan={colSpan} />
              {fellowsByPGY[5].map((fellow, idx) =>
                renderFellowRow(fellow, idx === fellowsByPGY[5].length - 1)
              )}

              <PGYDividerRow pgy={6} colSpan={colSpan} />
              {fellowsByPGY[6].map((fellow, idx) =>
                renderFellowRow(fellow, idx === fellowsByPGY[6].length - 1)
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
