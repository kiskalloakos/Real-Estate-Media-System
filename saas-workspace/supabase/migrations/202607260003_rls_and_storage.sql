-- Row-level security matrix and private Storage policies.

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- Agency scope is immutable after a row is created.
create or replace function public.enforce_immutable_agency_scope()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.agency_id <> old.agency_id then
    raise exception 'agency_id is immutable';
  end if;
  return new;
end;
$$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'agency_memberships',
    'client_accounts',
    'client_memberships',
    'invitations',
    'properties',
    'property_team_assignments',
    'service_contracts',
    'contract_deliverables',
    'payment_schedule_items',
    'payment_records',
    'media_assets',
    'review_comments',
    'calendar_events',
    'tasks',
    'notes',
    'gear_items',
    'finance_accounts',
    'finance_categories',
    'finance_transactions',
    'finance_debts',
    'recurring_costs',
    'recurring_cost_occurrences'
  ]
  loop
    execute format(
      'create trigger %I before update on public.%I
       for each row execute function public.enforce_immutable_agency_scope()',
      'protect_' || v_table || '_agency_scope',
      v_table
    );
  end loop;
end;
$$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'agencies',
    'profiles',
    'agency_memberships',
    'client_accounts',
    'client_memberships',
    'invitations',
    'properties',
    'property_team_assignments',
    'service_contracts',
    'contract_deliverables',
    'payment_schedule_items',
    'payment_records',
    'media_assets',
    'media_versions',
    'review_comments',
    'review_approval_events',
    'calendar_events',
    'calendar_event_assignees',
    'tasks',
    'notes',
    'record_attachments',
    'gear_items',
    'gear_custody_history',
    'finance_accounts',
    'finance_categories',
    'finance_transactions',
    'finance_debts',
    'finance_debt_payments',
    'recurring_costs',
    'recurring_cost_occurrences',
    'audit_events'
  ]
  loop
    execute format('alter table public.%I enable row level security', v_table);
  end loop;
end;
$$;

-- Agencies and identity.
create policy agencies_select_member
  on public.agencies for select
  to authenticated
  using (public.is_active_agency_member(id));

create policy agencies_update_admin
  on public.agencies for update
  to authenticated
  using (public.is_agency_admin(id))
  with check (public.is_agency_admin(id));

create policy profiles_select_visible
  on public.profiles for select
  to authenticated
  using (public.can_view_profile(id));

create policy profiles_update_self
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy agency_memberships_select
  on public.agency_memberships for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_agency_admin(agency_id)
    or (
      role in ('admin', 'team_member')
      and public.is_active_agency_member(agency_id)
    )
  );

create policy agency_memberships_insert_admin
  on public.agency_memberships for insert
  to authenticated
  with check (public.is_agency_admin(agency_id));

create policy agency_memberships_update_admin
  on public.agency_memberships for update
  to authenticated
  using (public.is_agency_admin(agency_id))
  with check (public.is_agency_admin(agency_id));

create policy agency_memberships_delete_admin
  on public.agency_memberships for delete
  to authenticated
  using (public.is_agency_admin(agency_id));

-- Clients, client users, properties, and assignments.
create policy client_accounts_select_context
  on public.client_accounts for select
  to authenticated
  using (public.has_client_context(id));

create policy client_accounts_insert_admin
  on public.client_accounts for insert
  to authenticated
  with check (public.is_agency_admin(agency_id));

create policy client_accounts_update_admin
  on public.client_accounts for update
  to authenticated
  using (public.is_agency_admin(agency_id))
  with check (public.is_agency_admin(agency_id));

create policy client_accounts_delete_admin
  on public.client_accounts for delete
  to authenticated
  using (public.is_agency_admin(agency_id));

create policy client_memberships_select
  on public.client_memberships for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_agency_admin(agency_id)
    or public.has_client_access(client_account_id)
  );

create policy client_memberships_insert_admin
  on public.client_memberships for insert
  to authenticated
  with check (public.is_agency_admin(agency_id));

create policy client_memberships_update_admin
  on public.client_memberships for update
  to authenticated
  using (public.is_agency_admin(agency_id))
  with check (public.is_agency_admin(agency_id));

create policy client_memberships_delete_admin
  on public.client_memberships for delete
  to authenticated
  using (public.is_agency_admin(agency_id));

