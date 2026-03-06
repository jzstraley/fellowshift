#!/usr/bin/env node
// scripts/seed.js
// Pushes base data from src/data/scheduleData.js to Supabase.
// Run from the project root:  node scripts/seed.js
//
// Prerequisites:
//   .env.local must contain VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
//   (or SUPABASE_SERVICE_ROLE_KEY for bypassing RLS)

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// ── Load .env.local manually (dotenv may not be installed as a script dep) ──
function loadEnv() {
  try {
    const raw = readFileSync(resolve(root, '.env.local'), 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)$/);
      if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  } catch (_) { /* no .env.local — rely on real env vars */ }
}
loadEnv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??   // preferred: bypasses RLS
  process.env.VITE_SUPABASE_ANON_KEY;        // fallback: anon key (RLS applies)

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: Missing VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_ANON_KEY)');
  console.error('\nGet your service_role key from:');
  console.error('  Supabase Dashboard → Settings → API → service_role (secret)');
  console.error('\nAdd it to .env.local:');
  console.error('  SUPABASE_SERVICE_ROLE_KEY=eyJ...');
  process.exit(1);
}

// Parse optional CLI overrides: node scripts/seed.js --programId=<uuid> --academicYearId=<uuid>
const cliArgs = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const [k, v] = a.slice(2).split('='); return [k, v]; })
);
if (cliArgs.programId) console.log(`CLI override programId: ${cliArgs.programId}`);
if (cliArgs.academicYearId) console.log(`CLI override academicYearId: ${cliArgs.academicYearId}`);

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Import base data ──────────────────────────────────────────────────────────
import {
  initialSchedule,
  initialCallSchedule,
  initialNightFloatSchedule,
  initialClinicDays,
  blockDates as localBlockDates,
  pgyLevels,
} from '../src/data/scheduleData.js';

const BLOCKS = 26;
const WEEKENDS_PER_BLOCK = 2;

// ── Discover program + academic year ─────────────────────────────────────────
async function discoverScope() {
  // Allow CLI overrides for environments where RLS blocks discovery
  if (cliArgs.programId && cliArgs.academicYearId) {
    const { data: prog, error: pe } = await supabase
      .from('programs')
      .select('institution_id')
      .eq('id', cliArgs.programId)
      .single();
    if (pe) throw new Error(`programs lookup: ${pe.message}`);
    console.log(`Using programId: ${cliArgs.programId}`);
    console.log(`Using academicYearId: ${cliArgs.academicYearId}`);
    return { programId: cliArgs.programId, academicYearId: cliArgs.academicYearId, institutionId: prog.institution_id };
  }

  const { data: programs, error: pe } = await supabase
    .from('programs')
    .select('id, name, institution_id')
    .order('created_at', { ascending: true })
    .limit(5);

  if (pe) throw new Error(`programs: ${pe.message}`);
  if (!programs?.length) {
    throw new Error(
      'No programs found (RLS may be blocking the anon key).\n\n' +
      'Options:\n' +
      '  1) Add SUPABASE_SERVICE_ROLE_KEY to .env.local (get it from Supabase Dashboard → Settings → API)\n' +
      '  2) Pass IDs directly: node scripts/seed.js --programId=<uuid> --academicYearId=<uuid>'
    );
  }

  console.log('\nAvailable programs:');
  programs.forEach((p, i) => console.log(`  [${i}] ${p.name} (${p.id})`));
  const program = programs[0];
  console.log(`\nUsing program: "${program.name}" (${program.id})`);

  const { data: years, error: ye } = await supabase
    .from('academic_years')
    .select('id, label, start_date')
    .order('start_date', { ascending: false })
    .limit(5);

  if (ye) throw new Error(`academic_years: ${ye.message}`);
  if (!years?.length) throw new Error('No academic years found. Create one in Supabase first.');

  console.log('\nAvailable academic years:');
  years.forEach((y, i) => console.log(`  [${i}] ${y.label ?? y.start_date} (${y.id})`));
  const year = years[0];
  console.log(`Using academic year: "${year.label ?? year.start_date}" (${year.id})\n`);

  return { programId: program.id, academicYearId: year.id, institutionId: program.institution_id };
}

// ── 1) Upsert block_dates ─────────────────────────────────────────────────────
async function seedBlockDates({ programId, academicYearId, institutionId }) {
  const rows = localBlockDates.map(b => ({
    institution_id: institutionId,
    program_id: programId,
    academic_year_id: academicYearId,
    block_number: Number(b.block),
    rotation_number: Number(b.rotation ?? b.block),
    start_date: b.start,
    end_date: b.end,
  }));

  const { error } = await supabase
    .from('block_dates')
    .upsert(rows, { onConflict: 'program_id,academic_year_id,block_number' });

  if (error) throw new Error(`block_dates upsert: ${error.message}`);
  console.log(`✓ block_dates: ${rows.length} rows upserted`);

  const { data: blocks, error: re } = await supabase
    .from('block_dates')
    .select('id, block_number')
    .eq('program_id', programId)
    .eq('academic_year_id', academicYearId);

  if (re) throw new Error(`block_dates fetch: ${re.message}`);
  return Object.fromEntries(blocks.map(b => [Number(b.block_number), b.id]));
}

