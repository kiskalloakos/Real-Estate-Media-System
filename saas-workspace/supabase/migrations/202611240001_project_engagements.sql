-- Engagements span any duration; task sections are named by the agency.
begin;

alter table public.jobs
  add column agreement_id uuid,
  add column owner_user_id uuid,
  add constraint jobs_agreement_client_fk foreign key (agreement_id, agency_id, client_account_id)
    references public.service_contracts(id, agency_id, client_account_id) on delete set null (agreement_id),
  add constraint jobs_owner_agency_fk foreign key (agency_id, owner_user_id)
    references public.agency_memberships(agency_id, user_id) on delete set null (owner_user_id),
  add constraint jobs_agreement_requires_client check (agreement_id is null or client_account_id is not null),
  add constraint jobs_agreement_unique unique (agency_id, agreement_id);

create table public.job_sections (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  job_id uuid not null,
  name text not null check (length(trim(name)) > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (job_id, agency_id) references public.jobs(id, agency_id) on delete cascade,
  unique(id, job_id, agency_id)
);
create index job_sections_order_idx on public.job_sections(job_id, sort_order);
alter table public.job_sections enable row level security;
create trigger job_sections_set_updated_at before update on public.job_sections
  for each row execute function public.set_updated_at();

alter table public.tasks
  add column job_section_id uuid,
  add column production_phase text check (production_phase in ('pre-production', 'production', 'post-production')),
  add constraint tasks_section_requires_job check (job_section_id is null or job_id is not null),
  add constraint tasks_job_section_fk foreign key(job_section_id, job_id, agency_id)
    references public.job_sections(id, job_id, agency_id) on delete set null (job_section_id);
create index tasks_job_section_idx on public.tasks(job_id, job_section_id) where archived_at is null;

create policy job_sections_read on public.job_sections for select to authenticated
  using (public.is_agency_admin(agency_id) or exists (
    select 1 from public.tasks where tasks.job_id = job_sections.job_id
      and tasks.job_section_id = job_sections.id
  ));
create policy job_sections_manage on public.job_sections for all to authenticated
  using (public.is_agency_admin(agency_id)) with check (public.is_agency_admin(agency_id));

-- Enforce project context for direct API callers as well as the UI.
create function public.validate_job_record_context() returns trigger language plpgsql
  set search_path = public, pg_temp as $$
declare project public.jobs;
begin
  if new.job_id is null then return new; end if;
  select * into project from public.jobs where id = new.job_id and agency_id = new.agency_id and archived_at is null;
  if not found then raise exception 'Project is unavailable'; end if;
  if new.client_account_id is distinct from project.client_account_id then
    raise exception 'The record must use its project client';
  end if;
  if new.property_id is not null and not exists (
    select 1 from public.properties where id = new.property_id and agency_id = new.agency_id
      and client_account_id = project.client_account_id and archived_at is null
  ) then raise exception 'The property must belong to the project client'; end if;
  return new;
end;
$$;
create trigger tasks_validate_job_context before insert or update on public.tasks
  for each row execute function public.validate_job_record_context();
create trigger calendar_validate_job_context before insert or update on public.calendar_events
  for each row execute function public.validate_job_record_context();

-- Inspect all linked work, including rows hidden from the editing user by task RLS.
create function public.protect_job_client() returns trigger language plpgsql security definer
  set search_path = public, pg_temp as $$
begin
  if new.client_account_id is distinct from old.client_account_id and (
    exists(select 1 from public.tasks where job_id = old.id)
    or exists(select 1 from public.calendar_events where job_id = old.id)
  ) then raise exception 'Move existing project work before changing the client'; end if;
  return new;
end;
$$;
create trigger jobs_protect_client before update on public.jobs
  for each row execute function public.protect_job_client();

commit;