create policy invitations_select_manager
  on public.invitations for select
  to authenticated
  using (
    public.is_agency_admin(agency_id)
    or (
      client_account_id is not null
      and public.is_client_owner(client_account_id)
    )
  );

create policy invitations_update_manager
  on public.invitations for update
  to authenticated
  using (
    public.is_agency_admin(agency_id)
    or (
      agency_role = 'client'
      and client_account_id is not null
      and public.is_client_owner(client_account_id)
    )
  )
  with check (
    public.is_agency_admin(agency_id)
    or (
      agency_role = 'client'
      and client_account_id is not null
      and public.is_client_owner(client_account_id)
    )
  );

create policy properties_select_access
  on public.properties for select
  to authenticated
  using (public.has_property_access(id));

create policy properties_insert_admin
  on public.properties for insert
  to authenticated
  with check (public.is_agency_admin(agency_id));

create policy properties_update_admin
  on public.properties for update
  to authenticated
  using (public.is_agency_admin(agency_id))
  with check (public.is_agency_admin(agency_id));

create policy properties_delete_admin
  on public.properties for delete
  to authenticated
  using (public.is_agency_admin(agency_id));

create policy property_assignments_select
  on public.property_team_assignments for select
  to authenticated
  using (
    public.is_agency_admin(agency_id)
    or user_id = auth.uid()
  );

create policy property_assignments_insert_admin
  on public.property_team_assignments for insert
  to authenticated
  with check (public.is_agency_admin(agency_id));

create policy property_assignments_update_admin
  on public.property_team_assignments for update
  to authenticated
  using (public.is_agency_admin(agency_id))
  with check (public.is_agency_admin(agency_id));

create policy property_assignments_delete_admin
  on public.property_team_assignments for delete
  to authenticated
  using (public.is_agency_admin(agency_id));

-- Contracts, deliverables, and manual billing.
create policy service_contracts_select
  on public.service_contracts for select
  to authenticated
  using (
    public.is_agency_admin(agency_id)
    or (
      client_visible
      and public.has_client_access(client_account_id)
    )
  );

create policy service_contracts_admin_all
  on public.service_contracts for all
  to authenticated
  using (public.is_agency_admin(agency_id))
  with check (public.is_agency_admin(agency_id));

create policy contract_deliverables_select
  on public.contract_deliverables for select
  to authenticated
  using (
    public.is_agency_admin(agency_id)
    or (
      public.is_agency_team_member(agency_id)
      and (
        (property_id is not null and public.is_property_team_member(property_id))
        or exists (
          select 1
          from public.service_contracts contract
          where contract.id = contract_deliverables.contract_id
            and public.has_client_context(contract.client_account_id)
        )
      )
    )
    or (
      client_visible
      and exists (
        select 1
        from public.service_contracts contract
        where contract.id = contract_deliverables.contract_id
          and public.has_client_access(contract.client_account_id)
      )
    )
  );

create policy contract_deliverables_admin_all
  on public.contract_deliverables for all
  to authenticated
  using (public.is_agency_admin(agency_id))
  with check (public.is_agency_admin(agency_id));

create policy payment_schedule_select
  on public.payment_schedule_items for select
  to authenticated
  using (
    public.is_agency_admin(agency_id)
    or (
      client_visible
      and public.has_client_access(client_account_id)
    )
  );

create policy payment_schedule_admin_all
  on public.payment_schedule_items for all
  to authenticated
  using (public.is_agency_admin(agency_id))
  with check (public.is_agency_admin(agency_id));

create policy payment_records_select
  on public.payment_records for select
  to authenticated
  using (
    public.is_agency_admin(agency_id)
    or (
      client_visible
      and public.has_client_access(client_account_id)
    )
  );

create policy payment_records_admin_all
  on public.payment_records for all
  to authenticated
  using (public.is_agency_admin(agency_id))
  with check (public.is_agency_admin(agency_id));

-- Media review.
create policy media_assets_select_access
  on public.media_assets for select
  to authenticated
  using (public.can_access_media_asset(id));

create policy media_assets_manage_admin_team
  on public.media_assets for all
  to authenticated
  using (public.can_manage_media_asset(id))
  with check (
    public.is_agency_admin(agency_id)
    or public.is_property_team_member(property_id)
  );

create policy media_versions_select_access
  on public.media_versions for select
  to authenticated
  using (public.can_access_media_asset(media_asset_id));

