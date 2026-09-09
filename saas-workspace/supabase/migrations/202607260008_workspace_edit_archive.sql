begin;

alter table public.payment_schedule_items
  add column if not exists archived_at timestamptz;

create index if not exists payment_schedule_items_active_due_idx
  on public.payment_schedule_items (agency_id, due_on)
  where archived_at is null;

create or replace function public.archive_client_workspace(
  p_client_account_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agency_id uuid;
  v_archived_at timestamptz := now();
begin
  select client.agency_id
  into v_agency_id
  from public.client_accounts client
  where client.id = p_client_account_id
    and client.archived_at is null;

  if v_agency_id is null then
    raise exception 'Client account was not found or is already archived';
  end if;

  if not public.is_agency_admin(v_agency_id) then
    raise exception 'Only agency admins can archive a client workspace';
  end if;

  update public.payment_schedule_items payment
  set archived_at = v_archived_at
  where payment.client_account_id = p_client_account_id
    and payment.archived_at is null;

  update public.service_contracts contract
  set archived_at = v_archived_at
  where contract.client_account_id = p_client_account_id
    and contract.archived_at is null;

  update public.media_assets asset
  set archived_at = v_archived_at
  where asset.property_id in (
    select property.id
    from public.properties property
    where property.client_account_id = p_client_account_id
  )
    and asset.archived_at is null;

  update public.calendar_events event
  set archived_at = v_archived_at
  where event.client_account_id = p_client_account_id
    and event.archived_at is null;

  update public.tasks task
  set archived_at = v_archived_at
  where task.client_account_id = p_client_account_id
    and task.archived_at is null;

  delete from public.property_team_assignments assignment
  using public.properties property
  where assignment.property_id = property.id
    and property.client_account_id = p_client_account_id;

  update public.properties property
  set archived_at = v_archived_at,
      status = 'archived'
  where property.client_account_id = p_client_account_id
    and property.archived_at is null;

  update public.client_accounts client
  set archived_at = v_archived_at
  where client.id = p_client_account_id;
end;
$$;

create or replace function public.archive_property_workspace(
  p_property_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agency_id uuid;
  v_archived_at timestamptz := now();
begin
  select property.agency_id
  into v_agency_id
  from public.properties property
  where property.id = p_property_id
    and property.archived_at is null;

  if v_agency_id is null then
    raise exception 'Property was not found or is already archived';
  end if;

  if not public.is_agency_admin(v_agency_id) then
    raise exception 'Only agency admins can archive a property workspace';
  end if;

  update public.payment_schedule_items payment
  set archived_at = v_archived_at
  where payment.contract_id in (
    select contract.id
    from public.service_contracts contract
    where contract.property_id = p_property_id
  )
    and payment.archived_at is null;

  update public.service_contracts contract
  set archived_at = v_archived_at
  where contract.property_id = p_property_id
    and contract.archived_at is null;

  update public.media_assets asset
  set archived_at = v_archived_at
  where asset.property_id = p_property_id
    and asset.archived_at is null;

  update public.calendar_events event
  set archived_at = v_archived_at
  where event.property_id = p_property_id
    and event.archived_at is null;

  update public.tasks task
  set archived_at = v_archived_at
  where task.property_id = p_property_id
    and task.archived_at is null;

  delete from public.property_team_assignments assignment
  where assignment.property_id = p_property_id;

  update public.properties property
  set archived_at = v_archived_at,
      status = 'archived'
  where property.id = p_property_id;
end;
$$;

revoke all on function public.archive_client_workspace(uuid) from public;
revoke all on function public.archive_property_workspace(uuid) from public;

grant execute on function public.archive_client_workspace(uuid) to authenticated;
grant execute on function public.archive_property_workspace(uuid) to authenticated;

commit;
