// src/components/HeaderBar.jsx
import { CheckCircle } from "lucide-react";
import ImportExportBar from "./ImportExportBar";

export default function HeaderBar({
  activeView,
  setActiveView,
  fellows,
  schedule,
  setSchedule,
  resetToDefaults,
  violations,
  checkBalance,
}) {
  const views = [
    { key: "schedule", label: "Schedule" },
    { key: "stats", label: "Stats" },
    { key: "call", label: "Call/Float" },
    { key: "calendar", label: "Calendar" },
    { key: "clinic", label: "Clinic Coverage" },
  ];

  return (
    <div className="bg-white border-b-2 border-gray-400 sticky top-0 z-50">
      {/* Title Bar */}
      <div className="px-3 py-2 border-b border-gray-300">
        <h1 className="text-base font-bold text-gray-800">Fellowship Scheduler</h1>
      </div>

      {/* Button Bar */}
      <div className="px-3 py-2 flex items-center justify-between">
        {/* Left: View Tabs */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {views.map((v) => (
              <button
                key={v.key}
                onClick={() => setActiveView(v.key)}
                className={`px-2 py-1 text-xs font-semibold rounded ${
                  activeView === v.key
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-700"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>

          <div className="border-l border-gray-400 pl-2 ml-2">
            <ImportExportBar
              fellows={fellows}
              schedule={schedule}
              setSchedule={setSchedule}
              resetToDefaults={resetToDefaults}
              violations={violations}
            />
          </div>
        </div>

        {/* Right: Check Balance only */}
        <button
          onClick={checkBalance}
          className="flex items-center gap-1 px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded"
          type="button"
        >
          <CheckCircle className="w-3 h-3" />
          Check Balance
        </button>
      </div>
    </div>
  );
}