-- Reusable agency workflows are templates; job_work_items are their editable
-- per-job copies. This preserves a clear default while allowing each agency
-- and campaign to adapt delivery without modifying the original template.
create table public.workflow_templates (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  name text not null,
  description text,
  kind public.job_kind not null default 'content_campaign',
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, agency_id),
  unique (agency_id, name),
  check (length(trim(name)) > 0)
);

create table public.workflow_template_steps (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  workflow_template_id uuid not null,
  step_key text not null,
  title text not null,
  description text,
  assignment_role text,
  due_offset_days integer not null default 0 check (due_offset_days >= 0),
  depends_on_step_key text,
  checklist jsonb not null default '[]'::jsonb check (jsonb_typeof(checklist) = 'array'),
  repeats_monthly boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workflow_template_id, agency_id)
    references public.workflow_templates(id, agency_id) on delete cascade,
  unique (workflow_template_id, step_key),
  unique (id, agency_id),
  check (length(trim(step_key)) > 0),
  check (length(trim(title)) > 0)
);

create table public.job_work_items (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  job_id uuid not null,
  workflow_template_step_id uuid,
  title text not null,
  description text,
  assignment_role text,
  assigned_user_id uuid,
  status public.task_status not null default 'todo',
  due_on date,
  depends_on_item_id uuid,
  checklist jsonb not null default '[]'::jsonb check (jsonb_typeof(checklist) = 'array'),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  foreign key (job_id, agency_id) references public.jobs(id, agency_id) on delete cascade,
  foreign key (workflow_template_step_id, agency_id) references public.workflow_template_steps(id, agency_id) on delete set null,
  foreign key (agency_id, assigned_user_id) references public.agency_memberships(agency_id, user_id) on delete set null,
  foreign key (depends_on_item_id, agency_id) references public.job_work_items(id, agency_id) on delete set null,
  unique (id, agency_id),
  check (length(trim(title)) > 0)
);

create index workflow_template_steps_template_idx on public.workflow_template_steps(workflow_template_id, sort_order);
create index job_work_items_job_idx on public.job_work_items(job_id, sort_order, due_on);

alter table public.workflow_templates enable row level security;
alter table public.workflow_template_steps enable row level security;
alter table public.job_work_items enable row level security;

create policy workflow_templates_agency_access on public.workflow_templates for all to authenticated
  using (public.is_agency_admin(agency_id) or public.is_agency_team_member(agency_id))
  with check (public.is_agency_admin(agency_id));
create policy workflow_template_steps_agency_access on public.workflow_template_steps for all to authenticated
  using (public.is_agency_admin(agency_id) or public.is_agency_team_member(agency_id))
  with check (public.is_agency_admin(agency_id));
create policy job_work_items_access on public.job_work_items for select to authenticated
  using (exists (select 1 from public.jobs where jobs.id = job_work_items.job_id and (public.is_agency_admin(jobs.agency_id) or public.is_agency_team_member(jobs.agency_id) or (jobs.client_account_id is not null and public.has_client_context(jobs.client_account_id)))));
create policy job_work_items_manage on public.job_work_items for all to authenticated
  using (public.is_agency_admin(agency_id) or public.is_agency_team_member(agency_id))
  with check (public.is_agency_admin(agency_id) or public.is_agency_team_member(agency_id));

create trigger workflow_templates_set_updated_at before update on public.workflow_templates for each row execute function public.set_updated_at();
create trigger workflow_template_steps_set_updated_at before update on public.workflow_template_steps for each row execute function public.set_updated_at();
create trigger job_work_items_set_updated_at before update on public.job_work_items for each row execute function public.set_updated_at();
