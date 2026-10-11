-- Public registration creates a fresh agency only after email verification.
-- Clients and team members are provisioned by the agency's authenticated admin.
create table public.agency_owner_signups (
  user_id uuid primary key references auth.users(id) on delete cascade,
  agency_id uuid not null unique default gen_random_uuid(),
  agency_name text not null check (length(agency_name) between 2 and 120),
  full_name text not null check (length(full_name) between 2 and 120),
  created_at timestamptz not null default now(),
  provisioned_at timestamptz
);
alter table public.agency_owner_signups enable row level security;
revoke all on public.agency_owner_signups from public, anon, authenticated;

create function public.validate_agency_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- These fields are written by Auth, never by public signup request data.
  -- Email confirmation MUST stay enabled: public signUp inserts an unverified
  -- user; the existing admin-provision-user service creates verified accounts.
  if new.raw_app_meta_data -> 'agency_provisioned' = 'true'::jsonb
     or new.invited_at is not null
     or (new.email_confirmed_at is not null
         and new.raw_user_meta_data ->> 'signup_role' is distinct from 'agency_owner') then
    return new;
  end if;

  if new.raw_user_meta_data ->> 'signup_role' is distinct from 'agency_owner'
     or nullif(trim(new.email), '') is null
     or coalesce(length(trim(new.raw_user_meta_data ->> 'agency_name')), 0) not between 2 and 120
     or coalesce(length(trim(new.raw_user_meta_data ->> 'full_name')), 0) not between 2 and 120 then
    raise exception 'Only agency owners can register. Clients and team members need an invitation from their agency.';
  end if;
  return new;
end;
$$;

create function public.provision_verified_agency_owner(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  signup public.agency_owner_signups%rowtype;
  owner_email text;
begin
  select * into signup from public.agency_owner_signups
  where user_id = p_user_id for update;
  if not found or signup.provisioned_at is not null then
    return;
  end if;

  select email into owner_email from auth.users
  where id = p_user_id and email_confirmed_at is not null;
  if not found then
    return;
  end if;

  insert into public.profiles (id, email, full_name)
  values (p_user_id, owner_email, signup.full_name)
  on conflict (id) do update set full_name = excluded.full_name;

  -- Neither the agency ID nor membership role comes from user-editable metadata.
  insert into public.agencies (id, slug, name, created_by)
  values (signup.agency_id, 'agency-' || replace(signup.agency_id::text, '-', ''), signup.agency_name, p_user_id);
  insert into public.agency_memberships (agency_id, user_id, role, status, created_by)
  values (signup.agency_id, p_user_id, 'admin', 'active', p_user_id);

  update public.agency_owner_signups set provisioned_at = now()
  where user_id = p_user_id;
end;
$$;

create function public.capture_agency_owner_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.raw_app_meta_data -> 'agency_provisioned' = 'true'::jsonb
     or new.invited_at is not null
     or new.raw_user_meta_data ->> 'signup_role' is distinct from 'agency_owner' then
    return new;
  end if;

  -- Capture validated signup intent once; subsequent metadata edits cannot
  -- change the agency being created when a confirmation link is used.
  insert into public.agency_owner_signups (user_id, agency_name, full_name)
  values (new.id, trim(new.raw_user_meta_data ->> 'agency_name'), trim(new.raw_user_meta_data ->> 'full_name'));
  perform public.provision_verified_agency_owner(new.id);
  return new;
end;
$$;

create function public.confirm_agency_owner_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null then
    perform public.provision_verified_agency_owner(new.id);
  end if;
  return new;
end;
$$;

revoke all on function public.validate_agency_signup() from public, anon, authenticated;
revoke all on function public.provision_verified_agency_owner(uuid) from public, anon, authenticated;
revoke all on function public.capture_agency_owner_signup() from public, anon, authenticated;
revoke all on function public.confirm_agency_owner_signup() from public, anon, authenticated;

create trigger before_auth_user_agency_signup
  before insert on auth.users for each row execute function public.validate_agency_signup();
create trigger on_auth_user_created_owner_workspace
  after insert on auth.users for each row execute function public.capture_agency_owner_signup();
create trigger on_auth_user_owner_email_confirmed
  after update of email_confirmed_at on auth.users for each row execute function public.confirm_agency_owner_signup();

-- This helper is called internally by payment triggers. It accepts agency IDs
-- and bypasses RLS, so it must not be callable directly by public API users.
revoke all on function public.recalculate_debt_balance(uuid, uuid) from public, anon, authenticated;
