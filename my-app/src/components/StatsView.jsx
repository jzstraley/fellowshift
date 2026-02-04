// src/components/StatsView.jsx
import React from 'react';

export default function StatsView({ stats, fellows }) {
  if (!stats) return null;

  return (
    <div className="bg-white rounded border-2 border-gray-400 overflow-x-auto">
      <table className="w-full text-[10px]">
        <thead>
          <tr className="bg-gray-200 border-b-2 border-gray-400">
            <th className="px-2 py-1 text-left font-bold sticky left-0 bg-gray-200">Fellow</th>
            <th className="px-1 py-1 text-center font-bold bg-purple-100">AI</th>
            <th className="px-1 py-1 text-center font-bold bg-purple-100">AI 2</th>
            <th className="px-1 py-1 text-center font-bold bg-blue-100">Cath</th>
            <th className="px-1 py-1 text-center font-bold bg-blue-100">Cath 2</th>
            <th className="px-1 py-1 text-center font-bold bg-cyan-100">Echo</th>
            <th className="px-1 py-1 text-center font-bold bg-cyan-100">Echo 2</th>
            <th className="px-1 py-1 text-center font-bold bg-green-100">EP</th>
            <th className="px-1 py-1 text-center font-bold bg-green-200">Floor A</th>
            <th className="px-1 py-1 text-center font-bold bg-blue-200">Floor B</th>
            <th className="px-1 py-1 text-center font-bold bg-red-200">ICU</th>
            <th className="px-1 py-1 text-center font-bold bg-gray-900 text-white">Nights</th>
            <th className="px-1 py-1 text-center font-bold bg-yellow-100">Nuclear</th>
            <th className="px-1 py-1 text-center font-bold bg-yellow-100">Nuclear 2</th>
            <th className="px-1 py-1 text-center font-bold bg-indigo-100">CTS</th>
            <th className="px-1 py-1 text-center font-bold bg-pink-100">Research</th>
            <th className="px-1 py-1 text-center font-bold bg-amber-100">Structural</th>
            <th className="px-1 py-1 text-center font-bold bg-rose-100">Vascular</th>
            <th className="px-1 py-1 text-center font-bold bg-gray-200">Admin</th>
            <th className="px-1 py-1 text-center font-bold bg-gray-200">SPC</th>
            <th className="px-1 py-1 text-center font-bold bg-blue-50 border-l-2 border-gray-400">Sum</th>
          </tr>
        </thead>
        <tbody>
          {fellows.map((f, idx) => (
            <tr key={f} className={`border-b border-gray-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
              <td className="px-2 py-1 font-semibold sticky left-0 bg-inherit">{f}</td>
              <td className="px-1 py-1 text-center">{stats[f].ai}</td>
              <td className="px-1 py-1 text-center">{stats[f].ai2}</td>
              <td className="px-1 py-1 text-center">{stats[f].cath}</td>
              <td className="px-1 py-1 text-center">{stats[f].cath2}</td>
              <td className="px-1 py-1 text-center">{stats[f].echo}</td>
              <td className="px-1 py-1 text-center">{stats[f].echo2}</td>
              <td className="px-1 py-1 text-center">{stats[f].ep}</td>
              <td className="px-1 py-1 text-center">{stats[f].floorA}</td>
              <td className="px-1 py-1 text-center">{stats[f].floorB}</td>
              <td className="px-1 py-1 text-center">{stats[f].icu}</td>
              <td className="px-1 py-1 text-center bg-black text-white font-bold">{stats[f].nights}</td>
              <td className="px-1 py-1 text-center">{stats[f].nuclear}</td>
              <td className="px-1 py-1 text-center">{stats[f].nuclear2}</td>
              <td className="px-1 py-1 text-center">{stats[f].cts}</td>
              <td className="px-1 py-1 text-center">{stats[f].research}</td>
              <td className="px-1 py-1 text-center">{stats[f].structural}</td>
              <td className="px-1 py-1 text-center">{stats[f].vascular}</td>
              <td className="px-1 py-1 text-center">{stats[f].admin}</td>
              <td className="px-1 py-1 text-center">{stats[f].spc}</td>
              <td className="px-1 py-1 text-center bg-blue-50 font-bold border-l-2 border-gray-400">{stats[f].sum}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
