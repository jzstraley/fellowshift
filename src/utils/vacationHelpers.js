// Pure helper functions for vacation/swap request views — no React, no state.

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_OFF_REASONS = ['Sick Day', 'Personal Day', 'Conference', 'CME'];

// Default form shape — exported so sub-views can import without prop drilling
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
//   Legacy:   `{type}|W{1|2}|note`
//   Bilateral:`{type}|req:B{block}-W{wknd}|tgt:B{block2}-W{wknd2}|note`
export const parseSwapReason = (reason) => {
  const out = { swapType: null, weekend: null, reqKey: null, tgtKey: null, note: '' };
  if (!reason || typeof reason !== 'string') return out;
  if (!reason.includes('|')) { out.note = reason; return out; }

  const parts = reason.split('|');
  const type = parts[0];
  if (type === 'call' || type === 'float') out.swapType = type;

  const reqPart = parts.find(p => p.startsWith('req:'));
  const tgtPart = parts.find(p => p.startsWith('tgt:'));
  if (reqPart && tgtPart) {
    out.reqKey = reqPart.replace('req:', '');
    out.tgtKey = tgtPart.replace('tgt:', '');
    const rm = out.reqKey.match(/^B\d+-W([12])$/);
    if (rm) out.weekend = Number(rm[1]);
    out.note = parts.filter(p => p !== type && !p.startsWith('req:') && !p.startsWith('tgt:')).join('|');
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
  const d = new Date(isoDate + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const fmtDate = (d) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;

export const formatBlockRange = (req) => {
  const startDate = req.start_block?.start_date;
  const endDate = (req.end_block ?? req.start_block)?.end_date;
  if (startDate && endDate && startDate !== endDate) return `${fmtDate(startDate)} - ${fmtDate(endDate)}`;
  if (startDate) return fmtDate(startDate);
  const start = req.start_block?.block_number ?? '?';
  const end = req.end_block?.block_number ?? '?';
  return start === end ? `Week ${start}` : `Weeks ${start}-${end}`;
};

// Pure: caller passes blockDates so this stays stateless
export const fmtSwapBlock = (blockNum, weekend, blockDates) => {
  if (!blockNum) return '—';
  if (weekend) {
    const weeklyNum = (blockNum - 1) * 2 + weekend;
    const entry = blockDates.find(b => b.block_number === weeklyNum);
    if (entry?.start_date) {
      return entry.start_date !== entry.end_date
        ? `${fmtDate(entry.start_date)} - ${fmtDate(entry.end_date)}`
        : fmtDate(entry.start_date);
    }
  }
  const w1 = blockDates.find(b => b.block_number === (blockNum - 1) * 2 + 1);
  const w2 = blockDates.find(b => b.block_number === blockNum * 2);
  if (w1?.start_date && w2?.end_date) return `${fmtDate(w1.start_date)} - ${fmtDate(w2.end_date)}`;
  if (w1?.start_date) return fmtDate(w1.start_date);
  return `Block ${blockNum}${weekend ? `, Wk ${weekend}` : ''}`;
};
