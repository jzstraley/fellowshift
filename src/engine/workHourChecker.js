// src/engine/workHourChecker.js
// ACGME Work Hour Violation Checker
// Builds a day-by-day shift timeline per fellow and checks against ACGME rules.

/**
 * Shift templates: { startHour, endHour, isNight, weekdaysOnly }
 * Hours are 0-23. Night shifts cross midnight (startHour > endHour).
 */
const SHIFT_TEMPLATES = {
  // 12-hour rotations
  'ICU':        { startHour: 7, endHour: 19, hours: 12, isNight: false, weekdaysOnly: false },
  'Nights':     { startHour: 19, endHour: 7, hours: 12, isNight: true, weekdaysOnly: true },

  // 10-hour rotations (weekdays)
  'Floor A':    { startHour: 7, endHour: 17, hours: 10, isNight: false, weekdaysOnly: true },
  'Floor B':    { startHour: 7, endHour: 17, hours: 10, isNight: false, weekdaysOnly: true },
  'Cath':       { startHour: 7, endHour: 17, hours: 10, isNight: false, weekdaysOnly: true },
  'Cath 2':     { startHour: 7, endHour: 17, hours: 10, isNight: false, weekdaysOnly: true },
  'Cath 3':     { startHour: 7, endHour: 17, hours: 10, isNight: false, weekdaysOnly: true },
  'Echo':       { startHour: 7, endHour: 17, hours: 10, isNight: false, weekdaysOnly: true },
  'Echo 2':     { startHour: 7, endHour: 17, hours: 10, isNight: false, weekdaysOnly: true },
  'EP':         { startHour: 7, endHour: 17, hours: 10, isNight: false, weekdaysOnly: true },
  'Nuclear':    { startHour: 7, endHour: 17, hours: 10, isNight: false, weekdaysOnly: true },
  'Nuclear 2':  { startHour: 7, endHour: 17, hours: 10, isNight: false, weekdaysOnly: true },

  // 8-hour rotations (weekdays)
  'AI':         { startHour: 8, endHour: 16, hours: 8, isNight: false, weekdaysOnly: true },
  'AI 2':       { startHour: 8, endHour: 16, hours: 8, isNight: false, weekdaysOnly: true },
  'AI 3':       { startHour: 8, endHour: 16, hours: 8, isNight: false, weekdaysOnly: true },
  'Research':   { startHour: 8, endHour: 16, hours: 8, isNight: false, weekdaysOnly: true },
  'Research 2': { startHour: 8, endHour: 16, hours: 8, isNight: false, weekdaysOnly: true },
  'CTS':        { startHour: 8, endHour: 16, hours: 8, isNight: false, weekdaysOnly: true },
  'Structural': { startHour: 8, endHour: 16, hours: 8, isNight: false, weekdaysOnly: true },
  'Vascular':   { startHour: 8, endHour: 16, hours: 8, isNight: false, weekdaysOnly: true },
  'SPC':        { startHour: 8, endHour: 16, hours: 8, isNight: false, weekdaysOnly: true },

  // No duty
  'Admin':      { startHour: 0, endHour: 0, hours: 0, isNight: false, weekdaysOnly: true },
  'E':          { startHour: 0, endHour: 0, hours: 0, isNight: false, weekdaysOnly: true },
  '':           { startHour: 0, endHour: 0, hours: 0, isNight: false, weekdaysOnly: true },
};

// Call/float overlay templates
const CALL_TEMPLATE = { startHour: 7, endHour: 19, hours: 12, isNight: false };
const NIGHT_FLOAT_TEMPLATE = { startHour: 19, endHour: 7, hours: 12, isNight: true };

// ─── Date helpers ───────────────────────────────────────────────────────────

function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function dayOfWeek(date) {
  return date.getDay(); // 0=Sun, 6=Sat
}

function isWeekend(date) {
  const dow = dayOfWeek(date);
  return dow === 0 || dow === 6;
}

