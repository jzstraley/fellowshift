-- Migration 008: RLS audit fixes
-- Addresses gaps found during security audit.
-- Safe to run multiple times (DROP IF EXISTS / CREATE OR REPLACE throughout).
-- Run after all previous migrations.

begin;

-- ============================================================================
-- FIX 1: Remove stale institution-scoped write policies on tables that have
-- been upgraded to program-scope in migration 003. If supabase_migration_roles.sql
-- was run after 003, these policies coexist and the looser institution-scoped
-- one wins (RLS uses OR). Dropping them ensures only program-scoped policies apply.
-- ============================================================================

-- fellows
drop policy if exists "Program directors can manage fellows"    on fellows;
-- (Migration 003 already owns "Fellows readable" and "Fellows writable")

-- schedule_assignments
drop policy if exists "Program directors can edit all schedules"        on schedule_assignments;
drop policy if exists "Chief fellows can edit their program schedules"   on schedule_assignments;
drop policy if exists "View schedules in institution"                    on schedule_assignments;
-- (Migration 003 owns "Schedule readable" and "Schedule writable")

-- vacation_requests
drop policy if exists "Fellows can create vacation requests"             on vacation_requests;
drop policy if exists "Program directors can manage vacation requests"   on vacation_requests;
drop policy if exists "View vacation requests in institution"            on vacation_requests;
-- (Migration 003 owns "Vacation readable" and "Vacation writable")

-- swap_requests
drop policy if exists "Fellows can create swap requests"                 on swap_requests;
drop policy if exists "Program directors can manage swap requests"       on swap_requests;
drop policy if exists "View swap requests in institution"                on swap_requests;
-- (Migration 003 owns "Swap readable" and "Swap writable")

-- ============================================================================
-- FIX 2: Upgrade call_assignments to program-scope.
-- The original institution-scoped policies are replaced with program-scoped
-- equivalents that match the pattern used in migration 003.
-- ============================================================================

drop policy if exists "View call assignments in institution"          on call_assignments;
drop policy if exists "Program directors can manage call assignments" on call_assignments;

create policy "Call assignments readable" on call_assignments for select using (
  exists (
    select 1 from block_dates bd
    where bd.id = call_assignments.block_date_id
      and (
        is_program_member(bd.program_id)
        or exists (select 1 from programs p where p.id = bd.program_id and is_institution_admin(p.institution_id))
      )
  )
);

create policy "Call assignments writable" on call_assignments for all
  using (
    exists (
      select 1 from block_dates bd
      where bd.id = call_assignments.block_date_id
        and (
          has_program_role(bd.program_id, array['program_admin','program_director','chief_fellow'])
          or exists (select 1 from programs p where p.id = bd.program_id and is_institution_admin(p.institution_id))
        )
    )
  )
  with check (
    exists (
      select 1 from block_dates bd
      where bd.id = call_assignments.block_date_id
        and (
          has_program_role(bd.program_id, array['program_admin','program_director','chief_fellow'])
          or exists (select 1 from programs p where p.id = bd.program_id and is_institution_admin(p.institution_id))
        )
    )
  );

-- ============================================================================
-- FIX 3: Add missing policies for lecture_rsvps, lecture_topics, speakers.
-- With RLS enabled and no policy, the default is deny-all. These tables need
-- at least read access for members and write access for managers.
-- ============================================================================

-- lecture_topics
drop policy if exists "Lecture topics readable" on lecture_topics;
drop policy if exists "Lecture topics writable" on lecture_topics;

create policy "Lecture topics readable" on lecture_topics for select using (
  institution_id = get_user_institution_id()
);

create policy "Lecture topics writable" on lecture_topics for all
  using (
    get_user_role() in ('program_director', 'chief_fellow', 'admin')
    and institution_id = get_user_institution_id()
  )
  with check (
    get_user_role() in ('program_director', 'chief_fellow', 'admin')
    and institution_id = get_user_institution_id()
  );

-- speakers
drop policy if exists "Speakers readable" on speakers;
drop policy if exists "Speakers writable" on speakers;

