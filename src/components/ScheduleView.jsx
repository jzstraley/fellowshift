// src/components/ScheduleView.jsx
import { useMemo, useState } from "react";
import { blockDates as defaultBlockDates, pgyLevels } from "../data/scheduleData";
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

function getInitialBlockIdx(dates) {
  const today = new Date().toISOString().split("T")[0];
  const idx = dates.findIndex((bd) => today >= bd.start && today <= bd.end);
  return idx >= 0 ? idx : 0;
}

export default function ScheduleView({
  fellows,
  schedule,
  vacations,
  workHourViolations = [],
  blockDates = defaultBlockDates,
}) {
  // Highlight state
  const [highlight, setHighlight] = useState(null);
  // { type: "fellow", fellow } | { type: "rotation", rotation }

  const toggleHighlight = (next) => {
    setHighlight((prev) => {
      if (!prev) return next;
      const same =
        prev.type === next.type &&
        prev.fellow === next.fellow &&
        prev.rotation === next.rotation;
      return same ? null : next;
    });
  };

  const isRowHot = (f) => highlight?.type === "fellow" && highlight.fellow === f;
  const isRotHot = (r) => highlight?.type === "rotation" && highlight.rotation === r;

  // Current block for column highlight
  const currentBlockIdx = useMemo(() => getInitialBlockIdx(blockDates), [blockDates]);

  // Precompute vacation set for O(1) checks: keys like "Fellow#blockNumber"
  // Only approved vacations are shown on the schedule view
  const vacationSet = useMemo(() => {
    const s = new Set();
    (vacations || []).forEach((v) => {
      if (v.reason !== "Vacation") return;
      if (v.status !== "approved") return;
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
    (workHourViolations || []).forEach((v) => {
      if (v.block) {
        const key = `${v.fellow}#${v.block}`;
        if (!m.has(key)) m.set(key, []);
        m.get(key).push(v);
      }
    });
    return m;
  }, [workHourViolations]);

  // Collect unique rotation names from the schedule for the rotation filter dropdown
  const allRotations = useMemo(() => {
    const rotSet = new Set();
    Object.values(schedule).forEach((blocks) => {
      blocks.forEach((rot) => {
        if (rot) rotSet.add(rot);
      });
    });
    return Array.from(rotSet).sort();
  }, [schedule]);

  // Group consecutive blocks by rotation number for the header
  const rotationGroups = useMemo(() => {
    const groups = [];
    let i = 0;
    while (i < blockDates.length) {
      const rot = blockDates[i].rotation;
      let j = i;
      while (j < blockDates.length && blockDates[j].rotation === rot) j++;
      groups.push({ rotation: rot, startIdx: i, count: j - i });
      i = j;
    }
    return groups;
  }, [blockDates]);

  // Group fellows by PGY
  const fellowsByPGY = useMemo(
    () => ({
      4: fellows.filter((f) => pgyLevels[f] === 4),
      5: fellows.filter((f) => pgyLevels[f] === 5),
      6: fellows.filter((f) => pgyLevels[f] === 6),
    }),
    [fellows]
  );

  const totalCols = 1 + blockDates.length;

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
          onClick={() => toggleHighlight({ type: "fellow", fellow })}
          title="Click to highlight this fellow (click again to clear)"
        >
          <span className="truncate text-center w-full block">{fellow}</span>
        </td>

        {blockDates.map((_, idx) => {
          const blockNumber = idx + 1;
          const rot = schedule[fellow]?.[idx] ?? "";
          const isVac = isBlockInVacationFast(fellow, blockNumber);
          const hotRot = isRotHot(rot);
          const hotCell =
            (highlight?.type === "fellow" && hotRow) ||
            (highlight?.type === "rotation" && hotRot);
          const fadeCell = highlight && !hotCell;
          const isCurrentCol = idx === currentBlockIdx;

          const vacStyle = isVac
            ? "bg-gradient-to-br from-gray-200 to-gray-100 dark:from-gray-600 dark:to-gray-700 text-gray-700 dark:text-gray-200 opacity-95"
            : "";

          return (
            <td
              key={idx}
              className={`border-r border-gray-200 dark:border-gray-700 px-1 py-1 text-center transition-opacity ${
                fadeCell ? "opacity-30" : "opacity-100"
              } cursor-pointer ${
                isCurrentCol ? "bg-blue-50 dark:bg-blue-900/10" : ""
              }`}
            >
              <div
                className={`relative px-2 py-1.5 rounded text-[11px] font-semibold whitespace-nowrap transition-all ${
                  isVac ? "" : getRotationColor(rot)
                } ${vacStyle} ${hotRot ? "ring-2 ring-amber-400" : ""}`}
                title="Click to highlight this rotation"
                onClick={(e) => {
                  toggleHighlight({ type: "rotation", rotation: rot });
                  e.stopPropagation();
                }}
              >
                <div className="relative">
                  {getBlockDisplay(fellow, idx, schedule, vacations, blockDates)}
                  {violationMap.has(`${fellow}#${blockNumber}`) && (
                    <span
                      className="absolute -top-1 -right-1 w-0 h-0 border-t-[6px] border-t-red-500 border-l-[6px] border-l-transparent"
                      title={violationMap
                        .get(`${fellow}#${blockNumber}`)
                        .map((v) => v.detail)
                        .join("\n")}
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

      <div className="bg-white dark:bg-gray-800 rounded border-2 border-gray-400 dark:border-gray-600 overflow-hidden">
        <div
          className="overflow-x-auto"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <table className="min-w-full text-xs border-separate border-spacing-0">
            <thead>
              {/* Rotation group header row */}
              <tr className="bg-gray-100 dark:bg-gray-700 sticky top-0 z-30">
                <th className="sticky top-0 left-0 z-40 bg-gray-100 dark:bg-gray-700 border-r-2 border-gray-400 dark:border-gray-600 px-2 py-1 w-24 min-w-[96px]" />
                {rotationGroups.map((g) => (
                  <th
                    key={g.rotation}
                    colSpan={g.count}
                    className="sticky top-0 z-30 bg-gray-100 dark:bg-gray-700 border-r-2 border-gray-400 dark:border-gray-600 px-1 py-1 text-center font-bold dark:text-gray-200"
                  >
                    Rotation {g.rotation}
                  </th>
                ))}
              </tr>

              {/* Block header row */}
              <tr className="bg-gray-200 dark:bg-gray-700 border-b-2 border-gray-400 dark:border-gray-600 sticky top-[26px] z-30">
                <th className="sticky left-0 top-[26px] z-40 bg-gray-200 dark:bg-gray-700 border-r-2 border-gray-400 dark:border-gray-600 px-2 py-1 text-left font-bold min-w-[96px] dark:text-gray-100">
                  Fellow
                </th>
                {blockDates.map((bd, i) => {
                  const isCurrentCol = i === currentBlockIdx;
                  return (
                    <th
                      key={i}
                      className={`sticky top-[26px] z-30 border-r border-gray-300 dark:border-gray-600 px-1 py-1 text-center min-w-[90px] ${
                        isCurrentCol
                          ? "bg-blue-100 dark:bg-blue-900/40"
                          : "bg-gray-200 dark:bg-gray-700"
                      }`}
                    >
                      <div className="font-bold dark:text-gray-100 text-[11px]">
                        Block {bd.block}
                      </div>
                      <div className="text-[9px] text-gray-700 dark:text-gray-300 whitespace-nowrap font-semibold">
                        {formatDate(bd.start)}–{formatDate(bd.end)}
                      </div>
                      {isCurrentCol && (
                        <div className="text-[9px] text-blue-600 dark:text-blue-400 font-semibold">
                          Current
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              <PGYDividerRow pgy={4} colSpan={totalCols} />
              {fellowsByPGY[4].map((fellow, idx) =>
                renderFellowRow(fellow, idx === fellowsByPGY[4].length - 1)
              )}

              <PGYDividerRow pgy={5} colSpan={totalCols} />
              {fellowsByPGY[5].map((fellow, idx) =>
                renderFellowRow(fellow, idx === fellowsByPGY[5].length - 1)
              )}

              <PGYDividerRow pgy={6} colSpan={totalCols} />
              {fellowsByPGY[6].map((fellow, idx) =>
                renderFellowRow(fellow, idx === fellowsByPGY[6].length - 1)
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rotation filter — bottom right */}
      <div className="flex justify-end items-center gap-2">
        <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
          Filter rotation:
        </label>
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
          className="px-3 py-1.5 text-xs font-semibold rounded border bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600"
        >
          <option value="">All Rotations</option>
          {allRotations.map((rot) => (
            <option key={rot} value={rot}>
              {rot}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