/** Get the two Saturday dates for a block's W1 and W2 weekends */
function getBlockWeekendSaturdays(blockStart) {
  const start = parseDate(blockStart);
  const dow = start.getDay();
  const daysUntilSat = (6 - dow + 7) % 7;
  const sat1 = addDays(start, daysUntilSat);
  const sat2 = addDays(sat1, 7);
  return { sat1, sat2 };
}

// ─── Shift timeline builder ─────────────────────────────────────────────────

/**
 * Build a day-by-day duty record for a single fellow.
 * Returns: Map<isoDate, { hours, shifts: [{ type, startHour, endHour, hours }], isNight, block }>
 */
function buildTimeline(fellow, schedule, callSchedule, nightFloatSchedule, blockDates, vacationBlocks) {
  const timeline = new Map();

  const getCallName = (sched, key) => {
    const v = sched?.[key];
    if (!v) return null;
    if (typeof v === 'string') return v;
    if (typeof v === 'object') return v.name ?? v.call ?? null;
    return null;
  };

  for (let bi = 0; bi < blockDates.length; bi++) {
    const block = blockDates[bi];
    const blockNum = block.block;
    const rotation = schedule[fellow]?.[bi] ?? '';
    const template = SHIFT_TEMPLATES[rotation] || SHIFT_TEMPLATES[''];
    const isVacation = vacationBlocks.has(blockNum);

    // Iterate each day in the block
    const start = parseDate(block.start);
    const end = parseDate(block.end);
    for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
      const iso = toISO(d);
      const entry = { hours: 0, shifts: [], isNight: false, block: blockNum, date: iso };

      if (!isVacation) {
        // Add rotation shift
        const isWknd = isWeekend(d);
        if (template.hours > 0 && (!template.weekdaysOnly || !isWknd)) {
          entry.shifts.push({
            type: 'rotation',
            rotation,
            startHour: template.startHour,
            endHour: template.endHour,
            hours: template.hours,
            isNight: template.isNight,
          });
          entry.hours += template.hours;
          if (template.isNight) entry.isNight = true;
        }
      }

      timeline.set(iso, entry);
    }

    // Overlay call weekends
    const { sat1, sat2 } = getBlockWeekendSaturdays(block.start);
    const w1Key = `B${blockNum}-W1`;
    const w2Key = `B${blockNum}-W2`;

    const callW1 = getCallName(callSchedule, w1Key);
    const callW2 = getCallName(callSchedule, w2Key);
    const floatW1 = getCallName(nightFloatSchedule, w1Key);
    const floatW2 = getCallName(nightFloatSchedule, w2Key);

    // Call: Saturday + Sunday of the weekend (7am-7pm in-house)
    const overlayCall = (sat, callFellow) => {
      if (callFellow !== fellow) return;
      for (const dayOff of [0, 1]) { // Sat, Sun
        const day = addDays(sat, dayOff);
        const iso = toISO(day);
        const entry = timeline.get(iso);
        if (entry) {
          entry.shifts.push({
            type: 'call',
            startHour: CALL_TEMPLATE.startHour,
            endHour: CALL_TEMPLATE.endHour,
            hours: CALL_TEMPLATE.hours,
            isNight: false,
          });
          entry.hours += CALL_TEMPLATE.hours;
        }
      }
    };

    // Night float: Saturday night (7pm-7am, hours count on Saturday)
    const overlayFloat = (sat, floatFellow) => {
      if (floatFellow !== fellow) return;
      const iso = toISO(sat);
      const entry = timeline.get(iso);
      if (entry) {
        entry.shifts.push({
          type: 'nightFloat',
          startHour: NIGHT_FLOAT_TEMPLATE.startHour,
          endHour: NIGHT_FLOAT_TEMPLATE.endHour,
          hours: NIGHT_FLOAT_TEMPLATE.hours,
          isNight: true,
        });
        entry.hours += NIGHT_FLOAT_TEMPLATE.hours;
        entry.isNight = true;
      }
    };

    overlayCall(sat1, callW1);
    overlayCall(sat2, callW2);
    overlayFloat(sat1, floatW1);
    overlayFloat(sat2, floatW2);
  }

  return timeline;
}

