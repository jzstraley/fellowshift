// src/components/HeaderBar.jsx
import { Menu, X, Moon, Sun, AlignJustify, User, FileText, Settings, LogIn, LogOut } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

export default function HeaderBar({
  activeView,
  setActiveView,
  darkMode,
  toggleDarkMode,
  onLogoClick,
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
    try {
      await signOut();
    } catch (err) {
      console.error('Sign out error:', err);
    }
    // Force reload to clear all state and return to clean start
    window.location.reload();
  };

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