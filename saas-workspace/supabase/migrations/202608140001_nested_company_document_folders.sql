-- Allow Documents and Notes folders to be nested under another folder.

alter table public.company_document_folders
  add column if not exists parent_folder_id uuid;

alter table public.company_document_folders
  drop constraint if exists company_document_folders_parent_folder_id_fkey;

alter table public.company_document_folders
  add constraint company_document_folders_parent_folder_id_fkey
  foreign key (parent_folder_id)
  references public.company_document_folders(id)
  on delete set null;

alter table public.company_document_folders
  drop constraint if exists company_document_folders_not_own_parent;

alter table public.company_document_folders
  add constraint company_document_folders_not_own_parent
  check (parent_folder_id is null or parent_folder_id <> id);

create index if not exists company_document_folders_parent_idx
  on public.company_document_folders (agency_id, scope, parent_folder_id, updated_at desc);

create or replace function public.enforce_company_document_folder_parent()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.parent_folder_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.company_document_folders parent
    where parent.id = new.parent_folder_id
      and parent.agency_id = new.agency_id
      and parent.scope = new.scope
  ) then
    raise exception 'parent folder must belong to the same agency and scope';
  end if;

  if exists (
    with recursive ancestors as (
      select parent.id, parent.parent_folder_id
      from public.company_document_folders parent
      where parent.id = new.parent_folder_id
      union all
      select parent.id, parent.parent_folder_id
      from public.company_document_folders parent
      join ancestors on ancestors.parent_folder_id = parent.id
    )
    select 1 from ancestors where id = new.id
  ) then
    raise exception 'folder cannot be nested inside itself';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_company_document_folder_parent on public.company_document_folders;
create trigger enforce_company_document_folder_parent
  before insert or update on public.company_document_folders
  for each row execute function public.enforce_company_document_folder_parent();
