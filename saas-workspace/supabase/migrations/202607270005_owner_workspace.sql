-- Simplified owner workspace: company documents, lightweight credentials,
-- sales leads, and internal marketing planning.

create type public.lead_status as enum (
  'pending',
  'contacted',
  'follow_up',
  'interested',
  'won',
  'lost'
);

create type public.company_document_kind as enum (
  'company_file',
  'template',
  'foundation',
  'sop',
  'production',
  'sales',
  'curriculum_vitae',
  'branding',
  'note'
);

create type public.marketing_content_status as enum (
  'idea',
  'draft',
  'ready',
  'published',
  'archived'
);

create table public.company_documents (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  kind public.company_document_kind not null default 'company_file',
  title text not null,
  content_html text,
  storage_path text,
  original_filename text,
  mime_type text,
  byte_size bigint check (byte_size is null or byte_size >= 0),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (id, agency_id),
  check (length(trim(title)) > 0),
  check (
    content_html is not null
    or storage_path is not null
  )
);

create table public.company_credentials (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  label text not null,
  username text,
  secret_value text,
  url text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (id, agency_id),
  check (length(trim(label)) > 0)
);

create table public.agency_leads (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  research_name text not null,
  county text,
  location text,
  phone_number text,
  website text,
  instagram text,
  facebook text,
  tiktok text,
  listing_link text,
  status public.lead_status not null default 'pending',
  source_list text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (id, agency_id),
  check (length(trim(research_name)) > 0)
);

create table public.marketing_content (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  title text not null,
  platform text,
  content_type text,
  body text,
  planned_for timestamptz,
  status public.marketing_content_status not null default 'idea',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (id, agency_id),
  check (length(trim(title)) > 0)
);

create index company_documents_agency_kind_idx
  on public.company_documents (agency_id, kind, updated_at desc)
  where archived_at is null;
create index company_credentials_agency_idx
  on public.company_credentials (agency_id, updated_at desc)
  where archived_at is null;
create index agency_leads_agency_status_idx
  on public.agency_leads (agency_id, status, updated_at desc)
  where archived_at is null;
create index marketing_content_agency_planned_idx
  on public.marketing_content (agency_id, planned_for, status)
  where archived_at is null;

create trigger company_documents_set_updated_at
  before update on public.company_documents
  for each row execute function public.set_updated_at();
create trigger company_credentials_set_updated_at
  before update on public.company_credentials
  for each row execute function public.set_updated_at();
create trigger agency_leads_set_updated_at
  before update on public.agency_leads
  for each row execute function public.set_updated_at();
create trigger marketing_content_set_updated_at
  before update on public.marketing_content
  for each row execute function public.set_updated_at();

create trigger protect_company_documents_agency_scope
  before update on public.company_documents
  for each row execute function public.enforce_immutable_agency_scope();
create trigger protect_company_credentials_agency_scope
  before update on public.company_credentials
  for each row execute function public.enforce_immutable_agency_scope();
create trigger protect_agency_leads_agency_scope
  before update on public.agency_leads
  for each row execute function public.enforce_immutable_agency_scope();
create trigger protect_marketing_content_agency_scope
  before update on public.marketing_content
  for each row execute function public.enforce_immutable_agency_scope();

alter table public.company_documents enable row level security;
alter table public.company_credentials enable row level security;
alter table public.agency_leads enable row level security;
alter table public.marketing_content enable row level security;

create policy company_documents_admin_all
  on public.company_documents for all
  to authenticated
  using (public.is_agency_admin(agency_id))
  with check (public.is_agency_admin(agency_id));

create policy company_credentials_admin_all
  on public.company_credentials for all
  to authenticated
  using (public.is_agency_admin(agency_id))
  with check (public.is_agency_admin(agency_id));

create policy agency_leads_admin_all
  on public.agency_leads for all
  to authenticated
  using (public.is_agency_admin(agency_id))
  with check (public.is_agency_admin(agency_id));

create policy marketing_content_admin_all
  on public.marketing_content for all
  to authenticated
  using (public.is_agency_admin(agency_id))
  with check (public.is_agency_admin(agency_id));

grant select, insert, update, delete on
  public.company_documents,
  public.company_credentials,
  public.agency_leads,
  public.marketing_content
to authenticated;

revoke all on
  public.company_documents,
  public.company_credentials,
  public.agency_leads,
  public.marketing_content
from anon;
