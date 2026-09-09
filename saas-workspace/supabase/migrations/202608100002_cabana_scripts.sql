create table if not exists public.cabana_scripts (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  title text not null default 'Generated cabana script',
  hooks jsonb not null default '[]'::jsonb,
  script text not null,
  brief jsonb not null default '{}'::jsonb,
  model text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (id, agency_id),
  check (length(trim(title)) > 0),
  check (length(trim(script)) > 0),
  check (jsonb_typeof(hooks) = 'array'),
  check (jsonb_typeof(brief) = 'object')
);

create index if not exists cabana_scripts_agency_updated_idx
  on public.cabana_scripts (agency_id, updated_at desc)
  where archived_at is null;

drop trigger if exists cabana_scripts_set_updated_at on public.cabana_scripts;
create trigger cabana_scripts_set_updated_at
  before update on public.cabana_scripts
  for each row execute function public.set_updated_at();

drop trigger if exists protect_cabana_scripts_agency_scope on public.cabana_scripts;
create trigger protect_cabana_scripts_agency_scope
  before update on public.cabana_scripts
  for each row execute function public.enforce_immutable_agency_scope();

alter table public.cabana_scripts enable row level security;

drop policy if exists cabana_scripts_admin_all on public.cabana_scripts;
create policy cabana_scripts_admin_all
  on public.cabana_scripts for all
  to authenticated
  using (public.is_agency_admin(agency_id))
  with check (public.is_agency_admin(agency_id));

grant select, insert, update, delete on public.cabana_scripts to authenticated;
revoke all on public.cabana_scripts from anon;
