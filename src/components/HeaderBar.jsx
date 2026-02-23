// src/components/HeaderBar.jsx
import { Menu, X, Moon, Sun, AlignJustify, User, FileText, Settings, LogIn, LogOut, ClipboardList } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

export default function HeaderBar({
  activeView,
  setActiveView,
  darkMode,
  toggleDarkMode,
  onLogoClick,
  violationCount = 0,
  showViolations = false,
  showEdit = false,
  showAdmin = false,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const { user, profile, signOut } = useAuth();

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    setUserMenuOpen(false);
    // Race signOut against a timeout so the button never hangs if Supabase is slow
    try {
      await Promise.race([
        signOut(),
        new Promise(resolve => setTimeout(resolve, 3000)),
      ]);
    } catch (_) {
      // ignore
    }
    // Clear all Supabase auth data from localStorage
    try {
      const host = new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split('.')[0];
      localStorage.removeItem(`sb-${host}-auth-token`);
    } catch (_) {
      // ignore if URL parsing fails
    }
    // Fallback: clear any remaining sb-* keys
    Object.keys(localStorage)
      .filter(key => key.startsWith('sb-'))
      .forEach(key => localStorage.removeItem(key));
    window.location.reload();
  };

  const roleLabels = {
    admin: "Admin",
    program_director: "Program Director",
    chief_fellow: "Chief Fellow",
    fellow: "Fellow",
    resident: "Resident",
  };

  const views = [
    { key: "dashboard", label: "Home" },
    { key: "schedule", label: "Schedule" },
    { key: "stats", label: "Stats" },
    { key: "call", label: "Call/Float" },
    { key: "calendar", label: "Calendar" },
    { key: "clinic", label: "Clinic" },
    { key: "vacRequests", label: "Requests" },
    { key: "lectures", label: "Lectures" },
    ...(showEdit ? [{ key: "editSchedule", label: "Edit" }] : []),
    ...(showViolations ? [{ key: "violations", label: "Violations" }] : []),
    ...(showAdmin ? [{ key: "admin", label: "Admin" }] : []),
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
        <button onClick={onLogoClick} className="text-left text-xl md:text-2xl font-extrabold tracking-tight leading-none cursor-pointer">
          Fellow<span className="text-red-400 italic ml-[1px]">Shift</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleDarkMode}
            className={`p-2 rounded ${
              darkMode ? "hover:bg-gray-700 text-yellow-400" : "hover:bg-gray-200 text-gray-600"
            }`}
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Username + role */}
          {user && profile && (
            <div className="hidden sm:flex flex-col items-end leading-tight text-right">
              <span className="text-xs font-semibold truncate max-w-[130px]">
                {profile.full_name || profile.email}
              </span>
              {profile.role && (
                <span className={`text-[10px] ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                  {roleLabels[profile.role] || profile.role}
                </span>
              )}
            </div>
          )}

          {/* User menu (hamburger) */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className={`p-2 rounded ${
                darkMode ? "hover:bg-gray-700 text-gray-300" : "hover:bg-gray-200 text-gray-600"
              }`}
            >
              <AlignJustify className="w-4 h-4" />
            </button>

            {userMenuOpen && (
              <div className={`absolute right-0 mt-1 w-48 rounded-md shadow-lg border z-[60] ${
                darkMode
                  ? "bg-gray-800 border-gray-600"
                  : "bg-white border-gray-200"
              }`}>
                {user && profile && (
                  <div className={`px-3 py-2 border-b text-xs ${
                    darkMode ? "border-gray-600 text-gray-400" : "border-gray-100 text-gray-500"
                  }`}>
                    {profile.full_name || profile.email}
                  </div>
                )}

                <button
                  onClick={() => { setActiveView("profile"); setUserMenuOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm ${
                    darkMode ? "hover:bg-gray-700 text-gray-200" : "hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  <User className="w-4 h-4" /> Profile
                </button>

                <button
                  onClick={() => { setActiveView("vacRequests"); setUserMenuOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm ${
                    darkMode ? "hover:bg-gray-700 text-gray-200" : "hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  <FileText className="w-4 h-4" /> Requests
                </button>

                <a
                  href="https://github.com/jzstraley/fellowshift/blob/main/CHANGELOG"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setUserMenuOpen(false)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm ${
                    darkMode ? "hover:bg-gray-700 text-gray-200" : "hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  <ClipboardList className="w-4 h-4" /> Changelog
                </a>

                <button
                  onClick={() => { setActiveView("settings"); setUserMenuOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm ${
                    darkMode ? "hover:bg-gray-700 text-gray-200" : "hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  <Settings className="w-4 h-4" /> Settings
                </button>

                <div className={`border-t ${darkMode ? "border-gray-600" : "border-gray-100"}`} />

                {user ? (
                  <button
                    onClick={handleSignOut}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-b-md ${
                      darkMode ? "hover:bg-gray-700 text-red-400" : "hover:bg-gray-50 text-red-600"
                    }`}
                  >
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                ) : (
                  <button
                    onClick={() => { onLogoClick(); setUserMenuOpen(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-b-md ${
                      darkMode ? "hover:bg-gray-700 text-green-400" : "hover:bg-gray-50 text-green-600"
                    }`}
                  >
                    <LogIn className="w-4 h-4" /> Sign In
                  </button>
                )}
              </div>
            )}
          </div>

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
            className={`relative px-3 py-1.5 text-xs font-semibold rounded ${
              activeView === v.key
                ? "bg-blue-600 text-white"
                : darkMode
                ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            {v.label}
            {v.key === "violations" && violationCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 flex items-center justify-center text-[9px] font-bold text-white bg-red-500 rounded-full">
                {violationCount > 99 ? '99+' : violationCount}
              </span>
            )}
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
              className={`relative px-2 py-2 text-xs font-semibold rounded ${
                activeView === v.key
                  ? "bg-blue-600 text-white"
                  : darkMode
                  ? "bg-gray-700 text-gray-300"
                  : "bg-gray-200 text-gray-700"
              }`}
            >
              {v.label}
              {v.key === "violations" && violationCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-0.5 flex items-center justify-center text-[8px] font-bold text-white bg-red-500 rounded-full">
                  {violationCount > 99 ? '99+' : violationCount}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}