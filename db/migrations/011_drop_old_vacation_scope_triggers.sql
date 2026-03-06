-- 011_drop_old_vacation_scope_triggers.sql
-- Migration 010 created trg_vacation_request_fellow_scope but did NOT drop two
-- pre-existing BEFORE INSERT triggers that were also enforcing (more restrictive)
-- fellow-scope logic. Those old triggers fire first and raise "No active fellow
-- scope for this user." before the new trigger even runs.
--
-- Safe to re-run (all DROP IF EXISTS).

begin;

drop trigger if exists trg_force_vacation_request_scope on vacation_requests;
drop trigger if exists trg_force_vacation_scope on vacation_requests;
drop function if exists force_vacation_request_scope();
drop function if exists force_vacation_request_scope_from_fellow();

commit;
