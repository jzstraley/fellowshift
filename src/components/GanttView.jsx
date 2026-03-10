// src/components/GanttView.jsx
// Gantt / swimlane calendar — replaces the per-day table with proportional rotation bars
import React, { useMemo, useState } from "react";
import { blockDates, pgyLevels } from "../data/scheduleData";
import { getRotationColor } from "../utils/scheduleUtils";

const YEAR_START = new Date("2026-07-01T12:00:00");
const YEAR_END   = new Date("2027-07-01T12:00:00"); // exclusive end (so Jun 30 is fully included)
const TOTAL_MS   = YEAR_END - YEAR_START;

const PGY_COLORS = {
  4: { text: "text-blue-600 dark:text-blue-400",   border: "border-l-blue-400",   bg: "bg-blue-50 dark:bg-blue-900/20"   },
  5: { text: "text-green-600 dark:text-green-400", border: "border-l-green-400",  bg: "bg-green-50 dark:bg-green-900/20" },
  6: { text: "text-purple-600 dark:text-purple-400",border: "border-l-purple-400",bg: "bg-purple-50 dark:bg-purple-900/20"},
};

function datePct(dateStr) {
  const ms = new Date(dateStr + "T12:00:00") - YEAR_START;
  return Math.max(0, Math.min(100, (ms / TOTAL_MS) * 100));
}

// Merge consecutive blocks with the same rotation into single spans
function buildSpans(fellow, schedule) {
  const spans = [];
  let i = 0;
  while (i < blockDates.length) {
    const rot = schedule[fellow]?.[i] ?? "";
    if (!rot) { i++; continue; }
    let j = i + 1;
    while (j < blockDates.length && (schedule[fellow]?.[j] ?? "") === rot) j++;
    spans.push({ rotation: rot, start: blockDates[i].start, end: blockDates[j - 1].end });
    i = j;
  }
  return spans;
}

function getMonthTicks() {
  const ticks = [];
  const d = new Date("2026-07-01T00:00:00");
  while (d < YEAR_END) {
    ticks.push({
      label: d.toLocaleDateString("en-US", { month: "short" }),
      yearLabel: d.getMonth() === 0 ? String(d.getFullYear()) : null,
      pct: ((d - YEAR_START) / TOTAL_MS) * 100,
    });
    d.setMonth(d.getMonth() + 1);
  }
  return ticks;
}

function todayPct() {
  const ms = Date.now() - YEAR_START;
  if (ms < 0 || ms > TOTAL_MS) return null;
  return (ms / TOTAL_MS) * 100;
}

