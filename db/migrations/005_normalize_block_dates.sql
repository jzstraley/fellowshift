-- 005_normalize_block_dates.sql
-- Completes the normalization of block_dates started in 003_normalized_scope.sql.
--
-- 003 already:
--   • Added program_id uuid references programs(id)
--   • Added academic_year_id uuid references academic_years(id)
--   • Backfilled both from legacy text columns
--   • Added unique (program_id, academic_year_id, block_number)
--
-- This migration:
--   1. Re-runs backfill for any rows that slipped through (empty-program edge cases)
--   2. Enforces NOT NULL on the UUID columns (aborts if backfill is incomplete)
--   3. Drops NOT NULL from the legacy text columns so app writes are optional
--      (drop the columns entirely once the app no longer references them)

begin;

-- ---------------------------------------------------------------------------
-- 1) Re-backfill any remaining nulls
-- ---------------------------------------------------------------------------

-- program_id: match on slug OR name
update public.block_dates bd
set program_id = p.id
from public.programs p
where bd.program_id is null
  and bd.institution_id = p.institution_id
  and (bd.program = p.slug or bd.program = p.name);

-- academic_year_id: match on label
update public.block_dates bd
set academic_year_id = ay.id
from public.academic_years ay
where bd.academic_year_id is null
  and bd.institution_id = ay.institution_id
  and bd.academic_year = ay.label;

-- Abort if anything is still null — fix the data before re-running.
do $$
declare
  prog_nulls bigint;
  year_nulls bigint;
begin
  select
    count(*) filter (where program_id    is null),
    count(*) filter (where academic_year_id is null)
  into prog_nulls, year_nulls
  from public.block_dates;

  if prog_nulls > 0 or year_nulls > 0 then
    raise exception
      'Backfill incomplete: % row(s) with null program_id, % with null academic_year_id. '
      'Fix the data then re-run this migration.',
      prog_nulls, year_nulls;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2) Enforce NOT NULL on normalized UUID columns
-- ---------------------------------------------------------------------------

alter table public.block_dates
  alter column program_id     set not null,
  alter column academic_year_id set not null;

-- ---------------------------------------------------------------------------
-- 3) Relax NOT NULL on legacy text columns (transition: keep but don't require)
--
-- The app still writes program / academic_year text as a convenience layer;
-- removing the NOT NULL pressure lets new-scope inserts omit them cleanly.
-- Once the app is fully migrated, run:
--   alter table public.block_dates drop column program, drop column academic_year;
-- ---------------------------------------------------------------------------

alter table public.block_dates
  alter column program      drop not null,
  alter column academic_year drop not null;

commit;
