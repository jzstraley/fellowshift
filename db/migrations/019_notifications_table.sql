-- Migration 019: In-app notifications system for swap requests
-- Adds persistent notifications table + trigger to alert users on swap transitions
-- No email; notifications appear in bell dropdown in HeaderBar with Realtime delivery

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Create notifications table
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id           UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id   UUID REFERENCES programs(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,
  message      TEXT NOT NULL,
  related_id   UUID,
  related_type TEXT,
  read         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_program
  ON notifications(program_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Enable RLS
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Notifications readable" ON notifications FOR SELECT
  USING (user_id = auth.uid());

-- Users can update only their own notifications (mark as read)
CREATE POLICY "Notifications self update" ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own notifications
CREATE POLICY "Notifications self delete" ON notifications FOR DELETE
  USING (user_id = auth.uid());

-- INSERT is blocked for normal auth users; trigger uses SECURITY DEFINER

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Trigger function: create notifications on swap request state changes
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_swap_notifications()
RETURNS TRIGGER AS $$
DECLARE
  requester_uid UUID;
  target_uid UUID;
  admin_uid UUID;
  admin_cursor CURSOR FOR
    SELECT DISTINCT pm.user_id
    FROM program_memberships pm
    WHERE pm.program_id = NEW.program_id
      AND pm.role IN ('program_admin', 'program_director', 'chief_fellow')
      AND pm.user_id IS NOT NULL;
BEGIN
  -- Fetch user_ids from fellows table
  SELECT f.user_id INTO requester_uid FROM fellows f WHERE f.id = NEW.requester_fellow_id;
  SELECT f.user_id INTO target_uid FROM fellows f WHERE f.id = NEW.target_fellow_id;

  -- INSERT: new pending_peer request
  IF TG_OP = 'INSERT' AND NEW.status = 'pending_peer' THEN
    IF target_uid IS NOT NULL THEN
      INSERT INTO notifications (user_id, program_id, type, message, related_id, related_type)
      VALUES (target_uid, NEW.program_id, 'swap_request',
              'You have a new swap request awaiting your confirmation',
              NEW.id, 'swap_request');
    END IF;

  -- UPDATE transitions
  ELSIF TG_OP = 'UPDATE' THEN

    -- pending_peer → pending (peer confirmed)
    IF OLD.status = 'pending_peer' AND NEW.status = 'pending' THEN
      -- Notify all program admins/directors/chiefs
      OPEN admin_cursor;
      LOOP
        FETCH admin_cursor INTO admin_uid;
        EXIT WHEN admin_cursor%NOTFOUND;
        IF admin_uid IS NOT NULL THEN
          INSERT INTO notifications (user_id, program_id, type, message, related_id, related_type)
          VALUES (admin_uid, NEW.program_id, 'swap_request',
                  'A swap request is awaiting your approval',
                  NEW.id, 'swap_request');
        END IF;
      END LOOP;
      CLOSE admin_cursor;

    -- → approved (admin approved)
    ELSIF NEW.status = 'approved' THEN
      IF requester_uid IS NOT NULL THEN
        INSERT INTO notifications (user_id, program_id, type, message, related_id, related_type)
        VALUES (requester_uid, NEW.program_id, 'swap_approved',
                'Your swap request was approved',
                NEW.id, 'swap_request');
      END IF;
      IF target_uid IS NOT NULL THEN
        INSERT INTO notifications (user_id, program_id, type, message, related_id, related_type)
        VALUES (target_uid, NEW.program_id, 'swap_approved',
                'A swap involving your schedule was approved',
                NEW.id, 'swap_request');
      END IF;

    -- pending_peer → denied (target declined)
    ELSIF OLD.status = 'pending_peer' AND NEW.status = 'denied' THEN
      IF requester_uid IS NOT NULL THEN
        INSERT INTO notifications (user_id, program_id, type, message, related_id, related_type)
        VALUES (requester_uid, NEW.program_id, 'swap_denied',
                'Your swap request was declined',
                NEW.id, 'swap_request');
      END IF;

    -- pending → denied (admin denied)
    ELSIF OLD.status = 'pending' AND NEW.status = 'denied' THEN
      IF requester_uid IS NOT NULL THEN
        INSERT INTO notifications (user_id, program_id, type, message, related_id, related_type)
        VALUES (requester_uid, NEW.program_id, 'swap_denied',
                'Your swap request was denied',
                NEW.id, 'swap_request');
      END IF;
      IF target_uid IS NOT NULL THEN
        INSERT INTO notifications (user_id, program_id, type, message, related_id, related_type)
        VALUES (target_uid, NEW.program_id, 'swap_denied',
                'A swap involving your schedule was denied',
                NEW.id, 'swap_request');
      END IF;

    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Trigger binding
-- ─────────────────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_swap_notifications ON swap_requests;
CREATE TRIGGER trg_swap_notifications
  AFTER INSERT OR UPDATE ON swap_requests
  FOR EACH ROW EXECUTE FUNCTION fn_swap_notifications();

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- Verification queries (run separately after commit):
-- ─────────────────────────────────────────────────────────────────────────────
-- Confirm table exists:
--   SELECT table_name FROM information_schema.tables WHERE table_name = 'notifications';
--
-- Confirm RLS is enabled:
--   SELECT tablename FROM pg_tables WHERE tablename = 'notifications'
--   AND schemaname = 'public';
--   SELECT policyname, cmd FROM pg_policies WHERE tablename = 'notifications';
--
-- Confirm trigger exists:
--   SELECT trigger_name FROM information_schema.triggers
--   WHERE trigger_name = 'trg_swap_notifications';