create policy media_versions_insert_manager
  on public.media_versions for insert
  to authenticated
  with check (
    public.can_manage_media_asset(media_asset_id)
    and exists (
      select 1
      from public.media_assets asset
      where asset.id = media_versions.media_asset_id
        and asset.agency_id = media_versions.agency_id
    )
  );

create policy media_versions_delete_manager
  on public.media_versions for delete
  to authenticated
  using (public.can_manage_media_asset(media_asset_id));

create policy review_comments_select_access
  on public.review_comments for select
  to authenticated
  using (
    public.can_access_media_asset(media_asset_id)
    and (
      visibility = 'client'
      or public.can_manage_media_asset(media_asset_id)
    )
  );

create policy review_comments_insert_access
  on public.review_comments for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and public.can_access_media_asset(media_asset_id)
    and (
      visibility = 'client'
      or public.can_manage_media_asset(media_asset_id)
    )
  );

create policy review_comments_update_access
  on public.review_comments for update
  to authenticated
  using (
    public.can_manage_media_asset(media_asset_id)
    or (
      author_id = auth.uid()
      and visibility = 'client'
      and public.can_access_media_asset(media_asset_id)
    )
  )
  with check (
    public.can_manage_media_asset(media_asset_id)
    or (
      author_id = auth.uid()
      and visibility = 'client'
      and public.can_access_media_asset(media_asset_id)
    )
  );

create policy review_comments_delete_access
  on public.review_comments for delete
  to authenticated
  using (
    public.can_manage_media_asset(media_asset_id)
    or (
      author_id = auth.uid()
      and visibility = 'client'
      and public.can_access_media_asset(media_asset_id)
    )
  );

create policy review_approval_events_select_access
  on public.review_approval_events for select
  to authenticated
  using (public.can_access_media_asset(media_asset_id));

create policy review_approval_events_insert_access
  on public.review_approval_events for insert
  to authenticated
  with check (
    actor_id = auth.uid()
    and public.can_access_media_asset(media_asset_id)
    and (
      public.can_manage_media_asset(media_asset_id)
      or decision in ('changes_requested', 'approved')
    )
  );

-- Calendar, tasks, notes, and attachments.
create policy calendar_events_select_access
  on public.calendar_events for select
  to authenticated
  using (public.can_view_calendar_event(id));

