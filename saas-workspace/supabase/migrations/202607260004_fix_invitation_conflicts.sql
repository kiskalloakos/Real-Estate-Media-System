-- Qualify invitation acceptance conflict targets by constraint name.
-- PL/pgSQL otherwise treats the function's TABLE output parameters
-- (`agency_id`, `client_account_id`) as competing identifiers.

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
  on conflict on constraint agency_memberships_agency_id_user_id_key do update
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
    on conflict on constraint client_memberships_client_account_id_user_id_key
    do update
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
