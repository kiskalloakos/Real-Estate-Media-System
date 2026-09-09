alter table public.cabana_scripts
  add column if not exists property_id uuid references public.properties(id) on delete set null,
  add column if not exists client_account_id uuid references public.client_accounts(id) on delete set null,
  add column if not exists status text not null default 'draft',
  add column if not exists approved_at timestamptz;

alter table public.cabana_scripts
  drop constraint if exists cabana_scripts_status_check;

alter table public.cabana_scripts
  add constraint cabana_scripts_status_check
  check (status in ('draft', 'approved'));

create index if not exists cabana_scripts_property_status_idx
  on public.cabana_scripts (agency_id, property_id, status, updated_at desc)
  where archived_at is null;

create index if not exists cabana_scripts_client_status_idx
  on public.cabana_scripts (agency_id, client_account_id, status, updated_at desc)
  where archived_at is null;