export default function GanttView({ fellows, schedule }) {
  const [tooltip, setTooltip]               = useState(null); // { span, x, y }
  const [highlightRotation, setHighlight]   = useState(null);

  const monthTicks  = useMemo(getMonthTicks, []);
  const todayLine   = useMemo(todayPct, []);

  const fellowsByPGY = useMemo(
    () => ({
      4: fellows.filter((f) => pgyLevels[f] === 4),
      5: fellows.filter((f) => pgyLevels[f] === 5),
      6: fellows.filter((f) => pgyLevels[f] === 6),
    }),
    [fellows]
  );

  const allSpans = useMemo(() => {
    const out = {};
    fellows.forEach((f) => { out[f] = buildSpans(f, schedule); });
    return out;
  }, [fellows, schedule]);

  const toggleHighlight = (rot) =>
    setHighlight((prev) => (prev === rot ? null : rot));

  const renderRow = (fellow) => {
    const pgy    = pgyLevels[fellow];
    const colors = PGY_COLORS[pgy] ?? PGY_COLORS[4];
    const spans  = allSpans[fellow] ?? [];

    return (
      <div
        key={fellow}
        className="flex items-stretch border-b border-gray-100 dark:border-gray-700 group"
        style={{ minWidth: "100%" }}
      >
        {/* Sticky name cell */}
        <div
          className={`w-28 flex-shrink-0 flex items-center gap-1 px-2 py-1 border-r-2 border-gray-300 dark:border-gray-600 border-l-4 ${colors.border} sticky left-0 bg-white dark:bg-gray-800 z-10`}
        >
          <span className={`text-[11px] font-semibold truncate ${colors.text}`}>
            {fellow}
          </span>
          <span className="text-[9px] text-gray-400 ml-auto">{pgy}</span>
        </div>

        {/* Timeline track */}
        <div className="relative flex-1 h-10 bg-white dark:bg-gray-800 group-hover:bg-gray-50/60 dark:group-hover:bg-gray-750">
          {/* Month grid lines */}
          {monthTicks.map((tick) => (
            <div
              key={tick.label}
              className="absolute top-0 bottom-0 w-px bg-gray-100 dark:bg-gray-700"
              style={{ left: `${tick.pct}%` }}
            />
          ))}

          {/* Today line */}
          {todayLine !== null && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-blue-400/70 z-10 pointer-events-none"
              style={{ left: `${todayLine}%` }}
            />
          )}

          {/* Rotation bars */}
          {spans.map((span, i) => {
            const left  = datePct(span.start);
            // extend to include the full end day (add 1 day in ms)
            const rightMs = new Date(span.end + "T12:00:00") - YEAR_START + 86_400_000;
            const right = Math.min(100, (rightMs / TOTAL_MS) * 100);
            const width = right - left;
            const colorClass = getRotationColor(span.rotation);
            const dimmed = highlightRotation && highlightRotation !== span.rotation;

            return (
              <div
                key={i}
                title={`${span.rotation}\n${span.start} → ${span.end}`}
                className={`absolute top-1.5 bottom-1.5 rounded cursor-pointer select-none transition-opacity ${colorClass} ${dimmed ? "opacity-15" : "opacity-100"}`}
                style={{ left: `${left}%`, width: `${Math.max(width, 0.4)}%` }}
                onMouseEnter={(e) => setTooltip({ span, x: e.clientX, y: e.clientY })}
                onMouseMove={(e)  => setTooltip((t) => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
                onMouseLeave={() => setTooltip(null)}
                onClick={() => toggleHighlight(span.rotation)}
              >
                {width > 5 && (
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold overflow-hidden px-0.5 whitespace-nowrap pointer-events-none">
                    {width > 10 ? span.rotation : span.rotation.slice(0, 4)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded border-2 border-gray-400 dark:border-gray-600 overflow-hidden">

      {/* ── Month axis header ── */}
      <div className="flex items-stretch border-b-2 border-gray-400 dark:border-gray-600 sticky top-0 z-30 bg-gray-100 dark:bg-gray-700">
        <div className="w-28 flex-shrink-0 sticky left-0 z-30 bg-gray-100 dark:bg-gray-700 border-r-2 border-gray-400 dark:border-gray-600 px-2 flex items-center">
          <span className="text-xs font-bold text-gray-600 dark:text-gray-300">Fellow</span>
        </div>
        <div className="relative flex-1 h-8 overflow-hidden">
          {monthTicks.map((tick) => (
            <div
              key={tick.pct}
              className="absolute top-0 bottom-0 flex flex-col justify-center"
              style={{ left: `${tick.pct}%` }}
            >
              <div className="absolute top-0 bottom-0 w-px bg-gray-300 dark:bg-gray-500" />
              <span className="relative ml-1 text-[9px] font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap leading-none">
                {tick.label}
                {tick.yearLabel && (
                  <span className="text-[8px] text-gray-400 dark:text-gray-500 ml-0.5">'{tick.yearLabel.slice(2)}</span>
                )}
              </span>
            </div>
          ))}

          {/* Today marker in header */}
          {todayLine !== null && (
            <div
              className="absolute top-0 bottom-0 flex flex-col items-center z-10"
              style={{ left: `${todayLine}%` }}
            >
              <div className="w-0.5 flex-1 bg-blue-500" />
              <span className="text-[8px] font-bold text-blue-500 whitespace-nowrap -mt-0.5">Today</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Fellow rows (scrollable) ── */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: "640px" }}>
          {[4, 5, 6].map((pgy) => (
            <React.Fragment key={pgy}>
              {/* PGY divider */}
              <div className="sticky left-0 z-20 bg-white dark:bg-gray-800 border-y-2 border-gray-400 dark:border-gray-600 px-3 py-0.5 text-[10px] font-extrabold text-gray-600 dark:text-gray-300">
                PGY-{pgy}
              </div>
              {fellowsByPGY[pgy].map(renderRow)}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── Highlight / clear bar ── */}
      {highlightRotation && (
        <div className="flex items-center justify-between px-3 py-1.5 border-t border-gray-200 dark:border-gray-700 bg-amber-50 dark:bg-amber-900/20 text-xs text-gray-800 dark:text-gray-200">
          <span>
            Highlighting: <strong>{highlightRotation}</strong>
            <span className="ml-2 text-gray-500 dark:text-gray-400 text-[10px]">(click a bar to toggle)</span>
          </span>
          <button
            className="px-2 py-0.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs font-semibold"
            onClick={() => setHighlight(null)}
          >
            Clear
          </button>
        </div>
      )}

      {/* ── Floating tooltip ── */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none bg-gray-900 text-white text-xs rounded-md px-3 py-1.5 shadow-xl"
          style={{ left: tooltip.x + 14, top: tooltip.y - 36 }}
        >
          <div className="font-bold text-sm">{tooltip.span.rotation}</div>
          <div className="text-gray-300 mt-0.5">
            {tooltip.span.start} → {tooltip.span.end}
          </div>
        </div>
      )}
    </div>
  );
}
