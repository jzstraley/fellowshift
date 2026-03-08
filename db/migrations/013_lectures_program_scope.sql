-- Migration 013: Upgrade lectures table to program scope + refresh PostgREST cache
-- Fixes:
--   BUG-002a: lectures table missing program_id column (toDbRow sends it; INSERT fails)
--   BUG-002b: PostgREST schema cache stale after migration 009 added check_in_open
--   BUG-002c: lectures RLS upgrade to program-scope (matching other tables in mig 003)
-- Safe to run multiple times (IF NOT EXISTS / DROP IF EXISTS throughout).
-- Run after migration 012.

begin;

-- ============================================================================
-- STEP 1: Ensure check_in_open exists (idempotent re-apply of mig 009 step 1)
-- ============================================================================
ALTER TABLE public.lectures
  ADD COLUMN IF NOT EXISTS check_in_open BOOLEAN DEFAULT NULL;

-- ============================================================================
-- STEP 2: Add program_id FK to lectures (frontend toDbRow already sends it)
--         and make the legacy program TEXT column nullable so INSERT doesn't
--         require it (program_id now carries the scope relationship).
-- ============================================================================
ALTER TABLE public.lectures
  ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL;

-- Make legacy text column nullable so rows with program_id don't need it
ALTER TABLE public.lectures
  ALTER COLUMN program DROP NOT NULL;

-- Backfill program_id from programs table using existing institution_id + program text
UPDATE public.lectures l
SET program_id = p.id
FROM public.programs p
WHERE p.institution_id = l.institution_id
  AND p.name = l.program
  AND l.program_id IS NULL;

CREATE INDEX IF NOT EXISTS lectures_program_id_idx ON public.lectures (program_id);

-- ============================================================================
-- STEP 3: Upgrade lectures RLS to program-scope
-- Drop old institution-scoped policies; replace with program-scoped ones.
-- ============================================================================

-- Drop old policies from supabase_schema.sql / supabase_migration_roles.sql
DROP POLICY IF EXISTS "View lectures in institution" ON public.lectures;
DROP POLICY IF EXISTS "Manage lectures"              ON public.lectures;

-- Read: any program member or institution admin can see lectures
CREATE POLICY "Lectures readable" ON public.lectures
  FOR SELECT USING (
    institution_id = get_user_institution_id()
    OR (
      program_id IS NOT NULL
      AND (
        is_program_member(program_id)
        OR EXISTS (
          SELECT 1 FROM public.programs p
          WHERE p.id = lectures.program_id
            AND is_institution_admin(p.institution_id)
        )
      )
    )
  );

-- Write: program managers or institution admins
CREATE POLICY "Lectures writable" ON public.lectures
  FOR ALL
  USING (
    has_program_role(program_id, ARRAY['program_admin','program_director','chief_fellow'])
    OR EXISTS (
      SELECT 1 FROM public.programs p
      WHERE p.id = lectures.program_id
        AND is_institution_admin(p.institution_id)
    )
    OR (
      -- fallback: institution-scoped role check for rows without program_id
      program_id IS NULL
      AND get_user_role() IN ('program_director', 'chief_fellow', 'admin')
      AND institution_id = get_user_institution_id()
    )
  )
  WITH CHECK (
    has_program_role(program_id, ARRAY['program_admin','program_director','chief_fellow'])
    OR EXISTS (
      SELECT 1 FROM public.programs p
      WHERE p.id = lectures.program_id
        AND is_institution_admin(p.institution_id)
    )
    OR (
      program_id IS NULL
      AND get_user_role() IN ('program_director', 'chief_fellow', 'admin')
      AND institution_id = get_user_institution_id()
    )
  );

-- ============================================================================
-- STEP 4: Force PostgREST to reload schema cache
-- Picks up check_in_open and program_id columns immediately after commit.
-- ============================================================================
NOTIFY pgrst, 'reload schema';

commit;

-- ============================================================================
-- Verification queries (run separately after commit):
-- ============================================================================
-- 1. Confirm columns:
--    SELECT column_name, data_type FROM information_schema.columns
--    WHERE table_name = 'lectures'
--      AND column_name IN ('check_in_open', 'program_id')
--    ORDER BY column_name;
--
-- 2. Confirm RLS policies:
--    SELECT policyname, cmd FROM pg_policies WHERE tablename = 'lectures';
--
-- 3. Confirm backfill:
--    SELECT COUNT(*) FROM lectures WHERE program_id IS NULL AND program IS NOT NULL;
