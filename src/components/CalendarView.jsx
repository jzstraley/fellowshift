// src/components/CalendarView.jsx
import React, { useMemo, useState } from "react";
import { blockDates, pgyLevels } from "../data/scheduleData";
import { getRotationColor, formatDate } from "../utils/scheduleUtils";

// --- helpers ---
const toISODate = (d) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const abbr = (rotation) => {
  if (!rotation) return "";
  const r = rotation.trim().toLowerCase();
  const map = {
    nuclear: "Nuc",
    "nuclear 2": "Nuc2",
    nuc: "Nuc",
    "floor a": "F-A",
    "floor b": "F-B",
    cath: "Cath",
    "cath 2": "Cth2",
    "cath 3": "Cth3",
    icu: "ICU",
    echo: "Echo",
    "echo 2": "Ech2",
    ep: "EP",
    ai: "AI",
    "ai 2": "AI2",
    "ai 3": "AI3",
    structural: "Str",
    spc: "SPC",
    cts: "CTS",
    nights: "Nts",
    float: "Flt",
    call: "Call",
    vac: "Vac",
    vacation: "Vac",
    admin: "Adm",
    research: "Res",
    "research 2": "Res2",
    vascular: "Vasc",
    off: "OFF",
    "post-call": "PC",
  };

  if (map[r]) return map[r];
  if (r.includes("research")) return "Res";
  if (r.includes("floor") && r.includes("a")) return "F-A";
  if (r.includes("floor") && r.includes("b")) return "F-B";
  if (r.includes("cath") && r.includes("3")) return "Cth3";
  if (r.includes("cath") && r.includes("2")) return "Cth2";
  if (r.includes("cath")) return "Cath";

  return rotation.length <= 5 ? rotation : rotation.slice(0, 5);
};

const PGYDividerRow = ({ pgy, colSpan }) => (
  <tr>
    <td
      colSpan={colSpan}
      className="sticky left-0 z-20 bg-white dark:bg-gray-800 border-y-2 border-gray-400 dark:border-gray-600 px-2 py-1 text-[10px] font-extrabold text-gray-700 dark:text-gray-200"
    >
      PGY-{pgy}
    </td>
  </tr>
);

function getInitialBlockIdx() {
  const today = new Date().toISOString().split("T")[0];
  const idx = blockDates.findIndex((bd) => today >= bd.start && today <= bd.end);
  return idx >= 0 ? idx : 0;
}

