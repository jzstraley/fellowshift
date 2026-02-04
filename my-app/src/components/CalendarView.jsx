// src/components/CalendarView.jsx
import React from 'react';
import { blockDates, pgyLevels } from '../data/scheduleData';
import { getRotationColor } from '../utils/scheduleUtils';

// --- helpers ---
const toISODate = (d) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const addDays = (d, n) => {
  const x = new Date(d);
  x.setHours(12, 0, 0, 0);
  x.setDate(x.getDate() + n);
  return x;
};

const abbr = (rotation) => {
  if (!rotation) return '';
  const r = rotation.trim().toLowerCase();

  const map = {
    'nuclear': 'Nuc', 'nuclear 2': 'Nuc2', 'nuc': 'Nuc',
    'floor a': 'F-A', 'floor b': 'F-B',
    'cath': 'Cath', 'cath 2': 'Cth2', 'cath 3': 'Cth3',
    'icu': 'ICU', 'echo': 'Echo', 'echo 2': 'Ech2',
    'ep': 'EP', 'ai': 'AI', 'ai 2': 'AI2', 'ai 3': 'AI3',
    'structural': 'Str', 'spc': 'SPC', 'cts': 'CTS',
    'nights': 'Nts', 'float': 'Flt', 'call': 'Call',
    'vac': 'Vac', 'vacation': 'Vac', 'admin': 'Adm',
    'research': 'Res', 'research 2': 'Res2', 'vascular': 'Vasc',
    'off': 'OFF', 'post-call': 'PC',
  };

  if (map[r]) return map[r];
  if (r.includes('research')) return 'Res';
  if (r.includes('floor') && r.includes('a')) return 'F-A';
  if (r.includes('floor') && r.includes('b')) return 'F-B';
  if (r.includes('cath') && r.includes('3')) return 'Cth3';
  if (r.includes('cath') && r.includes('2')) return 'Cth2';
  if (r.includes('cath')) return 'Cath';

  return rotation.length <= 5 ? rotation : rotation.slice(0, 5);
};

