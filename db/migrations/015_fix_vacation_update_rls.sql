-- 015_fix_vacation_update_rls.sql
--
-- ROOT CAUSE: The two existing UPDATE policies use can_manage_vacation_scope()
-- which calls has_program_role() → checks program_memberships table.
-- Users whose program_memberships rows were not seeded (migration 003 step 10
-- may have missed them) get can_manage = false → every approval/deny/cancel
-- is silently blocked even though profiles.role is correct.
--
-- FIX:
--  1. Replace the two broken UPDATE policies with a single one that accepts
--     EITHER has_program_role() (program_memberships path) OR get_user_role()
--     (profiles.role path), scoped to the same institution.
--  2. Seed any missing program_memberships rows from profiles.role so
--     has_program_role() works going forward.
--  3. Clean up pending rows that have approved_at set (hardcoded import artifact).
--
-- Safe to re-run.

begin;

-- ── 1. Drop the broken update policies ───────────────────────────────────────
drop policy if exists "Vacation update scoped"               on vacation_requests;
drop policy if exists "Vacation update requester or manager" on vacation_requests;
drop policy if exists "Vacation update"                      on vacation_requests;

-- ── 2. Create a correct UPDATE policy ────────────────────────────────────────
-- Allows update if ANY of these is true:
--   (a) The requester is updating their own row (cancel pending/denied)
--   (b) The user has the right role in program_memberships (has_program_role)
--   (c) The user has a privileged profiles.role AND is in the same institution
--       as the vacation's fellow — fallback for users missing program_memberships
--   (d) The user is an institution admin
create policy "Vacation update"
  on vacation_requests for update
  using (
    -- (a) own request
    requested_by = auth.uid()
    -- (b) program_memberships path
    or has_program_role(vacation_requests.program_id, array['program_admin','program_director','chief_fellow'])
    -- (c) profiles.role fallback (scoped to institution via the fellow record)
    or (
      get_user_role() in ('program_director', 'chief_fellow', 'admin')
      and exists (
        select 1 from fellows f
        where f.id = vacation_requests.fellow_id
          and f.institution_id = get_user_institution_id()
      )
    )
    -- (d) institution admin
    or exists (
      select 1 from programs p
      where p.id = vacation_requests.program_id
        and is_institution_admin(p.institution_id)
    )
  )
  with check (
    requested_by = auth.uid()
    or has_program_role(vacation_requests.program_id, array['program_admin','program_director','chief_fellow'])
    or (
      get_user_role() in ('program_director', 'chief_fellow', 'admin')
      and exists (
        select 1 from fellows f
        where f.id = vacation_requests.fellow_id
          and f.institution_id = get_user_institution_id()
      )
    )
    or exists (
      select 1 from programs p
      where p.id = vacation_requests.program_id
        and is_institution_admin(p.institution_id)
    )
  );

-- ── 3. Seed missing program_memberships from profiles.role ───────────────────
-- This ensures has_program_role() starts working for existing users too,
-- so future RLS additions don't hit this gap again.
insert into program_memberships (program_id, user_id, role)
select
  p.id as program_id,
  pr.id as user_id,
  case pr.role
    when 'admin'            then 'program_admin'
    when 'program_director' then 'program_director'
    when 'chief_fellow'     then 'chief_fellow'
    when 'fellow'           then 'fellow'
    when 'resident'         then 'resident'
    else                         'member'
  end as role
from profiles pr
join programs p
  on p.institution_id = pr.institution_id
  and p.name = coalesce(pr.program, '')
where pr.institution_id is not null
  and pr.is_active = true
  -- Only insert for roles that should have program_memberships
  and pr.role in ('admin', 'program_director', 'chief_fellow', 'fellow', 'resident')
on conflict (program_id, user_id) do update
  set role = excluded.role,
      is_active = true;

-- ── 4. Clean up hardcoded rows: pending requests should not have approved_at ─
-- The trg_enforce_vacation_cancel_rules trigger checks auth.uid() and raises
-- "Not authenticated" when run from the SQL editor (no JWT context).
-- Disable it temporarily for this admin cleanup, then re-enable.
alter table vacation_requests disable trigger trg_enforce_vacation_cancel_rules;

update vacation_requests
set
  approved_at = null,
  approved_by = null
where status = 'pending'
  and approved_at is not null;

alter table vacation_requests enable trigger trg_enforce_vacation_cancel_rules;

commit;

-- ── Verification ──────────────────────────────────────────────────────────────
-- 1. Confirm only the new "Vacation update" policy exists:
--    select policyname, cmd from pg_policies
--    where tablename = 'vacation_requests' and cmd = 'UPDATE';
--
-- 2. Confirm your user now has a program_memberships row:
--    select pm.role, pm.is_active, p.name
--    from program_memberships pm
--    join programs p on p.id = pm.program_id
--    where pm.user_id = auth.uid();
--
-- 3. Test approval directly:
--    update vacation_requests
--    set status = 'approved', approved_by = auth.uid(), approved_at = now()
--    where id = '<a pending request id>';
--    -- Should show "1 row affected"
--
-- 4. Confirm no pending rows have approved_at:
--    select count(*) from vacation_requests
--    where status = 'pending' and approved_at is not null;
--    -- Should be 0
