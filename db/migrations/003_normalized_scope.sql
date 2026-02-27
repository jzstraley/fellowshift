-- 003_normalized_scope.sql
-- Normalizes institution → programs → academic_years hierarchy.
-- Run in a maintenance window. Idempotent where possible.
-- After running, verify:
--   select count(*) from block_dates where program_id is null or academic_year_id is null; -- must be 0
--   select conname from pg_constraint where conrelid='block_dates'::regclass;

begin;

-- ---------------------------------------------------------------------------
-- 0) Extensions
-- ---------------------------------------------------------------------------
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1) Canonical scope tables
-- ---------------------------------------------------------------------------

create table if not exists programs (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  name text not null,
  slug text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, name)
);
create index if not exists programs_institution_id_idx on programs(institution_id);

create table if not exists academic_years (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  label text not null,          -- e.g. '2025-2026'
  start_date date,
  end_date date,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, label)
);
create index if not exists academic_years_institution_id_idx on academic_years(institution_id);

create table if not exists program_memberships (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null check (role in (
    'viewer','member','resident','fellow','faculty',
    'chief_fellow','program_director','program_admin'
  )),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (program_id, user_id)
);
create index if not exists program_memberships_user_id_idx on program_memberships(user_id);
create index if not exists program_memberships_program_id_idx on program_memberships(program_id);

create table if not exists institution_admins (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (institution_id, user_id)
);
create index if not exists institution_admins_user_id_idx on institution_admins(user_id);
create index if not exists institution_admins_institution_id_idx on institution_admins(institution_id);

-- ---------------------------------------------------------------------------
-- 2) Helper functions
-- ---------------------------------------------------------------------------

create or replace function is_institution_admin(inst_id uuid)
-- SECURITY DEFINER prevents circular RLS recursion: these functions query the
-- same tables whose RLS policies call them. Without it, every query causes
-- infinite recursion → statement timeout.
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

-- ---------------------------------------------------------------------------
-- 3) Normalize block_dates
-- ---------------------------------------------------------------------------

alter table block_dates
  add column if not exists program_id uuid references programs(id) on delete cascade,
  add column if not exists academic_year_id uuid references academic_years(id) on delete cascade;

-- Backfill programs from legacy block_dates.program (text)
insert into programs (institution_id, name)
select distinct institution_id, program
from block_dates
where program is not null and program <> ''
on conflict (institution_id, name) do nothing;

update block_dates bd
set program_id = p.id
from programs p
where p.institution_id = bd.institution_id
  and p.name = bd.program
  and bd.program_id is null;

-- Backfill academic_years from legacy block_dates.academic_year (text)
insert into academic_years (institution_id, label)
select distinct institution_id, academic_year
from block_dates
where academic_year is not null and academic_year <> ''
on conflict (institution_id, label) do nothing;

update block_dates bd
set academic_year_id = ay.id
from academic_years ay
where ay.institution_id = bd.institution_id
  and ay.label = bd.academic_year
  and bd.academic_year_id is null;

-- Mark the most recent academic year as current per institution
update academic_years ay
set is_current = true
from (
  select institution_id, max(label) as latest_label
  from academic_years
  group by institution_id
) latest
where ay.institution_id = latest.institution_id
  and ay.label = latest.latest_label;

-- Drop old uniqueness, apply normalized uniqueness
alter table block_dates
  drop constraint if exists block_dates_scope_unique,
  drop constraint if exists block_dates_institution_id_program_academic_year_block_numb_key,
  drop constraint if exists "block_dates_institution_id_program_academic_year_block_number_key",
  drop constraint if exists block_dates_program_year_block_unique;

alter table block_dates
  add constraint block_dates_program_year_block_unique
  unique (program_id, academic_year_id, block_number);

-- Only enforce not-null if backfill covered every row (skip if any are still null)
do $$
begin
  if not exists (select 1 from block_dates where program_id is null or academic_year_id is null) then
    alter table block_dates alter column program_id set not null;
    alter table block_dates alter column academic_year_id set not null;
  else
    raise notice 'Skipping NOT NULL on block_dates — % rows still have null program_id or academic_year_id. Backfill manually then run: ALTER TABLE block_dates ALTER COLUMN program_id SET NOT NULL; ALTER TABLE block_dates ALTER COLUMN academic_year_id SET NOT NULL;',
      (select count(*) from block_dates where program_id is null or academic_year_id is null);
  end if;
end $$;

