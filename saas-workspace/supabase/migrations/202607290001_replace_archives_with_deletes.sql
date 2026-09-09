-- Realty Media uses permanent deletion rather than an archive/recovery layer.
-- The functions keep all ownership checks server-side and remove dependent ledger rows first.

begin;

create or replace function public.delete_service_agreement(p_agreement_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_agency_id uuid;
begin
  select agency_id into v_agency_id from public.service_contracts where id = p_agreement_id;
  if v_agency_id is null or not public.is_agency_admin(v_agency_id) then
    raise exception 'Only agency admins can delete an agreement';
  end if;
  delete from public.payment_records where schedule_item_id in (
    select id from public.payment_schedule_items where contract_id = p_agreement_id
  );
  delete from public.payment_schedule_items where contract_id = p_agreement_id;
  delete from public.service_contracts where id = p_agreement_id;
end;
$$;

create or replace function public.delete_property_workspace(p_property_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_agency_id uuid;
begin
  select agency_id into v_agency_id from public.properties where id = p_property_id;
  if v_agency_id is null or not public.is_agency_admin(v_agency_id) then
    raise exception 'Only agency admins can delete a property';
  end if;
  delete from public.payment_records where schedule_item_id in (
    select payment.id from public.payment_schedule_items payment
    join public.service_contracts contract on contract.id = payment.contract_id
    where contract.property_id = p_property_id
  );
  delete from public.payment_schedule_items where contract_id in (
    select id from public.service_contracts where property_id = p_property_id
  );
  delete from public.service_contracts where property_id = p_property_id;
  delete from public.properties where id = p_property_id;
end;
$$;

create or replace function public.delete_client_workspace(p_client_account_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_agency_id uuid;
begin
  select agency_id into v_agency_id from public.client_accounts where id = p_client_account_id;
  if v_agency_id is null or not public.is_agency_admin(v_agency_id) then
    raise exception 'Only agency admins can delete a client';
  end if;
  delete from public.payment_records where client_account_id = p_client_account_id;
  delete from public.payment_schedule_items where client_account_id = p_client_account_id;
  delete from public.service_contracts where client_account_id = p_client_account_id;
  delete from public.client_accounts where id = p_client_account_id;
end;
$$;

revoke all on function public.delete_service_agreement(uuid) from public;
revoke all on function public.delete_property_workspace(uuid) from public;
revoke all on function public.delete_client_workspace(uuid) from public;
grant execute on function public.delete_service_agreement(uuid) to authenticated;
grant execute on function public.delete_property_workspace(uuid) to authenticated;
grant execute on function public.delete_client_workspace(uuid) to authenticated;

-- Permanently remove every existing soft-deleted record and its dependent rows.
delete from public.payment_records
where client_account_id in (select id from public.client_accounts where archived_at is not null)
   or schedule_item_id in (select id from public.payment_schedule_items where archived_at is not null);
delete from public.payment_schedule_items
where archived_at is not null
   or client_account_id in (select id from public.client_accounts where archived_at is not null)
   or contract_id in (select id from public.service_contracts where archived_at is not null);
delete from public.service_contracts
where archived_at is not null
   or client_account_id in (select id from public.client_accounts where archived_at is not null)
   or property_id in (select id from public.properties where archived_at is not null);
delete from public.calendar_events
where archived_at is not null
   or client_account_id in (select id from public.client_accounts where archived_at is not null)
   or property_id in (select id from public.properties where archived_at is not null);
delete from public.tasks
where archived_at is not null
   or client_account_id in (select id from public.client_accounts where archived_at is not null)
   or property_id in (select id from public.properties where archived_at is not null);
delete from public.media_assets
where archived_at is not null
   or property_id in (select id from public.properties where archived_at is not null);
delete from public.properties where archived_at is not null;
delete from public.client_accounts where archived_at is not null;
delete from public.company_documents where archived_at is not null;
delete from public.company_credentials where archived_at is not null;
delete from public.agency_leads where archived_at is not null;
delete from public.marketing_content where archived_at is not null or status = 'archived';
delete from public.recurring_cost_occurrences where recurring_cost_id in (
  select id from public.recurring_costs where archived_at is not null
);
delete from public.recurring_costs where archived_at is not null;

commit;
