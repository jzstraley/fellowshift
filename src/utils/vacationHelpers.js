// vacationHelpers.js
// Pure helper functions for vacation/swap request views, no React, no state.
//
// IMPORTANT MODEL (normalized):
// - blockDates entries are parent 2-week-ish blocks only (block_number 1-26)
// - week-level granularity is represented on the REQUEST via week_part (1 or 2)
// - do NOT map to weekly block_numbers (1-52) in block_dates

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_OFF_REASONS = ['Sick Day', 'Personal Day', 'Conference', 'CME'];

// Default form shape, exported so sub-views can import without prop drilling
export const SWAP_RESET = { requester_id: '', my_shift_key: '', target_shift_key: '', reason: '' };

export const getNameFromAssignment = (val) => {
  if (!val) return null;
  return typeof val === 'object' ? (val.name ?? null) : val;
};

export const getRelaxedFromAssignment = (val) => {
  if (!val || typeof val !== 'object') return false;
  return !!val.relaxed;
};

// Supports two reason encodings:
//   Legacy:    `{type}|W{1|2}|note`
//   Bilateral: `{type}|req:B{block}-W{wk}|tgt:B{block2}-W{wk2}|note`
export const parseSwapReason = (reason) => {
  const out = { swapType: null, weekend: null, reqKey: null, tgtKey: null, note: '' };
  if (!reason || typeof reason !== 'string') return out;
  if (!reason.includes('|')) {
    out.note = reason;
    return out;
  }

  const parts = reason.split('|');
  const type = parts[0];
  if (type === 'call' || type === 'float') out.swapType = type;

  const reqPart = parts.find((p) => p.startsWith('req:'));
  const tgtPart = parts.find((p) => p.startsWith('tgt:'));
  if (reqPart && tgtPart) {
    out.reqKey = reqPart.replace('req:', '');
    out.tgtKey = tgtPart.replace('tgt:', '');
    const rm = out.reqKey.match(/^B\d+-W([12])$/);
    if (rm) out.weekend = Number(rm[1]);
    out.note = parts
      .filter((p) => p !== type && !p.startsWith('req:') && !p.startsWith('tgt:'))
      .join('|');
    return out;
  }

  const w = parts[1] || '';
  if (w.startsWith('W')) {
    const n = Number(w.replace('W', ''));
    if (n === 1 || n === 2) out.weekend = n;
  }
  out.note = parts.slice(2).join('|') || '';
  return out;
};

