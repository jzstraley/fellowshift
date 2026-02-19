// src/engine/conflictDetector.js
import { checkAllWorkHourViolations } from "./workHourChecker";

/**
 * Detects double-bookings in day overrides.
 * A double-booking is when the same fellow has overlapping assignments
 * (both a block rotation and a day override pointing to different rotations
 * shouldn't be an issue — that's the purpose of overrides — but two overrides
 * on the same date would be a data corruption issue).
 */
export function detectDoubleBookings(dayOverrides) {
  // dayOverrides keys: "Fellow#B{block}#{date}"
  // Check for duplicate date assignments per fellow
  const seen = new Map(); // "Fellow#date" → rotation
  const issues = [];

  for (const [key, rotation] of Object.entries(dayOverrides)) {
    const parts = key.split("#");
    if (parts.length < 3) continue;
    const fellow = parts[0];
    const date = parts[2];
    const lookupKey = `${fellow}#${date}`;

    if (seen.has(lookupKey) && seen.get(lookupKey) !== rotation) {
      issues.push({
        type: "double_booking",
        severity: "error",
        fellow,
        date,
        detail: `${fellow} has conflicting overrides on ${date}: "${seen.get(lookupKey)}" vs "${rotation}"`,
      });
    }
    seen.set(lookupKey, rotation);
  }

  return issues;
}

/**
 * Detects coverage gaps: blocks where required high-acuity rotations
 * (ICU, Floor A, Floor B, Nights) have no fellow assigned.
 */
export function detectCoverageGaps(schedule, fellows, blockDates) {
  const requiredRotations = ["ICU", "Floor A", "Floor B", "Nights"];
  const issues = [];

  for (let blockIdx = 0; blockIdx < blockDates.length; blockIdx++) {
    const blockNum = blockIdx + 1;

    for (const req of requiredRotations) {
      const hasCoverage = fellows.some(
        (f) => schedule[f]?.[blockIdx] === req
      );
      if (!hasCoverage) {
        issues.push({
          type: "coverage_gap",
          severity: "warning",
          block: blockNum,
          rotation: req,
          detail: `Block ${blockNum} (${blockDates[blockIdx].start} – ${blockDates[blockIdx].end}): No fellow assigned to ${req}`,
        });
      }
    }
  }

  return issues;
}

/**
 * Main conflict detection orchestrator.
 * Runs all checks and returns a unified results object.
 */
export function detectConflicts({
  schedule,
  callSchedule,
  nightFloatSchedule,
  fellows,
  blockDates,
  vacations,
  dayOverrides = {},
}) {
  const doubleBookings = detectDoubleBookings(dayOverrides);
  const coverageGaps = detectCoverageGaps(schedule, fellows, blockDates);
  const acgmeViolations = checkAllWorkHourViolations({
    fellows,
    schedule,
    callSchedule,
    nightFloatSchedule,
    blockDates,
    vacations,
  });

  return {
    doubleBookings,
    coverageGaps,
    acgmeViolations,
    hasErrors: doubleBookings.length > 0,
    hasWarnings: coverageGaps.length > 0 || acgmeViolations.length > 0,
    total: doubleBookings.length + coverageGaps.length + acgmeViolations.length,
  };
}
