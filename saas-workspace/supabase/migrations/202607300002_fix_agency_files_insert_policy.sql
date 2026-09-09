-- Company documents upload to agency-files/<agency_uuid>/documents/<filename>.
-- Recreate the insert policy to ensure agency administrators can write that
-- namespaced path through Supabase Storage.

drop policy if exists agency_files_insert_admin on storage.objects;

create policy agency_files_insert_admin
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'agency-files'
    and public.is_agency_admin(((storage.foldername(name))[1])::uuid)
  );
