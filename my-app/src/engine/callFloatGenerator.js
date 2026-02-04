// src/engine/callFloatGenerator.js

export function generateCallAndFloat({
  fellows,
  schedule,
  pgyLevels,
  callTargets = { 4: 5, 5: 4, 6: 2 },
  floatTargets = { 4: 5, 5: 4, 6: 3 },
  nBlocks = 26,
  attempts = 80,
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

  // ============ BOARD EXAM WINDOWS (no call/float for PGY-6) ============
  // Hard constraint: 2 weeks prior + exam week (3 weeks total)
  // Soft constraint: 4 weeks prior
  
  const boardExams = [
    { name: 'ASE', examBlock: 0, examWeekend: 2 },          // 7/14/26 (Block 1 W2)
    { name: 'CBCCT', examBlock: 3, examWeekend: 2 },        // 10/8/26 (Block 4 W2)
    { name: 'CBNC', examBlock: 13, examWeekend: 1 },        // 12/29/2026 (Block 14 W1)
    { name: 'CBCMR', examBlock: 21, examWeekend: 1 },       // 05/29/2027 (Block 22 W1)
    { name: 'ACC', examBlock: 19, examWeekend: 1 }          // 10/13/2027 (Block 20 W1)
  ];

  // Calculate block ranges for exam windows
  const getExamWindowRanges = () => {
    const ranges = {};
    for (const exam of boardExams) {
      // Hard: 2 weeks prior + exam week = 3 weeks = 6 weekends
      const hardStartBlock = Math.max(0, exam.examBlock - 2);
      const hardStartWeekend = hardStartBlock === exam.examBlock - 2 ? 1 : (exam.examBlock - 2 < 0 ? 1 : 1);
      
      ranges[exam.name] = {
        hard: { startBlock: hardStartBlock, endBlock: exam.examBlock },
        soft: { startBlock: Math.max(0, exam.examBlock - 4), endBlock: exam.examBlock }
      };
    }
    return ranges;
  };

  const examWindowRanges = getExamWindowRanges();

  const isInExamHardWindow = (blockIdx) => {
    return boardExams.some(exam => {
      const range = examWindowRanges[exam.name].hard;
      return blockIdx >= range.startBlock && blockIdx <= range.endBlock;
    });
  };

  const isInExamSoftWindow = (blockIdx) => {
    return boardExams.some(exam => {
      const range = examWindowRanges[exam.name].soft;
      return blockIdx >= range.startBlock && blockIdx <= range.endBlock;
    });
  };

  // PGY-6 fellows who can't float in first 4 weeks (Blocks 0-3)
  const pgy6NoFloatFirstWeeks = ['Straley', 'Yousafzai', 'Mahmoud'];

  // ============ ELIGIBILITY RULES ============
  const hasICUByThisBlock = (fellow, blockIdx) =>
    schedule[fellow].slice(0, blockIdx + 1).some((r) => r === "ICU");

  const eligibleCall = (fellow, blockIdx) => {
    const rot = schedule[fellow]?.[blockIdx] ?? "";
    const pgy = pgyLevels[fellow];

    if (!pgy) return false;

    // hard excludes
    if (rot === "Nights" || rot === "Floor A" || rot === "Floor B") return false;

    // HARD CONSTRAINT: PGY-6 CANNOT call 2 weeks prior or during exam week
    if (pgy === 6 && isInExamHardWindow(blockIdx)) return false;

    // PGY-6 cannot call before block 2 (index 1)
    if (pgy === 6 && blockIdx < 1) return false;

    // PGY4 must have ICU by this block (ICU can be current block)
    if (pgy === 4 && !hasICUByThisBlock(fellow, blockIdx)) return false;

    // cannot call if going to Nights next block
    if (blockIdx < nBlocks - 1 && schedule[fellow]?.[blockIdx + 1] === "Nights") return false;

    return true;
  };

  const eligibleFloatStrict = (fellow, blockIdx) => {
    const rot = schedule[fellow]?.[blockIdx] ?? "";
    const pgy = pgyLevels[fellow];

    if (!pgy) return false;

    // hard excludes
    if (rot === "ICU" || rot === "Floor A" || rot === "Floor B") return false;

    // PGY-6 CANNOT float during board exam windows
    if (pgy === 6 && isInExamHardWindow(blockIdx)) return false;

    // PGY-6 cannot float in first 4 weeks
    if (pgy === 6 && pgy6NoFloatFirstWeeks.includes(fellow) && blockIdx < 4) return false;

    // strict rule: PGY4 needs prior floor
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

    // PGY-6 CANNOT float during board exam windows
    if (pgy === 6 && isInExamHardWindow(blockIdx)) return false;

    // PGY-6 cannot float in first 4 weeks
    if (pgy === 6 && pgy6NoFloatFirstWeeks.includes(fellow) && blockIdx < 4) return false;

    return true;
  };

  // ---------- CORRECT ADJACENCY: W1 & W2 same block only ----------
  // No one can be assigned the same type (call or float) in W1 AND W2 of same block
  const violatesAdjacencySameBlock = (schedule, fellow, blockIdx, type) => {
    const w1Key = keyFor(blockIdx, 1);
    const w2Key = keyFor(blockIdx, 2);
    
    if (type === "call") {
      return schedule[w1Key]?.name === fellow || schedule[w2Key]?.name === fellow;
    } else if (type === "float") {
      return schedule[w1Key]?.name === fellow || schedule[w2Key]?.name === fellow;
    }
    return false;
  };

  // No one can be assigned W2 of block N AND W1 of block N+1
  const violatesAdjacencyConsecutive = (schedule, fellow, blockIdx, weekend, type) => {
    if (weekend === 2 && blockIdx < nBlocks - 1) {
      const w1NextKey = keyFor(blockIdx + 1, 1);
      if (type === "call") return schedule[w1NextKey]?.name === fellow;
      if (type === "float") return schedule[w1NextKey]?.name === fellow;
    }
    if (weekend === 1 && blockIdx > 0) {
      const w2PrevKey = keyFor(blockIdx - 1, 2);
      if (type === "call") return schedule[w2PrevKey]?.name === fellow;
      if (type === "float") return schedule[w2PrevKey]?.name === fellow;
    }
    return false;
  };

  // ---------------- scoring ----------------
  const floatScore = (floatCounts, fellow, preferred) => {
    const pgy = pgyLevels[fellow];
    const target = floatTargets[pgy] ?? 1;
    const ratio = floatCounts[fellow] / Math.max(target, 1);
    return ratio - (preferred ? 0.25 : 0) + Math.random() * 0.01;
  };

  const callScore = (callCounts, fellow) => {
    const pgy = pgyLevels[fellow];
    const target = callTargets[pgy] ?? 1;
    return callCounts[fellow] / Math.max(target, 1) + Math.random() * 0.01;
  };

  // ---------------- attempt runner ----------------
  const runAttempt = () => {
    const callSchedule = {};
    const floatSchedule = {};

    const callCounts = {};
    const floatCounts = {};
    fellows.forEach((f) => {
      callCounts[f] = 0;
      floatCounts[f] = 0;
    });

    // 1) FLOATS strict: fill what you can, do not exceed targets
    for (let blockIdx = 0; blockIdx < nBlocks; blockIdx++) {
      const nightsFellow = fellows.find((f) => schedule[f]?.[blockIdx] === "Nights") || null;

      for (let weekend = 1; weekend <= 2; weekend++) {
        const key = keyFor(blockIdx, weekend);
        const preferNights = weekend === 2 && nightsFellow;

        let pick = null;

        // W2: attempt nights fellow first
        if (preferNights) {
          const nf = nightsFellow;
          if (
            nf &&
            floatCounts[nf] < (floatTargets[pgyLevels[nf]] ?? 999) &&
            eligibleFloatStrict(nf, blockIdx) &&
            !violatesAdjacencySameBlock(floatSchedule, nf, blockIdx, "float") &&
            !violatesAdjacencyConsecutive(floatSchedule, nf, blockIdx, weekend, "float")
          ) {
            pick = nf;
          }
        }

        if (!pick) {
          const candidates = shuffle(fellows).filter((f) => {
            if (floatCounts[f] >= (floatTargets[pgyLevels[f]] ?? 999)) return false;
            if (!eligibleFloatStrict(f, blockIdx)) return false;
            if (violatesAdjacencySameBlock(floatSchedule, f, blockIdx, "float")) return false;
            if (violatesAdjacencyConsecutive(floatSchedule, f, blockIdx, weekend, "float")) return false;
            // W1: avoid nights fellow if possible
            if (weekend === 1 && nightsFellow && f === nightsFellow) return false;
            return true;
          });

          if (candidates.length) {
            candidates.sort(
              (a, b) =>
                floatScore(floatCounts, a, preferNights && a === nightsFellow) -
                floatScore(floatCounts, b, preferNights && b === nightsFellow)
            );
            pick = candidates[0];
          }
        }

        if (pick) {
          floatSchedule[key] = { name: pick, relaxed: false };
          floatCounts[pick] += 1;
        }
      }
    }

    // 2) CALLS strict: fill what you can, do not exceed targets
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
          if (violatesAdjacencyConsecutive(callSchedule, f, blockIdx, weekend, "call")) return false;
          return true;
        });

        if (candidates.length) {
          candidates.sort((a, b) => callScore(callCounts, a) - callScore(callCounts, b));
          const pick = candidates[0];
          callSchedule[key] = { name: pick, relaxed: false };
          callCounts[pick] += 1;
          usedThisBlock.add(pick);
        }
      }
    }

    return { callSchedule, floatSchedule, callCounts, floatCounts };
  };

  // ---------------- choose best strict attempt ----------------
  let best = null;

  for (let i = 0; i < attempts; i++) {
    const attempt = runAttempt();
    const missCalls = countMissing(attempt.callSchedule);
    const missFloats = countMissing(attempt.floatSchedule);

    // prioritize call coverage massively
    const score = missCalls * 500 + missFloats * 80;

    if (!best || score < best.score) best = { ...attempt, score };
  }

  if (!best) return null;

  // ---------------- violations collector ----------------
  const violations = [];
  const addV = (v) => violations.push(v);

  const markRelaxed = ({ type, fellow, blockIdx, weekend, rule, detail }) => {
    addV({
      type,
      severity: "warn",
      fellow,
      block: blockIdx + 1,
      weekend: `W${weekend}`,
      rule,
      detail,
    });
  };

  const markError = ({ type, blockIdx, weekend, rule, detail }) => {
    addV({
      type,
      severity: "error",
      fellow: "",
      block: blockIdx + 1,
      weekend: `W${weekend}`,
      rule,
      detail,
    });
  };

  // ---------- RELAXED FILL PHASE ----------
  // Floats: try to fill missing, still capped, then allow exceeding targets if absolutely required
  for (let blockIdx = 0; blockIdx < nBlocks; blockIdx++) {
    for (let weekend = 1; weekend <= 2; weekend++) {
      const key = keyFor(blockIdx, weekend);
      if (best.floatSchedule[key]) continue;

      // Phase A: relaxed within targets
      let candidates = shuffle(fellows).filter((f) => {
        if (best.floatCounts[f] >= (floatTargets[pgyLevels[f]] ?? 999)) return false;
        if (!eligibleFloatRelaxed(f, blockIdx)) return false;
        if (violatesAdjacencySameBlock(best.floatSchedule, f, blockIdx, "float")) return false;
        if (violatesAdjacencyConsecutive(best.floatSchedule, f, blockIdx, weekend, "float")) return false;
        return true;
      });

      let pick = null;
      let usedRule = null;

      if (candidates.length) {
        candidates.sort((a, b) => (best.floatCounts[a] - best.floatCounts[b]) + Math.random() * 0.01);
        pick = candidates[0];
        usedRule = "relaxed_fill";
      }

      // Phase B: allow exceeding float targets (warn)
      if (!pick) {
        candidates = shuffle(fellows).filter((f) => {
          if (!eligibleFloatRelaxed(f, blockIdx)) return false;
          if (violatesAdjacencySameBlock(best.floatSchedule, f, blockIdx, "float")) return false;
          if (violatesAdjacencyConsecutive(best.floatSchedule, f, blockIdx, weekend, "float")) return false;
          return true;
        });
        if (candidates.length) {
          candidates.sort((a, b) => (best.floatCounts[a] - best.floatCounts[b]) + Math.random() * 0.01);
          pick = candidates[0];
          usedRule = "float_over_target";
        }
      }

      // Phase C: last resort ignore adjacency
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

        if (usedRule === "relaxed_fill") {
          markRelaxed({
            type: "float",
            fellow: pick,
            blockIdx,
            weekend,
            rule: "relaxed_fallback",
            detail: "Filled missing float using relaxed adjacency rules.",
          });
        } else if (usedRule === "float_over_target") {
          markRelaxed({
            type: "float",
            fellow: pick,
            blockIdx,
            weekend,
            rule: "over_target",
            detail: "Exceeded float target to fill missing float slot.",
          });
        } else if (usedRule === "float_ignore_adjacency") {
          markRelaxed({
            type: "float",
            fellow: pick,
            blockIdx,
            weekend,
            rule: "ignore_adjacency",
            detail: "Ignored adjacency rules to fill missing float slot.",
          });
        }

        // Extra: if PGY4 got float before floor, flag it
        if (pgyLevels[pick] === 4) {
          const hasDoneFloor = schedule[pick].slice(0, blockIdx).some((r) => r === "Floor A" || r === "Floor B");
          if (!hasDoneFloor) {
            markRelaxed({
              type: "float",
              fellow: pick,
              blockIdx,
              weekend,
              rule: "pgy4_float_before_floor",
              detail: "PGY4 assigned float before completing a floor block (relaxed).",
            });
          }
        }
      } else {
        markError({
          type: "float",
          blockIdx,
          weekend,
          rule: "unfilled_slot",
          detail: "No eligible fellow found for float, check exclusions/roster.",
        });
      }
    }
  }

  // Calls: MUST fill every slot
  for (let blockIdx = 0; blockIdx < nBlocks; blockIdx++) {
    const usedThisBlock = new Set(
      [keyFor(blockIdx, 1), keyFor(blockIdx, 2)].map((k) => best.callSchedule[k]?.name).filter(Boolean)
    );

    for (let weekend = 1; weekend <= 2; weekend++) {
      const key = keyFor(blockIdx, weekend);
      if (best.callSchedule[key]) continue;

      // Phase A: under-target, relaxed adjacency
      let candidates = shuffle(fellows).filter((f) => {
        const pgy = pgyLevels[f];
        if (usedThisBlock.has(f)) return false;
        if (!eligibleCall(f, blockIdx)) return false;
        if (violatesAdjacencySameBlock(best.callSchedule, f, blockIdx, "call")) return false;
        if (violatesAdjacencyConsecutive(best.callSchedule, f, blockIdx, weekend, "call")) return false;

        if (pgy === 6 && best.callCounts[f] >= (callTargets[pgy] ?? 999)) return false;
        return best.callCounts[f] < (callTargets[pgy] ?? 999);
      });

      let pick = null;
      let usedRule = null;

      if (candidates.length) {
        candidates.sort((a, b) => (best.callCounts[a] - best.callCounts[b]) + Math.random() * 0.01);
        pick = candidates[0];
        usedRule = "relaxed_fill_under_target";
      }

      // Phase B: allow over-target for PGY4/5 only
      if (!pick) {
        candidates = shuffle(fellows).filter((f) => {
          const pgy = pgyLevels[f];
          if (pgy === 6) return false;
          if (usedThisBlock.has(f)) return false;
          if (!eligibleCall(f, blockIdx)) return false;
          if (violatesAdjacencySameBlock(best.callSchedule, f, blockIdx, "call")) return false;
          if (violatesAdjacencyConsecutive(best.callSchedule, f, blockIdx, weekend, "call")) return false;
          return true;
        });

        if (candidates.length) {
          candidates.sort((a, b) => (best.callCounts[a] - best.callCounts[b]) + Math.random() * 0.01);
          pick = candidates[0];
          usedRule = "call_over_target";
        }
      }

      // Phase C: last resort ignore adjacency
      if (!pick) {
        candidates = shuffle(fellows).filter((f) => {
          const pgy = pgyLevels[f];
          if (pgy === 6) return false;
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

        if (usedRule === "relaxed_fill_under_target") {
          markRelaxed({
            type: "call",
            fellow: pick,
            blockIdx,
            weekend,
            rule: "relaxed_fallback",
            detail: "Filled missing call using relaxed adjacency rules.",
          });
        } else if (usedRule === "call_over_target") {
          markRelaxed({
            type: "call",
            fellow: pick,
            blockIdx,
            weekend,
            rule: "over_target",
            detail: "Exceeded call target (PGY4/5 only) to fill missing call slot.",
          });
        } else if (usedRule === "call_ignore_adjacency") {
          markRelaxed({
            type: "call",
            fellow: pick,
            blockIdx,
            weekend,
            rule: "ignore_adjacency",
            detail: "Ignored adjacency rules to fill missing call slot.",
          });
        }
      } else {
        markError({
          type: "call",
          blockIdx,
          weekend,
          rule: "unfilled_slot",
          detail:
            "No eligible PGY4/5 available without violating hard rules. Call slot left blank. Fix schedule/exclusions.",
        });
      }
    }
  }

  // Missing slot summary
  for (let blockIdx = 0; blockIdx < nBlocks; blockIdx++) {
    for (let weekend = 1; weekend <= 2; weekend++) {
      const ck = keyFor(blockIdx, weekend);
      const fk = keyFor(blockIdx, weekend);
      if (!best.callSchedule[ck]) {
        addV({
          type: "call",
          severity: "error",
          fellow: "",
          block: blockIdx + 1,
          weekend: `W${weekend}`,
          rule: "missing_call",
          detail: "Call slot is missing after all fill phases.",
        });
      }
      if (!best.floatSchedule[fk]) {
        addV({
          type: "float",
          severity: "warn",
          fellow: "",
          block: blockIdx + 1,
          weekend: `W${weekend}`,
          rule: "missing_float",
          detail: "Float slot is missing after all fill phases.",
        });
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