begin;

create or replace function public.attach_client_user(
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
  v_actor_is_admin boolean;
  v_actor_is_owner boolean;
  v_user auth.users%rowtype;
  v_membership_id uuid;
begin
  v_actor_is_admin := public.is_agency_admin(p_agency_id);
  v_actor_is_owner := public.is_client_owner(p_client_account_id);

  if not v_actor_is_admin and not v_actor_is_owner then
    raise exception 'Only agency admins or client owners can add client members';
  end if;

  if not v_actor_is_admin and p_client_role <> 'member' then
    raise exception 'Client owners can only add member access';
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

create or replace function public.set_agency_member_access(
  p_membership_id uuid,
  p_status public.membership_status,
  p_title text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membership public.agency_memberships%rowtype;
begin
  select *
  into v_membership
  from public.agency_memberships
  where id = p_membership_id;

  if not found then
    raise exception 'Agency membership not found';
  end if;

  if not public.is_agency_admin(v_membership.agency_id) then
    raise exception 'Only agency admins can manage team access';
  end if;

  if v_membership.role <> 'team_member' then
    raise exception 'Owner and client access cannot be changed from Team Access';
  end if;

  if p_status not in ('active', 'suspended') then
    raise exception 'Team access must be active or suspended';
  end if;

  update public.agency_memberships
  set status = p_status,
      title = nullif(trim(coalesce(p_title, '')), ''),
      updated_at = now()
  where id = p_membership_id;
end;
$$;

create or replace function public.set_client_member_access(
  p_membership_id uuid,
  p_status public.membership_status,
  p_role public.client_membership_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membership public.client_memberships%rowtype;
  v_actor_is_admin boolean;
  v_actor_is_owner boolean;
begin
  select *
  into v_membership
  from public.client_memberships
  where id = p_membership_id;

  if not found then
    raise exception 'Client membership not found';
  end if;

  v_actor_is_admin := public.is_agency_admin(v_membership.agency_id);
  v_actor_is_owner := public.is_client_owner(v_membership.client_account_id);

  if not v_actor_is_admin and not v_actor_is_owner then
    raise exception 'Only agency admins or client owners can manage client access';
  end if;

  if p_status not in ('active', 'suspended') then
    raise exception 'Client access must be active or suspended';
  end if;

  if not v_actor_is_admin then
    if v_membership.user_id = auth.uid() then
      raise exception 'You cannot change your own client access';
    end if;

    if v_membership.role = 'owner' or p_role <> 'member' then
      raise exception 'Client owners can only manage member access';
    end if;
  end if;

  if v_membership.role = 'owner'
     and p_status = 'suspended'
     and not exists (
       select 1
       from public.client_memberships other
       where other.client_account_id = v_membership.client_account_id
         and other.id <> v_membership.id
         and other.role = 'owner'
         and other.status = 'active'
     ) then
    raise exception 'Add another active owner before suspending the last owner';
  end if;

  update public.client_memberships
  set role = p_role,
      status = p_status,
      updated_at = now()
  where id = p_membership_id;

  if p_status = 'active' then
    update public.agency_memberships
    set status = 'active',
        updated_at = now()
    where agency_id = v_membership.agency_id
      and user_id = v_membership.user_id
      and role = 'client';
  elsif not exists (
    select 1
    from public.client_memberships other
    where other.agency_id = v_membership.agency_id
      and other.user_id = v_membership.user_id
      and other.status = 'active'
  ) then
    update public.agency_memberships
    set status = 'suspended',
        updated_at = now()
    where agency_id = v_membership.agency_id
      and user_id = v_membership.user_id
      and role = 'client';
  end if;
end;
$$;

revoke all on function public.attach_client_user(
  uuid,
  uuid,
  uuid,
  public.client_membership_role,
  text
) from public;
revoke all on function public.set_agency_member_access(
  uuid,
  public.membership_status,
  text
) from public;
revoke all on function public.set_client_member_access(
  uuid,
  public.membership_status,
  public.client_membership_role
) from public;

grant execute on function public.attach_client_user(
  uuid,
  uuid,
  uuid,
  public.client_membership_role,
  text
) to authenticated;
grant execute on function public.set_agency_member_access(
  uuid,
  public.membership_status,
  text
) to authenticated;
grant execute on function public.set_client_member_access(
  uuid,
  public.membership_status,
  public.client_membership_role
) to authenticated;

commit;
