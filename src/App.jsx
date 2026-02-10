// src/App.jsx
import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense } from "react";
import CheckCircle from "lucide-react/dist/esm/icons/check-circle";
import HeaderBar from "./components/HeaderBar";
import ImportExportBar from "./components/ImportExportBar";
import CookieConsent from "./components/CookieConsent";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { initialSchedule, initialVacations, pgyLevels, clinicDays, blockDates, initialCallSchedule, initialNightFloatSchedule } from "./data/scheduleData";
import { initialLectures, initialSpeakers, initialTopics } from "./data/lectureData";
import { generateCallAndFloat as runGenerator } from "./engine/callFloatGenerator";

// ✅ LAZY LOAD ALL VIEWS
const LoginPage = lazy(() => import("./components/auth/LoginPage"));
const LandingPage = lazy(() => import("./components/LandingPage"));
const ScheduleView = lazy(() => import("./components/ScheduleView"));
const StatsView = lazy(() => import("./components/StatsView"));
const CallView = lazy(() => import("./components/CallView"));
const CalendarView = lazy(() => import("./components/CalendarView"));
const ClinicCoverageView = lazy(() => import("./components/ClinicCoverageView"));
const LectureCalendarView = lazy(() => import("./components/LectureCalendarView"));
const SpeakerTopicManager = lazy(() => import("./components/SpeakerTopicManager"));
const GmailIntegration = lazy(() => import("./components/GmailIntegration"));
const VacationsView = lazy(() => import("./components/VacationsView"));
const ProfileSettings = lazy(() => import("./components/ProfileSettings"));

const STORAGE_KEY = "fellowship_scheduler_v1";
const LECTURE_STORAGE_KEY = "fellowship_lectures_v1";

const safeParse = (s) => {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};

const loadPersisted = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  return safeParse(raw);
};

const savePersisted = (payload) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
};

const loadLectureData = () => {
  const raw = localStorage.getItem(LECTURE_STORAGE_KEY);
  if (!raw) return null;
  return safeParse(raw);
};

const saveLectureData = (payload) => {
  localStorage.setItem(LECTURE_STORAGE_KEY, JSON.stringify(payload));
};

// Loading fallback component
const ViewLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
);

// Subtle footer
const Footer = () => (
  <footer className="py-1 text-center text-[9px] text-gray-300">
    © {new Date().getFullYear()} Austin Straley
  </footer>
);

