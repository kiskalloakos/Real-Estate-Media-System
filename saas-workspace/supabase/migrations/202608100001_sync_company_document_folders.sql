-- Persist Documents/Notes folders in Postgres so folder structure syncs across browsers and devices.

create table if not exists public.company_document_folders (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  scope text not null check (scope in ('documents', 'notes')),
  name text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, agency_id),
  check (length(trim(name)) > 0)
);

alter table public.company_documents
  add column if not exists folder_id uuid;

alter table public.company_documents
  drop constraint if exists company_documents_folder_id_fkey;

alter table public.company_documents
  add constraint company_documents_folder_id_fkey
  foreign key (folder_id, agency_id)
  references public.company_document_folders(id, agency_id)
  on delete set null;

create index if not exists company_document_folders_agency_scope_idx
  on public.company_document_folders (agency_id, scope, updated_at desc);

create index if not exists company_documents_agency_folder_idx
  on public.company_documents (agency_id, folder_id, updated_at desc)
  where archived_at is null;

drop trigger if exists company_document_folders_set_updated_at on public.company_document_folders;
create trigger company_document_folders_set_updated_at
  before update on public.company_document_folders
  for each row execute function public.set_updated_at();

drop trigger if exists protect_company_document_folders_agency_scope on public.company_document_folders;
create trigger protect_company_document_folders_agency_scope
  before update on public.company_document_folders
  for each row execute function public.enforce_immutable_agency_scope();

alter table public.company_document_folders enable row level security;

drop policy if exists company_document_folders_admin_all on public.company_document_folders;
create policy company_document_folders_admin_all
  on public.company_document_folders for all
  to authenticated
  using (public.is_agency_admin(agency_id))
  with check (public.is_agency_admin(agency_id));

grant select, insert, update, delete on public.company_document_folders to authenticated;
revoke all on public.company_document_folders from anon;