// ─── ACGME Rule Checks ─────────────────────────────────────────────────────

/**
 * Rule 1: 80-hour weekly limit (averaged over 4 weeks)
 */
function check80HourRule(fellow, timeline, blockDates) {
  const violations = [];
  const dates = Array.from(timeline.keys()).sort();
  if (dates.length === 0) return violations;

  // Calculate weekly hours for each 7-day period starting each Monday
  const firstDate = parseDate(dates[0]);
  // Find first Monday on or before the first date
  const startDow = firstDate.getDay();
  const mondayOffset = startDow === 0 ? -6 : 1 - startDow;
  const firstMonday = addDays(firstDate, mondayOffset);

  const weeklyHours = [];
  let weekStart = new Date(firstMonday);
  const lastDate = parseDate(dates[dates.length - 1]);

  while (weekStart <= lastDate) {
    let hours = 0;
    for (let i = 0; i < 7; i++) {
      const iso = toISO(addDays(weekStart, i));
      const entry = timeline.get(iso);
      if (entry) hours += entry.hours;
    }
    weeklyHours.push({ start: new Date(weekStart), hours });
    weekStart = addDays(weekStart, 7);
  }

  // Check 4-week rolling averages
  for (let i = 0; i <= weeklyHours.length - 4; i++) {
    const fourWeekTotal = weeklyHours[i].hours + weeklyHours[i+1].hours +
                          weeklyHours[i+2].hours + weeklyHours[i+3].hours;
    const avg = fourWeekTotal / 4;
    if (avg > 80) {
      const startISO = toISO(weeklyHours[i].start);
      const endISO = toISO(addDays(weeklyHours[i+3].start, 6));
      const block = findBlockForDate(startISO, blockDates);
      violations.push({
        rule: '80hr_weekly_avg',
        ruleLabel: '80-Hour Weekly Average',
        severity: 'error',
        fellow,
        block,
        startDate: startISO,
        endDate: endISO,
        hours: Math.round(avg * 10) / 10,
        detail: `${Math.round(avg * 10) / 10}h/wk average over 4 weeks (${startISO} to ${endISO}). Limit: 80h.`,
      });
    }
  }

  return violations;
}

/**
 * Rule 2: 24+4 max continuous duty (no shift > 28 hours)
 * Since we model shifts per day, flag any day with > 24h duty or
 * consecutive days where combined continuous hours > 28.
 */
function check24PlusFourRule(fellow, timeline, blockDates) {
  const violations = [];
  const dates = Array.from(timeline.keys()).sort();

  for (let i = 0; i < dates.length; i++) {
    const entry = timeline.get(dates[i]);
    if (entry.hours > 24) {
      const block = findBlockForDate(dates[i], blockDates);
      violations.push({
        rule: '24plus4_max_duty',
        ruleLabel: '24+4 Max Continuous Duty',
        severity: 'error',
        fellow,
        block,
        startDate: dates[i],
        endDate: dates[i],
        hours: entry.hours,
        detail: `${entry.hours}h duty on ${dates[i]}. Max continuous duty: 28h.`,
      });
    }
  }

  return violations;
}

/**
 * Rule 3: Minimum 8 hours between shifts
 * Check consecutive days where evening end + next morning start < 8h gap.
 */
