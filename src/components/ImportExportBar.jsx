// src/components/ImportExportBar.jsx
import React from "react";
import { Download } from "lucide-react";
import { buildScheduleCSV, buildViolationsCSV, downloadTextFile } from "../engine/ioScheduleCsv";

export default function ImportExportBar({
  fellows,
  schedule,
  violations,
  showExportViolations = false,
}) {
  return null;
  const exportSchedule = () => {
    const csv = buildScheduleCSV(schedule, fellows, 26);
    downloadTextFile("schedule_export.csv", csv);
  };

  const exportViolations = () => {
    const csv = buildViolationsCSV(violations ?? []);
    downloadTextFile("violations_export.csv", csv);
  };

return (
  <div className="w-full">
    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      {/* Left actions */}
      <div className="grid grid-cols-2 gap-2 md:flex md:items-center md:gap-2">
        <button
          onClick={exportSchedule}
          className="w-full flex items-center justify-center gap-1 px-2 py-1.5 md:py-1 min-h-[30px] bg-gray-800 hover:bg-gray-900 dark:bg-gray-600 dark:hover:bg-gray-500 text-white text-[11px] font-semibold rounded whitespace-nowrap"
          type="button"
        >
          <Download className="w-3 h-3 shrink-0" />
          Export Schedule
        </button>

        {showExportViolations && (
          <button
            onClick={exportViolations}
            className="w-full flex items-center justify-center gap-1 px-2 py-1.5 md:py-1 min-h-[30px] bg-gray-700 hover:bg-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 text-white text-[11px] font-semibold rounded whitespace-nowrap col-span-2 md:col-span-1"
            type="button"
          >
            <Download className="w-3 h-3 shrink-0" />
            Export Violations
          </button>
        )}
      </div>

    </div>
  </div>
);
}