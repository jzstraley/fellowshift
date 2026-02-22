-- FellowShift Role Migration
-- Run this in your Supabase SQL Editor to update an existing database.
-- Migrates from: viewer, fellow, chief_fellow, program_director
-- Migrates to:   resident, fellow, chief_fellow, program_director, admin
--
-- Each step is wrapped in a DO block so that missing tables are skipped
-- gracefully instead of aborting the whole script.

-- ============================================================================
-- STEP 1: Rename 'viewer' → 'resident' for existing users
-- ============================================================================
UPDATE profiles SET role = 'resident' WHERE role = 'viewer';

-- ============================================================================
-- STEP 2: Update the CHECK constraint on profiles.role
-- ============================================================================
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('resident', 'fellow', 'chief_fellow', 'program_director', 'admin'));

-- ============================================================================
-- STEP 3: RLS policies — fellows management
-- ============================================================================
DO $$ BEGIN
  DROP POLICY IF EXISTS "Program directors can manage fellows" ON fellows;
  CREATE POLICY "Program directors can manage fellows"
  ON fellows FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND institution_id = fellows.institution_id
      AND role IN ('program_director', 'chief_fellow', 'admin')
    )
  );
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Table fellows does not exist — skipping.';
END $$;

-- ============================================================================
-- STEP 4: RLS policies — schedule assignments
-- ============================================================================
DO $$ BEGIN
  DROP POLICY IF EXISTS "Program directors can edit all schedules" ON schedule_assignments;
  CREATE POLICY "Program directors can edit all schedules"
  ON schedule_assignments FOR ALL
  USING (
    get_user_role() IN ('program_director', 'admin')
    AND EXISTS (
      SELECT 1 FROM fellows
      WHERE id = schedule_assignments.fellow_id
      AND institution_id = get_user_institution_id()
    )
  );
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Table schedule_assignments does not exist — skipping.';
END $$;

-- ============================================================================
-- STEP 5: RLS policies — vacation requests
-- ============================================================================
DO $$ BEGIN
  DROP POLICY IF EXISTS "Fellows can create vacation requests" ON vacation_requests;
  CREATE POLICY "Fellows can create vacation requests"
  ON vacation_requests FOR INSERT
  WITH CHECK (
    requested_by = auth.uid()
    AND get_user_role() IN ('fellow', 'program_director', 'chief_fellow', 'admin')
  );

  DROP POLICY IF EXISTS "Program directors can manage vacation requests" ON vacation_requests;
  CREATE POLICY "Program directors can manage vacation requests"
  ON vacation_requests FOR UPDATE
  USING (
    get_user_role() IN ('program_director', 'chief_fellow', 'admin')
    AND EXISTS (
      SELECT 1 FROM fellows
      WHERE id = vacation_requests.fellow_id
      AND institution_id = get_user_institution_id()
    )
  );
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Table vacation_requests does not exist — skipping.';
END $$;

-- ============================================================================
-- STEP 6: RLS policies — swap requests
-- ============================================================================
DO $$ BEGIN
  DROP POLICY IF EXISTS "Fellows can create swap requests" ON swap_requests;
  CREATE POLICY "Fellows can create swap requests"
  ON swap_requests FOR INSERT
  WITH CHECK (
    requested_by = auth.uid()
    AND get_user_role() IN ('fellow', 'program_director', 'chief_fellow', 'admin')
  );

  DROP POLICY IF EXISTS "Program directors can manage swap requests" ON swap_requests;
  CREATE POLICY "Program directors can manage swap requests"
  ON swap_requests FOR UPDATE
  USING (
    get_user_role() IN ('program_director', 'chief_fellow', 'admin')
    AND EXISTS (
      SELECT 1 FROM fellows
      WHERE id = swap_requests.requester_fellow_id
      AND institution_id = get_user_institution_id()
    )
  );
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Table swap_requests does not exist — skipping.';
END $$;

-- ============================================================================
-- STEP 7: RLS policies — call assignments
-- ============================================================================
DO $$ BEGIN
  DROP POLICY IF EXISTS "Program directors can manage call assignments" ON call_assignments;
  CREATE POLICY "Program directors can manage call assignments"
  ON call_assignments FOR ALL
  USING (
    get_user_role() IN ('program_director', 'admin')
    AND EXISTS (
      SELECT 1 FROM fellows
      WHERE id = call_assignments.fellow_id
      AND institution_id = get_user_institution_id()
    )
  );
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Table call_assignments does not exist — skipping.';
END $$;

-- ============================================================================
-- STEP 8: RLS policies — lectures
-- ============================================================================
DO $$ BEGIN
  DROP POLICY IF EXISTS "Manage lectures" ON lectures;
  CREATE POLICY "Manage lectures"
  ON lectures FOR ALL
  USING (
    get_user_role() IN ('program_director', 'chief_fellow', 'admin')
    AND institution_id = get_user_institution_id()
  );
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Table lectures does not exist — skipping.';
END $$;

-- ============================================================================
-- STEP 9: RLS policies — block dates
-- ============================================================================
DO $$ BEGIN
  DROP POLICY IF EXISTS "Program directors can manage block dates" ON block_dates;
  CREATE POLICY "Program directors can manage block dates"
  ON block_dates FOR ALL
  USING (
    get_user_role() IN ('program_director', 'admin')
    AND institution_id = get_user_institution_id()
  );
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Table block_dates does not exist — skipping.';
END $$;

-- ============================================================================
-- STEP 10: RLS policies — admin user management (profiles table)
-- ============================================================================
-- Admins need to view all profiles in their institution and insert new ones.

-- Allow admins to view all profiles in their institution
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Admins can view all profiles"
ON profiles FOR SELECT
USING (
  get_user_role() = 'admin'
  AND institution_id = get_user_institution_id()
);

-- Allow admins to insert new profiles for their institution
DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;
CREATE POLICY "Admins can insert profiles"
ON profiles FOR INSERT
WITH CHECK (
  get_user_role() = 'admin'
  AND institution_id = get_user_institution_id()
);

-- Allow admins to update any profile in their institution
DROP POLICY IF EXISTS "Admins can update profiles" ON profiles;
CREATE POLICY "Admins can update profiles"
ON profiles FOR UPDATE
USING (
  get_user_role() = 'admin'
  AND institution_id = get_user_institution_id()
);

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Run this to confirm no 'viewer' roles remain and constraint is active:
-- SELECT role, COUNT(*) FROM profiles GROUP BY role ORDER BY role;