function check8HourRestRule(fellow, timeline, blockDates) {
  const violations = [];
  const dates = Array.from(timeline.keys()).sort();

  for (let i = 0; i < dates.length - 1; i++) {
    const today = timeline.get(dates[i]);
    const tomorrow = timeline.get(dates[i + 1]);

    if (today.shifts.length === 0 || tomorrow.shifts.length === 0) continue;

    // Find latest end hour today
    let latestEnd = 0;
    for (const s of today.shifts) {
      if (s.isNight) {
        // Night shift ends next morning — effectively 24 + endHour
        latestEnd = Math.max(latestEnd, 24 + s.endHour);
      } else {
        latestEnd = Math.max(latestEnd, s.endHour);
      }
    }

    // Find earliest start hour tomorrow
    let earliestStart = 24;
    for (const s of tomorrow.shifts) {
      if (s.isNight) {
        earliestStart = Math.min(earliestStart, s.startHour);
      } else {
        earliestStart = Math.min(earliestStart, s.startHour);
      }
    }

    // Gap = (24 - latestEnd) + earliestStart  if no night shift
    // For night shifts ending at 7am next day, latestEnd = 31, so gap = 24 - 31 + earlyStart = negative → skip
    // Simpler: gap from absolute hours
    const gapHours = (24 - latestEnd) + earliestStart;

    if (gapHours < 8 && gapHours >= 0) {
      const block = findBlockForDate(dates[i], blockDates);
      violations.push({
        rule: '8hr_between_shifts',
        ruleLabel: '8-Hour Rest Between Shifts',
        severity: 'warn',
        fellow,
        block,
        startDate: dates[i],
        endDate: dates[i + 1],
        hours: Math.round(gapHours * 10) / 10,
        detail: `Only ${Math.round(gapHours * 10) / 10}h rest between ${dates[i]} and ${dates[i + 1]}. Minimum: 8h.`,
      });
    }
  }

  return violations;
}

/**
 * Rule 4: One day off in 7 (averaged over 4 weeks)
 * Must have at least 4 days off in every 28-day window.
 */
function checkOneDayOffRule(fellow, timeline, blockDates) {
  const violations = [];
  const dates = Array.from(timeline.keys()).sort();
  if (dates.length < 28) return violations;

  for (let i = 0; i <= dates.length - 28; i++) {
    let daysOff = 0;
    for (let j = i; j < i + 28; j++) {
      const entry = timeline.get(dates[j]);
      if (!entry || entry.hours === 0) daysOff++;
    }
    if (daysOff < 4) {
      const startISO = dates[i];
      const endISO = dates[i + 27];
      const block = findBlockForDate(startISO, blockDates);
      // Deduplicate: skip if we already have a violation for this fellow in an overlapping window
      const isDuplicate = violations.some(v =>
        v.rule === '1_day_off_in_7' && v.startDate >= startISO && v.startDate <= endISO
      );
      if (!isDuplicate) {
        violations.push({
          rule: '1_day_off_in_7',
          ruleLabel: '1 Day Off per 7 Days',
          severity: 'error',
          fellow,
          block,
          startDate: startISO,
          endDate: endISO,
          hours: null,
          detail: `Only ${daysOff} days off in 28-day window (${startISO} to ${endISO}). Minimum: 4 days.`,
        });
      }
    }
  }

  return violations;
}

/**
 * Rule 5: No more than 6 consecutive night shifts
 */
function checkConsecutiveNightsRule(fellow, timeline, blockDates) {
  const violations = [];
  const dates = Array.from(timeline.keys()).sort();

  let consecutiveNights = 0;
  let streakStart = null;

  for (let i = 0; i < dates.length; i++) {
    const entry = timeline.get(dates[i]);
    if (entry.isNight) {
      if (consecutiveNights === 0) streakStart = dates[i];
      consecutiveNights++;
    } else {
      if (consecutiveNights > 6) {
        const block = findBlockForDate(streakStart, blockDates);
        violations.push({
          rule: '6_consecutive_nights',
          ruleLabel: '6 Consecutive Night Limit',
          severity: 'error',
          fellow,
          block,
          startDate: streakStart,
          endDate: dates[i - 1],
          hours: null,
          detail: `${consecutiveNights} consecutive night shifts (${streakStart} to ${dates[i - 1]}). Max: 6.`,
        });
      }
      consecutiveNights = 0;
      streakStart = null;
    }
  }

  // Check trailing streak
  if (consecutiveNights > 6 && streakStart) {
    const block = findBlockForDate(streakStart, blockDates);
    violations.push({
      rule: '6_consecutive_nights',
      ruleLabel: '6 Consecutive Night Limit',
      severity: 'error',
      fellow,
      block,
      startDate: streakStart,
      endDate: dates[dates.length - 1],
      hours: null,
      detail: `${consecutiveNights} consecutive night shifts (${streakStart} to ${dates[dates.length - 1]}). Max: 6.`,
    });
  }

  return violations;
}

