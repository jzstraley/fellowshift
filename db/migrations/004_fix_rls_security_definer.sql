-- 004_fix_rls_security_definer.sql
-- CRITICAL FIX: Add SECURITY DEFINER to the three RLS helper functions.
--
-- Without this, every query to institution_admins, program_memberships, programs,
-- block_dates, fellows, vacation_requests, or swap_requests triggers infinite
-- recursion: the RLS policy calls is_institution_admin() → which queries
-- institution_admins → whose RLS calls is_institution_admin() → ∞
--
-- PostgreSQL detects the recursion and cancels the statement after hitting the
-- stack limit, causing "canceling statement due to statement timeout" errors and
-- multi-minute login times.
--
-- SECURITY DEFINER makes the function execute with the privileges of the
-- function owner (bypassing RLS on the membership tables), while still using
-- auth.uid() to scope results to the current user. This is safe because the
-- function only returns a boolean about the current user's own membership.
--
-- Run this immediately after running 003_normalized_scope.sql.
-- Safe to re-run (CREATE OR REPLACE is idempotent).

begin;

create or replace function is_institution_admin(inst_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from institution_admins ia
    where ia.institution_id = inst_id
      and ia.user_id = auth.uid()
      and ia.is_active = true
  );
$$;

create or replace function has_program_role(prog_id uuid, roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from program_memberships pm
    where pm.program_id = prog_id
      and pm.user_id = auth.uid()
      and pm.is_active = true
      and pm.role = any(roles)
  );
$$;

create or replace function is_program_member(prog_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from program_memberships pm
    where pm.program_id = prog_id
      and pm.user_id = auth.uid()
      and pm.is_active = true
  );
$$;

commit;

-- Verification: these should now return quickly (no timeout):
-- select is_institution_admin('<your-institution-uuid>');
-- select is_program_member('<your-program-uuid>');
-- select count(*) from institution_admins;
-- select count(*) from program_memberships;
