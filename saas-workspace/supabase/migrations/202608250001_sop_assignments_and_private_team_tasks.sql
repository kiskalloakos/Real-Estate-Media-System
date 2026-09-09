-- Persist SOP assignments across users/devices and make team task access
-- strictly personal. Admins keep agency-wide access in both areas.

begin;

create table public.company_document_assignees (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  company_document_id uuid not null,
  user_id uuid not null,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  foreign key (company_document_id, agency_id)
    references public.company_documents(id, agency_id) on delete cascade,
  foreign key (agency_id, user_id)
    references public.agency_memberships(agency_id, user_id) on delete cascade,
  unique (company_document_id, user_id)
);

create index company_document_assignees_user_idx
  on public.company_document_assignees (user_id, company_document_id);

alter table public.company_document_assignees enable row level security;

create policy company_document_assignees_admin_all
  on public.company_document_assignees for all
  to authenticated
  using (public.is_agency_admin(agency_id))
  with check (public.is_agency_admin(agency_id));

create policy company_document_assignees_read_own
  on public.company_document_assignees for select
  to authenticated
  using (
    user_id = auth.uid()
    and public.is_agency_team_member(agency_id)
  );

create or replace function public.can_view_company_document(p_document_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.company_documents document
    where document.id = p_document_id
      and document.archived_at is null
      and (
        public.is_agency_admin(document.agency_id)
        or (
          document.kind = 'sop'
          and public.is_agency_team_member(document.agency_id)
          and exists (
            select 1
            from public.company_document_assignees assignment
            where assignment.company_document_id = document.id
              and assignment.user_id = auth.uid()
          )
        )
      )
  );
$$;

create policy company_documents_assigned_sop_select
  on public.company_documents for select
  to authenticated
  using (public.can_view_company_document(id));

-- Team members see and edit only tasks explicitly assigned to themselves.
-- Client visibility remains unchanged, and admins retain agency-wide access.
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
          and task.assignee_user_id = auth.uid()
          and task.visibility <> 'admin_only'
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

create or replace function public.can_edit_task(p_task_id uuid)
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
          and task.assignee_user_id = auth.uid()
          and task.visibility <> 'admin_only'
        )
      )
  );
$$;

drop policy if exists tasks_insert_access on public.tasks;
create policy tasks_insert_access
  on public.tasks for insert
  to authenticated
  with check (
    public.is_agency_admin(agency_id)
    or (
      public.is_agency_team_member(agency_id)
      and created_by = auth.uid()
      and assignee_user_id = auth.uid()
      and visibility <> 'admin_only'
      and (
        property_id is null
        or public.is_property_team_member(property_id)
      )
      and (
        client_account_id is null
        or public.has_client_context(client_account_id)
      )
    )
  );

drop policy if exists tasks_update_access on public.tasks;
create policy tasks_update_access
  on public.tasks for update
  to authenticated
  using (public.can_edit_task(id))
  with check (
    public.is_agency_admin(agency_id)
    or (
      public.is_agency_team_member(agency_id)
      and assignee_user_id = auth.uid()
      and visibility <> 'admin_only'
      and (
        property_id is null
        or public.is_property_team_member(property_id)
      )
      and (
        client_account_id is null
        or public.has_client_context(client_account_id)
      )
    )
  );

drop policy if exists tasks_delete_access on public.tasks;
create policy tasks_delete_access
  on public.tasks for delete
  to authenticated
  using (
    public.is_agency_admin(agency_id)
    or (
      public.is_agency_team_member(agency_id)
      and assignee_user_id = auth.uid()
      and created_by = auth.uid()
    )
  );

revoke all on public.company_document_assignees from anon;
grant select, insert, update, delete on public.company_document_assignees to authenticated;
revoke all on function public.can_view_company_document(uuid) from public;
grant execute on function public.can_view_company_document(uuid) to authenticated;

commit;
