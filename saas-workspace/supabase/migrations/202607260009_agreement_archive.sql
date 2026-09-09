begin;

create or replace function public.archive_service_agreement(
  p_agreement_id uuid
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
  select contract.agency_id
  into v_agency_id
  from public.service_contracts contract
  where contract.id = p_agreement_id
    and contract.archived_at is null;

  if v_agency_id is null then
    raise exception 'Agreement was not found or is already archived';
  end if;

  if not public.is_agency_admin(v_agency_id) then
    raise exception 'Only agency admins can archive an agreement';
  end if;

  update public.payment_schedule_items payment
  set archived_at = v_archived_at
  where payment.contract_id = p_agreement_id
    and payment.archived_at is null;

  update public.service_contracts contract
  set archived_at = v_archived_at
  where contract.id = p_agreement_id;
end;
$$;

revoke all on function public.archive_service_agreement(uuid) from public;
grant execute on function public.archive_service_agreement(uuid) to authenticated;

commit;
