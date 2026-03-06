-- 012_nullable_academic_year_label.sql
-- The denormalized "academic_year" text label on vacation_requests and
-- block_dates was defined NOT NULL, but user profiles may not carry the label
-- (the FK academic_year_id is the real reference). Make both nullable so
-- inserts don't fail when the profile label is absent.
-- Safe to re-run (ALTER COLUMN ... DROP NOT NULL is idempotent if already nullable).

begin;

alter table vacation_requests alter column academic_year drop not null;
alter table block_dates       alter column academic_year drop not null;

commit;
