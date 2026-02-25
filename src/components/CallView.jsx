// src/components/CallView.jsx
import React, { useMemo, useEffect } from 'react';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { blockDates } from '../data/scheduleData';

// ----- date helpers (local time, DST-safe) -----
const toLocalNoon = (d) => {
  const x = new Date(d);
  x.setHours(12, 0, 0, 0);
  return x;
};

const toISODate = (d) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const addDays = (d, n) => {
  const x = toLocalNoon(d);
  x.setDate(x.getDate() + n);
  return x;
};

const formatMD = (d) =>
  d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// Return first Saturday on/after block start, then second Saturday = +7 days
const getBlockWeekendSaturdays = (blockStart) => {
  const start = toLocalNoon(blockStart);
  const day = start.getDay(); // Sun=0 ... Sat=6
  const daysUntilSat = (6 - day + 7) % 7;

  const sat1 = addDays(start, daysUntilSat);
  const sat2 = addDays(sat1, 7);

  return { sat1, sat2 };
};

// ---------- Parsing helpers ----------
// CALL: accept string or object with {name} or {call} plus optional {relaxed}
const getCallEntry = (callSchedule, key) => {
  const v = callSchedule?.[key];
  if (!v) return { name: null, relaxed: false };
  if (typeof v === "string") return { name: v, relaxed: false };
  if (typeof v === "object" && !Array.isArray(v)) {
    return { name: v.name ?? v.call ?? null, relaxed: !!v.relaxed };
  }
  return { name: null, relaxed: false };
};

// FLOAT: accept string or object {name, relaxed}
const getFloatEntry = (nightFloatSchedule, key) => {
  const v = nightFloatSchedule?.[key];
  if (!v) return { name: null, relaxed: false };
  if (typeof v === 'string') return { name: v, relaxed: false };
  if (typeof v === 'object' && !Array.isArray(v)) {
    return { name: v.name ?? null, relaxed: !!v.relaxed };
  }
  return { name: null, relaxed: false };
};

// ---------- UI helpers ----------
const missingBadge = (
  <span className="px-2 py-0.5 bg-red-600 text-white rounded font-bold text-[11px]">
    MISSING
  </span>
);

const callBadgeClass = (relaxed) =>
  relaxed ? 'bg-red-600 text-white' : 'bg-blue-600 text-white';

const floatBadgeClass = (relaxed) =>
  relaxed ? 'bg-red-600 text-white' : 'bg-black text-white';

// Balance: green exact, yellow under, red over
const statusMeta = (actual, target) => {
  if (actual > target) return { tone: 'over', cls: 'text-red-600' };
  if (actual < target) return { tone: 'under', cls: 'text-yellow-700' };
  return { tone: 'exact', cls: 'text-green-600' };
};

const StatusIcon = ({ tone }) => {
  if (tone === 'exact') return <CheckCircle className="w-4 h-4 text-green-600 inline" />;
  if (tone === 'over') return <AlertTriangle className="w-4 h-4 text-red-600 inline" />;
  return <AlertTriangle className="w-4 h-4 text-yellow-700 inline" />;
};

