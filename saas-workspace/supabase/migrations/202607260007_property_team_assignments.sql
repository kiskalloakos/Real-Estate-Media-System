begin;

create or replace function public.set_property_team_assignments(
  p_agency_id uuid,
  p_user_id uuid,
  p_property_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_property_ids uuid[];
  v_assignment_count integer;
begin
  if not public.is_agency_admin(p_agency_id) then
    raise exception 'Only agency admins can manage property assignments';
  end if;

  if not exists (
    select 1
    from public.agency_memberships membership
    where membership.agency_id = p_agency_id
      and membership.user_id = p_user_id
      and membership.role = 'team_member'
      and membership.status = 'active'
  ) then
    raise exception 'Only active team members can receive property assignments';
  end if;

  select coalesce(
    array_agg(distinct requested.property_id),
    array[]::uuid[]
  )
  into v_property_ids
  from unnest(coalesce(p_property_ids, array[]::uuid[]))
    as requested(property_id);

  if exists (
    select 1
    from unnest(v_property_ids) as requested(property_id)
    left join public.properties property
      on property.id = requested.property_id
     and property.agency_id = p_agency_id
     and property.archived_at is null
    where property.id is null
  ) then
    raise exception 'One or more properties are outside this agency or archived';
  end if;

  delete from public.property_team_assignments assignment
  where assignment.agency_id = p_agency_id
    and assignment.user_id = p_user_id
    and not (assignment.property_id = any(v_property_ids));

  insert into public.property_team_assignments (
    agency_id,
    property_id,
    user_id,
    assigned_by
  )
  select
    p_agency_id,
    requested.property_id,
    p_user_id,
    auth.uid()
  from unnest(v_property_ids) as requested(property_id)
  on conflict (property_id, user_id) do nothing;

  select count(*)::integer
  into v_assignment_count
  from public.property_team_assignments assignment
  where assignment.agency_id = p_agency_id
    and assignment.user_id = p_user_id;

  return v_assignment_count;
end;
$$;

revoke all on function public.set_property_team_assignments(
  uuid,
  uuid,
  uuid[]
) from public;

grant execute on function public.set_property_team_assignments(
  uuid,
  uuid,
  uuid[]
) to authenticated;

commit;
