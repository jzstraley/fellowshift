-- Migration 014: Link fellows ↔ profiles and backfill program_memberships
-- Problems solved:
--   1. fellows.user_id may be null or wrong.
--      Linking strategy (in order):
--        a) email match: fellows.email = auth.users.email
--        b) derived-username match: first letter of first name + last name
--           (e.g. "James Straley" → "jstraley") against profiles.username
--   2. fellows.email and fellows.username are synced from the linked profile.
--   3. program_memberships has no row for linked fellows' user_ids
--      → "No program scope found" error in the UI.
-- Safe to re-run (idempotent).

begin;

-- ============================================================================
-- STEP 1: Ensure fellows.user_id and fellows.username columns exist
--         username mirrors profiles.username — it is what fellows log in with.
--         Format: lower(left(first_name, 1) || last_name)  e.g. jstraley
-- ============================================================================

ALTER TABLE public.fellows
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.fellows
  ADD COLUMN IF NOT EXISTS username TEXT;

CREATE INDEX IF NOT EXISTS fellows_user_id_idx ON public.fellows (user_id);
CREATE INDEX IF NOT EXISTS fellows_username_idx ON public.fellows (username);

-- ============================================================================
-- STEP 2a: Link fellows.user_id by matching fellows.email → auth.users.email
-- ============================================================================

UPDATE public.fellows f
SET user_id = au.id
FROM auth.users au
WHERE lower(trim(f.email)) = lower(trim(au.email))
  AND f.email IS NOT NULL
  AND f.email <> ''
  AND (f.user_id IS NULL OR f.user_id <> au.id);

-- ============================================================================
-- STEP 2b: Fallback — for fellows still unlinked, derive a candidate username
--          from fellows.name (first letter of first word + second word, lowercase)
--          and match against profiles.username.
--          e.g. "Mahmoud Yousafzai" → "myousafzai"
-- ============================================================================

UPDATE public.fellows f
SET user_id = p.id
FROM public.profiles p
WHERE f.user_id IS NULL
  AND p.username IS NOT NULL
  AND lower(
        left(split_part(trim(f.name), ' ', 1), 1) ||
        split_part(trim(f.name), ' ', 2)
      ) = lower(trim(p.username));

-- ============================================================================
-- STEP 3: Sync fellows.email and fellows.username FROM the linked profile
--         Auth email is the source of truth for email.
--         profiles.username is the source of truth for login username.
-- ============================================================================

UPDATE public.fellows f
SET
  email    = au.email,
  username = p.username
FROM auth.users au
JOIN public.profiles p ON p.id = au.id
WHERE f.user_id = au.id
  AND (
    f.email IS DISTINCT FROM au.email
    OR f.username IS DISTINCT FROM p.username
  );

-- ============================================================================
-- STEP 4: Unique constraint — one profile per fellow per program
-- ============================================================================

ALTER TABLE public.fellows
  DROP CONSTRAINT IF EXISTS fellows_program_user_unique;

ALTER TABLE public.fellows
  ADD CONSTRAINT fellows_program_user_unique
  UNIQUE (program_id, user_id);

-- ============================================================================
-- STEP 5: Backfill program_memberships for linked fellows
--         Every fellow with a user_id must have a program_memberships row
--         so loadScope() returns a programId for them in the UI.
-- ============================================================================

INSERT INTO public.program_memberships (program_id, user_id, role, is_active)
SELECT
  f.program_id,
  f.user_id,
  'fellow',
  true
FROM public.fellows f
WHERE f.user_id IS NOT NULL
  AND f.program_id IS NOT NULL
  AND f.is_active = true
ON CONFLICT (program_id, user_id) DO UPDATE
  SET role = 'fellow', is_active = true;

-- ============================================================================
-- STEP 6: Force PostgREST to reload schema cache
-- ============================================================================

NOTIFY pgrst, 'reload schema';

commit;

-- ============================================================================
-- Verification queries (run separately after commit):
-- ============================================================================
-- 1. Fellows still unlinked (no email match and no username match):
--    SELECT name, email,
--           lower(left(split_part(trim(name),' ',1),1) || split_part(trim(name),' ',2)) AS derived_username
--    FROM fellows
--    WHERE user_id IS NULL AND is_active = true;
--
-- 2. Spot-check a fellow (e.g. Mahmoud):
--    SELECT f.name, f.email, f.username, f.user_id,
--           au.email AS auth_email, p.username AS profile_username
--    FROM fellows f
--    LEFT JOIN auth.users au ON au.id = f.user_id
--    LEFT JOIN profiles p ON p.id = f.user_id
--    WHERE f.name ILIKE '%mahmoud%';
--
-- 3. Confirm program_memberships were backfilled:
--    SELECT f.name, pm.role, pm.program_id
--    FROM fellows f
--    JOIN program_memberships pm ON pm.user_id = f.user_id AND pm.program_id = f.program_id
--    WHERE f.is_active = true;
--
-- 4. Fellows with user_id but no membership (should be 0 rows):
--    SELECT f.name, f.user_id
--    FROM fellows f
--    LEFT JOIN program_memberships pm
--      ON pm.user_id = f.user_id AND pm.program_id = f.program_id
--    WHERE f.user_id IS NOT NULL AND pm.id IS NULL;