export default function CallView({
  callSchedule,
  nightFloatSchedule,
  stats,
  fellows,
  pgyLevels,
  onDateCallMap,
  workHourViolations = [],
  showBalanceCheck = false,
}) {
  const callTargets = { 4: 5, 5: 4, 6: 2 };
  const floatTargets = { 4: 5, 5: 4, 6: 3 };

  // Build violation lookup: "fellow#block" → true
  const violationByFellowBlock = useMemo(() => {
    const m = new Map();
    (workHourViolations || []).forEach(v => {
      if (v.block && v.fellow) {
        const key = `${v.fellow}#${v.block}`;
        if (!m.has(key)) m.set(key, []);
        m.get(key).push(v);
      }
    });
    return m;
  }, [workHourViolations]);

  const currentBlockIndex = useMemo(() => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    for (let i = 0; i < 26; i++) {
      const start = toLocalNoon(new Date(blockDates[i].start));
      const end = toLocalNoon(new Date(blockDates[i].end));
      if (today >= start && today <= end) return i;
    }
    return -1;
  }, []);

  // Pre-compute all 26 block rows (used by both mobile cards and desktop table)
  const blockRows = useMemo(() => {
    return Array.from({ length: 26 }, (_, i) => {
      const blockStart = new Date(blockDates[i].start);
      const { sat1, sat2 } = getBlockWeekendSaturdays(blockStart);
      const w1Key = `B${i + 1}-W1`;
      const w2Key = `B${i + 1}-W2`;
      return {
        i,
        sat1,
        sat2,
        c1: getCallEntry(callSchedule, w1Key),
        c2: getCallEntry(callSchedule, w2Key),
        f1: getFloatEntry(nightFloatSchedule, w1Key),
        f2: getFloatEntry(nightFloatSchedule, w2Key),
      };
    });
  }, [callSchedule, nightFloatSchedule]);

  // Build date-indexed map: { "YYYY-MM-DD": { call, float, callRelaxed?, floatRelaxed? } }
  const dateCallMap = useMemo(() => {
    const map = {};

    for (let i = 0; i < 26; i++) {
      const blockStart = new Date(blockDates[i].start);
      const { sat1, sat2 } = getBlockWeekendSaturdays(blockStart);

      const w1Key = `B${i + 1}-W1`;
      const w2Key = `B${i + 1}-W2`;

      const c1 = getCallEntry(callSchedule, w1Key);
      const c2 = getCallEntry(callSchedule, w2Key);

      const w1SatISO = toISODate(sat1);
      const w1SunISO = toISODate(addDays(sat1, 1));
      const w2SatISO = toISODate(sat2);
      const w2SunISO = toISODate(addDays(sat2, 1));

      // Calls apply Sat + Sun
      if (c1.name) {
        map[w1SatISO] = { ...(map[w1SatISO] ?? {}), call: c1.name, callRelaxed: c1.relaxed };
        map[w1SunISO] = { ...(map[w1SunISO] ?? {}), call: c1.name, callRelaxed: c1.relaxed };
      }
      if (c2.name) {
        map[w2SatISO] = { ...(map[w2SatISO] ?? {}), call: c2.name, callRelaxed: c2.relaxed };
        map[w2SunISO] = { ...(map[w2SunISO] ?? {}), call: c2.name, callRelaxed: c2.relaxed };
      }

      // Floats apply Sat only
      const f1 = getFloatEntry(nightFloatSchedule, w1Key);
      const f2 = getFloatEntry(nightFloatSchedule, w2Key);

      if (f1.name) {
        map[w1SatISO] = { ...(map[w1SatISO] ?? {}), float: f1.name, floatRelaxed: f1.relaxed };
      }
      if (f2.name) {
        map[w2SatISO] = { ...(map[w2SatISO] ?? {}), float: f2.name, floatRelaxed: f2.relaxed };
      }
    }

    return map;
  }, [callSchedule, nightFloatSchedule]);

  useEffect(() => {
    if (typeof onDateCallMap === 'function') onDateCallMap(dateCallMap);
  }, [dateCallMap, onDateCallMap]);