create policy calendar_events_insert_access
  on public.calendar_events for insert
  to authenticated
  with check (
    public.is_agency_admin(agency_id)
    or (
      public.is_agency_team_member(agency_id)
      and created_by = auth.uid()
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

create policy calendar_events_update_access
  on public.calendar_events for update
  to authenticated
  using (public.can_edit_calendar_event(id))
  with check (
    public.is_agency_admin(agency_id)
    or (
      public.is_agency_team_member(agency_id)
      and created_by = auth.uid()
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

create policy calendar_events_delete_access
  on public.calendar_events for delete
  to authenticated
  using (public.can_edit_calendar_event(id));

create policy calendar_assignees_select_access
  on public.calendar_event_assignees for select
  to authenticated
  using (public.can_view_calendar_event(calendar_event_id));

create policy calendar_assignees_insert_access
  on public.calendar_event_assignees for insert
  to authenticated
  with check (public.can_edit_calendar_event(calendar_event_id));

create policy calendar_assignees_delete_access
  on public.calendar_event_assignees for delete
  to authenticated
  using (public.can_edit_calendar_event(calendar_event_id));

create policy tasks_select_access
  on public.tasks for select
  to authenticated
  using (public.can_view_task(id));

create policy tasks_insert_access
  on public.tasks for insert
  to authenticated
  with check (
    public.is_agency_admin(agency_id)
    or (
      public.is_agency_team_member(agency_id)
      and created_by = auth.uid()
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

create policy tasks_update_access
  on public.tasks for update
  to authenticated
  using (public.can_edit_task(id))
  with check (
    public.is_agency_admin(agency_id)
    or (
      public.is_agency_team_member(agency_id)
      and visibility <> 'admin_only'
      and (
        assignee_user_id = auth.uid()
        or created_by = auth.uid()
        or (
          property_id is not null
          and public.is_property_team_member(property_id)
        )
      )
      and (
        client_account_id is null
        or public.has_client_context(client_account_id)
      )
    )
  );

create policy tasks_delete_access
  on public.tasks for delete
  to authenticated
  using (
    public.is_agency_admin(agency_id)
    or created_by = auth.uid()
  );

create policy notes_select_access
  on public.notes for select
  to authenticated
  using (public.can_view_note(id));

create policy notes_insert_access
  on public.notes for insert
  to authenticated
  with check (
    public.is_agency_admin(agency_id)
    or (
      public.is_agency_team_member(agency_id)
      and created_by = auth.uid()
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

create policy notes_update_access
  on public.notes for update
  to authenticated
  using (public.can_edit_note(id))
  with check (
    public.is_agency_admin(agency_id)
    or (
      public.is_agency_team_member(agency_id)
      and created_by = auth.uid()
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

create policy notes_delete_access
  on public.notes for delete
  to authenticated
  using (public.can_edit_note(id));

create policy attachments_select_access
  on public.record_attachments for select
  to authenticated
  using (
    (calendar_event_id is not null and public.can_view_calendar_event(calendar_event_id))
    or (task_id is not null and public.can_view_task(task_id))
    or (note_id is not null and public.can_view_note(note_id))
  );

create policy attachments_insert_access
  on public.record_attachments for insert
  to authenticated
  with check (
    uploaded_by = auth.uid()
    and (
      (calendar_event_id is not null and public.can_edit_calendar_event(calendar_event_id))
      or (task_id is not null and public.can_edit_task(task_id))
      or (note_id is not null and public.can_edit_note(note_id))
    )
  );

create policy attachments_delete_access
  on public.record_attachments for delete
  to authenticated
  using (
    public.is_agency_admin(agency_id)
    or (
      uploaded_by = auth.uid()
      and (
        (calendar_event_id is not null and public.can_edit_calendar_event(calendar_event_id))
        or (task_id is not null and public.can_edit_task(task_id))
        or (note_id is not null and public.can_edit_note(note_id))
      )
    )
  );

-- Gear.
create policy gear_items_select_access
  on public.gear_items for select
  to authenticated
  using (
    public.is_agency_admin(agency_id)
    or (
      public.is_agency_team_member(agency_id)
      and (
        current_custodian_user_id = auth.uid()
        or (
          current_property_id is not null
          and public.is_property_team_member(current_property_id)
        )
      )
    )
  );

create policy gear_items_admin_all
  on public.gear_items for all
  to authenticated
  using (public.is_agency_admin(agency_id))
  with check (public.is_agency_admin(agency_id));

create policy gear_history_select_access
  on public.gear_custody_history for select
  to authenticated
  using (
    public.is_agency_admin(agency_id)
    or (
      public.is_agency_team_member(agency_id)
      and (
        from_user_id = auth.uid()
        or to_user_id = auth.uid()
        or (from_property_id is not null and public.is_property_team_member(from_property_id))
        or (to_property_id is not null and public.is_property_team_member(to_property_id))
      )
    )
  );

create policy gear_history_admin_all
  on public.gear_custody_history for all
  to authenticated
  using (public.is_agency_admin(agency_id))
  with check (public.is_agency_admin(agency_id));

-- The entire Finances module is admin-only.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'finance_accounts',
    'finance_categories',
    'finance_transactions',
    'finance_debts',
    'finance_debt_payments',
    'recurring_costs',
    'recurring_cost_occurrences'
  ]
  loop
    execute format(
      'create policy %I on public.%I for all to authenticated
       using (public.is_agency_admin(agency_id))
       with check (public.is_agency_admin(agency_id))',
      v_table || '_admin_all',
      v_table
    );
  end loop;
end;
$$;

create policy audit_events_select_admin
  on public.audit_events for select
  to authenticated
  using (public.is_agency_admin(agency_id));

-- Private Storage helpers. Canonical client-files paths are:
-- <agency_uuid>/<client_uuid>/<property_uuid|_account>/<category>/<filename>
create or replace function public.can_read_client_storage_path(p_name text)
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
    join public.client_accounts client
      on client.agency_id::text = path.parts[1]
     and client.id::text = path.parts[2]
    where array_length(path.parts, 1) >= 4
      and (
        public.is_agency_admin(client.agency_id)
        or (
          path.parts[3] = '_account'
          and public.has_client_access(client.id)
        )
        or exists (
          select 1
          from public.properties property
          where property.agency_id = client.agency_id
            and property.client_account_id = client.id
            and property.id::text = path.parts[3]
            and (
              public.has_client_access(client.id)
              or public.is_property_team_member(property.id)
            )
        )
      )
  );
$$;

create or replace function public.can_write_client_storage_path(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_read_client_storage_path(p_name);
$$;

create or replace function public.can_manage_client_storage_path(p_name text)
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
    join public.client_accounts client
      on client.agency_id::text = path.parts[1]
     and client.id::text = path.parts[2]
    where array_length(path.parts, 1) >= 4
      and (
        public.is_agency_admin(client.agency_id)
        or exists (
          select 1
          from public.properties property
          where property.agency_id = client.agency_id
            and property.client_account_id = client.id
            and property.id::text = path.parts[3]
            and public.is_property_team_member(property.id)
        )
      )
  );
$$;

create or replace function public.can_read_avatar_storage_path(p_name text)
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
    join public.profiles profile
      on profile.id::text = path.parts[1]
    where array_length(path.parts, 1) >= 1
      and public.can_view_profile(profile.id)
  );
$$;

create or replace function public.can_read_gear_storage_path(p_name text)
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
    join public.gear_items gear
      on gear.agency_id::text = path.parts[1]
     and gear.id::text = path.parts[2]
    where array_length(path.parts, 1) >= 2
      and (
        public.is_agency_admin(gear.agency_id)
        or gear.current_custodian_user_id = auth.uid()
        or (
          gear.current_property_id is not null
          and public.is_property_team_member(gear.current_property_id)
        )
      )
  );
$$;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values
  (
    'avatars',
    'avatars',
    false,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
  ),
  (
    'client-files',
    'client-files',
    false,
    1073741824,
    array[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'video/mp4',
      'video/quicktime',
      'video/webm',
      'audio/mpeg',
      'audio/mp4'
    ]
  ),
  (
    'media-review',
    'media-review',
    false,
    1073741824,
    array[
      'application/pdf',
      'text/plain',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'video/mp4',
      'video/quicktime',
      'video/webm',
      'audio/mpeg',
      'audio/mp4'
    ]
  ),
  (
    'agency-files',
    'agency-files',
    false,
    52428800,
    null
  ),
  (
    'gear-files',
    'gear-files',
    false,
    20971520,
    array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
  )
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy avatars_select_visible
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and public.can_read_avatar_storage_path(name)
  );

create policy avatars_insert_own
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy avatars_update_own
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy avatars_delete_own
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy client_files_select_access
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'client-files'
    and public.can_read_client_storage_path(name)
  );

create policy client_files_insert_access
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'client-files'
    and public.can_write_client_storage_path(name)
  );

create policy client_files_update_manager
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'client-files'
    and public.can_manage_client_storage_path(name)
  )
  with check (
    bucket_id = 'client-files'
    and public.can_manage_client_storage_path(name)
  );

create policy client_files_delete_manager
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'client-files'
    and public.can_manage_client_storage_path(name)
  );

-- media-review paths are
-- <agency_uuid>/<client_uuid>/<property_uuid>/<media_asset_uuid>/<filename>.
create policy media_review_select_access
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'media-review'
    and public.can_read_client_storage_path(name)
  );

