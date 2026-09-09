-- Soft-deleting a calendar event updates archived_at. Postgres evaluates the
-- SELECT policy against the new row during UPDATE, so admins must retain policy
-- visibility of archived events for the archive operation to complete.
-- Application queries continue to filter archived_at is null.

drop policy if exists calendar_events_select_access
  on public.calendar_events;

create policy calendar_events_select_access
  on public.calendar_events for select
  to authenticated
  using (
    public.is_agency_admin(agency_id)
    or (
      archived_at is null
      and (
        (
          public.is_agency_team_member(agency_id)
          and visibility <> 'admin_only'
          and (
            visibility = 'team'
            or created_by = auth.uid()
            or exists (
              select 1
              from public.calendar_event_assignees assignee
              where assignee.calendar_event_id = calendar_events.id
                and assignee.user_id = auth.uid()
            )
            or (
              property_id is not null
              and public.is_property_team_member(property_id)
            )
          )
        )
        or (
          visibility = 'client'
          and client_account_id is not null
          and public.has_client_access(client_account_id)
        )
      )
    )
  );