const exportCallFloatCSV = () => {
  const rows = [];
  rows.push(['block', 'weekend', 'satdate', 'sundate', 'call', 'float']);

  for (let i = 0; i < 26; i++) {
    const blockStart = new Date(blockDates[i].start);
    const { sat1, sat2 } = getBlockWeekendSaturdays(blockStart);

    const w1Key = `B${i + 1}-W1`;
    const w2Key = `B${i + 1}-W2`;

    const c1 = getCallEntry(callSchedule, w1Key);
    const c2 = getCallEntry(callSchedule, w2Key);

    const f1 = getFloatEntry(nightFloatSchedule, w1Key);
    const f2 = getFloatEntry(nightFloatSchedule, w2Key);

    // Format dates as M/D/YY
    const formatDate = (d) => {
      const m = d.getMonth() + 1;
      const day = d.getDate();
      const y = String(d.getFullYear()).slice(-2);
      return `${m}/${day}/${y}`;
    };

    const w1SatDate = formatDate(sat1);
    const w1SunDate = formatDate(addDays(sat1, 1));
    const w2SatDate = formatDate(sat2);
    const w2SunDate = formatDate(addDays(sat2, 1));

    rows.push([
      i + 1,
      'W1',
      w1SatDate,
      w1SunDate,
      c1.name ?? '',
      f1.name ?? '',
    ]);

    rows.push([
      i + 1,
      'W2',
      w2SatDate,
      w2SunDate,
      c2.name ?? '',
      f2.name ?? '',
    ]);
  }

  // CSV escaping
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = rows.map((r) => r.map(esc).join(',')).join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'call_float_export.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

  // Shared violation indicator
  const ViolationDot = ({ name, block }) =>
    violationByFellowBlock.has(`${name}#${block}`) ? (
      <span
        className="w-0 h-0 border-t-[6px] border-t-red-500 border-l-[6px] border-l-transparent"
        title={violationByFellowBlock.get(`${name}#${block}`).map(v => v.detail).join('\n')}
      />
    ) : null;

  return (
    <div className="space-y-3">
      <div className="bg-white dark:bg-gray-800 rounded border-2 border-gray-400 dark:border-gray-600 overflow-hidden">
        <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700 border-b-2 border-gray-400 dark:border-gray-600">
          <h3 className="font-bold text-sm dark:text-gray-100">Call Weekend & Saturday Night Float Assignments</h3>
          <p className="text-[10px] text-gray-600 dark:text-gray-400">
            Strict calls are blue, strict floats are black. Relaxed fallback is red. Missing coverage is flagged.
          </p>
        </div>

        <div className="p-2">
          {/* ── Mobile: one card per block ── */}
          <div className="md:hidden space-y-1.5">
            {blockRows.map(({ i, sat1, sat2, c1, c2, f1, f2 }) => {
              const isCurrent = i === currentBlockIndex;
              return (
                <div
                  key={i}
                  className={`rounded border overflow-hidden ${
                    isCurrent
                      ? 'border-yellow-500'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                >
                  {/* Block header */}
                  <div className={`px-2 py-1 text-xs font-bold flex items-center gap-2 ${
                    isCurrent
                      ? 'bg-yellow-200 dark:bg-yellow-800/50 text-yellow-900 dark:text-yellow-100'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100'
                  }`}>
                    Block {i + 1}
                    {isCurrent && (
                      <span className="text-[10px] font-normal text-yellow-700 dark:text-yellow-300">← current</span>
                    )}
                  </div>

                  {/* Two weekends side-by-side */}
                  <div className="grid grid-cols-2 divide-x divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                    {/* Weekend 1 */}
                    <div className="px-2 py-1.5">
                      <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
                        W1 · {formatMD(sat1)}/{formatMD(addDays(sat1, 1))}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-400 w-6 shrink-0">Call</span>
                          {c1.name ? (
                            <span className="inline-flex items-center gap-0.5">
                              <span className={`px-1.5 py-0.5 rounded text-[11px] ${callBadgeClass(c1.relaxed)}`}>{c1.name}</span>
                              <ViolationDot name={c1.name} block={i + 1} />
                            </span>
                          ) : missingBadge}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-400 w-6 shrink-0">Float</span>
                          {f1.name ? (
                            <span className="inline-flex items-center gap-0.5">
                              <span className={`px-1.5 py-0.5 rounded text-[11px] ${floatBadgeClass(f1.relaxed)}`}>{f1.name}</span>
                              <ViolationDot name={f1.name} block={i + 1} />
                            </span>
                          ) : missingBadge}
                        </div>
                      </div>
                    </div>

                    {/* Weekend 2 */}
                    <div className="px-2 py-1.5">
                      <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
                        W2 · {formatMD(sat2)}/{formatMD(addDays(sat2, 1))}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-400 w-6 shrink-0">Call</span>
                          {c2.name ? (
                            <span className="inline-flex items-center gap-0.5">
                              <span className={`px-1.5 py-0.5 rounded text-[11px] ${callBadgeClass(c2.relaxed)}`}>{c2.name}</span>
                              <ViolationDot name={c2.name} block={i + 1} />
                            </span>
                          ) : missingBadge}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-400 w-6 shrink-0">Float</span>
                          {f2.name ? (
                            <span className="inline-flex items-center gap-0.5">
                              <span className={`px-1.5 py-0.5 rounded text-[11px] ${floatBadgeClass(f2.relaxed)}`}>{f2.name}</span>
                              <ViolationDot name={f2.name} block={i + 1} />
                            </span>
                          ) : missingBadge}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Desktop: full table ── */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-200 dark:bg-gray-700 border-b border-gray-400 dark:border-gray-600">
                  <th className="px-2 py-1 text-left font-bold dark:text-gray-100">Block</th>
                  <th className="px-2 py-1 text-left font-bold dark:text-gray-100">Wknd 1 (Sat/Sun)</th>
                  <th className="px-2 py-1 text-left font-bold dark:text-gray-100">W1 Call</th>
                  <th className="px-2 py-1 text-left font-bold dark:text-gray-100">W1 Sat Night Float</th>
                  <th className="px-2 py-1 text-left font-bold dark:text-gray-100">Wknd 2 (Sat/Sun)</th>
                  <th className="px-2 py-1 text-left font-bold dark:text-gray-100">W2 Call</th>
                  <th className="px-2 py-1 text-left font-bold dark:text-gray-100">W2 Sat Night Float</th>
                </tr>
              </thead>

              <tbody>
                {blockRows.map(({ i, sat1, sat2, c1, c2, f1, f2 }) => (
                  <tr
                    key={i}
                    className={`border-b border-gray-200 dark:border-gray-700 ${
                      i === currentBlockIndex
                        ? 'bg-yellow-100 dark:bg-yellow-900/30 border-l-4 border-l-yellow-500'
                        : i % 2 === 0
                          ? 'bg-white dark:bg-gray-900'
                          : 'bg-gray-50 dark:bg-gray-800'
                    }`}
                  >
                    <td className="px-2 py-1 font-semibold dark:text-gray-100">Block {i + 1}</td>

                    <td className="px-2 py-1 text-gray-900 dark:text-gray-200 font-semibold">
                      {formatMD(sat1)} / {formatMD(addDays(sat1, 1))}
                    </td>

                    <td className="px-2 py-1">
                      {c1.name ? (
                        <span className="inline-flex items-center gap-1">
                          <span className={`px-2 py-0.5 rounded ${callBadgeClass(c1.relaxed)}`}>
                            {c1.name}
                          </span>
                          <ViolationDot name={c1.name} block={i + 1} />
                        </span>
                      ) : (
                        missingBadge
                      )}
                    </td>

                    <td className="px-2 py-1">
                      {f1.name ? (
                        <span className="inline-flex items-center gap-1">
                          <span
                            className={`px-2 py-0.5 rounded ${floatBadgeClass(f1.relaxed)}`}
                            title={f1.relaxed ? 'relaxed fallback' : 'strict'}
                          >
                            {f1.name}
                          </span>
                          <ViolationDot name={f1.name} block={i + 1} />
                        </span>
                      ) : (
                        missingBadge
                      )}
                    </td>

                    <td className="px-2 py-1 text-gray-900 dark:text-gray-200 font-semibold">
                      {formatMD(sat2)} / {formatMD(addDays(sat2, 1))}
                    </td>

                    <td className="px-2 py-1">
                      {c2.name ? (
                        <span className="inline-flex items-center gap-1">
                          <span className={`px-2 py-0.5 rounded ${callBadgeClass(c2.relaxed)}`}>
                            {c2.name}
                          </span>
                          <ViolationDot name={c2.name} block={i + 1} />
                        </span>
                      ) : (
                        missingBadge
                      )}
                    </td>

                    <td className="px-2 py-1">
                      {f2.name ? (
                        <span className="inline-flex items-center gap-1">
                          <span
                            className={`px-2 py-0.5 rounded ${floatBadgeClass(f2.relaxed)}`}
                            title={f2.relaxed ? 'relaxed fallback' : 'strict'}
                          >
                            {f2.name}
                          </span>
                          <ViolationDot name={f2.name} block={i + 1} />
                        </span>
                      ) : (
                        missingBadge
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showBalanceCheck && stats && Array.isArray(fellows) && (
        <div className="bg-white dark:bg-gray-800 rounded border-2 border-gray-400 dark:border-gray-600 overflow-hidden">
          <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700 border-b-2 border-gray-400 dark:border-gray-600">
            <h3 className="font-bold text-sm dark:text-gray-100">Call/Float Balance Check</h3>
            <p className="text-[10px] text-gray-600 dark:text-gray-400">
              Green = at target. Yellow = under. Red = over. Use red to catch PGY-6 overages immediately.
            </p>
          </div>

          <div className="p-2">
            {/* ── Mobile: fellow rows ── */}
            <div className="md:hidden space-y-1">
              {fellows.map((f, idx) => {
                const pgy = pgyLevels[f];
                const callTarget = callTargets[pgy] ?? 0;
                const floatTarget = floatTargets[pgy] ?? 0;
                const callActual = stats[f]?.call ?? 0;
                const floatActual = stats[f]?.float ?? 0;
                const cStat = statusMeta(callActual, callTarget);
                const fStat = statusMeta(floatActual, floatTarget);

                return (
                  <div
                    key={f}
                    className={`flex items-center justify-between px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 text-xs ${
                      idx % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800'
                    }`}
                  >
                    <div className="min-w-0">
                      <span className="font-semibold dark:text-gray-100">{f}</span>
                      <span className="text-[10px] text-gray-400 ml-1">PGY-{pgy}</span>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      <div className="text-center">
                        <div className="text-[10px] text-gray-400">Call</div>
                        <div className={`font-bold leading-none ${cStat.cls}`}>
                          {callActual}<span className="text-[10px] text-gray-400">/{callTarget}</span>
                        </div>
                      </div>
                      <StatusIcon tone={cStat.tone} />
                      <div className="text-center">
                        <div className="text-[10px] text-gray-400">Float</div>
                        <div className={`font-bold leading-none ${fStat.cls}`}>
                          {floatActual}<span className="text-[10px] text-gray-400">/{floatTarget}</span>
                        </div>
                      </div>
                      <StatusIcon tone={fStat.tone} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Desktop: full table ── */}
            <div className="hidden md:block">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-200 dark:bg-gray-700 border-b border-gray-400 dark:border-gray-600">
                    <th className="px-2 py-1 text-left font-bold dark:text-gray-100">Fellow</th>
                    <th className="px-2 py-1 text-center font-bold dark:text-gray-100">PGY</th>
                    <th className="px-2 py-1 text-center font-bold bg-blue-100 dark:bg-blue-900 dark:text-blue-200">Call Target</th>
                    <th className="px-2 py-1 text-center font-bold bg-blue-50 dark:bg-blue-950 dark:text-blue-100">Call Actual</th>
                    <th className="px-2 py-1 text-center font-bold">Status</th>
                    <th className="px-2 py-1 text-center font-bold bg-gray-100 dark:bg-gray-700 dark:text-gray-200">Float Target</th>
                    <th className="px-2 py-1 text-center font-bold bg-gray-50 dark:bg-gray-800 dark:text-gray-200">Float Actual</th>
                    <th className="px-2 py-1 text-center font-bold">Status</th>
                  </tr>
                </thead>

                <tbody>
                  {fellows.map((f, idx) => {
                    const pgy = pgyLevels[f];
                    const callTarget = callTargets[pgy] ?? 0;
                    const floatTarget = floatTargets[pgy] ?? 0;

                    const callActual = stats[f]?.call ?? 0;
                    const floatActual = stats[f]?.float ?? 0;

                    const cStat = statusMeta(callActual, callTarget);
                    const fStat = statusMeta(floatActual, floatTarget);

                    return (
                      <tr
                        key={f}
                        className={`border-b border-gray-200 dark:border-gray-700 ${idx % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800'}`}
                      >
                        <td className="px-2 py-1 font-semibold dark:text-gray-100">{f}</td>
                        <td className="px-2 py-1 text-center dark:text-gray-200">{pgy}</td>

                        <td className="px-2 py-1 text-center bg-blue-100 dark:bg-blue-900 dark:text-blue-200">{callTarget}</td>
                        <td className={`px-2 py-1 text-center font-bold ${cStat.cls}`}>
                          {callActual}
                        </td>
                        <td className="px-2 py-1 text-center">
                          <StatusIcon tone={cStat.tone} />
                        </td>

                        <td className="px-2 py-1 text-center bg-gray-100 dark:bg-gray-700 dark:text-gray-200">{floatTarget}</td>
                        <td className={`px-2 py-1 text-center font-bold ${fStat.cls}`}>
                          {floatActual}
                        </td>
                        <td className="px-2 py-1 text-center">
                          <StatusIcon tone={fStat.tone} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-2 text-[10px] text-gray-600 dark:text-gray-400">
              Floats are counted per Saturday night assignment (W1 and W2). Red badges indicate relaxed fallback.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
