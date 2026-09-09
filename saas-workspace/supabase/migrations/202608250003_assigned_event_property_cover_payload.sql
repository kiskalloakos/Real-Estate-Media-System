-- Expose only the linked property's display name and cover path for calendar
-- events assigned to the current user. This lets a team member render the
-- event card without granting access to the full property workspace row.

create or replace function public.list_assigned_event_property_covers()
returns table (
  calendar_event_id uuid,
  property_id uuid,
  property_name text,
  cover_image_path text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    event.id,
    property.id,
    property.name,
    property.cover_image_path
  from public.calendar_events event
  join public.calendar_event_assignees assignee
    on assignee.calendar_event_id = event.id
   and assignee.agency_id = event.agency_id
  join public.properties property
    on property.id = event.property_id
   and property.agency_id = event.agency_id
  where assignee.user_id = auth.uid()
    and event.archived_at is null
    and property.archived_at is null
    and public.can_view_calendar_event(event.id);
$$;

revoke all on function public.list_assigned_event_property_covers() from public;
grant execute on function public.list_assigned_event_property_covers() to authenticated;
