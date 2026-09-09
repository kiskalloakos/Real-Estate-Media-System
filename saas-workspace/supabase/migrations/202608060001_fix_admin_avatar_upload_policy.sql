-- Allow agency admins to manage profile photos for users in their agency.
-- Storage RLS calls this security-definer helper so the membership lookup is
-- evaluated consistently with the rest of the app's access helpers.

create or replace function public.can_write_avatar_storage_path(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with path as (
    select storage.foldername(p_name) as parts
  )
  select coalesce(
    (
      select path.parts[1] = auth.uid()::text
      from path
      where array_length(path.parts, 1) >= 1
    ),
    false
  ) or exists (
    select 1
    from path
    join public.agency_memberships target
      on target.user_id::text = path.parts[1]
    where array_length(path.parts, 1) >= 1
      and public.is_agency_admin(target.agency_id)
  );
$$;

drop policy if exists avatars_manage_team_members on storage.objects;
drop policy if exists avatars_insert_own on storage.objects;
drop policy if exists avatars_update_own on storage.objects;
drop policy if exists avatars_delete_own on storage.objects;

create policy avatars_insert_access
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and public.can_write_avatar_storage_path(name)
  );

create policy avatars_update_access
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and public.can_write_avatar_storage_path(name)
  )
  with check (
    bucket_id = 'avatars'
    and public.can_write_avatar_storage_path(name)
  );

create policy avatars_delete_access
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and public.can_write_avatar_storage_path(name)
  );

revoke all on function public.can_write_avatar_storage_path(text) from public;
grant execute on function public.can_write_avatar_storage_path(text) to authenticated;
