-- Migration 009: Lecture attendance tracking
-- Adds check_in_open column to lectures and creates lecture_attendance table.
-- Safe to run multiple times (IF NOT EXISTS / OR REPLACE throughout).
-- Run after migration 008.

begin;

-- ============================================================================
-- STEP 1: Add check_in_open to lectures
--   null  = auto time-window (±15 min around lecture start)
--   true  = admin has manually opened check-in
--   false = admin has manually closed check-in
-- ============================================================================

ALTER TABLE public.lectures
  ADD COLUMN IF NOT EXISTS check_in_open BOOLEAN DEFAULT NULL;

-- ============================================================================
-- STEP 2: lecture_attendance table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.lecture_attendance (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lecture_id     UUID        NOT NULL REFERENCES public.lectures(id) ON DELETE CASCADE,
  fellow_id      UUID        NOT NULL REFERENCES public.fellows(id)  ON DELETE CASCADE,
  status         TEXT        NOT NULL
                             CHECK (status IN ('present', 'absent', 'excused', 'late')),
  checked_in_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  checked_in_by  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes          TEXT,
  UNIQUE (lecture_id, fellow_id)
);

CREATE INDEX IF NOT EXISTS lecture_attendance_lecture_id_idx
  ON public.lecture_attendance (lecture_id);

CREATE INDEX IF NOT EXISTS lecture_attendance_fellow_id_idx
  ON public.lecture_attendance (fellow_id);

-- ============================================================================
-- STEP 3: RLS for lecture_attendance
-- ============================================================================

ALTER TABLE public.lecture_attendance ENABLE ROW LEVEL SECURITY;

-- Read: members can see attendance for lectures in their institution.
DROP POLICY IF EXISTS "Attendance readable" ON public.lecture_attendance;
CREATE POLICY "Attendance readable" ON public.lecture_attendance
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.lectures l
      WHERE l.id = lecture_attendance.lecture_id
        AND (
          is_program_member(l.program_id)
          OR EXISTS (
            SELECT 1 FROM public.programs p
            WHERE p.id = l.program_id
              AND is_institution_admin(p.institution_id)
          )
        )
    )
  );

-- Insert: fellows can self-check-in (status = 'present') for their own fellow record;
-- managers/admins can insert any row.
DROP POLICY IF EXISTS "Attendance insert" ON public.lecture_attendance;
CREATE POLICY "Attendance insert" ON public.lecture_attendance
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lectures l
      WHERE l.id = lecture_attendance.lecture_id
        AND (
          -- Manager in program can insert any record
          has_program_role(l.program_id, ARRAY['program_admin','program_director','chief_fellow'])
          OR EXISTS (
            SELECT 1 FROM public.programs p
            WHERE p.id = l.program_id AND is_institution_admin(p.institution_id)
          )
          -- Fellow self-check-in: the fellow_id must map to the calling user
          OR (
            status = 'present'
            AND EXISTS (
              SELECT 1 FROM public.fellows f
              WHERE f.id = lecture_attendance.fellow_id
                AND f.user_id = auth.uid()
            )
          )
        )
    )
  );

-- Update/Delete: managers and institution admins only.
DROP POLICY IF EXISTS "Attendance update delete" ON public.lecture_attendance;
CREATE POLICY "Attendance update delete" ON public.lecture_attendance
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.lectures l
      WHERE l.id = lecture_attendance.lecture_id
        AND (
          has_program_role(l.program_id, ARRAY['program_admin','program_director','chief_fellow'])
          OR EXISTS (
            SELECT 1 FROM public.programs p
            WHERE p.id = l.program_id AND is_institution_admin(p.institution_id)
          )
        )
    )
  );

commit;

-- ============================================================================
-- Verification queries (run separately after commit):
-- ============================================================================
-- 1. Confirm check_in_open column exists:
--    SELECT column_name, data_type, column_default
--    FROM information_schema.columns
--    WHERE table_name = 'lectures' AND column_name = 'check_in_open';
--
-- 2. Confirm lecture_attendance table and unique constraint:
--    SELECT column_name, data_type FROM information_schema.columns
--    WHERE table_name = 'lecture_attendance' ORDER BY ordinal_position;
--
-- 3. Confirm RLS policies:
--    SELECT policyname, cmd FROM pg_policies WHERE tablename = 'lecture_attendance';
