-- Team members assigned to a calendar event need to see the cover of the
-- property linked to that event, even when they are not assigned to the
-- property workspace itself. Keep this exception read-only and cover-only so
-- it does not grant access to the property's other private files or uploads.

create or replace function public.can_read_assigned_event_property_cover_path(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with path as (
    select storage.foldername(p_name) as parts
  )
  select exists (
    select 1
    from path
    join public.properties property
      on property.agency_id::text = path.parts[1]
     and property.client_account_id::text = path.parts[2]
     and property.id::text = path.parts[3]
    where array_length(path.parts, 1) >= 4
      and path.parts[4] = 'cover'
      and exists (
        select 1
        from public.calendar_events event
        join public.calendar_event_assignees assignee
          on assignee.calendar_event_id = event.id
         and assignee.agency_id = event.agency_id
        where event.property_id = property.id
          and event.agency_id = property.agency_id
          and event.archived_at is null
          and assignee.user_id = auth.uid()
          and public.can_view_calendar_event(event.id)
      )
  );
$$;

drop policy if exists client_files_select_access
  on storage.objects;

create policy client_files_select_access
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'client-files'
    and (
      public.can_read_client_storage_path(name)
      or public.can_read_assigned_event_property_cover_path(name)
    )
  );

revoke all on function public.can_read_assigned_event_property_cover_path(text) from public;
grant execute on function public.can_read_assigned_event_property_cover_path(text) to authenticated;