export const formatPretty = (isoDate) => {
  if (!isoDate) return '';
  const d = new Date(isoDate + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const fmtDate = (iso) =>
  iso
    ? new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

export const fmtDateObj = (d) =>
  d
    ? d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

// Given a parent block start/end (2-week-ish), compute the week window.
// weekPart: 1 or 2 (or null for full block)
export const getWeekWindowWithinBlock = (blockStartISO, blockEndISO, weekPart) => {
  if (!blockStartISO || !blockEndISO) return { start: null, end: null };

  const blockStart = new Date(blockStartISO + 'T00:00:00');
  const blockEnd = new Date(blockEndISO + 'T00:00:00');

  if (weekPart !== 1 && weekPart !== 2) {
    return { start: blockStart, end: blockEnd };
  }

  const w1Start = new Date(blockStart);
  const w1End = new Date(blockStart);
  w1End.setDate(w1End.getDate() + 6);

  const w2Start = new Date(blockStart);
  w2Start.setDate(w2Start.getDate() + 7);

  const w2End = new Date(w2Start);
  w2End.setDate(w2End.getDate() + 6);

  const clamp = (d) => (d > blockEnd ? blockEnd : d);

  return weekPart === 1
    ? { start: w1Start, end: clamp(w1End) }
    : { start: clamp(w2Start), end: clamp(w2End) };
};

// Optional utility if you still pass labels like "local-1-2" around in the UI.
// Returns { blockNumber: 1..26, weekPart: 1|2|null }
export const parseParentAndWeekPart = (value) => {
  const raw = String(value || '').trim();
  const normalized = raw.startsWith('local-') ? raw.slice(6) : raw; // tolerate legacy UI
  const [b, w] = normalized.split('-');

  const blockNumber = Number(b);
  const weekPart = w ? Number(w) : null;

  return {
    blockNumber: Number.isFinite(blockNumber) ? blockNumber : null,
    weekPart: weekPart === 1 || weekPart === 2 ? weekPart : null,
  };
};

export const formatBlockRange = (req) => {
  const startBlock = req?.start_block ?? null;
  const endBlock = req?.end_block ?? req?.start_block ?? null;

  const startDate = startBlock?.start_date ?? null;
  const endDate = endBlock?.end_date ?? null;

  // If this request is for a single block and includes week_part, render the 1-week window.
  const weekPart = req?.week_part ?? null;
  const sameBlock =
    startBlock?.id && endBlock?.id ? startBlock.id === endBlock.id : startBlock?.block_number === endBlock?.block_number;

  if (sameBlock && (weekPart === 1 || weekPart === 2) && startDate && endDate) {
    const { start, end } = getWeekWindowWithinBlock(startDate, endDate, weekPart);
    const s = fmtDateObj(start);
    const e = fmtDateObj(end);
    if (s && e && s !== e) return `${s} - ${e}`;
    if (s) return s;
  }

  // Full block or multi-block range
  if (startDate && endDate && startDate !== endDate) return `${fmtDate(startDate)} - ${fmtDate(endDate)}`;
  if (startDate) return fmtDate(startDate);

  // Fallback by block numbers
  const startNum = startBlock?.block_number ?? '?';
  const endNum = endBlock?.block_number ?? '?';

  if (startNum === endNum) {
    if (weekPart === 1 || weekPart === 2) return `Block ${startNum}, Wk ${weekPart}`;
    return `Block ${startNum}`;
  }
  return `Blocks ${startNum}-${endNum}`;
};

// ─── Schedule context helpers ──────────────────────────────────────────────
export const ROTATION_ABBR = {
  'Floor A': 'FlA', 'Floor B': 'FlB',
  'Nuclear': 'Nuc', 'Nuclear 2': 'Nc2', 'Nuclear 3': 'Nc3',
  'Nights': 'Nts',
  'Research': 'Res', 'Research 2': 'Rs2',
  'Structural': 'Str', 'Vascular': 'Vasc', 'Admin': 'Adm',
  'Cath 2': 'Ct2', 'Cath 3': 'Ct3',
  'Echo 2': 'Ec2',
  'AI 2': 'AI2',
};

export function abbreviateRotation(rot) {
  if (!rot || rot === '—') return '—';
  if (rot in ROTATION_ABBR) return ROTATION_ABBR[rot];
  return rot.replace(/\s+\d+$/, '').slice(0, 4);
}

// Per-day weekend status for a block:
//   Call   → Sat=C, Sun=C  |  Float → Sat=F, Sun=X
//   Nights → Sat=X, Sun=N  |  Off   → Sat=X, Sun=X
export function weekendStatuses(blockDetails, wk) {
  const rotation = blockDetails?.find(d => d.label === 'Rotation')?.value ?? '';
  const callVal  = blockDetails?.find(d => d.label === 'Call')?.value  ?? '';
  const floatVal = blockDetails?.find(d => d.label === 'Float')?.value ?? '';
  const isNights = /nights/i.test(rotation);
  const hasCall  = callVal.includes(`W${wk}`);
  const hasFloat = floatVal.includes(`W${wk}`);
  if (hasCall)  return { sat: 'C', sun: 'C' };
  if (hasFloat) return { sat: 'F', sun: 'X' };
  if (isNights) return { sat: 'X', sun: 'N' };
  return { sat: 'X', sun: 'X' };
}

// True if the person has any duty (not fully off) in that block/wk
export function hasDuty({ sat, sun }) {
  return sat !== 'X' || sun !== 'X';
}

// Pure: caller passes parent blockDates (block_number 1-26).
// weekend is legacy naming in swap reasons (W1/W2). Treat it as weekPart 1/2.
export const fmtSwapBlock = (blockNum, weekend, blockDates) => {
  if (!blockNum) return '-';

  const block = Array.isArray(blockDates) ? blockDates.find((b) => b.block_number === blockNum) : null;

  if (!block?.start_date || !block?.end_date) {
    return `Block ${blockNum}${weekend ? `, Wk ${weekend}` : ''}`;
  }

  const weekPart = weekend === 1 || weekend === 2 ? weekend : null;

  if (weekPart) {
    const { start, end } = getWeekWindowWithinBlock(block.start_date, block.end_date, weekPart);
    const s = fmtDateObj(start);
    const e = fmtDateObj(end);
    if (s && e && s !== e) return `${s} - ${e}`;
    if (s) return s;
  }

  // Full parent block range
  if (block.start_date !== block.end_date) return `${fmtDate(block.start_date)} - ${fmtDate(block.end_date)}`;
  return fmtDate(block.start_date);
};