-- Migration 018: Two-tier swap approval system
-- 1. Expand swap_requests.status CHECK to allow 'pending_peer' state
-- 2. Add peer_approved_at and peer_approved_by columns for audit
-- 3. Add RLS policy allowing target fellow to update pending_peer requests
-- Safe to re-run (DROP IF EXISTS / CREATE OR REPLACE throughout).

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Expand status check constraint to include 'pending_peer'
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  cname TEXT;
BEGIN
  -- Drop any existing status-related check constraint
  FOR cname IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'swap_requests'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE swap_requests DROP CONSTRAINT %I', cname);
  END LOOP;
END $$;

ALTER TABLE swap_requests
  ADD CONSTRAINT swap_requests_status_check
  CHECK (status IN ('pending_peer', 'pending', 'approved', 'denied', 'cancelled'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Add peer audit columns
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE swap_requests
  ADD COLUMN IF NOT EXISTS peer_approved_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS peer_approved_by  UUID REFERENCES profiles(id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Add RLS policy: target fellow can UPDATE their own pending_peer requests
--    (Works in conjunction with existing "Swap update" policy from migration 008)
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Swap update peer" ON swap_requests;

CREATE POLICY "Swap update peer" ON swap_requests FOR UPDATE
  USING (
    -- Target fellow of a pending_peer request may update it (to confirm or decline)
    EXISTS (
      SELECT 1 FROM fellows f
      WHERE f.id = swap_requests.target_fellow_id
        AND f.user_id = auth.uid()
        AND f.is_active = TRUE
    )
    AND swap_requests.status = 'pending_peer'
  );

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- Verification queries (run separately after commit):
-- ─────────────────────────────────────────────────────────────────────────────
-- Confirm status constraint:
--   SELECT pg_get_constraintdef(oid)
--   FROM pg_constraint
--   WHERE conrelid = 'swap_requests'::regclass
--     AND conname = 'swap_requests_status_check';
--
-- Confirm new columns exist:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'swap_requests'
--     AND column_name IN ('peer_approved_at', 'peer_approved_by');
--
-- Confirm RLS policy:
--   SELECT policyname, cmd FROM pg_policies
--   WHERE tablename = 'swap_requests' AND policyname LIKE '%peer%';
