-- 010_fix_request_constraints.sql
-- 1. Ensure vacation_requests and swap_requests status check constraints use
--    the canonical value set: ('pending', 'approved', 'denied', 'cancelled').
--    The inline CHECK defined in supabase_schema.sql produces an auto-named
--    constraint. If the live DB was created with different values this drops
--    and recreates it.
-- 2. Define a transparent BEFORE INSERT trigger on vacation_requests that
--    enforces fellow-scope: only the fellow's linked user or a privileged role
--    (program_admin / program_director / chief_fellow / institution_admin) may
--    insert. This replaces any ad-hoc trigger that was raising "No active
--    fellow scope for this user. Cannot submit request." and makes the
--    rule explicit.
-- Safe to re-run (idempotent).

begin;

-- ─── Fix vacation_requests status constraint ─────────────────────────────────

do $$
declare
  cname text;
begin
  -- Drop any existing status-related check constraint (whatever name it was given)
  for cname in
    select conname
    from pg_constraint
    where conrelid = 'vacation_requests'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%status%'
  loop
    execute format('alter table vacation_requests drop constraint %I', cname);
  end loop;
end $$;

alter table vacation_requests
  add constraint vacation_requests_status_check
  check (status in ('pending', 'approved', 'denied', 'cancelled'));

-- ─── Fix swap_requests status constraint ─────────────────────────────────────

do $$
declare
  cname text;
begin
  for cname in
    select conname
    from pg_constraint
    where conrelid = 'swap_requests'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%status%'
  loop
    execute format('alter table swap_requests drop constraint %I', cname);
  end loop;
end $$;

alter table swap_requests
  add constraint swap_requests_status_check
  check (status in ('pending', 'approved', 'denied', 'cancelled'));

-- ─── Fellow-scope trigger for vacation_requests ───────────────────────────────
-- Allows insert if any of the following is true:
--   a) The requesting user has a program_admin / program_director / chief_fellow
--      role in the target program (submitting on behalf of a fellow).
--   b) The requesting user is an institution admin.
--   c) The fellow record (NEW.fellow_id) has user_id = auth.uid() and is_active.
-- All other inserts are rejected with a clear message.

create or replace function trg_vacation_request_fellow_scope()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- (a) privileged role in program
  if has_program_role(NEW.program_id, array['program_admin','program_director','chief_fellow']) then
    return NEW;
  end if;

  -- (b) institution admin
  if exists (
    select 1 from programs p
    where p.id = NEW.program_id
      and is_institution_admin(p.institution_id)
  ) then
    return NEW;
  end if;

  -- (c) fellow linked to this user
  if exists (
    select 1 from fellows f
    where f.id = NEW.fellow_id
      and f.user_id = auth.uid()
      and f.is_active = true
  ) then
    return NEW;
  end if;

  raise exception 'No active fellow scope for this user. Cannot submit request.'
    using errcode = 'P0001';
end;
$$;

drop trigger if exists vacation_request_fellow_scope_trg on vacation_requests;
create trigger vacation_request_fellow_scope_trg
  before insert on vacation_requests
  for each row execute function trg_vacation_request_fellow_scope();

commit;

-- ─── Verification queries ─────────────────────────────────────────────────────
-- Confirm status constraints:
--   select conname, pg_get_constraintdef(oid)
--   from pg_constraint
--   where conrelid in ('vacation_requests'::regclass, 'swap_requests'::regclass)
--     and contype = 'c' and conname like '%status%';
--
-- Confirm trigger:
--   select tgname, tgtype from pg_trigger
--   where tgrelid = 'vacation_requests'::regclass and tgname = 'vacation_request_fellow_scope_trg';
