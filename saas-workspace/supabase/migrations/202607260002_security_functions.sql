-- Security-definer helpers and controlled workflow RPCs.
-- Every security-definer function fixes its search_path and fully qualifies objects.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_path)
  values (
    new.id,
    coalesce(new.email, new.id::text || '@auth.local'),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'avatar_url', '')), '')
  )
  on conflict (id) do update
  set email = excluded.email,
      updated_at = now();

  return new;
end;
$$;

create or replace function public.handle_auth_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles
    set email = coalesce(new.email, new.id::text || '@auth.local'),
        updated_at = now()
    where id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_auth_user_email_change();

create or replace function public.is_active_agency_member(
  p_agency_id uuid,
  p_roles public.agency_role[] default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.agency_memberships membership
    where membership.agency_id = p_agency_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and (p_roles is null or membership.role = any(p_roles))
  );
$$;

create or replace function public.is_agency_admin(p_agency_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_agency_member(
    p_agency_id,
    array['admin']::public.agency_role[]
  );
$$;

create or replace function public.is_agency_team_member(p_agency_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_agency_member(
    p_agency_id,
    array['team_member']::public.agency_role[]
  );
$$;

create or replace function public.has_client_access(p_client_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.client_memberships client_membership
    join public.agency_memberships agency_membership
      on agency_membership.agency_id = client_membership.agency_id
     and agency_membership.user_id = client_membership.user_id
     and agency_membership.status = 'active'
    where client_membership.client_account_id = p_client_account_id
      and client_membership.user_id = auth.uid()
      and client_membership.status = 'active'
  );
$$;

create or replace function public.is_client_owner(p_client_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.client_memberships client_membership
    join public.agency_memberships agency_membership
      on agency_membership.agency_id = client_membership.agency_id
     and agency_membership.user_id = client_membership.user_id
     and agency_membership.status = 'active'
    where client_membership.client_account_id = p_client_account_id
      and client_membership.user_id = auth.uid()
      and client_membership.role = 'owner'
      and client_membership.status = 'active'
  );
$$;

create or replace function public.is_property_team_member(p_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.property_team_assignments assignment
    join public.agency_memberships membership
      on membership.agency_id = assignment.agency_id
     and membership.user_id = assignment.user_id
     and membership.role = 'team_member'
     and membership.status = 'active'
    where assignment.property_id = p_property_id
      and assignment.user_id = auth.uid()
  );
$$;

create or replace function public.has_property_access(p_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.properties property
    where property.id = p_property_id
      and property.archived_at is null
      and (
        public.is_agency_admin(property.agency_id)
        or public.is_property_team_member(property.id)
        or public.has_client_access(property.client_account_id)
      )
  );
$$;

create or replace function public.has_client_context(p_client_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.client_accounts client
    where client.id = p_client_account_id
      and (
        public.is_agency_admin(client.agency_id)
        or public.has_client_access(client.id)
        or exists (
          select 1
          from public.properties property
          join public.property_team_assignments assignment
            on assignment.property_id = property.id
           and assignment.agency_id = property.agency_id
          where property.client_account_id = client.id
            and assignment.user_id = auth.uid()
            and public.is_agency_team_member(client.agency_id)
        )
      )
  );
$$;

create or replace function public.can_view_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_profile_id = auth.uid()
    or exists (
      select 1
      from public.agency_memberships viewer
      join public.agency_memberships target
        on target.agency_id = viewer.agency_id
       and target.user_id = p_profile_id
       and target.status = 'active'
      where viewer.user_id = auth.uid()
        and viewer.status = 'active'
        and (
          viewer.role = 'admin'
          or (
            viewer.role = 'team_member'
            and (
              target.role in ('admin', 'team_member')
              or exists (
                select 1
                from public.property_team_assignments assignment
                join public.properties property
                  on property.id = assignment.property_id
                 and property.agency_id = assignment.agency_id
                join public.client_memberships target_client
                  on target_client.client_account_id = property.client_account_id
                 and target_client.user_id = target.user_id
                 and target_client.status = 'active'
                where assignment.user_id = viewer.user_id
              )
            )
          )
          or (
            viewer.role = 'client'
            and (
              exists (
                select 1
                from public.client_memberships viewer_client
                join public.client_memberships target_client
                  on target_client.client_account_id = viewer_client.client_account_id
                 and target_client.user_id = target.user_id
                 and target_client.status = 'active'
                where viewer_client.user_id = viewer.user_id
                  and viewer_client.status = 'active'
              )
              or target.role = 'admin'
              or (
                target.role = 'team_member'
                and exists (
                  select 1
                  from public.client_memberships viewer_client
                  join public.properties property
                    on property.client_account_id = viewer_client.client_account_id
                  join public.property_team_assignments assignment
                    on assignment.property_id = property.id
                   and assignment.user_id = target.user_id
                  where viewer_client.user_id = viewer.user_id
                    and viewer_client.status = 'active'
                )
              )
            )
          )
        )
    );
$$;

create or replace function public.can_manage_media_asset(p_media_asset_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.media_assets asset
    where asset.id = p_media_asset_id
      and (
        public.is_agency_admin(asset.agency_id)
        or public.is_property_team_member(asset.property_id)
      )
  );
$$;

create or replace function public.can_access_media_asset(p_media_asset_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.media_assets asset
    join public.properties property
      on property.id = asset.property_id
     and property.agency_id = asset.agency_id
    where asset.id = p_media_asset_id
      and (
        public.is_agency_admin(asset.agency_id)
        or public.is_property_team_member(asset.property_id)
        or (
          asset.client_visible
          and public.has_client_access(property.client_account_id)
        )
      )
  );
$$;

create or replace function public.can_view_calendar_event(p_calendar_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.calendar_events event
    where event.id = p_calendar_event_id
      and event.archived_at is null
      and (
        public.is_agency_admin(event.agency_id)
        or (
          public.is_agency_team_member(event.agency_id)
          and event.visibility <> 'admin_only'
          and (
            event.visibility = 'team'
            or event.created_by = auth.uid()
            or exists (
              select 1
              from public.calendar_event_assignees assignee
              where assignee.calendar_event_id = event.id
                and assignee.user_id = auth.uid()
            )
            or (
              event.property_id is not null
              and public.is_property_team_member(event.property_id)
            )
          )
        )
        or (
          event.visibility = 'client'
          and event.client_account_id is not null
          and public.has_client_access(event.client_account_id)
        )
      )
  );
$$;

create or replace function public.can_edit_calendar_event(p_calendar_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.calendar_events event
    where event.id = p_calendar_event_id
      and (
        public.is_agency_admin(event.agency_id)
        or (
          public.is_agency_team_member(event.agency_id)
          and event.created_by = auth.uid()
        )
      )
  );
$$;

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
      and task.archived_at is null
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
          task.visibility = 'client'
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
          and (
            task.assignee_user_id = auth.uid()
            or task.created_by = auth.uid()
            or (
              task.property_id is not null
              and public.is_property_team_member(task.property_id)
            )
          )
        )
      )
  );
