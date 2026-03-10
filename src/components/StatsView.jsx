// src/components/StatsView.jsx
import React, { useMemo } from "react";
import { CalendarDays, Coffee } from "lucide-react";
import { pgyLevels } from "../data/scheduleData";

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

const DAY_OFF_REASONS = new Set(['Sick Day', 'Personal Day', 'Conference', 'CME']);

export default function StatsView({ stats, fellows, vacations = [] }) {
  if (!stats) return null;

  const vacSummary = useMemo(() => {
    const map = {};
    for (const v of vacations) {
      const name = v.fellow || v.fellow_name;
      if (!name || !fellows.includes(name)) continue;
      if (!map[name]) map[name] = { vacation: 0, dayOff: 0 };
      const isDayOff = DAY_OFF_REASONS.has(v.reason);
      if (isDayOff) {
        map[name].dayOff += 1;
      } else {
        const start = v.startBlock ?? 1;
        const end = v.endBlock ?? start;
        map[name].vacation += end - start + 1;
      }
    }
    return map;
  }, [vacations, fellows]);

  const fellowsByPGY = useMemo(
    () => ({
      4: fellows.filter((f) => pgyLevels[f] === 4),
      5: fellows.filter((f) => pgyLevels[f] === 5),
      6: fellows.filter((f) => pgyLevels[f] === 6),
    }),
    [fellows]
  );

  // Fellow + 20 rotation cols + Sum = 22
  const colSpan = 22;

  const renderRow = (f, idx) => (
    <tr
      key={f}
      className={`border-b border-gray-200 dark:border-gray-700 ${
        idx % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50 dark:bg-gray-800"
      }`}
    >
      <td className="px-2 py-1 font-semibold sticky left-0 z-10 bg-inherit border-r border-gray-200 dark:border-gray-700 whitespace-nowrap dark:text-gray-100">
        {f}
        <span className="ml-1 text-[10px] text-gray-400 dark:text-gray-500">PGY{pgyLevels[f]}</span>
      </td>
      <td className="px-1 py-1 text-center dark:text-gray-200">{stats[f]?.ai ?? 0}</td>
      <td className="px-1 py-1 text-center dark:text-gray-200">{stats[f]?.ai2 ?? 0}</td>
      <td className="px-1 py-1 text-center dark:text-gray-200">{stats[f]?.cath ?? 0}</td>
      <td className="px-1 py-1 text-center dark:text-gray-200">{stats[f]?.cath2 ?? 0}</td>
      <td className="px-1 py-1 text-center dark:text-gray-200">{stats[f]?.echo ?? 0}</td>
      <td className="px-1 py-1 text-center dark:text-gray-200">{stats[f]?.echo2 ?? 0}</td>
      <td className="px-1 py-1 text-center dark:text-gray-200">{stats[f]?.ep ?? 0}</td>
      <td className="px-1 py-1 text-center dark:text-gray-200">{stats[f]?.floorA ?? 0}</td>
      <td className="px-1 py-1 text-center dark:text-gray-200">{stats[f]?.floorB ?? 0}</td>
      <td className="px-1 py-1 text-center dark:text-gray-200">{stats[f]?.icu ?? 0}</td>
      <td className="px-1 py-1 text-center bg-gray-900 dark:bg-black text-white font-bold">
        {stats[f]?.nights ?? 0}
      </td>
      <td className="px-1 py-1 text-center dark:text-gray-200">{stats[f]?.nuclear ?? 0}</td>
      <td className="px-1 py-1 text-center dark:text-gray-200">{stats[f]?.nuclear2 ?? 0}</td>
      <td className="px-1 py-1 text-center dark:text-gray-200">{stats[f]?.cts ?? 0}</td>
      <td className="px-1 py-1 text-center dark:text-gray-200">{stats[f]?.research ?? 0}</td>
      <td className="px-1 py-1 text-center dark:text-gray-200">{stats[f]?.structural ?? 0}</td>
      <td className="px-1 py-1 text-center dark:text-gray-200">{stats[f]?.vascular ?? 0}</td>
      <td className="px-1 py-1 text-center dark:text-gray-200">{stats[f]?.admin ?? 0}</td>
      <td className="px-1 py-1 text-center dark:text-gray-200">{stats[f]?.spc ?? 0}</td>
      <td className="px-1 py-1 text-center bg-blue-50 dark:bg-blue-950 font-bold border-l-2 border-gray-400 dark:border-gray-600 dark:text-blue-100">
        {stats[f]?.sum ?? 0}
      </td>
    </tr>
  );

  return (
    <div className="space-y-4">
    <div className="bg-white dark:bg-gray-800 rounded border-2 border-gray-400 dark:border-gray-600 overflow-hidden">
      {/* Table without its own scroll container so page scrolls instead */}
      <div className="w-full">
        <table className="w-full text-sm border-separate border-spacing-0">
          <thead>
            <tr className="bg-gray-200 dark:bg-gray-700 border-b-2 border-gray-400 dark:border-gray-600 sticky top-0 z-30">
              <th className="px-2 py-1 text-left font-bold sticky top-0 left-0 z-40 bg-gray-200 dark:bg-gray-700 border-r border-gray-300 dark:border-gray-600 dark:text-gray-100">
                Fellow
              </th>
              <th className="px-1 py-1 text-center font-bold bg-purple-100 dark:bg-purple-900 dark:text-purple-200 sticky top-0 z-30">AI</th>
              <th className="px-1 py-1 text-center font-bold bg-purple-100 dark:bg-purple-900 dark:text-purple-200 sticky top-0 z-30">AI 2</th>
              <th className="px-1 py-1 text-center font-bold bg-blue-100 dark:bg-blue-900 dark:text-blue-200 sticky top-0 z-30">Cath</th>
              <th className="px-1 py-1 text-center font-bold bg-blue-100 dark:bg-blue-900 dark:text-blue-200 sticky top-0 z-30">Cath 2</th>
              <th className="px-1 py-1 text-center font-bold bg-cyan-100 dark:bg-cyan-900 dark:text-cyan-200 sticky top-0 z-30">Echo</th>
              <th className="px-1 py-1 text-center font-bold bg-cyan-100 dark:bg-cyan-900 dark:text-cyan-200 sticky top-0 z-30">Echo 2</th>
              <th className="px-1 py-1 text-center font-bold bg-green-100 dark:bg-green-900 dark:text-green-200 sticky top-0 z-30">EP</th>
              <th className="px-1 py-1 text-center font-bold bg-green-200 dark:bg-green-800 dark:text-green-200 sticky top-0 z-30">Floor A</th>
              <th className="px-1 py-1 text-center font-bold bg-blue-200 dark:bg-blue-800 dark:text-blue-200 sticky top-0 z-30">Floor B</th>
              <th className="px-1 py-1 text-center font-bold bg-red-200 dark:bg-red-900 dark:text-red-200 sticky top-0 z-30">ICU</th>
              <th className="px-1 py-1 text-center font-bold bg-gray-900 dark:bg-black text-white sticky top-0 z-30">Nights</th>
              <th className="px-1 py-1 text-center font-bold bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-200 sticky top-0 z-30">Nuclear</th>
              <th className="px-1 py-1 text-center font-bold bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-200 sticky top-0 z-30">Nuclear 2</th>
              <th className="px-1 py-1 text-center font-bold bg-indigo-100 dark:bg-indigo-900 dark:text-indigo-200 sticky top-0 z-30">CTS</th>
              <th className="px-1 py-1 text-center font-bold bg-pink-100 dark:bg-pink-900 dark:text-pink-200 sticky top-0 z-30">Research</th>
              <th className="px-1 py-1 text-center font-bold bg-amber-100 dark:bg-amber-900 dark:text-amber-200 sticky top-0 z-30">Structural</th>
              <th className="px-1 py-1 text-center font-bold bg-rose-100 dark:bg-rose-900 dark:text-rose-200 sticky top-0 z-30">Vascular</th>
              <th className="px-1 py-1 text-center font-bold bg-gray-200 dark:bg-gray-700 dark:text-gray-200 sticky top-0 z-30">Admin</th>
              <th className="px-1 py-1 text-center font-bold bg-gray-200 dark:bg-gray-700 dark:text-gray-200 sticky top-0 z-30">SPC</th>
              <th className="px-1 py-1 text-center font-bold bg-blue-50 dark:bg-blue-950 dark:text-blue-100 border-l-2 border-gray-400 dark:border-gray-600 sticky top-0 z-30">
                Sum
              </th>
            </tr>
          </thead>

          <tbody>
            <PGYDividerRow pgy={4} colSpan={colSpan} />
            {fellowsByPGY[4].map((f, idx) => renderRow(f, idx))}

            <PGYDividerRow pgy={5} colSpan={colSpan} />
            {fellowsByPGY[5].map((f, idx) => renderRow(f, idx))}

            <PGYDividerRow pgy={6} colSpan={colSpan} />
            {fellowsByPGY[6].map((f, idx) => renderRow(f, idx))}
          </tbody>
        </table>
      </div>
    </div>

    {/* Vacation / Day-Off summary card */}
    <div className="bg-white dark:bg-gray-800 rounded border-2 border-gray-400 dark:border-gray-600 overflow-hidden">
      <div className="px-3 py-2 bg-gray-200 dark:bg-gray-700 border-b-2 border-gray-400 dark:border-gray-600 flex items-center gap-2">
        <CalendarDays className="w-4 h-4 text-gray-600 dark:text-gray-300" />
        <span className="text-sm font-bold text-gray-700 dark:text-gray-200">Time Off Summary</span>
        <span className="ml-auto text-[10px] text-gray-500 dark:text-gray-400">approved requests · vacation counts by block</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-separate border-spacing-0">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-750">
              <th className="px-3 py-1.5 text-left font-bold sticky left-0 bg-gray-100 dark:bg-gray-700 border-r border-b border-gray-200 dark:border-gray-600 dark:text-gray-100">Fellow</th>
              <th className="px-3 py-1.5 text-center font-bold border-b border-gray-200 dark:border-gray-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-200">
                <div className="flex items-center justify-center gap-1"><CalendarDays className="w-3 h-3" /> Vacation Blocks</div>
              </th>
              <th className="px-3 py-1.5 text-center font-bold border-b border-gray-200 dark:border-gray-600 bg-amber-50 dark:bg-amber-950 dark:text-amber-200">
                <div className="flex items-center justify-center gap-1"><Coffee className="w-3 h-3" /> Days Off</div>
              </th>
            </tr>
          </thead>
          <tbody>
            {[4, 5, 6].map((pgy) => (
              <React.Fragment key={pgy}>
                <tr>
                  <td colSpan={3} className="sticky left-0 z-20 bg-white dark:bg-gray-800 border-y-2 border-gray-400 dark:border-gray-600 px-2 py-1 text-sm font-extrabold text-gray-700 dark:text-gray-200">
                    PGY-{pgy}
                  </td>
                </tr>
                {fellowsByPGY[pgy].map((f, idx) => (
                  <tr key={f} className={`border-b border-gray-200 dark:border-gray-700 ${idx % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50 dark:bg-gray-800"}`}>
                    <td className="px-3 py-1.5 font-semibold sticky left-0 z-10 bg-inherit border-r border-gray-200 dark:border-gray-700 whitespace-nowrap dark:text-gray-100">
                      {f}
                      <span className="ml-1 text-[10px] text-gray-400 dark:text-gray-500">PGY{pgyLevels[f]}</span>
                    </td>
                    <td className="px-3 py-1.5 text-center bg-blue-50/50 dark:bg-blue-950/30 font-semibold dark:text-blue-100">
                      {vacSummary[f]?.vacation ?? 0}
                    </td>
                    <td className="px-3 py-1.5 text-center bg-amber-50/50 dark:bg-amber-950/30 font-semibold dark:text-amber-100">
                      {vacSummary[f]?.dayOff ?? 0}
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  );
}
