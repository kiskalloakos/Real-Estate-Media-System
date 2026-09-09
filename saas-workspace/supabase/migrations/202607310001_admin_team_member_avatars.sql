-- Agency admins may upload profile photos for the team members they manage.
-- The existing owner policies still limit individual users to their own folder.
create policy avatars_manage_team_members
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'avatars'
    and exists (
      select 1
      from public.agency_memberships membership
      where membership.user_id = auth.uid()
        and membership.role = 'admin'
        and membership.status = 'active'
    )
  )
  with check (
    bucket_id = 'avatars'
    and exists (
      select 1
      from public.agency_memberships membership
      where membership.user_id = auth.uid()
        and membership.role = 'admin'
        and membership.status = 'active'
    )
  );