create index if not exists block_dates_program_year_idx on block_dates(program_id, academic_year_id);

-- ---------------------------------------------------------------------------
-- 4) Normalize fellows
-- ---------------------------------------------------------------------------

alter table fellows
  add column if not exists program_id uuid references programs(id) on delete cascade;

insert into programs (institution_id, name)
select distinct institution_id, program
from fellows
where program is not null and program <> ''
on conflict (institution_id, name) do nothing;

update fellows f
set program_id = p.id
from programs p
where p.institution_id = f.institution_id
  and p.name = f.program
  and f.program_id is null;

create index if not exists fellows_program_id_idx on fellows(program_id);

-- ---------------------------------------------------------------------------
-- 5) Normalize vacation_requests
-- ---------------------------------------------------------------------------

alter table vacation_requests
  add column if not exists program_id uuid references programs(id) on delete cascade,
  add column if not exists academic_year_id uuid references academic_years(id) on delete cascade;

update vacation_requests vr
set
  program_id = bd.program_id,
  academic_year_id = bd.academic_year_id
from block_dates bd
where bd.id = vr.start_block_id
  and (vr.program_id is null or vr.academic_year_id is null);

create index if not exists vacation_requests_program_year_idx on vacation_requests(program_id, academic_year_id);

-- ---------------------------------------------------------------------------
-- 6) Normalize swap_requests
-- ---------------------------------------------------------------------------

alter table swap_requests
  add column if not exists program_id uuid references programs(id) on delete cascade,
  add column if not exists academic_year_id uuid references academic_years(id) on delete cascade,
  add column if not exists block_date_id uuid references block_dates(id) on delete set null;

-- Backfill program_id from requester fellow
update swap_requests sr
set program_id = f.program_id
from fellows f
where f.id = sr.requester_fellow_id
  and sr.program_id is null;

-- Backfill academic_year_id from current year
update swap_requests sr
set academic_year_id = ay.id
from programs p
join academic_years ay on ay.institution_id = p.institution_id and ay.is_current = true
where sr.program_id = p.id
  and sr.academic_year_id is null;

-- Backfill block_date_id
update swap_requests sr
set block_date_id = bd.id
from block_dates bd
where bd.program_id = sr.program_id
  and bd.academic_year_id = sr.academic_year_id
  and bd.block_number = sr.block_number
  and sr.block_date_id is null;

create index if not exists swap_requests_program_year_idx on swap_requests(program_id, academic_year_id);
create index if not exists swap_requests_block_date_id_idx on swap_requests(block_date_id);

-- ---------------------------------------------------------------------------
-- 7) Normalize schedule_assignments
-- ---------------------------------------------------------------------------

alter table schedule_assignments
  add column if not exists program_id uuid references programs(id) on delete cascade,
  add column if not exists academic_year_id uuid references academic_years(id) on delete cascade;

update schedule_assignments sa
set
  program_id = bd.program_id,
  academic_year_id = bd.academic_year_id
from block_dates bd
where bd.id = sa.block_date_id
  and (sa.program_id is null or sa.academic_year_id is null);

create index if not exists schedule_assignments_program_year_idx on schedule_assignments(program_id, academic_year_id);

-- ---------------------------------------------------------------------------
-- 8) Normalize call_float_assignments
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from information_schema.tables where table_name='call_float_assignments') then
    alter table call_float_assignments
      add column if not exists program_id uuid references programs(id) on delete cascade,
      add column if not exists academic_year_id uuid references academic_years(id) on delete cascade;

    -- Backfill from institution_id via fellows (pick first matching program per institution)
    update call_float_assignments cfa
    set program_id = (
      select p.id
      from fellows f
      join programs p on p.id = f.program_id
      where f.institution_id = cfa.institution_id
        and p.id is not null
      limit 1
    )
    where cfa.program_id is null;

    -- Backfill current academic year
    update call_float_assignments cfa
    set academic_year_id = ay.id
    from programs p
    join academic_years ay on ay.institution_id = p.institution_id and ay.is_current = true
    where p.id = cfa.program_id
      and cfa.academic_year_id is null;

    -- Drop old unique, add new scoped unique
    alter table call_float_assignments
      drop constraint if exists call_float_assignments_institution_id_block_number_weekend_type_key,
      drop constraint if exists call_float_assignments_scope_unique;

    alter table call_float_assignments
      add constraint call_float_assignments_scope_unique
      unique (program_id, academic_year_id, block_number, weekend, type);

    create index if not exists call_float_assignments_program_year_idx
      on call_float_assignments(program_id, academic_year_id);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 9) RLS enable + policies
