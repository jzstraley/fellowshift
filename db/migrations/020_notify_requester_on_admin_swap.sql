-- Migration 020: Notify requester fellow when admin/PD/chief creates swap on their behalf
-- Updates fn_swap_notifications to check if requester_fellow_id's user_id differs from requested_by
-- If they differ, the swap was created by an admin on behalf of the fellow; notify them

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- Update trigger function: notify both fellows when admin creates swap on behalf
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
    -- Notify target fellow about the swap request
    IF target_uid IS NOT NULL THEN
      INSERT INTO notifications (user_id, program_id, type, message, related_id, related_type)
      VALUES (target_uid, NEW.program_id, 'swap_request',
              'You have a new swap request awaiting your confirmation',
              NEW.id, 'swap_request');
    END IF;

    -- If an admin/PD/chief created this on behalf of the requester (requester_uid <> requested_by),
    -- also notify the requester fellow
    IF requester_uid IS NOT NULL AND requester_uid <> NEW.requested_by THEN
      INSERT INTO notifications (user_id, program_id, type, message, related_id, related_type)
      VALUES (requester_uid, NEW.program_id, 'swap_request',
              'A swap request was created on your behalf and is awaiting confirmation from your swap partner',
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
-- Rebind trigger to updated function
-- ─────────────────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_swap_notifications ON swap_requests;
CREATE TRIGGER trg_swap_notifications
  AFTER INSERT OR UPDATE ON swap_requests
  FOR EACH ROW EXECUTE FUNCTION fn_swap_notifications();

COMMIT;
