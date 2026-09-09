-- The previous SELECT policy delegated to can_view_calendar_event(id).
-- During INSERT ... RETURNING, that helper cannot see the row being inserted yet,
-- so Postgres rejects the response even when the INSERT policy passes.
-- Keep the same access rules, but evaluate them directly against the current row.

drop policy if exists calendar_events_select_access
  on public.calendar_events;

create policy calendar_events_select_access
  on public.calendar_events for select
  to authenticated
  using (
    archived_at is null
    and (
      public.is_agency_admin(agency_id)
      or (
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
  );