create policy media_review_insert_access
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'media-review'
    and public.can_manage_client_storage_path(name)
  );

create policy media_review_update_manager
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'media-review'
    and public.can_manage_client_storage_path(name)
  )
  with check (
    bucket_id = 'media-review'
    and public.can_manage_client_storage_path(name)
  );

create policy media_review_delete_manager
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'media-review'
    and public.can_manage_client_storage_path(name)
  );

create policy agency_files_select_member
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'agency-files'
    and exists (
      select 1
      from public.agencies agency
      where agency.id::text = (storage.foldername(name))[1]
        and public.is_active_agency_member(agency.id)
    )
  );

create policy agency_files_insert_admin
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'agency-files'
    and exists (
      select 1
      from public.agencies agency
      where agency.id::text = (storage.foldername(name))[1]
        and public.is_agency_admin(agency.id)
    )
  );

create policy agency_files_update_admin
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'agency-files'
    and exists (
      select 1
      from public.agencies agency
      where agency.id::text = (storage.foldername(name))[1]
        and public.is_agency_admin(agency.id)
    )
  )
  with check (
    bucket_id = 'agency-files'
    and exists (
      select 1
      from public.agencies agency
      where agency.id::text = (storage.foldername(name))[1]
        and public.is_agency_admin(agency.id)
    )
  );