export default function CalendarView({ fellows, schedule, dateCallMap }) {
  console.log('dateCallMap:', dateCallMap);  // <-- Here is OK
  
  const startDate = new Date(2026, 6, 1, 12);
  const endDate = new Date(2027, 5, 30, 12);    // Jun 30, 2027

  const allDays = [];
  let currentDate = new Date(startDate);
  currentDate.setHours(12, 0, 0, 0);
  while (currentDate <= endDate) {
    allDays.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
    currentDate.setHours(12, 0, 0, 0);
  }

  // Get block index for a given date
  const getBlockForDate = (date) => {
    for (let i = 0; i < blockDates.length; i++) {
      const start = new Date(blockDates[i].start);
      const end = new Date(blockDates[i].end);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      if (date >= start && date <= end) return i;
    }
    return null;
  };

  // Get rotation for fellow on a given date
  const getRotationForDate = (fellow, date) => {
    const blockIdx = getBlockForDate(date);
    if (blockIdx === null) return null;
    return schedule?.[fellow]?.[blockIdx] ?? null;
  };

// Check if fellow has call/float on a specific date
  const getCallFloatForDate = (fellow, dateISO) => {
    if (!dateCallMap || Object.keys(dateCallMap).length === 0) return null;
    
    const dayData = dateCallMap[dateISO];
    if (!dayData) return null;
    
    // Handle various data shapes
    if (dayData.call === fellow) return 'Call';
    if (dayData.float === fellow) return 'Float';
    
    // Maybe nested differently?
    if (typeof dayData === 'string' && dayData === fellow) return 'Call';
    
    return null;
  };

  // Nights: 6 nights starting Sunday (Sun-Fri working, Sat off)
  const isNightsWorkDay = (dow) => {
    // dow: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
    // Working: Sun(0), Mon(1), Tue(2), Wed(3), Thu(4), Fri(5)
    // Off: Sat(6)
    return dow !== 6;
  };

  // Determine what to display for a cell
  const getCellInfo = (fellow, date) => {
    const dateISO = toISODate(date);
    const dow = date.getDay(); // 0=Sun, 6=Sat
    const isWeekend = dow === 0 || dow === 6;
    const rotation = getRotationForDate(fellow, date);
    const isNights = rotation?.toLowerCase() === 'nights';

    // 1. Check for Call/Float assignment (these override everything on weekends)
    const callFloat = getCallFloatForDate(fellow, dateISO);
    if (callFloat === 'Call') {
      return { label: 'Call', type: 'call', colorClass: 'bg-red-500 text-white' };
    }
    if (callFloat === 'Float') {
      return { label: 'Flt', type: 'float', colorClass: 'bg-purple-600 text-white' };
    }

    // 3. Nights rotation logic: Sun-Fri work (6 nights), Sat off
    if (isNights) {
      if (isNightsWorkDay(dow)) {
        return { label: 'Nts', type: 'nights', colorClass: 'bg-black text-white' };
      } else {
        return { label: '-', type: 'off', colorClass: '' };
      }
    }

    // 4. Regular weekend (not on call/float/nights)
    if (isWeekend) {
      return { label: '-', type: 'off', colorClass: '' };
    }

    // 5. Regular weekday rotation
    if (rotation) {
      return { label: abbr(rotation), type: 'rotation', colorClass: getRotationColor(rotation) };
    }

    return { label: '', type: 'empty', colorClass: '' };
  };

  // Group days by month
  const months = {};
  allDays.forEach((day) => {
    const monthKey = day.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    if (!months[monthKey]) months[monthKey] = [];
    months[monthKey].push(day);
  });

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Group fellows by PGY
  const fellowsByPGY = {
    4: fellows.filter(f => pgyLevels[f] === 4),
    5: fellows.filter(f => pgyLevels[f] === 5),
    6: fellows.filter(f => pgyLevels[f] === 6),
  };

  const renderFellowRow = (fellow, idx, isLastInGroup) => (
    <tr
      key={fellow}
      className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${
        isLastInGroup ? 'border-b-4 border-gray-400' : 'border-b border-gray-200'
      }`}
    >
      <td className="px-1 py-1 font-semibold text-[10px] sticky left-0 bg-inherit border-r-2 border-gray-300 z-10 whitespace-nowrap">
        {fellow}
        <span className="text-[8px] text-gray-400 ml-1">
          {pgyLevels[fellow]}
        </span>
      </td>

      {months[Object.keys(months)[0]] && Object.values(months).flat().map((day, dayIdx) => {
        // This gets recalculated per month render, see below
        return null;
      })}
    </tr>
  );

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="bg-white rounded border-2 border-gray-400 p-2">
        <div className="flex flex-wrap gap-2 text-[9px] items-center">
          <span className="font-bold">Legend:</span>
          <span className="px-2 py-1 bg-red-500 text-white rounded font-semibold">Call</span>
          <span className="px-2 py-1 bg-purple-600 text-white rounded font-semibold">Float</span>
          <span className="px-2 py-1 bg-black text-white rounded font-semibold">Nights</span>
          <span className="border-l border-gray-300 pl-2 ml-1 text-gray-600">
            Nights = Sun-Fri (6 nights)
          </span>
        </div>
      </div>

      {Object.entries(months).map(([month, days]) => (
        <div key={month} className="bg-white rounded border-2 border-gray-400 overflow-hidden">
          <div className="px-3 py-2 bg-gray-100 border-b-2 border-gray-400">
            <h3 className="font-bold text-sm">{month}</h3>
          </div>

          <div className="p-2 overflow-x-auto">
            <table className="w-full text-[9px] border-collapse">
              <thead>
                <tr className="bg-gray-200 border-b-2 border-gray-400">
                  <th className="px-1 py-1 text-left font-bold sticky left-0 bg-gray-200 z-10 min-w-[70px] border-r-2 border-gray-300">
                    Fellow
                  </th>
                  {days.map((day, idx) => {
                    const dow = day.getDay();
                    const isWeekend = dow === 0 || dow === 6;
                    const isSunday = dow === 0;
                    return (
                      <th
                        key={idx}
                        className={`px-0.5 py-1 text-center font-bold min-w-[32px] ${
                          isWeekend ? 'bg-yellow-100' : ''
                        } ${isSunday ? 'border-l-2 border-gray-400' : 'border-l border-gray-200'}`}
                      >
                        <div className="text-[7px] text-gray-500">{dayNames[dow]}</div>
                        <div className="text-[9px]">{day.getDate()}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {/* PGY-4 */}
                {fellowsByPGY[4].map((fellow, idx) => {
                  const isLast = idx === fellowsByPGY[4].length - 1;
                  return (
                    <tr
                      key={fellow}
                      className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${
                        isLast ? 'border-b-4 border-blue-400' : 'border-b border-gray-200'
                      }`}
                    >
                      <td className="px-1 py-1 font-semibold text-[10px] sticky left-0 bg-inherit border-r-2 border-gray-300 z-10 whitespace-nowrap">
                        <span className="text-blue-600">{fellow}</span>
                        <span className="text-[7px] text-blue-400 ml-0.5">4</span>
                      </td>
                      {days.map((day, dayIdx) => {
                        const dow = day.getDay();
                        const isWeekend = dow === 0 || dow === 6;
                        const isSunday = dow === 0;
                        const cellInfo = getCellInfo(fellow, day);

                        return (
                          <td
                            key={dayIdx}
                            className={`px-0 py-0.5 text-center ${
                              isWeekend ? 'bg-yellow-50' : ''
                            } ${isSunday ? 'border-l-2 border-gray-400' : 'border-l border-gray-100'}`}
                          >
                            {cellInfo.type !== 'off' && cellInfo.type !== 'empty' ? (
                              <div className={`mx-0.5 px-0.5 py-0.5 rounded text-[7px] font-bold ${cellInfo.colorClass}`}>
                                {cellInfo.label}
                              </div>
                            ) : cellInfo.type === 'off' ? (
                              <div className="text-[8px] text-gray-300">-</div>
                            ) : null}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}

                {/* PGY-5 */}
                {fellowsByPGY[5].map((fellow, idx) => {
                  const isLast = idx === fellowsByPGY[5].length - 1;
                  return (
                    <tr
                      key={fellow}
                      className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${
                        isLast ? 'border-b-4 border-green-400' : 'border-b border-gray-200'
                      }`}
                    >
                      <td className="px-1 py-1 font-semibold text-[10px] sticky left-0 bg-inherit border-r-2 border-gray-300 z-10 whitespace-nowrap">
                        <span className="text-green-600">{fellow}</span>
                        <span className="text-[7px] text-green-400 ml-0.5">5</span>
                      </td>
                      {days.map((day, dayIdx) => {
                        const dow = day.getDay();
                        const isWeekend = dow === 0 || dow === 6;
                        const isSunday = dow === 0;
                        const cellInfo = getCellInfo(fellow, day);

                        return (
                          <td
                            key={dayIdx}
                            className={`px-0 py-0.5 text-center ${
                              isWeekend ? 'bg-yellow-50' : ''
                            } ${isSunday ? 'border-l-2 border-gray-400' : 'border-l border-gray-100'}`}
                          >
                            {cellInfo.type !== 'off' && cellInfo.type !== 'empty' ? (
                              <div className={`mx-0.5 px-0.5 py-0.5 rounded text-[7px] font-bold ${cellInfo.colorClass}`}>
                                {cellInfo.label}
                              </div>
                            ) : cellInfo.type === 'off' ? (
                              <div className="text-[8px] text-gray-300">-</div>
                            ) : null}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}

                {/* PGY-6 */}
                {fellowsByPGY[6].map((fellow, idx) => {
                  const isLast = idx === fellowsByPGY[6].length - 1;
                  return (
                    <tr
                      key={fellow}
                      className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${
                        isLast ? '' : 'border-b border-gray-200'
                      }`}
                    >
                      <td className="px-1 py-1 font-semibold text-[10px] sticky left-0 bg-inherit border-r-2 border-gray-300 z-10 whitespace-nowrap">
                        <span className="text-purple-600">{fellow}</span>
                        <span className="text-[7px] text-purple-400 ml-0.5">6</span>
                      </td>
                      {days.map((day, dayIdx) => {
                        const dow = day.getDay();
                        const isWeekend = dow === 0 || dow === 6;
                        const isSunday = dow === 0;
                        const cellInfo = getCellInfo(fellow, day);

                        return (
                          <td
                            key={dayIdx}
                            className={`px-0 py-0.5 text-center ${
                              isWeekend ? 'bg-yellow-50' : ''
                            } ${isSunday ? 'border-l-2 border-gray-400' : 'border-l border-gray-100'}`}
                          >
                            {cellInfo.type !== 'off' && cellInfo.type !== 'empty' ? (
                              <div className={`mx-0.5 px-0.5 py-0.5 rounded text-[7px] font-bold ${cellInfo.colorClass}`}>
                                {cellInfo.label}
                              </div>
                            ) : cellInfo.type === 'off' ? (
                              <div className="text-[8px] text-gray-300">-</div>
                            ) : null}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}