$$;

create or replace function public.can_view_note(p_note_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.notes note
    where note.id = p_note_id
      and note.archived_at is null
      and (
        public.is_agency_admin(note.agency_id)
        or (
          public.is_agency_team_member(note.agency_id)
          and note.visibility <> 'admin_only'
          and (
            note.created_by = auth.uid()
            or (
              note.property_id is not null
              and public.is_property_team_member(note.property_id)
            )
            or (
              note.calendar_event_id is not null
              and public.can_view_calendar_event(note.calendar_event_id)
            )
            or (
              note.task_id is not null
              and public.can_view_task(note.task_id)
            )
          )
        )
        or (
          note.visibility = 'client'
          and note.client_account_id is not null
          and public.has_client_access(note.client_account_id)
        )
      )
  );
$$;

create or replace function public.can_edit_note(p_note_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.notes note
    where note.id = p_note_id
      and (
        public.is_agency_admin(note.agency_id)
        or (
          public.is_agency_team_member(note.agency_id)
          and note.created_by = auth.uid()
        )
      )
  );
$$;

create or replace function public.bootstrap_first_admin(
  p_owner_user_id uuid,
  p_agency_name text default 'Realty Media',
  p_agency_slug text default 'realty-media'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user auth.users%rowtype;
  v_agency_id uuid;
begin
  if nullif(trim(p_agency_name), '') is null then
    raise exception 'Agency name is required';
  end if;

  if lower(trim(p_agency_slug)) !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Agency slug is invalid';
  end if;

  -- Serializes every attempted first-owner claim.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('realty-media:first-admin-bootstrap', 0)
  );

  if exists (select 1 from public.agencies) then
    raise exception 'The initial agency has already been bootstrapped';
  end if;

  select *
  into v_user
  from auth.users
  where id = p_owner_user_id
    and email_confirmed_at is not null;

  if not found then
    raise exception 'A verified email account is required';
  end if;

  insert into public.profiles (id, email, full_name, avatar_path)
  values (
    v_user.id,
    coalesce(v_user.email, v_user.id::text || '@auth.local'),
    nullif(trim(coalesce(v_user.raw_user_meta_data ->> 'full_name', '')), ''),
    nullif(trim(coalesce(v_user.raw_user_meta_data ->> 'avatar_url', '')), '')
  )
  on conflict (id) do update
  set email = excluded.email,
      updated_at = now();

  insert into public.agencies (name, slug, created_by)
  values (trim(p_agency_name), lower(trim(p_agency_slug)), v_user.id)
  returning id into v_agency_id;

  insert into public.agency_memberships (
    agency_id,
    user_id,
    role,
    status,
    created_by
  )
  values (
    v_agency_id,
    v_user.id,
    'admin',
    'active',
    v_user.id
  );

  return v_agency_id;
