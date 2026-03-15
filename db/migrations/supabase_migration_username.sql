-- FellowShift Username Migration
-- Run this in your Supabase SQL Editor to add username support to an existing database.
-- Safe to run multiple times (uses IF NOT EXISTS / OR REPLACE).

-- ============================================================================
-- STEP 1: Add username column to profiles
-- ============================================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

-- ============================================================================
-- STEP 2: Create/replace get_email_by_username function
-- This is called at login when the user types a username instead of an email.
-- SECURITY DEFINER lets it read profiles rows regardless of RLS.
-- ============================================================================
create or replace function public.get_email_by_username(lookup_username text)
returns text
language sql
security definer
stable
as $$
  select email
  from public.profiles
  where lower(username) = lower(lookup_username)
  limit 1;
$$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Confirm the column exists:
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'profiles' AND column_name = 'username';
