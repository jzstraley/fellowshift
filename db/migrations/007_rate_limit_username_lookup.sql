-- Migration 007: Rate-limit username lookup to prevent enumeration attacks
-- Run in Supabase SQL Editor.
-- Safe to run multiple times (uses IF NOT EXISTS / OR REPLACE).

-- ============================================================================
-- STEP 1: Log table for tracking lookup attempts per IP
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.username_lookup_log (
  id           BIGSERIAL   PRIMARY KEY,
  ip_addr      TEXT        NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS username_lookup_log_ip_time_idx
  ON public.username_lookup_log (ip_addr, attempted_at DESC);

-- Block all direct access. The SECURITY DEFINER function bypasses RLS when writing.
ALTER TABLE public.username_lookup_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "no_direct_access" ON public.username_lookup_log;
CREATE POLICY "no_direct_access" ON public.username_lookup_log USING (false);

-- ============================================================================
-- STEP 2: Replace get_email_by_username with rate-limited version
-- Limit: 10 lookups per IP per 60 seconds.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_email_by_username(lookup_username TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  client_ip     TEXT;
  attempt_count INT;
  result_email  TEXT;
BEGIN
  -- Extract client IP from PostgREST request headers.
  -- Falls back gracefully when called outside HTTP context (e.g., SQL editor).
  BEGIN
    client_ip := coalesce(
      (current_setting('request.headers', true)::jsonb->>'x-forwarded-for'),
      inet_client_addr()::text,
      'unknown'
    );
    -- x-forwarded-for may be "ip1, ip2, ..." — take the leftmost (originating) IP.
    client_ip := trim(split_part(client_ip, ',', 1));
  EXCEPTION WHEN OTHERS THEN
    client_ip := 'unknown';
  END;

  -- Count recent attempts from this IP within the sliding 60-second window.
  SELECT count(*) INTO attempt_count
  FROM public.username_lookup_log
  WHERE ip_addr = client_ip
    AND attempted_at > now() - interval '60 seconds';

  IF attempt_count >= 10 THEN
    RAISE EXCEPTION 'Too many login attempts. Please try again in a minute.'
      USING ERRCODE = 'P0001';
  END IF;

  -- Record this attempt before returning.
  INSERT INTO public.username_lookup_log (ip_addr, attempted_at)
  VALUES (client_ip, now());

  -- Probabilistic cleanup of stale entries (runs on ~1% of calls) to prevent
  -- unbounded table growth without needing a scheduled job.
  IF random() < 0.01 THEN
    DELETE FROM public.username_lookup_log
    WHERE attempted_at < now() - interval '10 minutes';
  END IF;

  -- Return the email for this username (case-insensitive).
  SELECT email INTO result_email
  FROM public.profiles
  WHERE lower(username) = lower(lookup_username)
  LIMIT 1;

  RETURN result_email;
END;
$$;

-- Grant execute to both roles that call this pre-authentication.
GRANT EXECUTE ON FUNCTION public.get_email_by_username(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_email_by_username(TEXT) TO authenticated;