-- ---------------------------------------------------------------------------

alter table programs enable row level security;
alter table academic_years enable row level security;
alter table program_memberships enable row level security;
alter table institution_admins enable row level security;
alter table block_dates enable row level security;
alter table fellows enable row level security;
alter table vacation_requests enable row level security;
alter table swap_requests enable row level security;
alter table schedule_assignments enable row level security;

-- Drop and recreate all policies (idempotent)
do $$ declare pol record; begin
  for pol in select policyname, tablename from pg_policies
    where tablename in ('programs','academic_years','program_memberships','institution_admins',
      'block_dates','fellows','vacation_requests','swap_requests','schedule_assignments',
      'call_float_assignments')
  loop
    execute format('drop policy if exists %I on %I', pol.policyname, pol.tablename);
  end loop;
end $$;

-- programs
create policy "Programs readable" on programs for select using (
  is_institution_admin(programs.institution_id)
  or is_program_member(programs.id)
);
create policy "Programs writable" on programs for all
  using (is_institution_admin(programs.institution_id))
  with check (is_institution_admin(programs.institution_id));

-- academic_years
create policy "Academic years readable" on academic_years for select using (
  is_institution_admin(academic_years.institution_id)
  or exists (
    select 1 from programs p join program_memberships pm on pm.program_id = p.id
    where p.institution_id = academic_years.institution_id and pm.user_id = auth.uid() and pm.is_active
  )
);
create policy "Academic years writable" on academic_years for all
  using (is_institution_admin(academic_years.institution_id))
  with check (is_institution_admin(academic_years.institution_id));

-- program_memberships
create policy "Program memberships readable" on program_memberships for select using (
  is_program_member(program_memberships.program_id)
  or exists (select 1 from programs p where p.id = program_memberships.program_id and is_institution_admin(p.institution_id))
);
create policy "Program memberships writable" on program_memberships for all
  using (has_program_role(program_memberships.program_id, array['program_admin','program_director']) or exists (select 1 from programs p where p.id = program_memberships.program_id and is_institution_admin(p.institution_id)))
  with check (has_program_role(program_memberships.program_id, array['program_admin','program_director']) or exists (select 1 from programs p where p.id = program_memberships.program_id and is_institution_admin(p.institution_id)));

-- institution_admins
create policy "Institution admins readable" on institution_admins for select using (is_institution_admin(institution_admins.institution_id));
create policy "Institution admins writable" on institution_admins for all
  using (is_institution_admin(institution_admins.institution_id))
  with check (is_institution_admin(institution_admins.institution_id));

-- block_dates
create policy "Block dates readable" on block_dates for select using (
  is_program_member(block_dates.program_id)
  or exists (select 1 from programs p where p.id = block_dates.program_id and is_institution_admin(p.institution_id))
);
create policy "Block dates writable" on block_dates for all
  using (has_program_role(block_dates.program_id, array['program_admin','program_director','chief_fellow']) or exists (select 1 from programs p where p.id = block_dates.program_id and is_institution_admin(p.institution_id)))
  with check (has_program_role(block_dates.program_id, array['program_admin','program_director','chief_fellow']) or exists (select 1 from programs p where p.id = block_dates.program_id and is_institution_admin(p.institution_id)));

-- fellows
create policy "Fellows readable" on fellows for select using (
  is_program_member(fellows.program_id)
  or exists (select 1 from programs p where p.id = fellows.program_id and is_institution_admin(p.institution_id))
);
create policy "Fellows writable" on fellows for all
  using (has_program_role(fellows.program_id, array['program_admin','program_director','chief_fellow']) or exists (select 1 from programs p where p.id = fellows.program_id and is_institution_admin(p.institution_id)))
  with check (has_program_role(fellows.program_id, array['program_admin','program_director','chief_fellow']) or exists (select 1 from programs p where p.id = fellows.program_id and is_institution_admin(p.institution_id)));