// ── 2) Ensure fellows exist, return name→id map ───────────────────────────────
async function ensureFellows({ programId, institutionId }) {
  const names = Object.keys(initialSchedule);

  let { data: existing, error: fe } = await supabase
    .from('fellows')
    .select('id, name')
    .eq('program_id', programId);

  if (fe) throw new Error(`fellows fetch: ${fe.message}`);

  const existingNames = new Set((existing ?? []).map(f => f.name));
  const toInsert = names
    .filter(n => !existingNames.has(n))
    .map(n => ({
      name: n,
      institution_id: institutionId,
      program_id: programId,
      is_active: true,
      pgy_level: pgyLevels[n] ?? 1,
    }));

  if (toInsert.length) {
    const { data: seeded, error: se } = await supabase
      .from('fellows')
      .insert(toInsert)
      .select('id, name');
    if (se) throw new Error(`fellows insert: ${se.message}`);
    existing = [...(existing ?? []), ...(seeded ?? [])];
    console.log(`✓ fellows: inserted ${toInsert.length} new (${toInsert.map(f => f.name).join(', ')})`);
  } else {
    console.log(`✓ fellows: all ${names.length} already exist`);
  }

  // Also update pgy_level and clinic_day for existing fellows
  const nameToId = Object.fromEntries((existing ?? []).map(f => [f.name, f.id]));

  const pgyUpdates = (existing ?? [])
    .filter(f => pgyLevels[f.name] !== undefined)
    .map(f => supabase.from('fellows').update({ pgy_level: pgyLevels[f.name] }).eq('id', f.id));

  const clinicUpdates = (existing ?? [])
    .filter(f => initialClinicDays[f.name] !== undefined)
    .map(f => supabase.from('fellows').update({ clinic_day: initialClinicDays[f.name] }).eq('id', f.id));

  await Promise.all([...pgyUpdates, ...clinicUpdates]);
  console.log(`✓ fellows: pgy_level + clinic_day updated`);

  return nameToId;
}

// ── 3) Upsert schedule_assignments ───────────────────────────────────────────
async function seedSchedule({ programId, nameToId, numToBlockId }) {
  const assignments = [];
  for (const [name, rotations] of Object.entries(initialSchedule)) {
    const fellowId = nameToId[name];
    if (!fellowId) { console.warn(`  WARN: fellow "${name}" not in DB, skipping`); continue; }
    rotations.forEach((rotation, idx) => {
      const blockNum = idx + 1;
      const blockDateId = numToBlockId[blockNum];
      if (!blockDateId) return;
      assignments.push({ fellow_id: fellowId, block_date_id: blockDateId, rotation: rotation ?? '' });
    });
  }

  const { error } = await supabase
    .from('schedule_assignments')
    .upsert(assignments, { onConflict: 'fellow_id,block_date_id' });

  if (error) throw new Error(`schedule_assignments upsert: ${error.message}`);
  console.log(`✓ schedule_assignments: ${assignments.length} rows upserted`);
}

// ── 4) Upsert call_float_assignments ─────────────────────────────────────────
async function seedCallFloat({ programId, academicYearId, nameToId }) {
  const rows = [];
  const addRows = (sched, type) => {
    for (let b = 1; b <= BLOCKS; b++) {
      for (let w = 1; w <= WEEKENDS_PER_BLOCK; w++) {
        const key = `B${b}-W${w}`;
        const val = sched?.[key];
        const name = typeof val === 'string' ? val : val?.name ?? null;
        const relaxed = typeof val === 'object' ? !!(val?.relaxed) : false;
        const fellowId = name ? (nameToId[name] ?? null) : null;
        rows.push({
          program_id: programId,
          academic_year_id: academicYearId,
          block_number: b,
          weekend: w,
          type,
          fellow_id: fellowId,
          relaxed,
        });
      }
    }
  };
  addRows(initialCallSchedule, 'call');
  addRows(initialNightFloatSchedule, 'float');

  const { error } = await supabase
    .from('call_float_assignments')
    .upsert(rows, { onConflict: 'program_id,academic_year_id,block_number,weekend,type' });

  if (error) throw new Error(`call_float_assignments upsert: ${error.message}`);
  console.log(`✓ call_float_assignments: ${rows.length} rows upserted`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('FellowShift seed script — pushing base data to Supabase\n');

  const { programId, academicYearId, institutionId } = await discoverScope();

  const numToBlockId = await seedBlockDates({ programId, academicYearId, institutionId });
  const nameToId = await ensureFellows({ programId, institutionId });
  await seedSchedule({ programId, nameToId, numToBlockId });
  await seedCallFloat({ programId, academicYearId, nameToId });

  console.log('\nAll done!');
}

main().catch(err => { console.error('\nFATAL:', err.message); process.exit(1); });
