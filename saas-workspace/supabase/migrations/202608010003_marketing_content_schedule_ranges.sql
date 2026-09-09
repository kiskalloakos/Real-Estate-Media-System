alter table public.marketing_content
  add column if not exists planned_until timestamptz,
  add column if not exists all_day boolean not null default false;

alter table public.marketing_content
  add constraint marketing_content_schedule_range_check
  check (planned_until is null or planned_for is null or planned_until >= planned_for);

create index if not exists marketing_content_agency_schedule_range_idx
  on public.marketing_content (agency_id, planned_for, planned_until, status)
  where archived_at is null;