-- vacation_requests
create policy "Vacation readable" on vacation_requests for select using (
  vacation_requests.requested_by = auth.uid()
  or is_program_member(vacation_requests.program_id)
  or exists (select 1 from programs p where p.id = vacation_requests.program_id and is_institution_admin(p.institution_id))
);
create policy "Vacation writable" on vacation_requests for all
  using (vacation_requests.requested_by = auth.uid() or has_program_role(vacation_requests.program_id, array['program_admin','program_director','chief_fellow']) or exists (select 1 from programs p where p.id = vacation_requests.program_id and is_institution_admin(p.institution_id)))
  with check (vacation_requests.requested_by = auth.uid() or has_program_role(vacation_requests.program_id, array['program_admin','program_director','chief_fellow']) or exists (select 1 from programs p where p.id = vacation_requests.program_id and is_institution_admin(p.institution_id)));

-- swap_requests
create policy "Swap readable" on swap_requests for select using (
  swap_requests.requested_by = auth.uid()
  or is_program_member(swap_requests.program_id)
  or exists (select 1 from programs p where p.id = swap_requests.program_id and is_institution_admin(p.institution_id))
);
create policy "Swap writable" on swap_requests for all
  using (swap_requests.requested_by = auth.uid() or has_program_role(swap_requests.program_id, array['program_admin','program_director','chief_fellow']) or exists (select 1 from programs p where p.id = swap_requests.program_id and is_institution_admin(p.institution_id)))
  with check (swap_requests.requested_by = auth.uid() or has_program_role(swap_requests.program_id, array['program_admin','program_director','chief_fellow']) or exists (select 1 from programs p where p.id = swap_requests.program_id and is_institution_admin(p.institution_id)));

-- schedule_assignments
create policy "Schedule readable" on schedule_assignments for select using (
  is_program_member(schedule_assignments.program_id)
  or exists (select 1 from programs p where p.id = schedule_assignments.program_id and is_institution_admin(p.institution_id))
);
create policy "Schedule writable" on schedule_assignments for all
  using (has_program_role(schedule_assignments.program_id, array['program_admin','program_director','chief_fellow']) or exists (select 1 from programs p where p.id = schedule_assignments.program_id and is_institution_admin(p.institution_id)))
  with check (has_program_role(schedule_assignments.program_id, array['program_admin','program_director','chief_fellow']) or exists (select 1 from programs p where p.id = schedule_assignments.program_id and is_institution_admin(p.institution_id)));

-- call_float_assignments (conditional)
do $$
begin
  if exists (select 1 from information_schema.tables where table_name='call_float_assignments') then
    alter table call_float_assignments enable row level security;

    create policy "CallFloat readable" on call_float_assignments for select using (
      is_program_member(call_float_assignments.program_id)
      or exists (select 1 from programs p where p.id = call_float_assignments.program_id and is_institution_admin(p.institution_id))
    );
    create policy "CallFloat writable" on call_float_assignments for all
      using (has_program_role(call_float_assignments.program_id, array['program_admin','program_director','chief_fellow']) or exists (select 1 from programs p where p.id = call_float_assignments.program_id and is_institution_admin(p.institution_id)))
      with check (has_program_role(call_float_assignments.program_id, array['program_admin','program_director','chief_fellow']) or exists (select 1 from programs p where p.id = call_float_assignments.program_id and is_institution_admin(p.institution_id)));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 10) Auto-seed program_memberships from existing profiles.role
-- ---------------------------------------------------------------------------
-- Maps old string roles → new program_memberships rows.
-- Only seeds for users who have a program row they can be matched to.
-- Run this after backfill to give existing users access under new RLS.

insert into program_memberships (program_id, user_id, role)
select
  p.id as program_id,
  pr.id as user_id,
  case pr.role
    when 'admin' then 'program_admin'
    when 'program_director' then 'program_director'
    when 'chief_fellow' then 'chief_fellow'
    when 'fellow' then 'fellow'
    when 'resident' then 'resident'
    else 'member'
  end as role
from profiles pr
join programs p on p.institution_id = pr.institution_id
  and p.name = coalesce(pr.program, '')
where pr.institution_id is not null
  and pr.is_active = true
on conflict (program_id, user_id) do nothing;

-- Seed institution_admins from admin profiles
insert into institution_admins (institution_id, user_id)
select institution_id, id
from profiles
where role = 'admin' and institution_id is not null and is_active = true
on conflict (institution_id, user_id) do nothing;

commit;

-- ---------------------------------------------------------------------------
-- Verification queries (run separately after commit):
-- ---------------------------------------------------------------------------
-- select count(*) from block_dates where program_id is null or academic_year_id is null;
-- select count(*) from fellows where program_id is null;
-- select count(*) from vacation_requests where program_id is null;
-- select count(*) from program_memberships;
-- select count(*) from institution_admins;
