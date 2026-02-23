// src/components/ScheduleEditorView.jsx
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Undo2, Redo2, AlertTriangle, ShieldCheck, X } from "lucide-react";
import { allRotationTypes, pgyLevels as defaultPgyLevels } from "../data/scheduleData";
import { getRotationColor, getPGYColor, formatDate } from "../utils/scheduleUtils";
import { detectConflicts } from "../engine/conflictDetector";

const MODE_GRID = "grid";
const MODE_DAY = "day";
const MODE_FELLOW = "fellow";

export default function ScheduleEditorView({
  fellows,
  schedule,
  setSchedule,
  callSchedule = {},
  nightFloatSchedule = {},
  dayOverrides,
  setDayOverrides,
  pgyLevels = defaultPgyLevels,
  blockDates,
  clinicDays,
  vacations,
  workHourViolations = [],
}) {
  const [mode, setMode] = useState(MODE_GRID);
  const [conflictResults, setConflictResults] = useState(null);
  const [changeLog, setChangeLog] = useState([]);

  // Undo/Redo: dual stacks of schedule snapshots
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const MAX_HISTORY = 30;

  const pushHistory = useCallback(() => {
    undoStackRef.current = [
      JSON.stringify(schedule),
      ...undoStackRef.current.slice(0, MAX_HISTORY - 1),
    ];
    redoStackRef.current = []; // new edit invalidates redo branch
  }, [schedule]);

  const undo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    redoStackRef.current = [JSON.stringify(schedule), ...redoStackRef.current.slice(0, MAX_HISTORY - 1)];
    const prevState = JSON.parse(undoStackRef.current[0]);
    undoStackRef.current = undoStackRef.current.slice(1);
    setSchedule(prevState);
    setChangeLog((log) => log.slice(1));
  }, [setSchedule, schedule]);

  // Undo back to a specific entry in the change log (index 0 = most recent)
  const undoTo = useCallback((logIndex) => {
    const stepsBack = logIndex + 1;
    const steps = Math.min(stepsBack, undoStackRef.current.length);
    if (steps === 0) return;
    const targetState = JSON.parse(undoStackRef.current[steps - 1]);
    const intermediateStates = undoStackRef.current.slice(0, steps - 1).reverse();
    redoStackRef.current = [
      ...intermediateStates,
      JSON.stringify(schedule),
      ...redoStackRef.current,
    ].slice(0, MAX_HISTORY);
    undoStackRef.current = undoStackRef.current.slice(steps);
    setSchedule(targetState);
    setChangeLog((log) => log.slice(steps));
  }, [setSchedule, schedule]);

  const redo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    undoStackRef.current = [JSON.stringify(schedule), ...undoStackRef.current.slice(0, MAX_HISTORY - 1)];
    const next = JSON.parse(redoStackRef.current[0]);
    redoStackRef.current = redoStackRef.current.slice(1);
    setSchedule(next);
  }, [setSchedule, schedule]);

  // Keyboard shortcuts: Ctrl+Z for undo, Ctrl+Shift+Z for redo
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  // Violation lookup
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

  const fellowsByPGY = useMemo(
    () => ({
      4: fellows.filter((f) => pgyLevels[f] === 4),
      5: fellows.filter((f) => pgyLevels[f] === 5),
      6: fellows.filter((f) => pgyLevels[f] === 6),
    }),
    [fellows, pgyLevels]
  );

  const handleCellChange = useCallback(
    (fellow, blockIdx, newRotation) => {
      const oldRotation = schedule[fellow]?.[blockIdx] || '';
      if (oldRotation === newRotation) return;
      pushHistory();
      setChangeLog((prev) => [
        { id: Date.now(), fellow, blockNumber: blockIdx + 1, from: oldRotation, to: newRotation },
        ...prev,
      ].slice(0, 20));
      setSchedule((prev) => {
        const next = {};
        for (const f of Object.keys(prev)) next[f] = [...prev[f]];
        next[fellow][blockIdx] = newRotation;
        return next;
      });
    },
    [setSchedule, pushHistory, schedule]
  );

  const runValidation = useCallback(() => {
    const results = detectConflicts({
      schedule,
      callSchedule,
      nightFloatSchedule,
      fellows,
      blockDates,
      vacations,
      dayOverrides,
    });
    setConflictResults(results);
  }, [schedule, callSchedule, nightFloatSchedule, fellows, blockDates, vacations, dayOverrides]);

  const modes = [
    { key: MODE_GRID, label: "Grid" },
    { key: MODE_DAY, label: "Day Override" },
    { key: MODE_FELLOW, label: "Fellow" },
  ];

  return (
    <div className="space-y-3">
      {/* Header bar with mode toggle and undo */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
          {modes.map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                mode === m.key
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center">
            <button
              onClick={undo}
              disabled={undoStackRef.current.length === 0}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-l border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="w-3.5 h-3.5" />
              Undo
            </button>
            <button
              onClick={redo}
              disabled={redoStackRef.current.length === 0}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-r border border-l-0 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Redo (Ctrl+Shift+Z)"
            >
              <Redo2 className="w-3.5 h-3.5" />
              Redo
            </button>
          </div>
          <button
            onClick={runValidation}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded border border-green-300 dark:border-green-600 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/50"
            title="Check for conflicts and violations"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Validate
          </button>
        </div>
      </div>

      {/* Conflict detection results panel */}
      {conflictResults && (
        <div className={`rounded-lg border p-3 text-xs ${
          conflictResults.total === 0
            ? "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20"
            : "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20"
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold dark:text-gray-200">
              {conflictResults.total === 0 ? "No issues found" : `${conflictResults.total} issue${conflictResults.total !== 1 ? "s" : ""} detected`}
            </span>
            <button onClick={() => setConflictResults(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {conflictResults.doubleBookings.length > 0 && (
            <div className="mb-2">
              <div className="font-semibold text-red-600 dark:text-red-400 mb-1">Double Bookings ({conflictResults.doubleBookings.length})</div>
              {conflictResults.doubleBookings.slice(0, 5).map((d, i) => (
                <div key={i} className="text-gray-600 dark:text-gray-300 pl-2">{d.detail}</div>
              ))}
            </div>
          )}
          {conflictResults.coverageGaps.length > 0 && (
            <div className="mb-2">
              <div className="font-semibold text-amber-600 dark:text-amber-400 mb-1">Coverage Gaps ({conflictResults.coverageGaps.length})</div>
              {conflictResults.coverageGaps.slice(0, 5).map((g, i) => (
                <div key={i} className="text-gray-600 dark:text-gray-300 pl-2">{g.detail}</div>
              ))}
              {conflictResults.coverageGaps.length > 5 && (
                <div className="text-gray-400 pl-2">...and {conflictResults.coverageGaps.length - 5} more</div>
              )}
            </div>
          )}
          {conflictResults.acgmeViolations.length > 0 && (
            <div>
              <div className="font-semibold text-red-600 dark:text-red-400 mb-1">ACGME Violations ({conflictResults.acgmeViolations.length})</div>
              {conflictResults.acgmeViolations.slice(0, 5).map((v, i) => (
                <div key={i} className="text-gray-600 dark:text-gray-300 pl-2">{v.fellow}: {v.detail || v.rule}</div>
              ))}
              {conflictResults.acgmeViolations.length > 5 && (
                <div className="text-gray-400 pl-2">...and {conflictResults.acgmeViolations.length - 5} more</div>
              )}
            </div>
          )}
        </div>
      )}

      {mode === MODE_GRID && (
        <GridEditor
          fellows={fellows}
          fellowsByPGY={fellowsByPGY}
          schedule={schedule}
          blockDates={blockDates}
          pgyLevels={pgyLevels}
          violationMap={violationMap}
          onCellChange={handleCellChange}
        />
      )}

      {mode === MODE_DAY && (
        <DayOverrideEditor
          fellows={fellows}
          schedule={schedule}
          blockDates={blockDates}
          dayOverrides={dayOverrides}
          setDayOverrides={setDayOverrides}
        />
      )}

      {mode === MODE_FELLOW && (
        <FellowEditor
          fellows={fellows}
          schedule={schedule}
          blockDates={blockDates}
          pgyLevels={pgyLevels}
          violationMap={violationMap}
          onCellChange={handleCellChange}
          pushHistory={pushHistory}
        />
      )}

      {/* Change History */}
      {changeLog.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-600 p-3">
          <div className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">Recent Changes</div>
          <div className="space-y-1">
            {changeLog.map((entry, i) => (
              <div key={entry.id} className="flex items-center justify-between text-xs py-0.5 border-b border-gray-100 dark:border-gray-700 last:border-0">
                <span className="text-gray-600 dark:text-gray-300">
                  <span className="font-medium">{entry.fellow}</span>
                  {' · Block '}
                  <span className="font-medium">{entry.blockNumber}</span>
                  {': '}
                  <span className={`px-1 rounded text-[10px] font-semibold ${getRotationColor(entry.from)}`}>
                    {entry.from || '(empty)'}
                  </span>
                  {' → '}
                  <span className={`px-1 rounded text-[10px] font-semibold ${getRotationColor(entry.to)}`}>
                    {entry.to || '(empty)'}
                  </span>
                </span>
                <button
                  onClick={() => undoTo(i)}
                  className="ml-3 flex items-center gap-1 px-2 py-0.5 text-[10px] rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 shrink-0"
                >
                  <Undo2 className="w-3 h-3" /> Undo
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Mode A: Grid Editor ────────────────────────────────────── */

function GridEditor({
  fellows,
  fellowsByPGY,
  schedule,
  blockDates,
  pgyLevels,
  violationMap,
  onCellChange,
}) {
  const rotationGroups = useMemo(() => {
    const groups = [];
    let currentRotation = null;
    let startIdx = 0;
    blockDates.forEach((bd, idx) => {
      if (bd.rotation !== currentRotation) {
        if (currentRotation !== null) {
          groups.push({ rotation: currentRotation, start: startIdx, end: idx - 1 });
        }
        currentRotation = bd.rotation;
        startIdx = idx;
      }
    });
    groups.push({ rotation: currentRotation, start: startIdx, end: blockDates.length - 1 });
    return groups;
  }, [blockDates]);

  const colSpan = 1 + blockDates.length;

  const renderRow = (fellow, isLastInGroup) => {
    const pgy = pgyLevels[fellow];
    return (
      <tr
        key={fellow}
        className={`border-b ${
          isLastInGroup ? "border-b-4 border-gray-400" : "border-gray-300"
        }`}
      >
        <td
          className={`sticky left-0 z-10 bg-white dark:bg-gray-800 border-r-2 border-gray-400 dark:border-gray-600 px-2 py-1 font-semibold text-gray-800 dark:text-gray-100 border-l-4 ${getPGYColor(pgy)}`}
        >
          <div className="flex items-center gap-1">
            <span className="truncate">{fellow}</span>
            <span className="text-[8px] text-gray-500 dark:text-gray-400">PGY{pgy}</span>
          </div>
        </td>
        {schedule[fellow]?.map((rot, idx) => {
          const blockNumber = idx + 1;
          const hasViolation = violationMap.has(`${fellow}#${blockNumber}`);
          return (
            <td
              key={idx}
              className="border-r border-gray-200 dark:border-gray-700 px-0 py-0.5 text-center"
            >
              <div className="relative">
                <select
                  value={rot || ""}
                  onChange={(e) => onCellChange(fellow, idx, e.target.value)}
                  className={`w-full text-[9px] font-semibold px-0.5 py-1 rounded border-0 cursor-pointer appearance-none text-center ${getRotationColor(rot)}`}
                  title={`${fellow} Block ${blockNumber}: ${rot || "(empty)"}`}
                >
                  {allRotationTypes.map((r) => (
                    <option key={r} value={r}>
                      {r || "(empty)"}
                    </option>
                  ))}
                </select>
                {hasViolation && (
                  <span
                    className="absolute -top-0.5 -right-0.5 text-red-500"
                    title={violationMap
                      .get(`${fellow}#${blockNumber}`)
                      .map((v) => v.detail)
                      .join("\n")}
                  >
                    <AlertTriangle className="w-2.5 h-2.5" />
                  </span>
                )}
              </div>
            </td>
          );
        })}
      </tr>
    );
  };

  const PGYDivider = ({ pgy }) => (
    <tr>
      <td
        colSpan={colSpan}
        className="sticky left-0 z-20 bg-white dark:bg-gray-800 border-y-2 border-gray-400 dark:border-gray-600 px-2 py-1 text-xs font-extrabold text-gray-700 dark:text-gray-200"
      >
        PGY-{pgy}
      </td>
    </tr>
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded border-2 border-gray-400 dark:border-gray-600 overflow-hidden">
      <div
        className="overflow-x-auto"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <table className="min-w-full text-[10px] border-separate border-spacing-0">
          <thead>
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
            <tr className="bg-gray-200 dark:bg-gray-700 border-b-2 border-gray-400 dark:border-gray-600 sticky top-[26px] z-30">
              <th className="sticky left-0 top-[26px] z-40 bg-gray-200 dark:bg-gray-700 border-r-2 border-gray-400 dark:border-gray-600 px-2 py-1 text-left font-bold min-w-[96px] dark:text-gray-100">
                Fellow
              </th>
              {blockDates.map((bd, i) => (
                <th
                  key={i}
                  className="sticky top-[26px] z-30 bg-gray-200 dark:bg-gray-700 border-r border-gray-300 dark:border-gray-600 px-1 py-1 text-center min-w-[60px]"
                >
                  <div className="font-bold dark:text-gray-100">{bd.block}</div>
                  <div className="text-[8px] text-gray-700 dark:text-gray-300 whitespace-nowrap font-semibold">
                    {formatDate(bd.start)}-{formatDate(bd.end)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <PGYDivider pgy={4} />
            {fellowsByPGY[4].map((f, i) => renderRow(f, i === fellowsByPGY[4].length - 1))}
            <PGYDivider pgy={5} />
            {fellowsByPGY[5].map((f, i) => renderRow(f, i === fellowsByPGY[5].length - 1))}
            <PGYDivider pgy={6} />
            {fellowsByPGY[6].map((f, i) => renderRow(f, i === fellowsByPGY[6].length - 1))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Mode B: Day Override Editor ────────────────────────────── */

function DayOverrideEditor({
  fellows,
  schedule,
  blockDates,
  dayOverrides,
  setDayOverrides,
}) {
  const [selectedFellow, setSelectedFellow] = useState(fellows[0] || "");
  const [selectedBlock, setSelectedBlock] = useState(0);

  const block = blockDates[selectedBlock];
  const blockRotation = schedule[selectedFellow]?.[selectedBlock] || "";

  // Generate all dates in the 2-week block
  const blockDays = useMemo(() => {
    if (!block) return [];
    const days = [];
    const start = new Date(block.start + "T12:00:00");
    const end = new Date(block.end + "T12:00:00");
    const cursor = new Date(start);
    while (cursor <= end) {
      const iso = cursor.toISOString().slice(0, 10);
      days.push({
        date: iso,
        dayOfWeek: cursor.toLocaleDateString("en-US", { weekday: "short" }),
        dayNum: cursor.getDate(),
        month: cursor.toLocaleDateString("en-US", { month: "short" }),
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }, [block]);

  const overrideKey = (date) => `${selectedFellow}#B${block?.block}#${date}`;

  const handleDayChange = (date, newRotation) => {
    const key = overrideKey(date);
    setDayOverrides((prev) => {
      const next = { ...prev };
      if (newRotation === blockRotation || newRotation === "") {
        delete next[key];
      } else {
        next[key] = newRotation;
      }
      return next;
    });
  };

  const overrideCount = useMemo(() => {
    const prefix = `${selectedFellow}#B${block?.block}#`;
    return Object.keys(dayOverrides).filter((k) => k.startsWith(prefix)).length;
  }, [dayOverrides, selectedFellow, block]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
            Fellow
          </label>
          <select
            value={selectedFellow}
            onChange={(e) => setSelectedFellow(e.target.value)}
            className="px-3 py-2 text-xs font-semibold rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-200 min-h-[44px]"
          >
            {fellows.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
            Block
          </label>
          <select
            value={selectedBlock}
            onChange={(e) => setSelectedBlock(Number(e.target.value))}
            className="px-3 py-2 text-xs font-semibold rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-200 min-h-[44px]"
          >
            {blockDates.map((bd, i) => (
              <option key={i} value={i}>
                Block {bd.block} ({formatDate(bd.start)} - {formatDate(bd.end)})
              </option>
            ))}
          </select>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Block rotation:{" "}
          <span className={`inline-block px-2 py-0.5 rounded font-semibold ${getRotationColor(blockRotation)}`}>
            {blockRotation || "(empty)"}
          </span>
          {overrideCount > 0 && (
            <span className="ml-2 text-amber-600 dark:text-amber-400 font-medium">
              {overrideCount} override{overrideCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-600 overflow-hidden">
        <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-600">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div
              key={d}
              className="bg-gray-100 dark:bg-gray-700 text-center text-[10px] font-bold py-1.5 text-gray-600 dark:text-gray-300"
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-600">
          {/* Pad leading days to align with day of week */}
          {blockDays.length > 0 &&
            Array.from({
              length: new Date(blockDays[0].date + "T12:00:00").getDay(),
            }).map((_, i) => (
              <div key={`pad-${i}`} className="bg-gray-50 dark:bg-gray-800 p-2" />
            ))}

          {blockDays.map((day) => {
            const key = overrideKey(day.date);
            const currentValue = dayOverrides[key] || "";
            const isOverridden = Boolean(dayOverrides[key]);

            return (
              <div
                key={day.date}
                className={`bg-white dark:bg-gray-800 p-1.5 min-h-[72px] ${
                  isOverridden ? "ring-2 ring-amber-400 ring-inset" : ""
                }`}
              >
                <div className="text-[9px] text-gray-500 dark:text-gray-400 mb-1">
                  {day.month} {day.dayNum}
                </div>
                <select
                  value={currentValue}
                  onChange={(e) => handleDayChange(day.date, e.target.value)}
                  className={`w-full text-[9px] font-semibold px-1 py-1 rounded cursor-pointer ${
                    isOverridden
                      ? getRotationColor(currentValue)
                      : "bg-gray-50 dark:bg-gray-700 text-gray-400 dark:text-gray-500"
                  }`}
                >
                  <option value="">
                    {blockRotation || "(block default)"}
                  </option>
                  {allRotationTypes
                    .filter((r) => r !== blockRotation)
                    .map((r) => (
                      <option key={r} value={r}>
                        {r || "(empty)"}
                      </option>
                    ))}
                </select>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[10px] text-gray-400 dark:text-gray-500">
        Select a different rotation to override that day. Choose the block default to remove the override.
      </p>
    </div>
  );
}

/* ─── Mode C: Per-Fellow Quick Editor ────────────────────────── */

function FellowEditor({
  fellows,
  schedule,
  blockDates,
  pgyLevels,
  violationMap,
  onCellChange,
}) {
  const [selectedFellow, setSelectedFellow] = useState(fellows[0] || "");
  const pgy = pgyLevels[selectedFellow];

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
          Fellow
        </label>
        <select
          value={selectedFellow}
          onChange={(e) => setSelectedFellow(e.target.value)}
          className="px-3 py-2 text-xs font-semibold rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-200 min-h-[44px]"
        >
          {fellows.map((f) => (
            <option key={f} value={f}>
              {f} (PGY-{pgyLevels[f]})
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded border-2 border-gray-400 dark:border-gray-600 overflow-hidden">
        <div
          className="overflow-x-auto"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <table className="min-w-full text-[10px] border-separate border-spacing-0">
            <thead>
              <tr className="bg-gray-200 dark:bg-gray-700">
                {blockDates.map((bd, i) => (
                  <th
                    key={i}
                    className="border-r border-gray-300 dark:border-gray-600 px-1 py-1.5 text-center min-w-[70px]"
                  >
                    <div className="font-bold dark:text-gray-100">B{bd.block}</div>
                    <div className="text-[8px] text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      {formatDate(bd.start)}
                    </div>
                    <div className="text-[8px] text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      {formatDate(bd.end)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {schedule[selectedFellow]?.map((rot, idx) => {
                  const blockNumber = idx + 1;
                  const hasViolation = violationMap.has(
                    `${selectedFellow}#${blockNumber}`
                  );
                  return (
                    <td
                      key={idx}
                      className="border-r border-gray-200 dark:border-gray-700 px-0.5 py-1 text-center"
                    >
                      <div className="relative">
                        <select
                          value={rot || ""}
                          onChange={(e) =>
                            onCellChange(selectedFellow, idx, e.target.value)
                          }
                          className={`w-full text-[9px] font-semibold px-0.5 py-1.5 rounded border-0 cursor-pointer appearance-none text-center ${getRotationColor(rot)}`}
                        >
                          {allRotationTypes.map((r) => (
                            <option key={r} value={r}>
                              {r || "(empty)"}
                            </option>
                          ))}
                        </select>
                        {hasViolation && (
                          <span
                            className="absolute -top-0.5 -right-0.5 text-red-500"
                            title={violationMap
                              .get(`${selectedFellow}#${blockNumber}`)
                              .map((v) => v.detail)
                              .join("\n")}
                          >
                            <AlertTriangle className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className={`text-xs border-l-4 ${getPGYColor(pgy)} pl-3 py-1 text-gray-600 dark:text-gray-300`}>
        Editing <strong>{selectedFellow}</strong> (PGY-{pgy}) — 26 blocks
      </div>
    </div>
  );
}
