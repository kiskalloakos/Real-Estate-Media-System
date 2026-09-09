-- A job is the operational container for a listing launch, a recurring
-- personal-brand campaign, or internal agency work. Properties stay separate:
-- a job may reference one, but campaigns do not have to.
create type public.job_kind as enum (
  'property_launch',
  'content_campaign',
  'recurring_content',
  'internal'
);

create type public.job_status as enum (
  'draft',
  'planned',
  'active',
  'on_hold',
  'complete',
  'cancelled'
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_account_id uuid,
  property_id uuid,
  name text not null,
  kind public.job_kind not null default 'content_campaign',
  status public.job_status not null default 'draft',
  brief text,
  starts_on date,
  due_on date,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  foreign key (client_account_id, agency_id)
    references public.client_accounts(id, agency_id) on delete cascade,
  foreign key (property_id, agency_id, client_account_id)
    references public.properties(id, agency_id, client_account_id) on delete set null (property_id),
  unique (id, agency_id),
  check (length(trim(name)) > 0),
  check (property_id is null or client_account_id is not null),
  check (due_on is null or starts_on is null or due_on >= starts_on)
);

alter table public.tasks
  add column job_id uuid,
  add foreign key (job_id, agency_id)
    references public.jobs(id, agency_id) on delete set null;

alter table public.calendar_events
  add column job_id uuid,
  add foreign key (job_id, agency_id)
    references public.jobs(id, agency_id) on delete set null;

alter table public.media_assets
  add column job_id uuid,
  add foreign key (job_id, agency_id)
    references public.jobs(id, agency_id) on delete set null;

alter table public.notes
  add column job_id uuid,
  add foreign key (job_id, agency_id)
    references public.jobs(id, agency_id) on delete set null;

create index jobs_agency_status_idx
  on public.jobs (agency_id, status, due_on)
  where archived_at is null;
create index jobs_client_status_idx
  on public.jobs (client_account_id, status, due_on)
  where archived_at is null;
create index tasks_job_status_idx
  on public.tasks (job_id, status, due_at)
  where archived_at is null and job_id is not null;
create index calendar_events_job_dates_idx
  on public.calendar_events (job_id, starts_at)
  where archived_at is null and job_id is not null;

alter table public.jobs enable row level security;

create policy jobs_select_access
  on public.jobs for select to authenticated
  using (
    public.is_agency_admin(agency_id)
    or public.is_agency_team_member(agency_id)
    or (client_account_id is not null and public.has_client_context(client_account_id))
  );

create policy jobs_insert_access
  on public.jobs for insert to authenticated
  with check (
    public.is_agency_admin(agency_id)
    or (
      public.is_agency_team_member(agency_id)
      and created_by = auth.uid()
      and status <> 'cancelled'
      and (client_account_id is null or public.has_client_context(client_account_id))
    )
  );

create policy jobs_update_access
  on public.jobs for update to authenticated
  using (
    public.is_agency_admin(agency_id)
    or public.is_agency_team_member(agency_id)
  )
  with check (
    public.is_agency_admin(agency_id)
    or (
      public.is_agency_team_member(agency_id)
      and status <> 'cancelled'
      and (client_account_id is null or public.has_client_context(client_account_id))
    )
  );

create policy jobs_delete_admin
  on public.jobs for delete to authenticated
  using (public.is_agency_admin(agency_id));

create trigger jobs_set_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();
