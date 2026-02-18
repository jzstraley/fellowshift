// src/engine/violationSuggester.js
// Generates swap/reassignment suggestions that fix a violation without introducing new ones.

import { checkAllWorkHourViolations } from './workHourChecker';

const MAX_SUGGESTIONS = 5;

/**
 * Deep-clone a schedule object (fellow → rotation[]).
 */
function cloneSchedule(schedule) {
  const out = {};
  for (const f of Object.keys(schedule)) {
    out[f] = [...schedule[f]];
  }
  return out;
}

/**
 * Get violations for a specific set of fellows only.
 */
function getViolationsForFellows(fellowList, params) {
  return checkAllWorkHourViolations({ ...params, fellows: fellowList });
}

/**
 * Find block index (0-based) for a 1-based block number.
 */
function blockNumToIndex(blockNum) {
  return blockNum - 1;
}

/**
 * Find all call/float weekend keys that overlap a violation's date range for a given fellow.
 */
function findOverlappingWeekendKeys(violation, callSchedule, nightFloatSchedule, blockDates) {
  const keys = [];
  // Check the block the violation is in, plus adjacent blocks
  const blocksToCheck = new Set();
  if (violation.block) {
    blocksToCheck.add(violation.block);
    if (violation.block > 1) blocksToCheck.add(violation.block - 1);
    if (violation.block < 26) blocksToCheck.add(violation.block + 1);
  }

  for (const bn of blocksToCheck) {
    for (const wn of [1, 2]) {
      const key = `B${bn}-W${wn}`;
      const callFellow = typeof callSchedule[key] === 'string' ? callSchedule[key] : callSchedule[key]?.name;
      const floatFellow = typeof nightFloatSchedule[key] === 'string' ? nightFloatSchedule[key] : nightFloatSchedule[key]?.name;

      if (callFellow === violation.fellow) {
        keys.push({ key, type: 'call', fellow: callFellow });
      }
      if (floatFellow === violation.fellow) {
        keys.push({ key, type: 'float', fellow: floatFellow });
      }
    }
  }
  return keys;
}

/**
 * Generate suggestions to fix a single violation.
 * Returns an array of suggestion objects (max MAX_SUGGESTIONS).
 */
export function generateSuggestions(violation, { fellows, schedule, callSchedule, nightFloatSchedule, blockDates, vacations }) {
  const suggestions = [];
  const params = { schedule, callSchedule, nightFloatSchedule, blockDates, vacations };

  // Get baseline violations for comparison
  const baselineAll = getViolationsForFellows(fellows, params);
  const baselineCount = baselineAll.length;

  // --- Strategy 1: Rotation swaps ---
  if (violation.block) {
    const blockIdx = blockNumToIndex(violation.block);
    const fellowRotation = schedule[violation.fellow]?.[blockIdx];

    for (const other of fellows) {
      if (other === violation.fellow) continue;
      if (suggestions.length >= MAX_SUGGESTIONS) break;

      const otherRotation = schedule[other]?.[blockIdx];
      // Skip if same rotation (no effect)
      if (otherRotation === fellowRotation) continue;

      // Try the swap
      const newSchedule = cloneSchedule(schedule);
      newSchedule[violation.fellow][blockIdx] = otherRotation;
      newSchedule[other][blockIdx] = fellowRotation;

      const newParams = { ...params, schedule: newSchedule };
      // Check only the two affected fellows first (fast check)
      const affectedViolations = getViolationsForFellows([violation.fellow, other], newParams);
      // Get original violations for these two fellows
      const origAffected = baselineAll.filter(v => v.fellow === violation.fellow || v.fellow === other);

      // The swap is good if: fewer or equal total violations for these two, AND the original violation is gone
      const originalStillPresent = affectedViolations.some(v =>
        v.rule === violation.rule &&
        v.fellow === violation.fellow &&
        v.startDate === violation.startDate
      );

      if (!originalStillPresent && affectedViolations.length <= origAffected.length) {
        const netChange = affectedViolations.length - origAffected.length;
        suggestions.push({
          type: 'rotationSwap',
          description: `Swap ${violation.fellow}'s ${fellowRotation || 'Off'} with ${other}'s ${otherRotation || 'Off'} in B${violation.block}`,
          netChange,
          apply: {
            fellowA: violation.fellow,
            fellowB: other,
            blockIndex: blockIdx,
            rotationA: fellowRotation,
            rotationB: otherRotation,
          },
        });
      }
    }
  }

  // --- Strategy 2: Call reassignment ---
  const callRules = ['24plus4_max_duty', '8hr_between_shifts', '14hr_post_call_rest', '80hr_weekly_avg', '1_day_off_in_7'];
  if (callRules.includes(violation.rule)) {
    const weekendEntries = findOverlappingWeekendKeys(violation, callSchedule, nightFloatSchedule, blockDates);

    for (const entry of weekendEntries) {
      if (suggestions.length >= MAX_SUGGESTIONS) break;

      for (const other of fellows) {
        if (other === violation.fellow) continue;
        if (suggestions.length >= MAX_SUGGESTIONS) break;

        if (entry.type === 'call') {
          // Try reassigning call to other fellow
          const newCall = { ...callSchedule, [entry.key]: other };
          const newParams = { ...params, callSchedule: newCall };
          const affectedViolations = getViolationsForFellows([violation.fellow, other], newParams);
          const origAffected = baselineAll.filter(v => v.fellow === violation.fellow || v.fellow === other);

          const originalStillPresent = affectedViolations.some(v =>
            v.rule === violation.rule &&
            v.fellow === violation.fellow &&
            v.startDate === violation.startDate
          );

          if (!originalStillPresent && affectedViolations.length <= origAffected.length) {
            suggestions.push({
              type: 'callReassign',
              description: `Reassign ${entry.key} call from ${violation.fellow} to ${other}`,
              netChange: affectedViolations.length - origAffected.length,
              apply: {
                weekendKey: entry.key,
                fromFellow: violation.fellow,
                toFellow: other,
              },
            });
          }
        } else {
          // Try reassigning night float to other fellow
          const newFloat = { ...nightFloatSchedule, [entry.key]: other };
          const newParams = { ...params, nightFloatSchedule: newFloat };
          const affectedViolations = getViolationsForFellows([violation.fellow, other], newParams);
          const origAffected = baselineAll.filter(v => v.fellow === violation.fellow || v.fellow === other);

          const originalStillPresent = affectedViolations.some(v =>
            v.rule === violation.rule &&
            v.fellow === violation.fellow &&
            v.startDate === violation.startDate
          );

          if (!originalStillPresent && affectedViolations.length <= origAffected.length) {
            suggestions.push({
              type: 'floatReassign',
              description: `Reassign ${entry.key} night float from ${violation.fellow} to ${other}`,
              netChange: affectedViolations.length - origAffected.length,
              apply: {
                weekendKey: entry.key,
                fromFellow: violation.fellow,
                toFellow: other,
              },
            });
          }
        }
      }
    }
  }

  // Sort: prefer suggestions that reduce overall violation count the most
  suggestions.sort((a, b) => a.netChange - b.netChange);

  return suggestions.slice(0, MAX_SUGGESTIONS);
}
