// src/engine/ioScheduleCsv.js

const normalizeHeader = (s) => String(s ?? "").trim().toLowerCase();

const splitLineSmart = (line, delimiter) => {
  // Minimal CSV/TSV splitter with quote support.
  // Handles: "Cath, 2" as one cell in CSV.
  const out = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      // doubled quotes inside quoted field
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && ch === delimiter) {
      out.push(cur);
      cur = "";
      continue;
    }

    cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim());
};

const detectDelimiter = (text) => {
  // Prefer tab if present in header line, else comma
  const firstLine = text.split(/\r?\n/).find((l) => l.trim().length > 0) ?? "";
  return firstLine.includes("\t") ? "\t" : ",";
};

export const parseScheduleTable = (text, { fellows, nBlocks = 26 }) => {
  const delimiter = detectDelimiter(text);
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);

  if (lines.length < 2) {
    return { ok: false, error: "File has no data rows." };
  }

  const headerCells = splitLineSmart(lines[0], delimiter);
  if (headerCells.length < 2) {
    return { ok: false, error: "Header row is invalid." };
  }

  if (normalizeHeader(headerCells[0]) !== "fellow") {
    return { ok: false, error: 'First header cell must be "Fellow".' };
  }

  // Validate blocks
  for (let i = 1; i <= nBlocks; i++) {
    const expected = `block ${i}`;
    const got = normalizeHeader(headerCells[i] ?? "");
    if (got !== expected) {
      return {
        ok: false,
        error: `Header mismatch at column ${i + 1}. Expected "${expected}", got "${headerCells[i] ?? ""}".`,
      };
    }
  }

  const fellowSet = new Set(fellows);

  const nextSchedule = {};
  const unknownFellows = [];
  const rowLengthIssues = [];

  for (let r = 1; r < lines.length; r++) {
    const cells = splitLineSmart(lines[r], delimiter);

    const name = (cells[0] ?? "").trim();
    if (!name) continue;

    if (!fellowSet.has(name)) {
      unknownFellows.push(name);
      continue;
    }

    if (cells.length < nBlocks + 1) {
      rowLengthIssues.push(`${name} has ${cells.length - 1} blocks, expected ${nBlocks}.`);
      // still pad
    }

    const blocks = [];
    for (let i = 1; i <= nBlocks; i++) {
      blocks.push((cells[i] ?? "").trim());
    }
    nextSchedule[name] = blocks;
  }

  if (unknownFellows.length) {
    return {
      ok: false,
      error: `Unknown fellows in import: ${unknownFellows.join(", ")}`,
    };
  }

  if (rowLengthIssues.length) {
    return {
      ok: false,
      error: `Block count issues:\n${rowLengthIssues.join("\n")}`,
    };
  }

  // Ensure all fellows exist (keep old schedule for missing rows is a policy choice)
  // Here we require every fellow row to be present:
  const missing = fellows.filter((f) => !nextSchedule[f]);
  if (missing.length) {
    return {
      ok: false,
      error: `Missing rows for fellows: ${missing.join(", ")}`,
    };
  }

  return { ok: true, schedule: nextSchedule };
};

export const buildScheduleCSV = (schedule, fellows, nBlocks = 26) => {
  const header = ["Fellow", ...Array.from({ length: nBlocks }, (_, i) => `Block ${i + 1}`)];

  const rows = [header];

  for (const f of fellows) {
    const arr = schedule[f] ?? [];
    const row = [f];
    for (let i = 0; i < nBlocks; i++) row.push(arr[i] ?? "");
    rows.push(row);
  }

  const esc = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  return rows.map((r) => r.map(esc).join(",")).join("\n");
};

export const buildViolationsCSV = (violations = []) => {
  // violations: [{ type, severity, fellow, block, weekend, rule, detail }]
  const header = ["type", "severity", "fellow", "block", "weekend", "rule", "detail"];
  const rows = [header];

  for (const v of violations) {
    rows.push([
      v.type ?? "",
      v.severity ?? "",
      v.fellow ?? "",
      v.block ?? "",
      v.weekend ?? "",
      v.rule ?? "",
      v.detail ?? "",
    ]);
  }

  const esc = (x) => `"${String(x ?? "").replaceAll('"', '""')}"`;
  return rows.map((r) => r.map(esc).join(",")).join("\n");
};

export const downloadTextFile = (filename, text, mime = "text/csv;charset=utf-8;") => {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};