end;
$$;

create or replace function public.admin_attach_client_user(
  p_agency_id uuid,
  p_auth_user_id uuid,
  p_client_account_id uuid,
  p_client_role public.client_membership_role default 'member',
  p_full_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user auth.users%rowtype;
  v_membership_id uuid;
begin
  if not public.is_agency_admin(p_agency_id) then
    raise exception 'Only agency admins can attach client users';
  end if;

  if not exists (
    select 1
    from public.client_accounts client
    where client.id = p_client_account_id
      and client.agency_id = p_agency_id
      and client.archived_at is null
  ) then
    raise exception 'Client account not found in this agency';
  end if;

  select *
  into v_user
  from auth.users
  where id = p_auth_user_id;

  if not found then
    raise exception 'Auth user not found';
  end if;

  insert into public.profiles (id, email, full_name)
  values (
    v_user.id,
    coalesce(v_user.email, v_user.id::text || '@auth.local'),
    coalesce(
      nullif(trim(p_full_name), ''),
      nullif(trim(coalesce(v_user.raw_user_meta_data ->> 'full_name', '')), '')
    )
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(excluded.full_name, public.profiles.full_name),
      updated_at = now();

  insert into public.agency_memberships (
    agency_id,
    user_id,
    role,
    status,
    created_by
  )
  values (
    p_agency_id,
    p_auth_user_id,
    'client',
    'active',
    auth.uid()
  )
  on conflict (agency_id, user_id) do update
  set role = case
        when public.agency_memberships.role = 'admin' then 'admin'::public.agency_role
        when public.agency_memberships.role = 'team_member' then 'team_member'::public.agency_role
        else 'client'::public.agency_role
      end,
      status = 'active',
      updated_at = now();

  insert into public.client_memberships (
    agency_id,
    client_account_id,
    user_id,
    role,
    status,
    invited_by
  )
  values (
    p_agency_id,
    p_client_account_id,
    p_auth_user_id,
    p_client_role,
    'active',
    auth.uid()
  )
  on conflict (client_account_id, user_id) do update
  set role = excluded.role,
      status = 'active',
      invited_by = auth.uid(),
      updated_at = now()
  returning id into v_membership_id;

  return v_membership_id;
end;
$$;

create or replace function public.admin_attach_team_user(
  p_agency_id uuid,
  p_auth_user_id uuid,
  p_full_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user auth.users%rowtype;
  v_membership_id uuid;
begin
  if not public.is_agency_admin(p_agency_id) then
    raise exception 'Only agency admins can attach team users';
  end if;

  select *
  into v_user
  from auth.users
  where id = p_auth_user_id;

  if not found then
    raise exception 'Auth user not found';
  end if;

  insert into public.profiles (id, email, full_name)
  values (
    v_user.id,
    coalesce(v_user.email, v_user.id::text || '@auth.local'),
    coalesce(
      nullif(trim(p_full_name), ''),
      nullif(trim(coalesce(v_user.raw_user_meta_data ->> 'full_name', '')), '')
    )
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(excluded.full_name, public.profiles.full_name),
      updated_at = now();

  insert into public.agency_memberships (
    agency_id,
    user_id,
    role,
    status,
    created_by
  )
  values (
    p_agency_id,
    p_auth_user_id,
    'team_member',
    'active',
    auth.uid()
  )
  on conflict (agency_id, user_id) do update
  set role = case
        when public.agency_memberships.role = 'admin' then 'admin'::public.agency_role
        else 'team_member'::public.agency_role
      end,
      status = 'active',
      updated_at = now()
  returning id into v_membership_id;

  return v_membership_id;
end;
$$;

create or replace function public.create_invitation(
  p_agency_id uuid,
  p_email text,
  p_agency_role public.agency_role,
  p_client_account_id uuid default null,
  p_client_role public.client_membership_role default null,
  p_expires_at timestamptz default (now() + interval '7 days')
)
returns table (
  invitation_id uuid,
  token text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
  v_invitation_id uuid;
  v_email extensions.citext;
begin
  v_email := nullif(trim(p_email), '')::extensions.citext;

  if v_email is null then
    raise exception 'Email is required';
  end if;

  if p_expires_at <= now() + interval '1 hour'
    or p_expires_at > now() + interval '30 days' then
    raise exception 'Invitation expiry must be between 1 hour and 30 days';
  end if;

  if public.is_agency_admin(p_agency_id) then
    null;
  elsif p_agency_role = 'client'
    and p_client_account_id is not null
    and public.is_client_owner(p_client_account_id)
    and exists (
      select 1
      from public.client_accounts client
      where client.id = p_client_account_id
        and client.agency_id = p_agency_id
        and client.archived_at is null
    ) then
    null;
  else
    raise exception 'Not allowed to create this invitation';
  end if;

  if (p_agency_role = 'client') <> (p_client_account_id is not null and p_client_role is not null) then
    raise exception 'Client invitations require a client account and client role';
  end if;

  update public.invitations invitation
  set status = 'revoked',
      updated_at = now()
  where invitation.agency_id = p_agency_id
    and invitation.email = v_email
    and invitation.status = 'pending'
    and invitation.client_account_id is not distinct from p_client_account_id;

  v_token := translate(
    trim(trailing '=' from encode(extensions.gen_random_bytes(32), 'base64')),
    '+/',
    '-_'
  );

  insert into public.invitations (
    agency_id,
    client_account_id,
    email,
    agency_role,
    client_role,
    token_hash,
    expires_at,
    invited_by
  )
  values (
    p_agency_id,
    p_client_account_id,
    v_email,
    p_agency_role,
    p_client_role,
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    p_expires_at,
    auth.uid()
  )
  returning id into v_invitation_id;

  return query
  select v_invitation_id, v_token, p_expires_at;
end;
$$;

create or replace function public.accept_invitation(p_token text)
returns table (
  agency_id uuid,
  client_account_id uuid,
  agency_role public.agency_role
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text;
  v_invitation public.invitations%rowtype;
  v_email extensions.citext;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_hash, 0)
  );

  select *
  into v_invitation
  from public.invitations invitation
  where invitation.token_hash = v_hash
    and invitation.status = 'pending'
  for update;

  if not found then
    raise exception 'Invitation is invalid or has already been used';
  end if;

  if v_invitation.expires_at <= now() then
    update public.invitations
    set status = 'expired',
        updated_at = now()
    where id = v_invitation.id;
    raise exception 'Invitation has expired';
  end if;

  select user_record.email::extensions.citext
  into v_email
  from auth.users user_record
  where user_record.id = auth.uid()
    and user_record.email_confirmed_at is not null;

  if not found or lower(v_email::text) <> lower(v_invitation.email::text) then
    raise exception 'Use the verified email address that received this invitation';
  end if;

  insert into public.profiles (id, email)
  values (auth.uid(), v_email)
  on conflict (id) do update
  set email = excluded.email,
      updated_at = now();

  insert into public.agency_memberships (
    agency_id,
    user_id,
    role,
    status,
    created_by
  )
  values (
    v_invitation.agency_id,
    auth.uid(),
    v_invitation.agency_role,
    'active',
    v_invitation.invited_by
  )
  on conflict (agency_id, user_id) do update
  set role = case
        when public.agency_memberships.role = 'admin'
          or excluded.role = 'admin'
          then 'admin'::public.agency_role
        when public.agency_memberships.role = 'team_member'
          or excluded.role = 'team_member'
          then 'team_member'::public.agency_role
        else 'client'::public.agency_role
      end,
      status = 'active',
      updated_at = now();

  if v_invitation.agency_role = 'client' then
    insert into public.client_memberships (
      agency_id,
      client_account_id,
      user_id,
      role,
      status,
      invited_by
    )
    values (
      v_invitation.agency_id,
      v_invitation.client_account_id,
      auth.uid(),
      v_invitation.client_role,
      'active',
      v_invitation.invited_by
    )
    on conflict (client_account_id, user_id) do update
    set role = excluded.role,
        status = 'active',
        updated_at = now();
  end if;

  update public.invitations
  set status = 'accepted',
      accepted_by = auth.uid(),
      accepted_at = now(),
      updated_at = now()
  where id = v_invitation.id;

  return query
  select
    v_invitation.agency_id,
    v_invitation.client_account_id,
    v_invitation.agency_role;
end;
$$;

create or replace function public.validate_property_team_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.agency_memberships membership
    where membership.agency_id = new.agency_id
      and membership.user_id = new.user_id
      and membership.role = 'team_member'
      and membership.status = 'active'
  ) then
    raise exception 'Only active team members can be assigned to properties';
  end if;

  return new;
end;
$$;

create trigger validate_property_team_assignment_before_write
  before insert or update on public.property_team_assignments
  for each row execute function public.validate_property_team_assignment();

create or replace function public.validate_deliverable_property_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.property_id is not null
    and not exists (
      select 1
      from public.service_contracts contract
      join public.properties property
        on property.id = new.property_id
       and property.agency_id = new.agency_id
       and property.client_account_id = contract.client_account_id
      where contract.id = new.contract_id
        and contract.agency_id = new.agency_id
    ) then
    raise exception 'Deliverable property must belong to the contract client';
  end if;

  return new;
end;
$$;

create trigger validate_deliverable_property_scope_before_write
  before insert or update on public.contract_deliverables
  for each row execute function public.validate_deliverable_property_scope();

create or replace function public.prevent_last_active_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'admin'
    and old.status = 'active'
    and (
      tg_op = 'DELETE'
      or new.role <> 'admin'
      or new.status <> 'active'
    )
    and not exists (
      select 1
      from public.agency_memberships other
      where other.agency_id = old.agency_id
        and other.id <> old.id
        and other.role = 'admin'
        and other.status = 'active'
    ) then
    raise exception 'An agency must retain at least one active admin';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger prevent_last_active_admin_before_write
  before update or delete on public.agency_memberships
  for each row execute function public.prevent_last_active_admin();

create or replace function public.protect_profile_email()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.email is distinct from old.email
    and coalesce(auth.role(), '') <> 'service_role' then
    new.email := old.email;
  end if;
  return new;
end;
$$;

create trigger protect_profile_email_before_update
  before update on public.profiles
  for each row execute function public.protect_profile_email();

create or replace function public.protect_review_comment_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.author_id := auth.uid();
      new.status := 'open';
      new.resolved_by := null;
      new.resolved_at := null;
    end if;
    return new;
  end if;

  if new.agency_id <> old.agency_id
    or new.media_asset_id <> old.media_asset_id
    or new.media_version_id <> old.media_version_id
    or new.parent_comment_id is distinct from old.parent_comment_id
    or new.author_id <> old.author_id
    or new.created_at <> old.created_at then
    raise exception 'Comment identity and review target are immutable';
  end if;

  if new.status is distinct from old.status and auth.uid() is not null then
    if new.status = 'resolved' then
      new.resolved_by := auth.uid();
      new.resolved_at := now();
    else
      new.resolved_by := null;
      new.resolved_at := null;
    end if;
  end if;

  return new;
end;
$$;

create trigger protect_review_comment_identity_before_write
  before insert or update on public.review_comments
  for each row execute function public.protect_review_comment_identity();

create or replace function public.apply_review_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.actor_id := auth.uid();
  end if;

  update public.media_assets
  set status = case new.decision
        when 'ready_for_review' then 'ready_for_review'::public.media_status
        when 'changes_requested' then 'changes_requested'::public.media_status
        when 'approved' then 'approved'::public.media_status
        when 'approval_revoked' then 'ready_for_review'::public.media_status
      end,
      client_visible = case
        when new.decision = 'ready_for_review' then true
        else client_visible
      end,
      updated_at = now()
  where id = new.media_asset_id
    and agency_id = new.agency_id;

  return new;
end;
$$;

create trigger apply_review_decision_before_insert
  before insert on public.review_approval_events
  for each row execute function public.apply_review_decision();

create or replace function public.apply_gear_custody_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.transferred_by := auth.uid();
  end if;

  if new.action in ('checked_out', 'transferred') and new.to_user_id is null then
    raise exception 'A receiving team member is required for this custody action';
  end if;

  if new.action = 'placed_on_site' and new.to_property_id is null then
    raise exception 'A destination property is required for an on-site transfer';
  end if;

  update public.gear_items
  set status = case new.action
        when 'checked_out' then 'assigned'::public.gear_status
        when 'transferred' then 'assigned'::public.gear_status
        when 'placed_on_site' then 'on_site'::public.gear_status
        when 'returned' then 'available'::public.gear_status
        when 'sent_to_maintenance' then 'maintenance'::public.gear_status
        when 'marked_missing' then 'missing'::public.gear_status
        when 'retired' then 'retired'::public.gear_status
      end,
      current_custodian_user_id = case
        when new.action in ('checked_out', 'transferred') then new.to_user_id
        else null
      end,
      current_property_id = case
        when new.action = 'placed_on_site' then new.to_property_id
        else null
      end,
      current_location = coalesce(
        new.to_location,
        case
          when new.action = 'returned' then home_location
          else current_location
        end
      ),
      condition_label = coalesce(new.condition_label, condition_label),
      updated_at = now()
  where id = new.gear_item_id
    and agency_id = new.agency_id;

  return new;
end;
$$;

create trigger apply_gear_custody_event_before_insert
  before insert on public.gear_custody_history
  for each row execute function public.apply_gear_custody_event();

create or replace function public.acknowledge_gear_transfer(p_history_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.gear_custody_history history
  set acknowledged_by = auth.uid(),
      acknowledged_at = now()
  where history.id = p_history_id
    and history.to_user_id = auth.uid()
    and history.acknowledged_at is null;

  if not found then
    raise exception 'Transfer not found or cannot be acknowledged';
  end if;
end;
$$;

create or replace function public.recalculate_debt_balance(
  p_debt_id uuid,
  p_agency_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_original numeric(16, 2);
  v_paid numeric(16, 2);
  v_current_status public.debt_status;
begin
  select debt.original_amount, debt.status
  into v_original, v_current_status
  from public.finance_debts debt
  where debt.id = p_debt_id
    and debt.agency_id = p_agency_id
  for update;

  if not found then
    return;
  end if;

  select coalesce(sum(payment.amount), 0)
  into v_paid
  from public.finance_debt_payments payment
  where payment.debt_id = p_debt_id
    and payment.agency_id = p_agency_id;

  if v_paid > v_original then
    raise exception 'Debt payments cannot exceed the original amount';
  end if;

  update public.finance_debts
  set outstanding_amount = v_original - v_paid,
      status = case
        when v_current_status in ('waived', 'cancelled') then v_current_status
        when v_paid = 0 then 'open'::public.debt_status
        when v_paid = v_original then 'paid'::public.debt_status
        else 'partial'::public.debt_status
      end,
      updated_at = now()
  where id = p_debt_id
    and agency_id = p_agency_id;
end;
$$;

create or replace function public.recalculate_debt_after_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.recalculate_debt_balance(old.debt_id, old.agency_id);
  end if;

  if tg_op in ('INSERT', 'UPDATE')
    and (
      tg_op = 'INSERT'
      or new.debt_id is distinct from old.debt_id
      or new.agency_id is distinct from old.agency_id
      or new.amount is distinct from old.amount
    ) then
    perform public.recalculate_debt_balance(new.debt_id, new.agency_id);
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger recalculate_debt_after_payment_write
  after insert or update or delete on public.finance_debt_payments
  for each row execute function public.recalculate_debt_after_payment();

create or replace function public.initialize_debt_balance()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.outstanding_amount is null then
    new.outstanding_amount := new.original_amount;
  end if;

  if new.status not in ('waived', 'cancelled') then
    new.status := case
      when new.outstanding_amount = 0 then 'paid'::public.debt_status
      when new.outstanding_amount < new.original_amount then 'partial'::public.debt_status
      else 'open'::public.debt_status
    end;
  end if;

  return new;
end;
$$;

create trigger initialize_debt_balance_before_write
  before insert or update of original_amount, outstanding_amount, status
  on public.finance_debts
  for each row execute function public.initialize_debt_balance();

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_record jsonb;
  v_agency_id uuid;
  v_entity_id uuid;
  v_agency_field text := coalesce(tg_argv[0], 'agency_id');
begin
  if tg_op = 'INSERT' then
    v_new := to_jsonb(new);
    v_record := v_new;
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    v_record := v_new;
  else
    v_old := to_jsonb(old);
    v_record := v_old;
  end if;

  v_agency_id := nullif(v_record ->> v_agency_field, '')::uuid;
  v_entity_id := nullif(v_record ->> 'id', '')::uuid;

  insert into public.audit_events (
    agency_id,
    actor_user_id,
    action,
    entity_schema,
    entity_table,
    entity_id,
    old_record,
    new_record
  )
  values (
    v_agency_id,
    auth.uid(),
    tg_op,
    tg_table_schema,
    tg_table_name,
    v_entity_id,
    v_old,
    v_new
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- Keep updated_at consistent at the database boundary.
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
       for each row execute function public.set_updated_at()',
      'set_' || v_table || '_updated_at',
      v_table
    );
  end loop;
end;
$$;

-- Audit mutable business data. Profiles are intentionally omitted because they
-- contain cross-agency identity data; agency membership changes remain audited.
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
    'recurring_cost_occurrences'
  ]
  loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I
       for each row execute function public.audit_row_change(''agency_id'')',
      'audit_' || v_table || '_changes',
      v_table
    );
  end loop;
end;
$$;

create trigger audit_agencies_changes
  after insert or update on public.agencies
  for each row execute function public.audit_row_change('id');

-- RPCs are never callable by anon. Internal helpers are available only to
-- authenticated policy evaluation and backend/service roles.
revoke all on function public.bootstrap_first_admin(uuid, text, text) from public;
revoke all on function public.admin_attach_client_user(
  uuid,
  uuid,
  uuid,
  public.client_membership_role,
  text
) from public;
revoke all on function public.admin_attach_team_user(uuid, uuid, text) from public;
revoke all on function public.create_invitation(
  uuid,
  text,
  public.agency_role,
  uuid,
  public.client_membership_role,
  timestamptz
) from public;
revoke all on function public.accept_invitation(text) from public;
revoke all on function public.acknowledge_gear_transfer(uuid) from public;

grant execute on function public.admin_attach_client_user(
  uuid,
  uuid,
  uuid,
  public.client_membership_role,
  text
) to authenticated;
grant execute on function public.admin_attach_team_user(uuid, uuid, text) to authenticated;
grant execute on function public.create_invitation(
  uuid,
  text,
  public.agency_role,
  uuid,
  public.client_membership_role,
  timestamptz
) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
grant execute on function public.acknowledge_gear_transfer(uuid) to authenticated;