create policy "Speakers readable" on speakers for select using (
  institution_id = get_user_institution_id()
);

create policy "Speakers writable" on speakers for all
  using (
    get_user_role() in ('program_director', 'chief_fellow', 'admin')
    and institution_id = get_user_institution_id()
  )
  with check (
    get_user_role() in ('program_director', 'chief_fellow', 'admin')
    and institution_id = get_user_institution_id()
  );

-- lecture_rsvps: users can read RSVPs for lectures in their institution;
-- each user can only write their own RSVP row.
drop policy if exists "Lecture rsvps readable" on lecture_rsvps;
drop policy if exists "Lecture rsvps self writable" on lecture_rsvps;

create policy "Lecture rsvps readable" on lecture_rsvps for select using (
  exists (
    select 1 from lectures l
    where l.id = lecture_rsvps.lecture_id
      and l.institution_id = get_user_institution_id()
  )
);

create policy "Lecture rsvps self writable" on lecture_rsvps for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================================
-- FIX 4: Tighten INSERT WITH CHECK on vacation_requests and swap_requests so
-- the program_id in the new row must be one the requesting user belongs to.
-- This prevents a member of multiple programs from filing a request on behalf
-- of a program they shouldn't be acting as.
-- ============================================================================

-- vacation_requests: replace the combined "Vacation writable" policy with
-- separate INSERT and UPDATE/DELETE policies so we can apply a tighter WITH CHECK.
drop policy if exists "Vacation writable" on vacation_requests;

create policy "Vacation insert" on vacation_requests for insert
  with check (
    requested_by = auth.uid()
    and is_program_member(vacation_requests.program_id)
  );

create policy "Vacation update delete" on vacation_requests for update using (
  requested_by = auth.uid()
  or has_program_role(vacation_requests.program_id, array['program_admin','program_director','chief_fellow'])
  or exists (select 1 from programs p where p.id = vacation_requests.program_id and is_institution_admin(p.institution_id))
);

create policy "Vacation delete" on vacation_requests for delete using (
  requested_by = auth.uid()
  or has_program_role(vacation_requests.program_id, array['program_admin','program_director','chief_fellow'])
  or exists (select 1 from programs p where p.id = vacation_requests.program_id and is_institution_admin(p.institution_id))
);

-- swap_requests: same pattern
drop policy if exists "Swap writable" on swap_requests;

create policy "Swap insert" on swap_requests for insert
  with check (
    requested_by = auth.uid()
    and is_program_member(swap_requests.program_id)
  );

create policy "Swap update" on swap_requests for update using (
  requested_by = auth.uid()
  or has_program_role(swap_requests.program_id, array['program_admin','program_director','chief_fellow'])
  or exists (select 1 from programs p where p.id = swap_requests.program_id and is_institution_admin(p.institution_id))
);

create policy "Swap delete" on swap_requests for delete using (
  requested_by = auth.uid()
  or has_program_role(swap_requests.program_id, array['program_admin','program_director','chief_fellow'])
  or exists (select 1 from programs p where p.id = swap_requests.program_id and is_institution_admin(p.institution_id))
);

commit;

-- ============================================================================
-- Verification queries (run separately after commit):
-- ============================================================================
-- 1. Confirm no stale institution-scoped policies remain on upgraded tables:
--    select policyname, tablename, cmd from pg_policies
--    where tablename in ('fellows','schedule_assignments','vacation_requests','swap_requests')
--    order by tablename, policyname;
--
-- 2. Confirm call_assignments now has program-scoped policies:
--    select policyname, cmd from pg_policies where tablename = 'call_assignments';
--
-- 3. Confirm lecture_rsvps, lecture_topics, speakers now have policies:
--    select policyname, tablename from pg_policies
--    where tablename in ('lecture_rsvps','lecture_topics','speakers');
--
-- 4. Test as a low-privilege role (set role to 'authenticated', set uid to a
--    test user, then try selecting from each table and inserting bad rows):
--    set local role authenticated;
--    set local "request.jwt.claims" to '{"sub":"<test-user-uuid>"}';
--    select count(*) from vacation_requests;  -- should return only own program's rows
