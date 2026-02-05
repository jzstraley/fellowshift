// src/components/ImportExportBar.jsx
import React, { useRef, useState } from "react";
import { Upload, Download, RotateCcw } from "lucide-react";
import { parseScheduleTable, buildScheduleCSV, buildViolationsCSV, downloadTextFile } from "../engine/ioScheduleCsv";

export default function ImportExportBar({
  fellows,
  schedule,
  setSchedule,
  resetToDefaults,
  violations,
}) {
  const fileRef = useRef(null);
  const [msg, setMsg] = useState(null);

  const onPickFile = () => fileRef.current?.click();

  const onFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-import same file
    if (!file) return;

    try {
      const text = await file.text();
      const res = parseScheduleTable(text, { fellows, nBlocks: 26 });
      if (!res.ok) {
        setMsg({ type: "error", text: res.error });
        return;
      }
      setSchedule(res.schedule);
      setMsg({ type: "ok", text: `Imported schedule from ${file.name}` });
    } catch (err) {
      setMsg({ type: "error", text: `Import failed: ${err?.message ?? String(err)}` });
    }
  };

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
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.tsv,text/csv,text/tab-separated-values"
          className="hidden"
          onChange={onFileChange}
        />

        <button
          onClick={onPickFile}
          className="w-full flex items-center justify-center gap-1 px-2 py-1.5 md:py-1 min-h-[32px] bg-gray-800 hover:bg-gray-900 text-white text-[11px] font-semibold rounded whitespace-nowrap"
          type="button"
          title="Import CSV/TSV: Fellow, Block 1..26"
        >
          <Upload className="w-3 h-3 shrink-0" />
          Import
        </button>

        <button
          onClick={exportSchedule}
          className="w-full flex items-center justify-center gap-1 px-2 py-1.5 md:py-1 min-h-[30px] bg-gray-800 hover:bg-gray-900 text-white text-[11px] font-semibold rounded whitespace-nowrap"
          type="button"
        >
          <Download className="w-3 h-3 shrink-0" />
          Export Schedule
        </button>

        <button
          onClick={exportViolations}
          className="w-full flex items-center justify-center gap-1 px-2 py-1.5 md:py-1 min-h-[30px] bg-gray-700 hover:bg-gray-800 text-white text-[11px] font-semibold rounded whitespace-nowrap col-span-2 md:col-span-1"
          type="button"
        >
          <Download className="w-3 h-3 shrink-0" />
          Export Violations
        </button>

        <button
          onClick={resetToDefaults}
          className="w-full flex items-center justify-center gap-1 px-2 py-1.5 md:py-1 min-h-[30px] bg-red-600 hover:bg-red-700 text-white text-[11px] font-semibold rounded whitespace-nowrap col-span-2 md:col-span-1"
          type="button"
        >
          <RotateCcw className="w-3 h-3 shrink-0" />
          Reset
        </button>
      </div>

      {/* Status message */}
      {msg && (
        <div
          className={`text-[11px] px-2 py-2 md:py-1 rounded border w-full md:w-auto ${
            msg.type === "ok"
              ? "bg-green-50 border-green-300 text-green-800"
              : "bg-red-50 border-red-300 text-red-800"
          }`}
        >
          {msg.text}
        </div>
      )}
    </div>
  </div>
);
}