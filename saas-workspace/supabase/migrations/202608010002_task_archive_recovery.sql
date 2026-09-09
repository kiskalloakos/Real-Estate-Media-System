-- Completed tasks move into a recoverable archive. Active task queries still
-- filter archived_at in the application, while authorized agency users can
-- explicitly load archived tasks for the recovery window.

begin;

create or replace function public.can_view_task(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tasks task
    where task.id = p_task_id
      and (
        public.is_agency_admin(task.agency_id)
        or (
          public.is_agency_team_member(task.agency_id)
          and task.visibility <> 'admin_only'
          and (
            task.assignee_user_id = auth.uid()
            or task.created_by = auth.uid()
            or (
              task.property_id is not null
              and public.is_property_team_member(task.property_id)
            )
          )
        )
        or (
          task.archived_at is null
          and task.visibility = 'client'
          and task.client_account_id is not null
          and public.has_client_access(task.client_account_id)
        )
      )
  );
$$;

commit;