function AppContent() {
  const { signOut, profile, user, loading, isSupabaseConfigured } = useAuth();
  // Dark mode state
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("fellowshift_darkmode");
    return saved === "true";
  });

  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem("fellowshift_darkmode", next);
      return next;
    });
  };

  // Apply dark mode to document
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    // Update favicon to match dark mode immediately. Replace the link element
    // (some browsers only pick up new favicon elements, not href changes).
    try {
      const updateFavicon = (href) => {
        const head = document.getElementsByTagName('head')[0];
        if (!head) return;
        const existing = document.getElementById('site-favicon') || head.querySelector('link[rel~="icon"]');
        const el = document.createElement('link');
        el.id = 'site-favicon';
        el.rel = 'icon';
        el.href = href;
        // append new and remove old to force refresh
        head.appendChild(el);
        if (existing && existing !== el) head.removeChild(existing);
      };

      updateFavicon(darkMode ? '/favicon-dark.ico' : '/favicon-light.ico');
    } catch (e) {
      // ignore in non-browser environments
    }
  }, [darkMode]);

  const [activeView, setActiveView] = useState("schedule");
  const [violations, setViolations] = useState([]);

  const fellows = useMemo(() => Object.keys(initialSchedule), []);

  const persisted = useMemo(() => loadPersisted(), []);
  const persistedLectures = useMemo(() => loadLectureData(), []);

  const [schedule, setSchedule] = useState(
    persisted?.schedule && typeof persisted.schedule === "object"
      ? persisted.schedule
      : initialSchedule
  );

  const [vacations, setVacations] = useState(
    Array.isArray(persisted?.vacations) ? persisted.vacations : initialVacations
  );

  const [callSchedule, setCallSchedule] = useState(
    persisted?.callSchedule && typeof persisted.callSchedule === "object"
      ? persisted.callSchedule
      : initialCallSchedule
  );

  const [nightFloatSchedule, setNightFloatSchedule] = useState(
    persisted?.nightFloatSchedule && typeof persisted.nightFloatSchedule === "object"
      ? persisted.nightFloatSchedule
      : initialNightFloatSchedule
  );

  // Lecture system state
  const [lectures, setLectures] = useState(
    Array.isArray(persistedLectures?.lectures)
      ? persistedLectures.lectures
      : initialLectures
  );

  const [speakers, setSpeakers] = useState(
    Array.isArray(persistedLectures?.speakers)
      ? persistedLectures.speakers
      : initialSpeakers
  );

  const [topics, setTopics] = useState(
    Array.isArray(persistedLectures?.topics)
      ? persistedLectures.topics
      : initialTopics
  );

  // Fellow emails for Gmail integration
  const [fellowEmails, setFellowEmails] = useState(
    persistedLectures?.fellowEmails || {}
  );

  const [stats, setStats] = useState(null);

  // Build dateCallMap from callSchedule and nightFloatSchedule
  const dateCallMap = useMemo(() => {
    const map = {};

    const toLocalNoon = (d) => {
      const x = new Date(d);
      x.setHours(12, 0, 0, 0);
      return x;
    };

    const toISODate = (d) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    const addDays = (d, n) => {
      const x = toLocalNoon(d);
      x.setDate(x.getDate() + n);
      return x;
    };

    const getBlockWeekendSaturdays = (blockStart) => {
      const start = toLocalNoon(blockStart);
      const day = start.getDay();
      const daysUntilSat = (6 - day + 7) % 7;
      const sat1 = addDays(start, daysUntilSat);
      const sat2 = addDays(sat1, 7);
      return { sat1, sat2 };
    };

    const getCallEntry = (sched, key) => {
      const v = sched?.[key];
      if (!v) return { name: null };
      if (typeof v === "string") return { name: v };
      if (typeof v === "object") return { name: v.name ?? v.call ?? null };
      return { name: null };
    };

    const getFloatEntry = (sched, key) => {
      const v = sched?.[key];
      if (!v) return { name: null };
      if (typeof v === "string") return { name: v };
      if (typeof v === "object") return { name: v.name ?? null };
      return { name: null };
    };

    for (let i = 0; i < 26; i++) {
      const blockStart = new Date(blockDates[i].start);
      const { sat1, sat2 } = getBlockWeekendSaturdays(blockStart);

      const w1Key = `B${i + 1}-W1`;
      const w2Key = `B${i + 1}-W2`;

      const c1 = getCallEntry(callSchedule, w1Key);
      const c2 = getCallEntry(callSchedule, w2Key);
      const f1 = getFloatEntry(nightFloatSchedule, w1Key);
      const f2 = getFloatEntry(nightFloatSchedule, w2Key);

      const w1SatISO = toISODate(sat1);
      const w1SunISO = toISODate(addDays(sat1, 1));
      const w2SatISO = toISODate(sat2);
      const w2SunISO = toISODate(addDays(sat2, 1));

      if (c1.name) {
        map[w1SatISO] = { ...map[w1SatISO], call: c1.name };
        map[w1SunISO] = { ...map[w1SunISO], call: c1.name };
      }
      if (c2.name) {
        map[w2SatISO] = { ...map[w2SatISO], call: c2.name };
        map[w2SunISO] = { ...map[w2SunISO], call: c2.name };
      }

      if (f1.name) {
        map[w1SatISO] = { ...map[w1SatISO], float: f1.name };
      }
      if (f2.name) {
        map[w2SatISO] = { ...map[w2SatISO], float: f2.name };
      }
    }

    return map;
  }, [callSchedule, nightFloatSchedule]);

  // Save schedule data
  useEffect(() => {
    const t = setTimeout(() => {
      savePersisted({
        schedule,
        vacations,
        callSchedule,
        nightFloatSchedule,
      });
    }, 150);

    return () => clearTimeout(t);
  }, [schedule, vacations, callSchedule, nightFloatSchedule]);

  // Save lecture data
  useEffect(() => {
    const t = setTimeout(() => {
      saveLectureData({
        lectures,
        speakers,
        topics,
        fellowEmails,
      });
    }, 150);

    return () => clearTimeout(t);
  }, [lectures, speakers, topics, fellowEmails]);

  // Build stats object synchronously from a schedule snapshot.
  const buildCounts = (sched) => {
    const counts = {};
    fellows.forEach((f) => {
      const pgy = pgyLevels[f];
      counts[f] = {
        ai: 0, ai2: 0, cath: 0, cath2: 0, echo: 0, echo2: 0, ep: 0,
        floorA: 0, floorB: 0, icu: 0, nights: 0, nuclear: 0, nuclear2: 0,
        cts: 0, research: 0, structural: 0, vascular: 0, admin: 0, spc: 0, sum: 0,
        call: 0,
        float: 0,
        pgy,
      };

      (sched[f] || []).forEach((rot) => {
        if (!rot) return;
        counts[f].sum++;

        if (rot === "AI") counts[f].ai++;
        else if (rot === "AI 2" || rot === "AI 3") counts[f].ai2++;
        else if (rot === "Cath") counts[f].cath++;
        else if (rot.includes("Cath 2") || rot.includes("Cath 3")) counts[f].cath2++;
        else if (rot === "Echo") counts[f].echo++;
        else if (rot === "Echo 2") counts[f].echo2++;
        else if (rot === "EP") counts[f].ep++;
        else if (rot === "Floor A") counts[f].floorA++;
        else if (rot === "Floor B") counts[f].floorB++;
        else if (rot === "ICU") counts[f].icu++;
        else if (rot === "Nights") counts[f].nights++;
        else if (rot === "Nuclear") counts[f].nuclear++;
        else if (rot === "Nuclear 2") counts[f].nuclear2++;
        else if (rot === "CTS") counts[f].cts++;
        else if (rot.includes("Research")) counts[f].research++;
        else if (rot === "Structural") counts[f].structural++;
        else if (rot === "Vascular") counts[f].vascular++;
        else if (rot === "Admin") counts[f].admin++;
        else if (rot === "SPC") counts[f].spc++;
      });
    });

    return counts;
  };

  const generateCallAndFloat = useCallback(() => {
    const callTargets = { 4: 5, 5: 4, 6: 2 };
    const floatTargets = { 4: 5, 5: 4, 6: 3 };

    const result = runGenerator({
      fellows,
      schedule,
      pgyLevels,
      callTargets,
      floatTargets,
    });

    if (!result) return;

    setCallSchedule(result.callSchedule ?? {});
    setNightFloatSchedule(result.nightFloatSchedule ?? {});
    setViolations(result.violations ?? []);

    // Build fresh stats from the current schedule and merge call/float counts
    const fresh = buildCounts(schedule);
    fellows.forEach((f) => {
      fresh[f].call = result.callCounts?.[f] ?? 0;
      fresh[f].float = result.floatCounts?.[f] ?? 0;
    });
    setStats(fresh);
  }, [fellows, schedule]);

  // Small debounce utility for UI-triggered heavy actions so users can't spam-run generator
  const debounce = (fn, wait = 500) => {
    let timer = null;
    return (...args) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        try {
          fn(...args);
        } catch (e) {
          console.error('Debounced function error', e);
        }
      }, wait);
    };
  };

  // Expose a debounced version for UI hooks (so clicking optimize repeatedly won't spam the generator)
  const debouncedGenerate = useMemo(() => debounce(generateCallAndFloat, 750), [generateCallAndFloat]);

  // Debounced stats calculation when schedule changes to avoid frequent heavy work
  useEffect(() => {
    const t = setTimeout(() => {
      setStats(buildCounts(schedule));
    }, 150);
    return () => clearTimeout(t);
  }, [schedule]);

  // Run generator once on mount to produce initial call/float base output.
  // Users can still optimize manually; this prevents repeated automatic runs.
  useEffect(() => {
    generateCallAndFloat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetToDefaults = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LECTURE_STORAGE_KEY);
    setSchedule(initialSchedule);
    setVacations(initialVacations);
    setCallSchedule({});
    setNightFloatSchedule({});
    setLectures(initialLectures);
    setSpeakers(initialSpeakers);
    setTopics(initialTopics);
    setFellowEmails({});
  }, []);

  const checkBalance = useCallback(() => {
    if (!stats) return;

    const pgy4 = fellows.filter((f) => pgyLevels[f] === 4);
    const pgy5 = fellows.filter((f) => pgyLevels[f] === 5);
    const pgy6 = fellows.filter((f) => pgyLevels[f] === 6);

    const issues = [];

    const pgy4Nights = pgy4.map((f) => stats[f]?.nights ?? 0);
    const pgy4ICU = pgy4.map((f) => stats[f]?.icu ?? 0);
    const pgy4FloorA = pgy4.map((f) => stats[f]?.floorA ?? 0);
    const pgy4FloorB = pgy4.map((f) => stats[f]?.floorB ?? 0);

    if (new Set(pgy4Nights).size > 1) issues.push('PGY-4 Nights not balanced');
    if (new Set(pgy4ICU).size > 1) issues.push('PGY-4 ICU not balanced');
    if (new Set(pgy4FloorA).size > 1) issues.push('PGY-4 Floor A not balanced');
    if (new Set(pgy4FloorB).size > 1) issues.push('PGY-4 Floor B not balanced');

    const pgy5Nights = pgy5.map((f) => stats[f]?.nights ?? 0);
    const pgy5ICU = pgy5.map((f) => stats[f]?.icu ?? 0);
    const pgy5FloorA = pgy5.map((f) => stats[f]?.floorA ?? 0);
    const pgy5FloorB = pgy5.map((f) => stats[f]?.floorB ?? 0);

    if (new Set(pgy5Nights).size > 1) issues.push('PGY-5 Nights not balanced');
    if (new Set(pgy5ICU).size > 1) issues.push('PGY-5 ICU not balanced');
    if (new Set(pgy5FloorA).size > 1) issues.push('PGY-5 Floor A not balanced');
    if (new Set(pgy5FloorB).size > 1) issues.push('PGY-5 Floor B not balanced');

    pgy6.forEach((f) => {
      const s = stats[f] ?? {};
      if ((s.nights ?? 0) < 2) issues.push(`${f} needs 2 nights blocks`);
      const coreBlocks = (s.icu ?? 0) + (s.floorA ?? 0) + (s.floorB ?? 0);
      if (coreBlocks < 1) issues.push(`${f} needs 1 ICU/Floor block`);
    });

    const callTargets = { 4: 5, 5: 4, 6: 2 };
    const floatTargets = { 4: 5, 5: 4, 6: 3 };

    fellows.forEach((f) => {
      const pgy = pgyLevels[f];
      const s = stats[f] ?? {};
      if ((s.call ?? 0) !== callTargets[pgy]) issues.push(`${f} call: ${(s.call ?? 0)}/${callTargets[pgy]}`);
      if ((s.float ?? 0) !== floatTargets[pgy]) issues.push(`${f} float: ${(s.float ?? 0)}/${floatTargets[pgy]}`);
    });

    if (issues.length === 0) {
      alert('✅ Perfect Balance!\n\nAll rotations, call, and float are balanced correctly.');
    } else {
      alert('⚠️ Balance Issues:\n\n' + issues.join('\n'));
    }
  }, [stats, fellows]);

  const handleReminderSent = (lectureId) => {
    setLectures(
      lectures.map((l) =>
        l.id === lectureId ? { ...l, reminderSent: true } : l
      )
    );
  };

  const [showLanding, setShowLanding] = useState(true);

  if (showLanding) {
    return (
      <Suspense fallback={<ViewLoader />}>
        <LandingPage onEnter={() => setShowLanding(false)} />
      </Suspense>
    );
  }

  // Wait for auth to finish loading before deciding what to show
  if (loading) {
    return <ViewLoader />;
  }

  // After landing page, check auth before showing the main app
  if (isSupabaseConfigured && !user) {
    return (
      <Suspense fallback={<ViewLoader />}>
        <LoginPage />
      </Suspense>
    );
  }

  return (
    <div className={`min-h-screen ${darkMode ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-800"}`}>
      <HeaderBar
        activeView={activeView}
        setActiveView={setActiveView}
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
        onLogoClick={() => setShowLanding(true)}
      />

      <div className="p-3 pb-16">
        <Suspense fallback={<ViewLoader />}>
          {activeView === "schedule" && (
            <ScheduleView
              fellows={fellows}
              schedule={schedule}
              vacations={vacations}
              onScheduleChange={setSchedule}
              onVacationsChange={setVacations}
            />
          )}

          {activeView === "stats" && <StatsView stats={stats} fellows={fellows} />}

          {activeView === "call" && (
            <CallView
              callSchedule={callSchedule}
              nightFloatSchedule={nightFloatSchedule}
              stats={stats}
              fellows={fellows}
              pgyLevels={pgyLevels}
              onOptimize={debouncedGenerate}
            />
          )}

          {activeView === "calendar" && (
            <CalendarView
              fellows={fellows}
              schedule={schedule}
              dateCallMap={dateCallMap}
            />
          )}

          {activeView === "clinic" && (
            <ClinicCoverageView
              fellows={fellows}
              schedule={schedule}
              clinicDays={clinicDays}
              pgyLevels={pgyLevels}
              blockDates={blockDates}
            />
          )}

          {activeView === "lectures" && (
            <LectureCalendarView
              lectures={lectures}
              setLectures={setLectures}
              speakers={speakers}
              topics={topics}
              fellows={fellows}
              darkMode={darkMode}
              onSendReminder={(lecture) => {
                console.log("Send reminder for:", lecture);
              }}
            />
          )}

          {activeView === "speakers" && (
            <SpeakerTopicManager
              speakers={speakers}
              setSpeakers={setSpeakers}
              topics={topics}
              setTopics={setTopics}
              darkMode={darkMode}
            />
          )}

          {activeView === "gmail" && (
            <GmailIntegration
              lectures={lectures}
              speakers={speakers}
              fellows={fellows}
              fellowEmails={fellowEmails}
              darkMode={darkMode}
              onReminderSent={handleReminderSent}
            />
          )}

          {(activeView === "profile" || activeView === "settings") && (
            <ProfileSettings darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
          )}

          {activeView === "vacRequests" && (
            <VacationsView
              fellows={fellows}
              schedule={schedule}
              vacations={vacations}
              setSchedule={setSchedule}
              setVacations={setVacations}
              isAdmin={true}
            />
          )}
        </Suspense>

        {/* Global Import/Export/Reset bar - hidden on vacations */}
        {activeView !== "vacRequests" && (
          <div className={`mt-4 p-3 rounded border ${
            darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-300"
          }`}>
            {/* Check Balance - only on call and clinic */}
            {(activeView === "call" || activeView === "clinic") && (
              <div className="mb-3 pb-3 border-b border-gray-200 dark:border-gray-700">
                <button
                  onClick={checkBalance}
                  className="w-full sm:w-auto flex items-center justify-center gap-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded"
                >
                  <CheckCircle className="w-3 h-3" />
                  Check Balance
                </button>
              </div>
            )}
            
            {/* Import/Export - stacked on mobile */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
              <span className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                Import/Export
              </span>
              <ImportExportBar
                fellows={fellows}
                schedule={schedule}
                setSchedule={setSchedule}
                resetToDefaults={resetToDefaults}
                violations={violations}
              />
            </div>
          </div>
        )}
      </div>

      <Footer />
      <CookieConsent />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}