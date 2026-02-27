begin;

-- vacation_requests (required)
alter table public.vacation_requests
  add column if not exists week_part smallint;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'vacation_requests_week_part_chk'
  ) then
    alter table public.vacation_requests
      add constraint vacation_requests_week_part_chk
      check (week_part in (1,2) or week_part is null);
  end if;
end $$;

-- day_off_requests (optional)
do $$
begin
  if to_regclass('public.day_off_requests') is not null then
    alter table public.day_off_requests
      add column if not exists week_part smallint;

    if not exists (
      select 1
      from pg_constraint
      where conname = 'day_off_requests_week_part_chk'
    ) then
      alter table public.day_off_requests
        add constraint day_off_requests_week_part_chk
        check (week_part in (1,2) or week_part is null);
    end if;
  end if;
end $$;

-- swap_requests (optional)
do $$
begin
  if to_regclass('public.swap_requests') is not null then
    alter table public.swap_requests
      add column if not exists from_week_part smallint,
      add column if not exists to_week_part smallint;

    if not exists (
      select 1
      from pg_constraint
      where conname = 'swap_requests_from_week_part_chk'
    ) then
      alter table public.swap_requests
        add constraint swap_requests_from_week_part_chk
        check (from_week_part in (1,2) or from_week_part is null);
    end if;

    if not exists (
      select 1
      from pg_constraint
      where conname = 'swap_requests_to_week_part_chk'
    ) then
      alter table public.swap_requests
        add constraint swap_requests_to_week_part_chk
        check (to_week_part in (1,2) or to_week_part is null);
    end if;
  end if;
end $$;

commit;