export default function CalendarView({ fellows, schedule, dateCallMap }) {
  const startDate = new Date(2026, 6, 1, 12); // Jul 1 2026
  const endDate = new Date(2027, 5, 30, 12); // Jun 30 2027

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const [selectedBlockIdx, setSelectedBlockIdx] = useState(getInitialBlockIdx);

  const selectedBd = blockDates[selectedBlockIdx];

  // Build all days once
  const allDays = useMemo(() => {
    const out = [];
    const cur = new Date(startDate);
    cur.setHours(12, 0, 0, 0);
    while (cur <= endDate) {
      out.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
      cur.setHours(12, 0, 0, 0);
    }
    return out;
  }, []);

  // Filter days to only those within the selected block
  const blockDays = useMemo(() => {
    const start = new Date(selectedBd.start + "T00:00:00");
    const end = new Date(selectedBd.end + "T23:59:59");
    return allDays.filter((day) => day >= start && day <= end);
  }, [allDays, selectedBlockIdx]);

  // Group block days by month
  const months = useMemo(() => {
    const m = {};
    blockDays.forEach((day) => {
      const monthKey = day.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
      });
      if (!m[monthKey]) m[monthKey] = [];
      m[monthKey].push(day);
    });
    return m;
  }, [blockDays]);

  const fellowsByPGY = useMemo(
    () => ({
      4: fellows.filter((f) => pgyLevels[f] === 4),
      5: fellows.filter((f) => pgyLevels[f] === 5),
      6: fellows.filter((f) => pgyLevels[f] === 6),
    }),
    [fellows]
  );

  // Map date -> block index (cache)
  const dateToBlockIdx = useMemo(() => {
    const m = {};
    for (const day of allDays) {
      const iso = toISODate(day);
      let found = null;
      for (let i = 0; i < blockDates.length; i++) {
        const start = new Date(blockDates[i].start);
        const end = new Date(blockDates[i].end);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        if (day >= start && day <= end) {
          found = i;
          break;
        }
      }
      m[iso] = found;
    }
    return m;
  }, [allDays]);

  const getRotationForDate = (fellow, date) => {
    const iso = toISODate(date);
    const blockIdx = dateToBlockIdx[iso];
    if (blockIdx === null || blockIdx === undefined) return null;
    return schedule?.[fellow]?.[blockIdx] ?? null;
  };

  const getCallFloatForDate = (fellow, dateISO) => {
    if (!dateCallMap) return null;
    const dayData = dateCallMap[dateISO];
    if (!dayData) return null;

    if (dayData.call === fellow) return "Call";
    if (dayData.float === fellow) return "Float";
    if (typeof dayData === "string" && dayData === fellow) return "Call";

    return null;
  };

  const isNightsWorkDay = (dow) => dow !== 6; // Sat off

  const getCellInfo = (fellow, date) => {
    const dateISO = toISODate(date);
    const dow = date.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const rotation = getRotationForDate(fellow, date);
    const isNights = rotation?.toLowerCase() === "nights";

    const callFloat = getCallFloatForDate(fellow, dateISO);
    if (callFloat === "Call") {
      return { label: "Call", type: "call", colorClass: "bg-red-500 text-white" };
    }
    if (callFloat === "Float") {
      return { label: "Flt", type: "float", colorClass: "bg-purple-600 text-white" };
    }

    if (isNights) {
      if (isNightsWorkDay(dow)) {
        return { label: "Nts", type: "nights", colorClass: "bg-black text-white" };
      }
      return { label: "-", type: "off", colorClass: "" };
    }

    if (isWeekend) return { label: "-", type: "off", colorClass: "" };

    if (rotation) {
      return { label: abbr(rotation), type: "rotation", colorClass: getRotationColor(rotation) };
    }

    return { label: "", type: "empty", colorClass: "" };
  };

  return (
    <div className="space-y-4">
      {/* Block selector toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
          Block:
        </label>
        <select
          value={selectedBlockIdx}
          onChange={(e) => setSelectedBlockIdx(Number(e.target.value))}
          className="px-3 py-2 text-sm font-semibold rounded border min-h-[44px] bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600"
        >
          {blockDates.map((bd, i) => (
            <option key={i} value={i}>
              Block {bd.block} · {formatDate(bd.start)}–{formatDate(bd.end)}
              {i === getInitialBlockIdx() ? " ★ Current" : ""}
            </option>
          ))}
        </select>

        {/* Legend */}
        <div className="flex flex-wrap gap-2 text-[9px] items-center dark:text-gray-200 sm:ml-auto">
          <span className="font-bold text-sm text-gray-700 dark:text-gray-300">Legend:</span>
          <span className="px-2 py-1 bg-red-500 text-white rounded font-semibold">Call</span>
          <span className="px-2 py-1 bg-purple-600 text-white rounded font-semibold">Float</span>
          <span className="px-2 py-1 bg-black text-white rounded font-semibold">Nights</span>
          <span className="border-l border-gray-300 dark:border-gray-600 pl-2 ml-1 text-gray-600 dark:text-gray-400">
            Nights = Sun–Fri
          </span>
        </div>
      </div>

      {Object.entries(months).map(([month, days]) => {
        const colSpan = 1 + days.length;

        return (
          <div key={month} className="bg-white dark:bg-gray-800 rounded border-2 border-gray-400 dark:border-gray-600 overflow-hidden">
            <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700 border-b-2 border-gray-400 dark:border-gray-600">
              <h3 className="font-bold text-sm dark:text-gray-100">{month}</h3>
            </div>

            <div className="overflow-auto max-h-[calc(100vh-260px)]">
              <table className="w-full text-[9px] border-separate border-spacing-0">
                <thead>
                  <tr className="bg-gray-200 dark:bg-gray-700 border-b-2 border-gray-400 dark:border-gray-600 sticky top-0 z-30">
                    <th className="px-1 py-1 text-left font-bold sticky top-0 left-0 z-40 bg-gray-200 dark:bg-gray-700 dark:text-gray-100 min-w-[90px] border-r-2 border-gray-300 dark:border-gray-600">
                      Fellow
                    </th>
                    {days.map((day, idx) => {
                      const dow = day.getDay();
                      const isWeekend = dow === 0 || dow === 6;
                      const isSunday = dow === 0;
                      return (
                        <th
                          key={idx}
                          className={`px-0.5 py-1 text-center font-bold min-w-[32px] sticky top-0 z-30 ${
                            isWeekend ? "bg-yellow-100 dark:bg-yellow-900/40" : "bg-gray-200 dark:bg-gray-700"
                          } ${isSunday ? "border-l-2 border-gray-400 dark:border-gray-600" : "border-l border-gray-200 dark:border-gray-600"}`}
                        >
                          <div className="text-[7px] text-gray-500 dark:text-gray-400">{dayNames[dow]}</div>
                          <div className="text-[9px] dark:text-gray-200">{day.getDate()}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                <tbody>
                  <PGYDividerRow pgy={4} colSpan={colSpan} />
                  {fellowsByPGY[4].map((fellow, idx) => (
                    <tr
                      key={fellow}
                      className={`${idx % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50 dark:bg-gray-800"} border-b border-gray-200 dark:border-gray-700`}
                    >
                      <td className="px-1 py-1 font-semibold text-[10px] sticky left-0 z-10 bg-inherit border-r-2 border-gray-300 dark:border-gray-600 whitespace-nowrap">
                        <span className="text-blue-600 dark:text-blue-400">{fellow}</span>
                        <span className="text-[7px] text-blue-400 dark:text-blue-500 ml-0.5">4</span>
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
                              isWeekend ? "bg-yellow-50 dark:bg-yellow-900/20" : ""
                            } ${isSunday ? "border-l-2 border-gray-400 dark:border-gray-600" : "border-l border-gray-100 dark:border-gray-700"}`}
                          >
                            {cellInfo.type !== "off" && cellInfo.type !== "empty" ? (
                              <div className={`mx-0.5 px-0.5 py-0.5 rounded text-[7px] font-bold ${cellInfo.colorClass}`}>
                                {cellInfo.label}
                              </div>
                            ) : cellInfo.type === "off" ? (
                              <div className="text-[8px] text-gray-300 dark:text-gray-600">-</div>
                            ) : null}
                          </td>
                        );
                      })}
                    </tr>
                  ))}

                  <PGYDividerRow pgy={5} colSpan={colSpan} />
                  {fellowsByPGY[5].map((fellow, idx) => (
                    <tr
                      key={fellow}
                      className={`${idx % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50 dark:bg-gray-800"} border-b border-gray-200 dark:border-gray-700`}
                    >
                      <td className="px-1 py-1 font-semibold text-[10px] sticky left-0 z-10 bg-inherit border-r-2 border-gray-300 dark:border-gray-600 whitespace-nowrap">
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
                              isWeekend ? "bg-yellow-50 dark:bg-yellow-900/20" : ""
                            } ${isSunday ? "border-l-2 border-gray-400 dark:border-gray-600" : "border-l border-gray-100 dark:border-gray-700"}`}
                          >
                            {cellInfo.type !== "off" && cellInfo.type !== "empty" ? (
                              <div className={`mx-0.5 px-0.5 py-0.5 rounded text-[7px] font-bold ${cellInfo.colorClass}`}>
                                {cellInfo.label}
                              </div>
                            ) : cellInfo.type === "off" ? (
                              <div className="text-[8px] text-gray-300 dark:text-gray-600">-</div>
                            ) : null}
                          </td>
                        );
                      })}
                    </tr>
                  ))}

                  <PGYDividerRow pgy={6} colSpan={colSpan} />
                  {fellowsByPGY[6].map((fellow, idx) => (
                    <tr
                      key={fellow}
                      className={`${idx % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50 dark:bg-gray-800"} border-b border-gray-200 dark:border-gray-700`}
                    >
                      <td className="px-1 py-1 font-semibold text-[10px] sticky left-0 z-10 bg-inherit border-r-2 border-gray-300 dark:border-gray-600 whitespace-nowrap">
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
                              isWeekend ? "bg-yellow-50 dark:bg-yellow-900/20" : ""
                            } ${isSunday ? "border-l-2 border-gray-400 dark:border-gray-600" : "border-l border-gray-100 dark:border-gray-700"}`}
                          >
                            {cellInfo.type !== "off" && cellInfo.type !== "empty" ? (
                              <div className={`mx-0.5 px-0.5 py-0.5 rounded text-[7px] font-bold ${cellInfo.colorClass}`}>
                                {cellInfo.label}
                              </div>
                            ) : cellInfo.type === "off" ? (
                              <div className="text-[8px] text-gray-300 dark:text-gray-600">-</div>
                            ) : null}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