create policy agency_files_delete_admin
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'agency-files'
    and exists (
      select 1
      from public.agencies agency
      where agency.id::text = (storage.foldername(name))[1]
        and public.is_agency_admin(agency.id)
    )
  );

create policy gear_files_select_access
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'gear-files'
    and public.can_read_gear_storage_path(name)
  );

create policy gear_files_insert_admin
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'gear-files'
    and exists (
      select 1
      from public.gear_items gear
      where gear.agency_id::text = (storage.foldername(name))[1]
        and gear.id::text = (storage.foldername(name))[2]
        and public.is_agency_admin(gear.agency_id)
    )
  );

create policy gear_files_update_admin
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'gear-files'
    and exists (
      select 1
      from public.gear_items gear
      where gear.agency_id::text = (storage.foldername(name))[1]
        and gear.id::text = (storage.foldername(name))[2]
        and public.is_agency_admin(gear.agency_id)
    )
  )
  with check (
    bucket_id = 'gear-files'
    and exists (
      select 1
      from public.gear_items gear
      where gear.agency_id::text = (storage.foldername(name))[1]
        and gear.id::text = (storage.foldername(name))[2]
        and public.is_agency_admin(gear.agency_id)
    )
  );

create policy gear_files_delete_admin
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'gear-files'
    and exists (
      select 1
      from public.gear_items gear
      where gear.agency_id::text = (storage.foldername(name))[1]
        and gear.id::text = (storage.foldername(name))[2]
        and public.is_agency_admin(gear.agency_id)
    )
  );

-- Internal policy helpers are not exposed to anon.
revoke all on function public.is_active_agency_member(uuid, public.agency_role[]) from public;
revoke all on function public.is_agency_admin(uuid) from public;
revoke all on function public.is_agency_team_member(uuid) from public;
revoke all on function public.has_client_access(uuid) from public;
revoke all on function public.is_client_owner(uuid) from public;
revoke all on function public.is_property_team_member(uuid) from public;
revoke all on function public.has_property_access(uuid) from public;
revoke all on function public.has_client_context(uuid) from public;
revoke all on function public.can_view_profile(uuid) from public;
revoke all on function public.can_manage_media_asset(uuid) from public;
revoke all on function public.can_access_media_asset(uuid) from public;
revoke all on function public.can_view_calendar_event(uuid) from public;
revoke all on function public.can_edit_calendar_event(uuid) from public;
revoke all on function public.can_view_task(uuid) from public;
revoke all on function public.can_edit_task(uuid) from public;
revoke all on function public.can_view_note(uuid) from public;
revoke all on function public.can_edit_note(uuid) from public;
revoke all on function public.can_read_client_storage_path(text) from public;
revoke all on function public.can_write_client_storage_path(text) from public;
revoke all on function public.can_manage_client_storage_path(text) from public;
revoke all on function public.can_read_avatar_storage_path(text) from public;
revoke all on function public.can_read_gear_storage_path(text) from public;

grant execute on function public.is_active_agency_member(uuid, public.agency_role[]) to authenticated;
grant execute on function public.is_agency_admin(uuid) to authenticated;
grant execute on function public.is_agency_team_member(uuid) to authenticated;
grant execute on function public.has_client_access(uuid) to authenticated;
grant execute on function public.is_client_owner(uuid) to authenticated;
grant execute on function public.is_property_team_member(uuid) to authenticated;
grant execute on function public.has_property_access(uuid) to authenticated;
grant execute on function public.has_client_context(uuid) to authenticated;
grant execute on function public.can_view_profile(uuid) to authenticated;
grant execute on function public.can_manage_media_asset(uuid) to authenticated;
grant execute on function public.can_access_media_asset(uuid) to authenticated;
grant execute on function public.can_view_calendar_event(uuid) to authenticated;
grant execute on function public.can_edit_calendar_event(uuid) to authenticated;
grant execute on function public.can_view_task(uuid) to authenticated;
grant execute on function public.can_edit_task(uuid) to authenticated;
grant execute on function public.can_view_note(uuid) to authenticated;
grant execute on function public.can_edit_note(uuid) to authenticated;
grant execute on function public.can_read_client_storage_path(text) to authenticated;
grant execute on function public.can_write_client_storage_path(text) to authenticated;
grant execute on function public.can_manage_client_storage_path(text) to authenticated;
grant execute on function public.can_read_avatar_storage_path(text) to authenticated;
grant execute on function public.can_read_gear_storage_path(text) to authenticated;
