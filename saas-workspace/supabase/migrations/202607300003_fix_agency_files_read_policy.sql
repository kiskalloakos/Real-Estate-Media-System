-- Storage policy expressions must qualify storage.objects.name. Without that
-- qualification, PostgreSQL resolves `name` to the joined agencies row and
-- valid task attachments cannot be read or signed by agency members.

drop policy if exists agency_files_select_member on storage.objects;

create policy agency_files_select_member
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'agency-files'
    and public.is_active_agency_member(
      ((storage.foldername(storage.objects.name))[1])::uuid
    )
  );
