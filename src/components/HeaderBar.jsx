// src/components/HeaderBar.jsx
import { Menu, X, Moon, Sun } from "lucide-react";
import { useState } from "react";

export default function HeaderBar({
  activeView,
  setActiveView,
  darkMode,
  toggleDarkMode,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const views = [
    { key: "schedule", label: "Schedule" },
    { key: "stats", label: "Stats" },
    { key: "call", label: "Call/Float" },
    { key: "calendar", label: "Calendar" },
    { key: "clinic", label: "Clinic" },
    { key: "vacRequests", label: "Vacations" },
    { key: "lectures", label: "Lectures" },
  ];

  return (
    <div
      className={`border-b-2 sticky top-0 z-50 ${
        darkMode
          ? "bg-gray-900 border-gray-700 text-gray-100"
          : "bg-white border-gray-400 text-gray-800"
      }`}
    >
      {/* Title Bar */}
      <div
        className={`px-3 py-2 flex items-center justify-between ${
          darkMode ? "border-gray-700" : "border-gray-300"
        }`}
      >
        <h1 className="text-base font-bold">
          Fellow<span className="text-red-400 italic">Shift</span>
        </h1>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleDarkMode}
            className={`p-2 rounded ${
              darkMode ? "hover:bg-gray-700 text-yellow-400" : "hover:bg-gray-200 text-gray-600"
            }`}
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Desktop Tabs */}
      <div className="hidden md:flex px-3 py-2 justify-center gap-1">
        {views.map((v) => (
          <button
            key={v.key}
            onClick={() => setActiveView(v.key)}
            className={`px-3 py-1.5 text-xs font-semibold rounded ${
              activeView === v.key
                ? "bg-blue-600 text-white"
                : darkMode
                ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden p-2 grid grid-cols-3 gap-2">
          {views.map((v) => (
            <button
              key={v.key}
              onClick={() => {
                setActiveView(v.key);
                setMobileMenuOpen(false);
              }}
              className={`px-2 py-2 text-xs font-semibold rounded ${
                activeView === v.key
                  ? "bg-blue-600 text-white"
                  : darkMode
                  ? "bg-gray-700 text-gray-300"
                  : "bg-gray-200 text-gray-700"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}