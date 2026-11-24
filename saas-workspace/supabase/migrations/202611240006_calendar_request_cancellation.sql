-- Preserve the existing calendar delete action and retain the request outcome.
begin;
alter table public.calendar_booking_requests drop constraint calendar_booking_requests_status_check;
alter table public.calendar_booking_requests add constraint calendar_booking_requests_status_check check(status in ('pending','confirmed','declined','cancelled'));
create function public.cancel_deleted_calendar_booking() returns trigger language plpgsql security definer set search_path='' as $$
begin
  update public.calendar_booking_requests set status='cancelled',calendar_event_id=null where calendar_event_id=old.id;
  return old;
end; $$;
revoke all on function public.cancel_deleted_calendar_booking() from public,anon,authenticated;
create trigger calendar_cancel_booking_before_delete before delete on public.calendar_events for each row execute function public.cancel_deleted_calendar_booking();
commit;
