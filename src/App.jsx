// src/App.jsx
import React, { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from "react";
import CheckCircle from "lucide-react/dist/esm/icons/check-circle";
import Shuffle from "lucide-react/dist/esm/icons/shuffle";
import HeaderBar from "./components/HeaderBar";
import ImportExportBar from "./components/ImportExportBar";
import CookieConsent from "./components/CookieConsent";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { initialSchedule, initialVacations, initialSwapRequests, pgyLevels, initialClinicDays, blockDates, initialCallSchedule, initialNightFloatSchedule, allRotationTypes } from "./data/scheduleData";
import { initialLectures, initialSpeakers, initialTopics } from "./data/lectureData";
import { generateCallAndFloat as runGenerator } from "./engine/callFloatGenerator";
import { checkAllWorkHourViolations } from "./engine/workHourChecker";
import { deriveKey, encryptAndStore, loadAndDecrypt, clearSensitiveStorage } from "./utils/secureStorage";
import {
  pushScheduleToSupabase, pullScheduleFromSupabase,
  pushCallFloatToSupabase, pullCallFloatFromSupabase,
  pullVacationsFromSupabase, pullSwapRequestsFromSupabase,
  pushLecturesToSupabase, pullLecturesFromSupabase,
  pushClinicDaysToSupabase, pullClinicDaysFromSupabase,
} from "./utils/scheduleSupabaseSync";

import useKeyboardShortcuts from "./hooks/useKeyboardShortcuts";
import useIdleTimeout from "./hooks/useIdleTimeout";

// ✅ LAZY LOAD ALL VIEWS
const LoginPage = lazy(() => import("./components/auth/LoginPage"));
const LandingPage = lazy(() => import("./components/LandingPage"));
const DashboardView = lazy(() => import("./components/DashboardView"));
const ScheduleView = lazy(() => import("./components/ScheduleView"));
const StatsView = lazy(() => import("./components/StatsView"));
const CallView = lazy(() => import("./components/CallView"));
const CalendarView = lazy(() => import("./components/CalendarView"));
const ClinicCoverageView = lazy(() => import("./components/ClinicCoverageView"));
const LectureCalendarView = lazy(() => import("./components/LectureCalendarView"));
const SpeakerTopicManager = lazy(() => import("./components/SpeakerTopicManager"));
const VacationsView = lazy(() => import("./components/VacationsView"));
const ViolationsView = lazy(() => import("./components/ViolationsView"));
const ScheduleEditorView = lazy(() => import("./components/ScheduleEditorView"));
const ProfileSettings = lazy(() => import("./components/ProfileSettings"));
const AdminView = lazy(() => import("./components/AdminView"));

const STORAGE_KEY = "fellowship_scheduler_v1";
const LECTURE_STORAGE_KEY = "fellowship_lectures_v1";

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
  const { signOut, profile, user, loading, isSupabaseConfigured, canApprove, isAdmin } = useAuth();
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

  const [activeView, setActiveView] = useState("dashboard");
  const [violations, setViolations] = useState([]);

  const fellows = useMemo(() => Object.keys(initialSchedule), []);

  // Encryption key derived from user ID — null until user is authenticated
  const cryptoKeyRef = useRef(null);
  const [dataReady, setDataReady] = useState(false);
  // Prevents the one-shot Supabase initial load from running more than once per session
  const supabaseInitLoadDoneRef = useRef(false);

  const [clinicDays, setClinicDays] = useState(initialClinicDays);
  const [schedule, setSchedule] = useState(initialSchedule);
  const [vacations, setVacations] = useState(initialVacations);
  const [swapRequests, setSwapRequests] = useState(initialSwapRequests);
  const [callSchedule, setCallSchedule] = useState(initialCallSchedule);
  const [nightFloatSchedule, setNightFloatSchedule] = useState(initialNightFloatSchedule);
  const [dayOverrides, setDayOverrides] = useState({});

  // Lecture system state
  const [lectures, setLectures] = useState(initialLectures);
  const [speakers, setSpeakers] = useState(initialSpeakers);
  const [topics, setTopics] = useState(initialTopics);

  // Derive encryption key and load persisted data when user becomes available
  useEffect(() => {
    if (!user?.id) {
      cryptoKeyRef.current = null;
      setDataReady(false);
      supabaseInitLoadDoneRef.current = false;
      return;
    }

    let cancelled = false;

    (async () => {
      const key = await deriveKey(user.id);
      if (cancelled) return;
      cryptoKeyRef.current = key;

      const persisted = await loadAndDecrypt(key, STORAGE_KEY);
      const persistedLectures = await loadAndDecrypt(key, LECTURE_STORAGE_KEY);

      if (cancelled) return;

      if (persisted?.schedule && typeof persisted.schedule === "object") setSchedule(persisted.schedule);
      if (Array.isArray(persisted?.vacations)) setVacations(persisted.vacations);
      if (Array.isArray(persisted?.swapRequests)) setSwapRequests(persisted.swapRequests);
      if (persisted?.callSchedule && typeof persisted.callSchedule === "object" && Object.keys(persisted.callSchedule).length > 0) setCallSchedule(persisted.callSchedule);
      if (persisted?.nightFloatSchedule && typeof persisted.nightFloatSchedule === "object" && Object.keys(persisted.nightFloatSchedule).length > 0) setNightFloatSchedule(persisted.nightFloatSchedule);
      if (persisted?.dayOverrides && typeof persisted.dayOverrides === "object") setDayOverrides(persisted.dayOverrides);
      if (persisted?.clinicDays && typeof persisted.clinicDays === "object" && Object.keys(persisted.clinicDays).length > 0) setClinicDays(persisted.clinicDays);

      if (Array.isArray(persistedLectures?.lectures)) setLectures(persistedLectures.lectures);
      if (Array.isArray(persistedLectures?.speakers)) setSpeakers(persistedLectures.speakers);
      if (Array.isArray(persistedLectures?.topics)) setTopics(persistedLectures.topics);

      setDataReady(true);
    })();

    return () => { cancelled = true; };
  }, [user?.id]);


  const [stats, setStats] = useState(null);

  // Debounced inputs for expensive violation checks to avoid recomputing on every keystroke
  const [debouncedInputs, setDebouncedInputs] = useState({
    schedule,
    callSchedule,
    nightFloatSchedule,
    vacations,
  });

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedInputs({ schedule, callSchedule, nightFloatSchedule, vacations });
    }, 300);
    return () => clearTimeout(t);
  }, [schedule, callSchedule, nightFloatSchedule, vacations]);

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

  // ACGME work-hour violation checker
  const workHourViolations = useMemo(() => {
    return checkAllWorkHourViolations({
      fellows,
      schedule: debouncedInputs.schedule,
      callSchedule: debouncedInputs.callSchedule,
      nightFloatSchedule: debouncedInputs.nightFloatSchedule,
      blockDates,
      vacations: debouncedInputs.vacations,
    });
  }, [fellows, debouncedInputs.schedule, debouncedInputs.callSchedule, debouncedInputs.nightFloatSchedule, debouncedInputs.vacations]);

  // Save schedule data (encrypted)
  useEffect(() => {
    if (!dataReady || !cryptoKeyRef.current) return;
    const t = setTimeout(() => {
      encryptAndStore(cryptoKeyRef.current, STORAGE_KEY, {
        schedule,
        vacations,
        swapRequests,
        callSchedule,
        nightFloatSchedule,
        dayOverrides,
        clinicDays,
      });
    }, 150);

    return () => clearTimeout(t);
  }, [schedule, vacations, swapRequests, callSchedule, nightFloatSchedule, dayOverrides, clinicDays, dataReady]);

  // Save lecture data (encrypted)
  useEffect(() => {
    if (!dataReady || !cryptoKeyRef.current) return;
    const t = setTimeout(() => {
      encryptAndStore(cryptoKeyRef.current, LECTURE_STORAGE_KEY, {
        lectures,
        speakers,
        topics,
      });
    }, 150);

    return () => clearTimeout(t);
  }, [lectures, speakers, topics, dataReady]);

  // One-shot Supabase load on sign-in — runs once after localStorage is ready and profile is available.
  // If the DB has no assignments yet, local state is preserved unchanged.
  useEffect(() => {
    if (!dataReady || !isSupabaseConfigured || !profile?.institution_id) return;
    if (supabaseInitLoadDoneRef.current) return;
    supabaseInitLoadDoneRef.current = true;

    Promise.all([
      pullScheduleFromSupabase({ fellows, blockDates, institutionId: profile.institution_id }),
      pullCallFloatFromSupabase({ institutionId: profile.institution_id }),
      pullVacationsFromSupabase({ institutionId: profile.institution_id }),
      pullSwapRequestsFromSupabase({ institutionId: profile.institution_id }),
      pullLecturesFromSupabase({ institutionId: profile.institution_id }),
      pullClinicDaysFromSupabase({ institutionId: profile.institution_id }),
    ]).then(([schedResult, callFloatResult, vacResult, swapResult, lectResult, clinicResult]) => {
      if (schedResult.schedule) {
        // Merge: apply non-empty Supabase rotations on top of current schedule.
        // Avoids wiping local data when Supabase only has partial records (e.g. vacation approvals).
        setSchedule(prev => {
          const merged = {};
          fellows.forEach(f => {
            const supaBlocks = schedResult.schedule[f] || [];
            const prevBlocks = prev[f] || [];
            merged[f] = prevBlocks.map((prevRot, idx) =>
              supaBlocks[idx] !== undefined && supaBlocks[idx] !== '' ? supaBlocks[idx] : prevRot
            );
          });
          return merged;
        });
      }
      if (callFloatResult.callSchedule) setCallSchedule(callFloatResult.callSchedule);
      if (callFloatResult.nightFloatSchedule) setNightFloatSchedule(callFloatResult.nightFloatSchedule);

      // Update stats to include call/float counts read from Supabase
      if (callFloatResult.callSchedule || callFloatResult.nightFloatSchedule) {
        const fresh = buildCounts(schedResult.schedule || schedule);
        const callCounts = {};
        const floatCounts = {};
        fellows.forEach(f => { callCounts[f] = 0; floatCounts[f] = 0; });
        const cs = callFloatResult.callSchedule || {};
        const fs = callFloatResult.nightFloatSchedule || {};
        Object.values(cs).forEach(e => { if (e?.name && callCounts[e.name] !== undefined) callCounts[e.name] += 1; });
        Object.values(fs).forEach(e => { if (e?.name && floatCounts[e.name] !== undefined) floatCounts[e.name] += 1; });
        fellows.forEach(f => { fresh[f].call = callCounts[f] ?? 0; fresh[f].float = floatCounts[f] ?? 0; });
        setStats(fresh);
      }
      if (vacResult.vacations) setVacations(vacResult.vacations);
      if (swapResult.swapRequests) setSwapRequests(swapResult.swapRequests);
      if (lectResult.lectures) setLectures(lectResult.lectures);
      if (lectResult.speakers) setSpeakers(lectResult.speakers);
      if (lectResult.topics) setTopics(lectResult.topics);
      if (clinicResult.clinicDays) setClinicDays(clinicResult.clinicDays);
    });
  // fellows and blockDates are stable module-level constants
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataReady, profile?.institution_id]);

  // Push the full schedule to Supabase — called by ScheduleEditorView's Validate button.
  const onSaveToSupabase = useCallback(async () => {
    if (!isSupabaseConfigured || !profile?.institution_id) return { error: 'Supabase not available' };
    // Push schedule first so it seeds the fellows table if empty, then run the rest in parallel.
    const schedResult = await pushScheduleToSupabase({
      schedule,
      fellows,
      blockDates,
      institutionId: profile.institution_id,
      userId: user?.id,
      pgyLevels,
    });
    if (schedResult.error) return { error: schedResult.error, count: 0 };
    const [callFloatResult, lectResult, clinicResult] = await Promise.all([
      pushCallFloatToSupabase({
        callSchedule,
        nightFloatSchedule,
        institutionId: profile.institution_id,
        userId: user?.id,
      }),
      pushLecturesToSupabase({
        lectures,
        speakers,
        topics,
        institutionId: profile.institution_id,
        userId: user?.id,
      }),
      pushClinicDaysToSupabase({
        clinicDays,
        institutionId: profile.institution_id,
      }),
    ]);
    const error = callFloatResult.error || lectResult.error || clinicResult.error || null;
    const count = (schedResult.count ?? 0) + (callFloatResult.count ?? 0) + (lectResult.count ?? 0);
    return { error, count };
  }, [schedule, callSchedule, nightFloatSchedule, lectures, speakers, topics, clinicDays, fellows, pgyLevels, profile?.institution_id, user?.id]);

  // Pull schedule from Supabase on demand — called by ScheduleEditorView's Sync button.
  const onPullFromSupabase = useCallback(async () => {
    if (!isSupabaseConfigured || !profile?.institution_id) return { error: 'Supabase not available', loaded: false };
    const [schedResult, callFloatResult, vacResult, swapResult, lectResult, clinicResult] = await Promise.all([
      pullScheduleFromSupabase({ fellows, blockDates, institutionId: profile.institution_id }),
      pullCallFloatFromSupabase({ institutionId: profile.institution_id }),
      pullVacationsFromSupabase({ institutionId: profile.institution_id }),
      pullSwapRequestsFromSupabase({ institutionId: profile.institution_id }),
      pullLecturesFromSupabase({ institutionId: profile.institution_id }),
      pullClinicDaysFromSupabase({ institutionId: profile.institution_id }),
    ]);
    const error = schedResult.error || callFloatResult.error || null;
    if (error) return { error, loaded: false };
    if (schedResult.schedule) {
      // Merge: apply non-empty Supabase rotations on top of current schedule.
      setSchedule(prev => {
        const merged = {};
        fellows.forEach(f => {
          const supaBlocks = schedResult.schedule[f] || [];
          const prevBlocks = prev[f] || [];
          merged[f] = prevBlocks.map((prevRot, idx) =>
            supaBlocks[idx] !== undefined && supaBlocks[idx] !== '' ? supaBlocks[idx] : prevRot
          );
        });
        return merged;
      });
    }
    if (callFloatResult.callSchedule) setCallSchedule(callFloatResult.callSchedule);
    if (callFloatResult.nightFloatSchedule) setNightFloatSchedule(callFloatResult.nightFloatSchedule);
    if (vacResult.vacations) setVacations(vacResult.vacations);
    if (swapResult.swapRequests) setSwapRequests(swapResult.swapRequests);
    if (lectResult.lectures) setLectures(lectResult.lectures);
    if (lectResult.speakers) setSpeakers(lectResult.speakers);
    if (lectResult.topics) setTopics(lectResult.topics);
    if (clinicResult.clinicDays) setClinicDays(clinicResult.clinicDays);
    const loaded = !!(schedResult.schedule || callFloatResult.callSchedule || callFloatResult.nightFloatSchedule
      || vacResult.vacations || swapResult.swapRequests || lectResult.lectures || clinicResult.clinicDays);
    // Ensure stats reflect call/float counts from Supabase after a manual pull
    if (callFloatResult.callSchedule || callFloatResult.nightFloatSchedule) {
      const fresh = buildCounts(schedResult.schedule || schedule);
      const callCounts = {};
      const floatCounts = {};
      fellows.forEach(f => { callCounts[f] = 0; floatCounts[f] = 0; });
      const cs = callFloatResult.callSchedule || {};
      const fs = callFloatResult.nightFloatSchedule || {};
      Object.values(cs).forEach(e => { if (e?.name && callCounts[e.name] !== undefined) callCounts[e.name] += 1; });
      Object.values(fs).forEach(e => { if (e?.name && floatCounts[e.name] !== undefined) floatCounts[e.name] += 1; });
      fellows.forEach(f => { fresh[f].call = callCounts[f] ?? 0; fresh[f].float = floatCounts[f] ?? 0; });
      setStats(fresh);
    }
    return { error: null, loaded };
  // fellows and blockDates are stable
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.institution_id]);

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

  const generateCallAndFloat = useCallback(async () => {
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

    // Persist relaxed flags to Supabase so they survive page reloads
    if (isSupabaseConfigured && profile?.institution_id) {
      await pushCallFloatToSupabase({
        callSchedule: result.callSchedule ?? {},
        nightFloatSchedule: result.nightFloatSchedule ?? {},
        institutionId: profile.institution_id,
        userId: user?.id,
      });
    }
  }, [fellows, schedule, isSupabaseConfigured, profile?.institution_id, user?.id]);

  // Debounced stats calculation when schedule changes to avoid frequent heavy work
  // Preserve call/float counts from the previous stats (set by generateCallAndFloat)
  useEffect(() => {
    const t = setTimeout(() => {
      setStats((prev) => {
        const fresh = buildCounts(schedule);
        if (prev) {
          Object.keys(fresh).forEach((f) => {
            fresh[f].call = prev[f]?.call ?? 0;
            fresh[f].float = prev[f]?.float ?? 0;
          });
        }
        return fresh;
      });
    }, 150);
    return () => clearTimeout(t);
  }, [schedule]);



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


  // Build views array for keyboard shortcuts (must stay in sync with HeaderBar)
  const viewsList = useMemo(() => {
    const base = [
      { key: "dashboard", label: "Home" },
      { key: "schedule", label: "Schedule" },
      { key: "call", label: "Call/Float" },
      { key: "calendar", label: "Calendar" },
      { key: "clinic", label: "Clinic" },
      { key: "vacRequests", label: "Requests" },
      { key: "lectures", label: "Lectures" },
    ];
    if (!isSupabaseConfigured || canApprove?.()) {
      base.splice(2, 0, { key: "stats", label: "Stats" });
      base.push({ key: "editSchedule", label: "Edit" });
      base.push({ key: "violations", label: "Violations" });
    }
    if (isAdmin?.()) {
      base.push({ key: "admin", label: "Admin" });
    }
    return base;
  }, [isSupabaseConfigured, canApprove, isAdmin]);

  useKeyboardShortcuts({ views: viewsList, setActiveView });

  // Idle timeout — signs out after 15 min of inactivity
  const handleIdleTimeout = useCallback(async () => {
    clearSensitiveStorage();
    await signOut();
    setShowLanding(true);
  }, [signOut]);

  const { showWarning: showIdleWarning, dismissWarning: dismissIdleWarning } = useIdleTimeout({
    onTimeout: handleIdleTimeout,
    enabled: !!user,
  });

  const [showLanding, setShowLanding] = useState(true);

  // Wait for auth to finish loading before deciding what to show
  if (loading) {
    return <ViewLoader />;
  }

  // Show landing or login when not authenticated — nothing renders behind this gate
  if (!user) {
    if (showLanding) {
      return (
        <Suspense fallback={<ViewLoader />}>
          <LandingPage onEnter={() => setShowLanding(false)} />
        </Suspense>
      );
    }
    return (
      <Suspense fallback={<ViewLoader />}>
        <LoginPage onLogoClick={() => setShowLanding(true)} />
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
        onSignOut={() => { clearSensitiveStorage(); setShowLanding(true); }}
        violationCount={workHourViolations.length}
        showStats={!isSupabaseConfigured || canApprove?.()}
        showViolations={!isSupabaseConfigured || canApprove?.()}
        showEdit={!isSupabaseConfigured || canApprove?.()}
        showAdmin={isAdmin?.()}
      />

      <div className="p-3 pb-16">
        <Suspense fallback={<ViewLoader />}>
          {activeView === "dashboard" && (
            <DashboardView
              fellows={fellows}
              schedule={schedule}
              callSchedule={callSchedule}
              nightFloatSchedule={nightFloatSchedule}
              blockDates={blockDates}
              lectures={lectures}
              vacations={vacations}
              swapRequests={swapRequests}
              workHourViolations={workHourViolations}
              setActiveView={setActiveView}
            />
          )}

          {activeView === "schedule" && (
            <ScheduleView
              fellows={fellows}
              schedule={schedule}
              vacations={vacations}
              workHourViolations={workHourViolations}
              clinicDays={clinicDays}
              blockDates={blockDates}
            />
          )}

          {activeView === "stats" && (!isSupabaseConfigured || canApprove?.()) && <StatsView stats={stats} fellows={fellows} />}

          {activeView === "call" && (
            <CallView
              callSchedule={callSchedule}
              nightFloatSchedule={nightFloatSchedule}
              stats={stats}
              fellows={fellows}
              pgyLevels={pgyLevels}
              workHourViolations={workHourViolations}
              showBalanceCheck={['program_director', 'admin'].includes(profile?.role)}
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
              canManageLectures={!isSupabaseConfigured || canApprove?.()}
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


          {activeView === "violations" && (!isSupabaseConfigured || canApprove?.()) && (
            <ViolationsView
              violations={workHourViolations}
              schedule={schedule}
              setSchedule={setSchedule}
              callSchedule={callSchedule}
              setCallSchedule={setCallSchedule}
              nightFloatSchedule={nightFloatSchedule}
              setNightFloatSchedule={setNightFloatSchedule}
              fellows={fellows}
              blockDates={blockDates}
              vacations={vacations}
            />
          )}

          {activeView === "editSchedule" && (!isSupabaseConfigured || canApprove?.()) && (
            <ScheduleEditorView
              fellows={fellows}
              schedule={schedule}
              setSchedule={setSchedule}
              callSchedule={callSchedule}
              setCallSchedule={setCallSchedule}
              nightFloatSchedule={nightFloatSchedule}
              setNightFloatSchedule={setNightFloatSchedule}
              dayOverrides={dayOverrides}
              setDayOverrides={setDayOverrides}
              pgyLevels={pgyLevels}
              blockDates={blockDates}
              clinicDays={clinicDays}
              vacations={vacations}
              workHourViolations={workHourViolations}
              isSupabaseConfigured={isSupabaseConfigured}
              onSaveToSupabase={isSupabaseConfigured ? onSaveToSupabase : null}
              onPullFromSupabase={isSupabaseConfigured ? onPullFromSupabase : null}
            />
          )}

          {(activeView === "profile" || activeView === "settings") && (
            <ProfileSettings darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
          )}

          {activeView === "admin" && isAdmin?.() && (
            <AdminView
              darkMode={darkMode}
              fellows={fellows}
              pgyLevels={pgyLevels}
              clinicDays={clinicDays}
              setClinicDays={setClinicDays}
            />
          )}

          {activeView === "vacRequests" && (
            <VacationsView
              fellows={fellows}
              schedule={schedule}
              vacations={vacations}
              swapRequests={swapRequests}
              callSchedule={callSchedule}
              nightFloatSchedule={nightFloatSchedule}
              setCallSchedule={setCallSchedule}
              setNightFloatSchedule={setNightFloatSchedule}
              clinicDays={clinicDays}
              pgyLevels={pgyLevels}
              setSchedule={setSchedule}
              setVacations={setVacations}
              setSwapRequests={setSwapRequests}
              isAdmin={true}
            />
          )}
        </Suspense>

        {/* Global Import/Export/Reset bar - non-dashboard views inline */}
        {activeView !== "vacRequests" && activeView !== "dashboard" && (
          <div className={`mt-4 p-3 rounded border ${
            darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-300"
          }`}>
            {/* Check Balance + Optimize Call/Float - admin/PD/chief only */}
            {(activeView === "call" || activeView === "clinic") && ['program_director', 'admin', 'chief_fellow'].includes(profile?.role) && (
              <div className="mb-3 pb-3 border-b border-gray-200 dark:border-gray-700 flex flex-wrap gap-2">
                <button
                  onClick={checkBalance}
                  className="w-full sm:w-auto flex items-center justify-center gap-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded"
                >
                  <CheckCircle className="w-3 h-3" />
                  Check Balance
                </button>
                {activeView === "call" && (
                  <button
                    onClick={generateCallAndFloat}
                    className="w-full sm:w-auto flex items-center justify-center gap-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded"
                  >
                    <Shuffle className="w-3 h-3" />
                    Optimize Call/Float
                  </button>
                )}
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
                violations={violations}
                showExportViolations={
                  activeView === "violations" &&
                  ['admin', 'program_director', 'chief_fellow'].includes(profile?.role)
                }
              />
            </div>
          </div>
        )}

        {/* Dashboard Import/Export — admin/PD/chief only, inline card below dashboard grid */}
        {activeView === "dashboard" && ['admin', 'program_director', 'chief_fellow'].includes(profile?.role) && (
          <div className="max-w-4xl mx-auto mt-5">
            <div className={`rounded-xl p-5 shadow-sm border ${
              darkMode
                ? "bg-gray-800 border-gray-700"
                : "bg-white border-gray-200"
            }`}>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                <span className={`text-xs font-semibold uppercase tracking-wider ${
                  darkMode ? "text-gray-400" : "text-gray-500"
                }`}>
                  Import / Export
                </span>
                <ImportExportBar
                  fellows={fellows}
                  schedule={schedule}
                  setSchedule={setSchedule}
                  violations={violations}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Idle timeout warning modal */}
      {showIdleWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={dismissIdleWarning}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-sm mx-4 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="text-lg font-bold mb-2 dark:text-gray-100">Session Expiring</div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              You will be signed out in 2 minutes due to inactivity.
            </p>
            <button
              onClick={dismissIdleWarning}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded"
            >
              Stay Signed In
            </button>
          </div>
        </div>
      )}

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