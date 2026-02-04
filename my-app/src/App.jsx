// src/App.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import ScheduleView from "./components/ScheduleView";
import StatsView from "./components/StatsView";
import CallView from "./components/CallView";
import CalendarView from "./components/CalendarView";
import HeaderBar from "./components/HeaderBar";
import ClinicCoverageView from "./components/ClinicCoverageView";
import { initialSchedule, initialVacations, pgyLevels, clinicDays, blockDates } from "./data/scheduleData";
import { generateCallAndFloat as runGenerator } from "./engine/callFloatGenerator";

const STORAGE_KEY = "fellowship_scheduler_v1";

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

export default function App() {
  const [activeView, setActiveView] = useState("schedule");
  const [violations, setViolations] = useState([]);

  const fellows = useMemo(() => Object.keys(initialSchedule), []);

  const persisted = useMemo(() => loadPersisted(), []);

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
      : {}
  );

  const [nightFloatSchedule, setNightFloatSchedule] = useState(
    persisted?.nightFloatSchedule && typeof persisted.nightFloatSchedule === "object"
      ? persisted.nightFloatSchedule
      : {}
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

      // Call on Sat + Sun
      if (c1.name) {
        map[w1SatISO] = { ...map[w1SatISO], call: c1.name };
        map[w1SunISO] = { ...map[w1SunISO], call: c1.name };
      }
      if (c2.name) {
        map[w2SatISO] = { ...map[w2SatISO], call: c2.name };
        map[w2SunISO] = { ...map[w2SunISO], call: c2.name };
      }

      // Float on Sat only
      if (f1.name) {
        map[w1SatISO] = { ...map[w1SatISO], float: f1.name };
      }
      if (f2.name) {
        map[w2SatISO] = { ...map[w2SatISO], float: f2.name };
      }
    }

    return map;
  }, [callSchedule, nightFloatSchedule]);

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

  const calculateStats = useCallback(() => {
    setStats((prev) => {
      const counts = {};
      fellows.forEach((f) => {
        const pgy = pgyLevels[f];
        counts[f] = {
          ai: 0, ai2: 0, cath: 0, cath2: 0, echo: 0, echo2: 0, ep: 0,
          floorA: 0, floorB: 0, icu: 0, nights: 0, nuclear: 0, nuclear2: 0,
          cts: 0, research: 0, structural: 0, vascular: 0, admin: 0, spc: 0, sum: 0,
          call: prev?.[f]?.call ?? 0,
          float: prev?.[f]?.float ?? 0,
          pgy,
        };

        schedule[f]?.forEach((rot) => {
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
    });
  }, [fellows, schedule]);

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

    setStats((prev) => {
      if (!prev) return prev;
      const next = { ...prev };
      fellows.forEach((f) => {
        next[f] = {
          ...next[f],
          call: result.callCounts?.[f] ?? 0,
          float: result.floatCounts?.[f] ?? 0,
        };
      });
      return next;
    });
  }, [fellows, schedule]);

  useEffect(() => {
    calculateStats();
  }, [calculateStats]);

  useEffect(() => {
    generateCallAndFloat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule]);

  const resetToDefaults = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSchedule(initialSchedule);
    setVacations(initialVacations);
    setCallSchedule({});
    setNightFloatSchedule({});
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

  return (
    <div className="min-h-screen bg-gray-50">
      <HeaderBar
        activeView={activeView}
        setActiveView={setActiveView}
        fellows={fellows}
        schedule={schedule}
        setSchedule={setSchedule}
        resetToDefaults={resetToDefaults}
        violations={violations}
        checkBalance={checkBalance}
      />

      <div className="p-3">
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
            onOptimize={generateCallAndFloat}
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
      </div>
    </div>
  );
}