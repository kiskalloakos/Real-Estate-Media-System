-- Agency-owned packages replace the built-in-only package picker. A package
-- carries its commercial promise and a reusable role-based workflow.
create table public.service_package_templates (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  name text not null,
  description text,
  monthly_price numeric(14, 2) not null default 0 check (monthly_price >= 0),
  currency text not null default 'RON' check (currency ~ '^[A-Z]{3}$'),
  contract_months integer not null default 1 check (contract_months > 0),
  monthly_deliverables jsonb not null default '[]'::jsonb check (jsonb_typeof(monthly_deliverables) = 'array'),
  is_active boolean not null default true,
  archived_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, agency_id),
  unique (agency_id, name),
  check (length(trim(name)) > 0)
);

create table public.service_package_steps (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  service_package_template_id uuid not null,
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
  foreign key (service_package_template_id, agency_id)
    references public.service_package_templates(id, agency_id) on delete cascade,
  unique (service_package_template_id, step_key),
  unique (id, agency_id),
  check (length(trim(step_key)) > 0),
  check (length(trim(title)) > 0)
);

-- One row per contract month gives fulfillment a real, immutable period rather
-- than treating a whole retainer as one running checklist.
create table public.monthly_fulfillment_cycles (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  contract_id uuid not null,
  client_account_id uuid not null,
  service_package_template_id uuid,
  period_start date not null,
  period_end date not null,
  status text not null default 'planned' check (status in ('planned', 'active', 'at_risk', 'completed', 'cancelled')),
  committed_deliverables jsonb not null default '[]'::jsonb check (jsonb_typeof(committed_deliverables) = 'array'),
  extra_work_count integer not null default 0 check (extra_work_count >= 0),
  revision_overrun_count integer not null default 0 check (revision_overrun_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (contract_id, agency_id, client_account_id)
    references public.service_contracts(id, agency_id, client_account_id) on delete cascade,
  foreign key (service_package_template_id, agency_id)
    references public.service_package_templates(id, agency_id) on delete set null,
  unique (contract_id, period_start),
  unique (id, agency_id),
  check (period_end >= period_start)
);

create index service_package_templates_agency_active_idx on public.service_package_templates(agency_id, is_active) where archived_at is null;
create index service_package_steps_template_idx on public.service_package_steps(service_package_template_id, sort_order);
create index monthly_fulfillment_cycles_client_period_idx on public.monthly_fulfillment_cycles(client_account_id, period_start desc);

alter table public.service_package_templates enable row level security;
alter table public.service_package_steps enable row level security;
alter table public.monthly_fulfillment_cycles enable row level security;

create policy service_package_templates_agency_access on public.service_package_templates for all to authenticated
  using (public.is_agency_admin(agency_id) or public.is_agency_team_member(agency_id))
  with check (public.is_agency_admin(agency_id));
create policy service_package_steps_agency_access on public.service_package_steps for all to authenticated
  using (public.is_agency_admin(agency_id) or public.is_agency_team_member(agency_id))
  with check (public.is_agency_admin(agency_id));
create policy monthly_fulfillment_cycles_select on public.monthly_fulfillment_cycles for select to authenticated
  using (public.is_agency_admin(agency_id) or public.is_agency_team_member(agency_id) or public.has_client_context(client_account_id));
create policy monthly_fulfillment_cycles_manage on public.monthly_fulfillment_cycles for all to authenticated
  using (public.is_agency_admin(agency_id) or public.is_agency_team_member(agency_id))
  with check (public.is_agency_admin(agency_id) or public.is_agency_team_member(agency_id));

create trigger service_package_templates_set_updated_at before update on public.service_package_templates for each row execute function public.set_updated_at();
create trigger service_package_steps_set_updated_at before update on public.service_package_steps for each row execute function public.set_updated_at();
create trigger monthly_fulfillment_cycles_set_updated_at before update on public.monthly_fulfillment_cycles for each row execute function public.set_updated_at();
