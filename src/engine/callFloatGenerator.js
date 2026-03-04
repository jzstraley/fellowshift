// src/engine/callFloatGenerator.js

export function generateCallAndFloat({
  fellows,
  schedule,
  pgyLevels,
  callTargets = { 4: 5, 5: 4, 6: 2 },
  floatTargets = { 4: 5, 5: 4, 6: 3 },
  nBlocks = 26,
  attempts = 200,
}) {
  // ---------------- utils ----------------
  const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const keyFor = (blockIdx, weekend) => `B${blockIdx + 1}-W${weekend}`;

  const countMissing = (obj) => {
    let missing = 0;
    for (let b = 0; b < nBlocks; b++) {
      for (let w = 1; w <= 2; w++) {
        if (!obj[keyFor(b, w)]) missing++;
      }
    }
    return missing;
  };

  // Balance penalty: penalize over-target (3×) more than under-target (1×)
  const balancePenalty = (counts, targets) =>
    Object.keys(counts).reduce((sum, f) => {
      const t = targets[pgyLevels[f]] ?? 0;
      const c = counts[f];
      return sum + (c > t ? (c - t) * 3 : (t - c) * 1);
    }, 0);

  // ============ BOARD EXAM WINDOWS (no call/float for PGY-6) ============
  const boardExams = [
    { name: 'ASE',   examBlock: 0,  examWeekend: 2 },  // Block 1 W2
    { name: 'CBCCT', examBlock: 3,  examWeekend: 2 },  // Block 4 W2
    { name: 'CBNC',  examBlock: 13, examWeekend: 1 },  // Block 14 W1
    { name: 'CBCMR', examBlock: 21, examWeekend: 1 },  // Block 22 W1
    { name: 'ACC',   examBlock: 19, examWeekend: 1 },  // Block 20 W1
  ];

  const examWindowRanges = boardExams.reduce((acc, exam) => {
    acc[exam.name] = {
      // Hard window = just the exam block itself (2 weekends)
      hard: { startBlock: exam.examBlock, endBlock: exam.examBlock },
    };
    return acc;
  }, {});

  const isInExamHardWindow = (blockIdx) =>
    boardExams.some(({ name }) => {
      const r = examWindowRanges[name].hard;
      return blockIdx >= r.startBlock && blockIdx <= r.endBlock;
    });

  // ============ ELIGIBILITY RULES ============
  const hasICUByThisBlock = (fellow, blockIdx) =>
    schedule[fellow].slice(0, blockIdx + 1).some((r) => r === "ICU");

  const eligibleCall = (fellow, blockIdx) => {
    const rot = schedule[fellow]?.[blockIdx] ?? "";
    const pgy = pgyLevels[fellow];
    if (!pgy) return false;
    if (rot === "Nights" || rot === "Floor A" || rot === "Floor B") return false;
    if (pgy === 6 && isInExamHardWindow(blockIdx)) return false;
    if (pgy === 6 && blockIdx < 1) return false;
    if (pgy === 4 && !hasICUByThisBlock(fellow, blockIdx)) return false;
    if (blockIdx < nBlocks - 1 && schedule[fellow]?.[blockIdx + 1] === "Nights") return false;
    return true;
  };

  const eligibleFloatStrict = (fellow, blockIdx) => {
    const rot = schedule[fellow]?.[blockIdx] ?? "";
    const pgy = pgyLevels[fellow];
    if (!pgy) return false;
    if (rot === "ICU" || rot === "Floor A" || rot === "Floor B") return false;
    if (pgy === 6 && isInExamHardWindow(blockIdx)) return false;
    if (pgy === 6 && blockIdx < 4) return false;
    if (pgy === 4) {
      const hasDoneFloor = schedule[fellow].slice(0, blockIdx).some((r) => r === "Floor A" || r === "Floor B");
      if (!hasDoneFloor) return false;
    }
    return true;
  };

  const eligibleFloatRelaxed = (fellow, blockIdx) => {
    const rot = schedule[fellow]?.[blockIdx] ?? "";
    const pgy = pgyLevels[fellow];
    if (!pgy) return false;
    if (rot === "ICU" || rot === "Floor A" || rot === "Floor B") return false;
    if (pgy === 6 && isInExamHardWindow(blockIdx)) return false;
    if (pgy === 6 && blockIdx < 4) return false;
    return true;
  };

  // ---------- ADJACENCY CHECKS ----------

  // Same type, same block: no fellow appears twice in W1+W2 for the same type
  const violatesAdjacencySameBlock = (sched, fellow, blockIdx) => {
    const w1Key = keyFor(blockIdx, 1);
    const w2Key = keyFor(blockIdx, 2);
    return sched[w1Key]?.name === fellow || sched[w2Key]?.name === fellow;
  };

  // Same type, consecutive weekends (W2 block N / W1 block N+1)
  const violatesAdjacencyConsecutive = (sched, fellow, blockIdx, weekend) => {
    if (weekend === 2 && blockIdx < nBlocks - 1) {
      return sched[keyFor(blockIdx + 1, 1)]?.name === fellow;
    }
    if (weekend === 1 && blockIdx > 0) {
      return sched[keyFor(blockIdx - 1, 2)]?.name === fellow;
    }
    return false;
  };

  // Cannot be assigned BOTH call AND float on the same weekend
  const violatesCallFloatSameWeekend = (callSched, floatSched, fellow, blockIdx, weekend) => {
    const key = keyFor(blockIdx, weekend);
    return callSched[key]?.name === fellow || floatSched[key]?.name === fellow;
  };

  // Cross-type consecutive: no back-to-back weekends regardless of call vs float
  const violatesCrossTypeConsecutive = (callSched, floatSched, fellow, blockIdx, weekend) => {
    if (weekend === 2 && blockIdx < nBlocks - 1) {
      const nextKey = keyFor(blockIdx + 1, 1);
      return callSched[nextKey]?.name === fellow || floatSched[nextKey]?.name === fellow;
    }
    if (weekend === 1 && blockIdx > 0) {
      const prevKey = keyFor(blockIdx - 1, 2);
      return callSched[prevKey]?.name === fellow || floatSched[prevKey]?.name === fellow;
    }
    return false;
  };

  // ---------------- scoring ----------------

  // Recency penalty for float: discourage assigning someone who just floated recently
  // (promotes temporal spread across the year)
  const floatRecencyPenalty = (lastFloatBlocks, fellow, blockIdx) => {
    const lastBlock = lastFloatBlocks[fellow] ?? -10;
    const gap = blockIdx - lastBlock;
    if (gap <= 1) return 0.8;  // same or adjacent block — strong penalty
    if (gap <= 3) return 0.35; // within 3 blocks — moderate penalty
    if (gap <= 5) return 0.1;  // within 5 blocks — light penalty
    return 0;
  };

  // Float score: PGY-6 gets highest priority, PGY-5 deprioritized
  // Lower score = picked first
  const floatScore = (floatCounts, fellow, isNights, blockIdx, lastFloatBlocks) => {
    const pgy = pgyLevels[fellow];
    const target = floatTargets[pgy] ?? 1;
    const ratio = floatCounts[fellow] / Math.max(target, 1);
    // PGY-6 prioritized for float (nights-friendly), PGY-5 deprioritized
    const pgyBonus = pgy === 6 ? -0.25 : pgy === 4 ? -0.05 : 0.2;
    const nightsBonus = isNights ? -0.3 : 0;   // strong preference for nights fellow
    const recency = floatRecencyPenalty(lastFloatBlocks, fellow, blockIdx);
    return ratio + pgyBonus + nightsBonus + recency + Math.random() * 0.01;
  };

  // Pre-compute eligible call blocks per fellow for MCF scoring (done once)
  const eligibleCallBlocks = {};
  fellows.forEach((f) => {
    eligibleCallBlocks[f] = Array.from({ length: nBlocks }, (_, b) => b).filter((b) => eligibleCall(f, b));
  });

  // Call score: correct counts first (MCF for PGY-4), PGY-5 penalized, PGY-6 last
  // Lower score = picked first
  const callScore = (callCounts, fellow, blockIdx) => {
    const pgy = pgyLevels[fellow];
    const target = callTargets[pgy] ?? 1;
    const ratio = callCounts[fellow] / Math.max(target, 1);
    const pgyBonus = pgy === 4 ? -0.3 : pgy === 5 ? 0.25 : 0.5;

    // MCF for PGY-4: urgency = calls still needed / eligible blocks remaining
    // Ensures all PGY-4s hit their target before PGY-5s absorb excess slots
    let urgency = 0;
    if (pgy === 4 && blockIdx !== undefined) {
      const needed = Math.max(0, target - callCounts[fellow]);
      const remainingEligible = eligibleCallBlocks[fellow].filter((b) => b >= blockIdx).length;
      urgency = remainingEligible > 0 ? -(needed / remainingEligible) * 0.5 : 0;
    }

    return ratio + pgyBonus + urgency + Math.random() * 0.01;
  };

  // ---------------- attempt runner ----------------
  const runAttempt = () => {
    const callSchedule = {};
    const floatSchedule = {};
    const callCounts = {};
    const floatCounts = {};
    const lastFloatBlocks = {}; // fellow → last block where they got a float (for recency scoring)
    fellows.forEach((f) => { callCounts[f] = 0; floatCounts[f] = 0; lastFloatBlocks[f] = -10; });

    // Assign float and track last-block for evenness
    const assignFloat = (key, fellow, blockIdx) => {
      floatSchedule[key] = { name: fellow, relaxed: false };
      floatCounts[fellow] += 1;
      lastFloatBlocks[fellow] = blockIdx;
    };

    // 1) FLOATS strict
    // W2 of each block = nights fellow's slot (end of their rotation)
    // W1 of each block = any eligible non-nights fellow
    for (let blockIdx = 0; blockIdx < nBlocks; blockIdx++) {
      const nightsFellow = fellows.find((f) => schedule[f]?.[blockIdx] === "Nights") || null;

      for (let weekend = 1; weekend <= 2; weekend++) {
        const key = keyFor(blockIdx, weekend);
        let pick = null;

        if (weekend === 2 && nightsFellow) {
          // W2: nights fellow gets priority — this is their float at rotation's end
          if (
            floatCounts[nightsFellow] < (floatTargets[pgyLevels[nightsFellow]] ?? 999) &&
            eligibleFloatStrict(nightsFellow, blockIdx) &&
            !violatesAdjacencyConsecutive(floatSchedule, nightsFellow, blockIdx, weekend) &&
            !violatesCrossTypeConsecutive(callSchedule, floatSchedule, nightsFellow, blockIdx, weekend)
          ) {
            pick = nightsFellow;
          }
        }

        if (!pick) {
          // W1: exclude the nights fellow (their slot is W2)
          // W2 fallback: nights fellow ineligible, open to others
          const candidates = shuffle(fellows).filter((f) => {
            if (weekend === 1 && f === nightsFellow) return false; // reserved for W2
            if (floatCounts[f] >= (floatTargets[pgyLevels[f]] ?? 999)) return false;
            if (!eligibleFloatStrict(f, blockIdx)) return false;
            if (violatesAdjacencySameBlock(floatSchedule, f, blockIdx)) return false;
            if (violatesAdjacencyConsecutive(floatSchedule, f, blockIdx, weekend)) return false;
            if (violatesCrossTypeConsecutive(callSchedule, floatSchedule, f, blockIdx, weekend)) return false;
            return true;
          });

          if (candidates.length) {
            candidates.sort((a, b) =>
              floatScore(floatCounts, a, false, blockIdx, lastFloatBlocks) -
              floatScore(floatCounts, b, false, blockIdx, lastFloatBlocks)
            );
            pick = candidates[0];
          }
        }

        if (pick) assignFloat(key, pick, blockIdx);
      }
    }

    // 2) CALLS strict — PGY-4 strongly prioritized; PGY-5 load reduced
    for (let blockIdx = 0; blockIdx < nBlocks; blockIdx++) {
      const usedThisBlock = new Set();
      const weekendOrder = shuffle([1, 2]);

      for (const weekend of weekendOrder) {
        const key = keyFor(blockIdx, weekend);

        const candidates = shuffle(fellows).filter((f) => {
          if (usedThisBlock.has(f)) return false;
          if (callCounts[f] >= (callTargets[pgyLevels[f]] ?? 999)) return false;
          if (!eligibleCall(f, blockIdx)) return false;
          if (violatesAdjacencySameBlock(callSchedule, f, blockIdx, "call")) return false;
          if (violatesAdjacencyConsecutive(callSchedule, f, blockIdx, weekend)) return false;
          if (violatesCallFloatSameWeekend(callSchedule, floatSchedule, f, blockIdx, weekend)) return false;
          if (violatesCrossTypeConsecutive(callSchedule, floatSchedule, f, blockIdx, weekend)) return false;
          return true;
        });

        if (candidates.length) {
          candidates.sort((a, b) => callScore(callCounts, a, blockIdx) - callScore(callCounts, b, blockIdx));
          const pick = candidates[0];
          callSchedule[key] = { name: pick, relaxed: false };
          callCounts[pick] += 1;
          usedThisBlock.add(pick);
        }
      }
    }

    return { callSchedule, floatSchedule, callCounts, floatCounts };
  };

  // ---------------- choose best attempt ----------------
  // Score: coverage first, then balance (over-target weighted heavily)
  let best = null;

  for (let i = 0; i < attempts; i++) {
    const attempt = runAttempt();
    const missCalls  = countMissing(attempt.callSchedule);
    const missFloats = countMissing(attempt.floatSchedule);
    const callBal    = balancePenalty(attempt.callCounts, callTargets);
    const floatBal   = balancePenalty(attempt.floatCounts, floatTargets);

    const score = missCalls * 500 + missFloats * 80 + callBal * 4 + floatBal * 2;

    if (!best || score < best.score) best = { ...attempt, score };
  }

  if (!best) return null;

  // ---------------- violations collector ----------------
  const violations = [];
  const addV    = (v) => violations.push(v);
  const markRelaxed = ({ type, fellow, blockIdx, weekend, rule, detail }) =>
    addV({ type, severity: "warn", fellow, block: blockIdx + 1, weekend: `W${weekend}`, rule, detail });
  const markError = ({ type, blockIdx, weekend, rule, detail }) =>
    addV({ type, severity: "error", fellow: "", block: blockIdx + 1, weekend: `W${weekend}`, rule, detail });

  // ---------- RELAXED FILL PHASE ----------

  // Floats: progressively relax constraints to fill remaining slots
  for (let blockIdx = 0; blockIdx < nBlocks; blockIdx++) {
    const nightsFellow = fellows.find((f) => schedule[f]?.[blockIdx] === "Nights") || null;

    for (let weekend = 1; weekend <= 2; weekend++) {
      const key = keyFor(blockIdx, weekend);
      if (best.floatSchedule[key]) continue;

      const baseFilter = (f) => {
        if (!eligibleFloatRelaxed(f, blockIdx)) return false;
        if (violatesAdjacencySameBlock(best.floatSchedule, f, blockIdx)) return false;
        if (violatesCallFloatSameWeekend(best.callSchedule, best.floatSchedule, f, blockIdx, weekend)) return false;
        return true;
      };

      let pick = null;
      let usedRule = null;

      // W2 relaxed: still try nights fellow first before opening to others
      if (weekend === 2 && nightsFellow && !best.floatSchedule[key]) {
        if (eligibleFloatRelaxed(nightsFellow, blockIdx) &&
            !violatesAdjacencySameBlock(best.floatSchedule, nightsFellow, blockIdx) &&
            !violatesCallFloatSameWeekend(best.callSchedule, best.floatSchedule, nightsFellow, blockIdx, weekend)) {
          pick = nightsFellow;
          usedRule = "relaxed_fill";
        }
      }

      // Phase A: within target + cross-type respected
      let candidates = [];
      if (!pick) candidates = shuffle(fellows).filter((f) => {
        if (weekend === 1 && f === nightsFellow) return false;
        if (best.floatCounts[f] >= (floatTargets[pgyLevels[f]] ?? 999)) return false;
        if (!baseFilter(f)) return false;
        if (violatesAdjacencyConsecutive(best.floatSchedule, f, blockIdx, weekend)) return false;
        if (violatesCrossTypeConsecutive(best.callSchedule, best.floatSchedule, f, blockIdx, weekend)) return false;
        return true;
      });
      if (!pick && candidates.length) {
        candidates.sort((a, b) =>
          floatScore(best.floatCounts, a, false, blockIdx, {}) -
          floatScore(best.floatCounts, b, false, blockIdx, {})
        );
        pick = candidates[0];
        usedRule = "relaxed_fill";
      }

      // Phase B: allow exceeding target, cross-type respected
      if (!pick) {
        candidates = shuffle(fellows).filter((f) => {
          if (weekend === 1 && f === nightsFellow) return false;
          if (!baseFilter(f)) return false;
          if (violatesAdjacencyConsecutive(best.floatSchedule, f, blockIdx, weekend)) return false;
          if (violatesCrossTypeConsecutive(best.callSchedule, best.floatSchedule, f, blockIdx, weekend)) return false;
          return true;
        });
        if (candidates.length) {
          candidates.sort((a, b) => (best.floatCounts[a] - best.floatCounts[b]) + Math.random() * 0.01);
          pick = candidates[0];
          usedRule = "float_over_target";
        }
      }

      // Phase C: ignore cross-type consecutive, within target
      if (!pick) {
        candidates = shuffle(fellows).filter((f) => {
          if (weekend === 1 && f === nightsFellow) return false;
          if (best.floatCounts[f] >= (floatTargets[pgyLevels[f]] ?? 999)) return false;
          return baseFilter(f);
        });
        if (candidates.length) {
          candidates.sort((a, b) => (best.floatCounts[a] - best.floatCounts[b]) + Math.random() * 0.01);
          pick = candidates[0];
          usedRule = "relaxed_fill";
        }
      }

      // Phase D: last resort — ignore all adjacency (nights exclusion dropped)
      if (!pick) {
        candidates = shuffle(fellows).filter((f) => eligibleFloatRelaxed(f, blockIdx));
        if (candidates.length) {
          pick = candidates[0];
          usedRule = "float_ignore_adjacency";
        }
      }

      if (pick) {
        best.floatSchedule[key] = { name: pick, relaxed: true };
        best.floatCounts[pick] += 1;

        if (usedRule === "float_ignore_adjacency") {
          markRelaxed({ type: "float", fellow: pick, blockIdx, weekend, rule: "ignore_adjacency", detail: "Ignored adjacency rules to fill missing float slot." });
        } else if (usedRule === "float_over_target") {
          markRelaxed({ type: "float", fellow: pick, blockIdx, weekend, rule: "over_target", detail: "Exceeded float target to fill missing float slot." });
        } else {
          markRelaxed({ type: "float", fellow: pick, blockIdx, weekend, rule: "relaxed_fallback", detail: "Filled missing float using relaxed adjacency rules." });
        }

        if (pgyLevels[pick] === 4) {
          const hasDoneFloor = schedule[pick].slice(0, blockIdx).some((r) => r === "Floor A" || r === "Floor B");
          if (!hasDoneFloor) {
            markRelaxed({ type: "float", fellow: pick, blockIdx, weekend, rule: "pgy4_float_before_floor", detail: "PGY4 assigned float before completing a floor block (relaxed)." });
          }
        }
      } else {
        markError({ type: "float", blockIdx, weekend, rule: "unfilled_slot", detail: "No eligible fellow found for float, check exclusions/roster." });
      }
    }
  }

  // Calls: MUST fill every slot, PGY-4/5 only for over-target
  for (let blockIdx = 0; blockIdx < nBlocks; blockIdx++) {
    const usedThisBlock = new Set(
      [keyFor(blockIdx, 1), keyFor(blockIdx, 2)].map((k) => best.callSchedule[k]?.name).filter(Boolean)
    );

    for (let weekend = 1; weekend <= 2; weekend++) {
      const key = keyFor(blockIdx, weekend);
      if (best.callSchedule[key]) continue;

      const baseFilter = (f) => {
        if (usedThisBlock.has(f)) return false;
        if (!eligibleCall(f, blockIdx)) return false;
        if (violatesAdjacencySameBlock(best.callSchedule, f, blockIdx)) return false;
        if (violatesCallFloatSameWeekend(best.callSchedule, best.floatSchedule, f, blockIdx, weekend)) return false;
        return true;
      };

      let pick = null;
      let usedRule = null;

      // Phase A: under-target, consecutive + cross-type respected, PGY-4 first
      let candidates = shuffle(fellows).filter((f) => {
        const pgy = pgyLevels[f];
        if (!baseFilter(f)) return false;
        if (violatesAdjacencyConsecutive(best.callSchedule, f, blockIdx, weekend)) return false;
        if (violatesCrossTypeConsecutive(best.callSchedule, best.floatSchedule, f, blockIdx, weekend)) return false;
        if (pgy === 6 && best.callCounts[f] >= (callTargets[pgy] ?? 999)) return false;
        return best.callCounts[f] < (callTargets[pgy] ?? 999);
      });
      if (candidates.length) {
        candidates.sort((a, b) => callScore(best.callCounts, a, blockIdx) - callScore(best.callCounts, b, blockIdx));
        pick = candidates[0];
        usedRule = "relaxed_fill_under_target";
      }

      // Phase B: ignore cross-type consecutive, PGY-4 preferred
      if (!pick) {
        candidates = shuffle(fellows).filter((f) => {
          const pgy = pgyLevels[f];
          if (!baseFilter(f)) return false;
          if (violatesAdjacencyConsecutive(best.callSchedule, f, blockIdx, weekend)) return false;
          if (pgy === 6 && best.callCounts[f] >= (callTargets[pgy] ?? 999)) return false;
          return best.callCounts[f] < (callTargets[pgy] ?? 999);
        });
        if (candidates.length) {
          candidates.sort((a, b) => callScore(best.callCounts, a, blockIdx) - callScore(best.callCounts, b, blockIdx));
          pick = candidates[0];
          usedRule = "relaxed_fill_under_target";
        }
      }

      // Phase C: allow over-target for PGY-4 first, then PGY-5
      if (!pick) {
        candidates = shuffle(fellows).filter((f) => {
          const pgy = pgyLevels[f];
          if (pgy === 6) return false;
          return baseFilter(f);
        });
        if (candidates.length) {
          // Sort: PGY-4 over-target before PGY-5 over-target
          candidates.sort((a, b) => callScore(best.callCounts, a, blockIdx) - callScore(best.callCounts, b, blockIdx));
          pick = candidates[0];
          usedRule = "call_over_target";
        }
      }

      // Phase D: last resort — ignore all adjacency
      if (!pick) {
        candidates = shuffle(fellows).filter((f) => {
          if (pgyLevels[f] === 6) return false;
          if (usedThisBlock.has(f)) return false;
          return eligibleCall(f, blockIdx);
        });
        if (candidates.length) {
          pick = candidates[0];
          usedRule = "call_ignore_adjacency";
        }
      }

      if (pick) {
        best.callSchedule[key] = { name: pick, relaxed: true };
        best.callCounts[pick] += 1;
        usedThisBlock.add(pick);

        if (usedRule === "call_over_target") {
          markRelaxed({ type: "call", fellow: pick, blockIdx, weekend, rule: "over_target", detail: "Exceeded call target (PGY4/5 only) to fill missing call slot." });
        } else if (usedRule === "call_ignore_adjacency") {
          markRelaxed({ type: "call", fellow: pick, blockIdx, weekend, rule: "ignore_adjacency", detail: "Ignored adjacency rules to fill missing call slot." });
        } else {
          markRelaxed({ type: "call", fellow: pick, blockIdx, weekend, rule: "relaxed_fallback", detail: "Filled missing call using relaxed adjacency rules." });
        }
      } else {
        markError({ type: "call", blockIdx, weekend, rule: "unfilled_slot", detail: "No eligible PGY4/5 available without violating hard rules. Call slot left blank." });
      }
    }
  }

  // Missing slot summary
  for (let blockIdx = 0; blockIdx < nBlocks; blockIdx++) {
    for (let weekend = 1; weekend <= 2; weekend++) {
      const ck = keyFor(blockIdx, weekend);
      if (!best.callSchedule[ck]) {
        addV({ type: "call", severity: "error", fellow: "", block: blockIdx + 1, weekend: `W${weekend}`, rule: "missing_call", detail: "Call slot is missing after all fill phases." });
      }
      if (!best.floatSchedule[ck]) {
        addV({ type: "float", severity: "warn", fellow: "", block: blockIdx + 1, weekend: `W${weekend}`, rule: "missing_float", detail: "Float slot is missing after all fill phases." });
      }
    }
  }

  return {
    callSchedule: best.callSchedule,
    nightFloatSchedule: best.floatSchedule,
    callCounts: best.callCounts,
    floatCounts: best.floatCounts,
    violations,
  };
}
