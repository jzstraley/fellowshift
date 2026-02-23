// src/components/StatsView.jsx
import React, { useMemo } from "react";
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

export default function StatsView({ stats, fellows }) {
  if (!stats) return null;

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
  );
}
