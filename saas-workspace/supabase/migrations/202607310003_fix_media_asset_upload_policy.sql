-- Agency members can upload review content only for a property in their own
-- agency. The original INSERT check only accepted admins or an explicit
-- property-team assignment, which blocked a valid owner workspace.

drop policy if exists media_assets_manage_admin_team on public.media_assets;

create policy media_assets_manage_admin_team
  on public.media_assets for all
  to authenticated
  using (
    public.is_agency_admin(agency_id)
    or public.is_property_team_member(property_id)
  )
  with check (
    public.is_active_agency_member(agency_id)
    and exists (
      select 1
      from public.properties property
      where property.id = media_assets.property_id
        and property.agency_id = media_assets.agency_id
        and property.archived_at is null
    )
  );
