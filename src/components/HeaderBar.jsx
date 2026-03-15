// src/components/HeaderBar.jsx
import {
  Moon, Sun, CircleUser, User, Settings, LogIn, LogOut,
  ClipboardList, LayoutDashboard, Calendar, BookOpen, MoreHorizontal, X, MessageSquare, FileText, Bell,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import FeedbackModal from "./FeedbackModal";

// ── bottom nav definition (primary 4 + More) ─────────────────────────────────
const PRIMARY_NAV = [
  { key: "dashboard",   label: "Home",     Icon: LayoutDashboard },
  { key: "schedule",    label: "Schedule", Icon: ClipboardList },
  { key: "calendar",    label: "Calendar", Icon: Calendar },
  { key: "vacRequests", label: "Requests", Icon: FileText },
  { key: "lectures",    label: "Lectures", Icon: BookOpen },
];

// ── Notification dropdown component ─────────────────────────────────
function NotifDropdown({ notifications, onMarkAllRead, onClose }) {
  return (
    <div className="absolute right-0 top-12 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-gray-700">
        <span className="font-semibold text-sm dark:text-gray-100">Notifications</span>
        <button onClick={onMarkAllRead} className="text-xs text-blue-600 hover:underline dark:text-blue-400">
          Mark all read
        </button>
      </div>
      <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
        {notifications.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-gray-400 dark:text-gray-500">No notifications</div>
        ) : notifications.map(n => (
          <div key={n.id} className={`px-4 py-2.5 flex gap-2.5 ${n.read ? '' : 'bg-blue-50 dark:bg-blue-900/20'}`}>
            <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${n.read ? 'bg-transparent' : 'bg-blue-500'}`} />
            <div className="flex-1 min-w-0">
              <p className="text-xs dark:text-gray-100 leading-snug">{n.message}</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                {n.created_at ? new Date(n.created_at).toLocaleString() : ''}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HeaderBar({
  activeView,
  setActiveView,
  darkMode,
  toggleDarkMode,
  onLogoClick,
  onSignOut,
  violationCount = 0,
  requestBadgeCount = 0,
  showStats = false,
  showViolations = false,
  showEdit = false,
  showAdmin = false,
  notifCount = 0,
  notifications = [],
  onMarkAllRead,
}) {
  const [userMenuOpen,    setUserMenuOpen]    = useState(false);
  const [moreSheetOpen,  setMoreSheetOpen]   = useState(false);
  const [feedbackOpen,   setFeedbackOpen]    = useState(false);
  const [notifOpen,      setNotifOpen]       = useState(false);
  const userMenuRef = useRef(null);
  const moreSheetRef = useRef(null);
  const notifRef = useRef(null);
  const { user, profile, signOut, isSupabaseConfigured } = useAuth();

  const showNavTabs = !!user || !isSupabaseConfigured;

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
      if (moreSheetRef.current && !moreSheetRef.current.contains(e.target)) {
        setMoreSheetOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = () => {
    setUserMenuOpen(false);
    onSignOut?.();
    try {
      const host = new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split('.')[0];
      localStorage.removeItem(`sb-${host}-auth-token`);
    } catch (_) {}
    Object.keys(localStorage)
      .filter(key => key.startsWith('sb-'))
      .forEach(key => localStorage.removeItem(key));
    signOut().catch(() => {});
  };

  const navigate = (key) => {
    setActiveView(key);
    setMoreSheetOpen(false);
    setUserMenuOpen(false);
  };

  const roleLabels = {
    admin:            "Admin",
    program_director: "Program Director",
    chief_fellow:     "Chief Fellow",
    fellow:           "Fellow",
    resident:         "Resident",
  };

  // All views for desktop tabs + More sheet
  const allViews = [
    { key: "dashboard",   label: "Home" },
    { key: "schedule",    label: "Schedule" },
    { key: "calendar",    label: "Calendar" },
    ...(showStats       ? [{ key: "stats",       label: "Stats" }]       : []),
    { key: "call",        label: "Call/Float" },
    { key: "clinic",      label: "Clinic" },
    { key: "vacRequests", label: "Requests" },
    { key: "lectures",    label: "Lectures" },
    ...(showEdit        ? [{ key: "editSchedule", label: "Edit" }]        : []),
    ...(showViolations  ? [{ key: "violations",   label: "Violations" }]  : []),
    ...(showAdmin       ? [{ key: "admin",         label: "Admin" }]       : []),
  ];

  // "More" sheet: everything not in the primary 4
  const primaryKeys = PRIMARY_NAV.map(n => n.key);
  const moreViews = allViews.filter(v => !primaryKeys.includes(v.key));

  return (
    <>
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className={`border-b-2 sticky top-0 z-50 ${
        darkMode ? "bg-gray-900 border-gray-700 text-gray-100" : "bg-white border-gray-400 text-gray-800"
      }`}>
        {/* Title row */}
        <div className={`px-3 py-2 flex items-center justify-between ${
          darkMode ? "border-gray-700" : "border-gray-300"
        }`}>
          <button
            onClick={onLogoClick}
            className="text-left text-xl md:text-2xl font-extrabold tracking-tight leading-none cursor-pointer"
          >
            Fellow<span className="text-red-400 italic ml-[1px]">Shift</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleDarkMode}
              className={`w-11 h-11 flex items-center justify-center rounded transition-colors ${
                darkMode ? "text-gray-300 hover:text-white hover:bg-gray-700" : "text-gray-600 hover:text-gray-900 hover:bg-gray-200"
              }`}
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Notification bell */}
            {isSupabaseConfigured && (
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => setNotifOpen(o => !o)}
                  className={`relative w-11 h-11 flex items-center justify-center rounded transition-colors ${
                    darkMode ? "text-gray-300 hover:text-white hover:bg-gray-700" : "text-gray-600 hover:text-gray-900 hover:bg-gray-200"
                  }`}
                  aria-label="Notifications"
                >
                  <Bell className="w-5 h-5" />
                  {notifCount > 0 && (
                    <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {notifCount > 99 ? '99+' : notifCount}
                    </span>
                  )}
                </button>
                {notifOpen && <NotifDropdown notifications={notifications} onMarkAllRead={onMarkAllRead} onClose={() => setNotifOpen(false)} />}
              </div>
            )}

            {/* Username + role — desktop only */}
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

            {/* User menu */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className={`w-11 h-11 flex items-center justify-center rounded transition-colors ${
                  darkMode ? "text-gray-300 hover:text-white hover:bg-gray-700" : "text-gray-600 hover:text-gray-900 hover:bg-gray-200"
                }`}
              >
                <CircleUser className="w-4 h-4" />
              </button>

              {userMenuOpen && (
                <div className={`absolute right-0 mt-1 w-48 rounded-md shadow-lg border z-[60] ${
                  darkMode ? "bg-gray-800 border-gray-600" : "bg-white border-gray-200"
                }`}>
                  {user && profile && (
                    <div className={`px-3 py-2 border-b text-xs ${
                      darkMode ? "border-gray-600 text-gray-400" : "border-gray-100 text-gray-500"
                    }`}>
                      {profile.full_name || profile.email}
                    </div>
                  )}
                  <button
                    onClick={() => navigate("profile")}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm ${
                      darkMode ? "hover:bg-gray-700 text-gray-200" : "hover:bg-gray-50 text-gray-700"
                    }`}
                  >
                    <User className="w-4 h-4" /> Profile
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
                    onClick={() => navigate("settings")}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm ${
                      darkMode ? "hover:bg-gray-700 text-gray-200" : "hover:bg-gray-50 text-gray-700"
                    }`}
                  >
                    <Settings className="w-4 h-4" /> Settings
                  </button>
                  <button
                    onClick={() => { setFeedbackOpen(true); setUserMenuOpen(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm ${
                      darkMode ? "hover:bg-gray-700 text-gray-200" : "hover:bg-gray-50 text-gray-700"
                    }`}
                  >
                    <MessageSquare className="w-4 h-4" /> Send Feedback
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
          </div>
        </div>

        {/* Desktop tabs */}
        {showNavTabs && (
          <div className="hidden md:flex px-3 py-2 justify-center gap-2">
            {allViews.map((v) => (
              <button
                key={v.key}
                onClick={() => navigate(v.key)}
                className={`relative px-3 py-2.5 text-xs font-semibold rounded transition-colors ${
                  activeView === v.key
                    ? darkMode
                      ? "bg-gray-700/60 text-white border-b-2 border-red-400"
                      : "bg-gray-100 text-gray-900 border-b-2 border-red-500"
                    : darkMode
                    ? "bg-transparent text-gray-400 hover:bg-gray-700/40 hover:text-gray-200"
                    : "bg-transparent text-gray-600 hover:bg-gray-100/80 hover:text-gray-900"
                }`}
              >
                {v.label}
                {v.key === "violations" && violationCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 z-10 min-w-[16px] h-4 px-1 flex items-center justify-center text-[9px] font-bold text-white bg-red-500 rounded-full">
                    {violationCount > 99 ? '99+' : violationCount}
                  </span>
                )}
                {v.key === "vacRequests" && requestBadgeCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 z-10 min-w-[16px] h-4 px-1 flex items-center justify-center text-[9px] font-bold text-white bg-blue-500 rounded-full">
                    {requestBadgeCount > 99 ? '99+' : requestBadgeCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Mobile bottom nav ────────────────────────────────────────────── */}
      {showNavTabs && (
        <>
          {/* "More" sheet — slides up above the nav bar */}
          {moreSheetOpen && (
            <div
              className={`md:hidden fixed bottom-14 inset-x-0 z-40 border-t shadow-lg ${
                darkMode ? "bg-gray-900 border-gray-700" : "bg-white border-gray-200"
              }`}
              ref={moreSheetRef}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b-2" style={{borderColor: darkMode ? '#4b5563' : '#e5e7eb'}}>
                <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                  More
                </span>
                <button
                  onClick={() => setMoreSheetOpen(false)}
                  className="flex items-center justify-center w-11 h-11 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200/30 dark:hover:bg-gray-600/30 rounded transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className={`grid grid-cols-3 gap-3 p-4 rounded-lg m-3 ${
                darkMode ? "bg-gray-800/40" : "bg-gray-50/50"
              }`}>
                {moreViews.map((v) => (
                  <button
                    key={v.key}
                    onClick={() => navigate(v.key)}
                    className={`relative px-2 py-2.5 text-xs font-semibold rounded transition-colors min-h-[44px] flex items-center justify-center ${
                      activeView === v.key
                        ? darkMode
                          ? "bg-gray-700 text-white border-b border-red-400"
                          : "bg-white text-gray-900 border-b border-red-500 shadow-sm"
                        : darkMode
                        ? "bg-transparent text-gray-300 hover:bg-gray-700/40"
                        : "bg-transparent text-gray-600 hover:bg-white/60"
                    }`}
                  >
                    {v.label}
                    {v.key === "violations" && violationCount > 0 && (
                      <span className="absolute -top-1 -right-1 z-10 min-w-[14px] h-3.5 px-0.5 flex items-center justify-center text-[8px] font-bold text-white bg-red-500 rounded-full">
                        {violationCount > 99 ? '99+' : violationCount}
                      </span>
                    )}
                    {v.key === "vacRequests" && requestBadgeCount > 0 && (
                      <span className="absolute -top-1 -right-1 z-10 min-w-[14px] h-3.5 px-0.5 flex items-center justify-center text-[8px] font-bold text-white bg-blue-500 rounded-full">
                        {requestBadgeCount > 99 ? '99+' : requestBadgeCount}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Fixed bottom nav bar */}
          <nav className={`md:hidden fixed bottom-0 inset-x-0 z-50 border-t flex items-stretch ${
            darkMode ? "bg-gray-900 border-gray-700" : "bg-white border-gray-200"
          }`}
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            {PRIMARY_NAV.map(({ key, label, Icon }) => {
              const active = activeView === key;
              return (
                <button
                  key={key}
                  onClick={() => navigate(key)}
                  className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-semibold transition-colors border-b-2 ${
                    active
                      ? darkMode
                        ? "text-gray-100 border-red-400"
                        : "text-gray-900 border-red-500"
                      : darkMode
                      ? "text-gray-400 border-transparent hover:text-gray-200 hover:bg-gray-800/30"
                      : "text-gray-600 border-transparent hover:text-gray-900 hover:bg-gray-50/50"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {label}
                  {key === "vacRequests" && requestBadgeCount > 0 && (
                    <span className="absolute top-1 right-[calc(50%-16px)] min-w-[14px] h-3.5 px-0.5 flex items-center justify-center text-[8px] font-bold text-white bg-blue-500 rounded-full">
                      {requestBadgeCount > 99 ? '99+' : requestBadgeCount}
                    </span>
                  )}
                </button>
              );
            })}

            {/* More button */}
            <button
              onClick={() => setMoreSheetOpen(v => !v)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-semibold transition-colors border-b-2 ${
                moreSheetOpen || (!primaryKeys.includes(activeView))
                  ? darkMode
                    ? "text-gray-100 border-red-400"
                    : "text-gray-900 border-red-500"
                  : darkMode
                  ? "text-gray-400 border-transparent hover:text-gray-200 hover:bg-gray-800/30"
                  : "text-gray-600 border-transparent hover:text-gray-900 hover:bg-gray-50/50"
              }`}
            >
              <MoreHorizontal className="w-5 h-5" />
              More
            </button>
          </nav>
        </>
      )}

      {/* Feedback Modal */}
      {user && profile && isSupabaseConfigured && (
        <FeedbackModal
          open={feedbackOpen}
          onClose={() => setFeedbackOpen(false)}
          user={user}
          institutionId={profile.institution_id}
        />
      )}
    </>
  );
}