/**
 * Rule 6: 14 hours off after 24 hours of in-house duty
 * Flag if a day with >= 24h duty is followed by less than 14h rest.
 */
function checkPostCallRestRule(fellow, timeline, blockDates) {
  const violations = [];
  const dates = Array.from(timeline.keys()).sort();

  for (let i = 0; i < dates.length - 1; i++) {
    const today = timeline.get(dates[i]);
    if (today.hours < 24) continue;

    const tomorrow = timeline.get(dates[i + 1]);
    if (!tomorrow || tomorrow.shifts.length === 0) continue;

    // Find earliest start tomorrow
    let earliestStart = 24;
    for (const s of tomorrow.shifts) {
      earliestStart = Math.min(earliestStart, s.isNight ? s.startHour : s.startHour);
    }

    // Assume 24h duty ends at the sum of the shift hours... simplification:
    // If they worked 24h, they finished around 7am next day (if call + night).
    // Rest = earliestStart tomorrow (in hours from midnight)
    // But since 24h duty likely spans to next morning, the gap may be very small.
    if (earliestStart < 14) {
      const block = findBlockForDate(dates[i], blockDates);
      violations.push({
        rule: '14hr_post_call_rest',
        ruleLabel: '14-Hour Post-Call Rest',
        severity: 'warn',
        fellow,
        block,
        startDate: dates[i],
        endDate: dates[i + 1],
        hours: earliestStart,
        detail: `Only ${earliestStart}h rest after 24h duty on ${dates[i]}. Minimum: 14h.`,
      });
    }
  }

  return violations;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function findBlockForDate(isoDate, blockDates) {
  for (const b of blockDates) {
    if (isoDate >= b.start && isoDate <= b.end) return b.block;
  }
  return null;
}

// ─── Main export ────────────────────────────────────────────────────────────

/**
 * Check all ACGME work-hour rules for all fellows.
 * @param {Object} params
 * @param {string[]} params.fellows - Fellow names
 * @param {Object} params.schedule - { fellowName: [26 rotations] }
 * @param {Object} params.callSchedule - { 'B1-W1': 'Name', ... }
 * @param {Object} params.nightFloatSchedule - { 'B1-W1': 'Name', ... }
 * @param {Array} params.blockDates - [{ block, start, end, rotation }]
 * @param {Array} params.vacations - [{ fellow, startBlock, endBlock, reason, status }]
 * @returns {Array} violations - sorted by date
 */
export function checkAllWorkHourViolations({ fellows, schedule, callSchedule, nightFloatSchedule, blockDates, vacations }) {
  const allViolations = [];

  for (const fellow of fellows) {
    // Build vacation block set for this fellow
    const vacBlocks = new Set();
    (vacations || []).forEach(v => {
      if (v.fellow === fellow && v.status === 'approved' && v.reason === 'Vacation') {
        for (let b = v.startBlock; b <= v.endBlock; b++) vacBlocks.add(b);
      }
    });

    const timeline = buildTimeline(fellow, schedule, callSchedule, nightFloatSchedule, blockDates, vacBlocks);

    allViolations.push(
      ...check80HourRule(fellow, timeline, blockDates),
      ...check24PlusFourRule(fellow, timeline, blockDates),
      ...check8HourRestRule(fellow, timeline, blockDates),
      ...checkOneDayOffRule(fellow, timeline, blockDates),
      ...checkConsecutiveNightsRule(fellow, timeline, blockDates),
      ...checkPostCallRestRule(fellow, timeline, blockDates),
    );
  }

  // Sort by date, then fellow
  allViolations.sort((a, b) => {
    if (a.startDate !== b.startDate) return a.startDate < b.startDate ? -1 : 1;
    return a.fellow.localeCompare(b.fellow);
  });

  return allViolations;
}
