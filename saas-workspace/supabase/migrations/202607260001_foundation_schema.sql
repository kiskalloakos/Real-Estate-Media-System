-- Realty Media application foundation.
-- This migration contains no environment-specific identifiers or credentials.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

create type public.agency_role as enum ('admin', 'team_member', 'client');
create type public.membership_status as enum ('invited', 'active', 'suspended');
create type public.client_membership_role as enum ('owner', 'member');
create type public.invitation_status as enum ('pending', 'accepted', 'revoked', 'expired');
create type public.property_status as enum ('onboarding', 'active', 'paused', 'archived');
create type public.contract_status as enum ('draft', 'active', 'paused', 'completed', 'cancelled');
create type public.billing_frequency as enum (
  'one_time',
  'weekly',
  'monthly',
  'quarterly',
  'yearly',
  'custom'
);
create type public.deliverable_status as enum (
  'planned',
  'in_progress',
  'ready_for_review',
  'changes_requested',
  'approved',
  'delivered',
  'skipped'
);
create type public.payment_status as enum (
  'upcoming',
  'due',
  'paid',
  'late',
  'waived',
  'cancelled'
);
create type public.media_kind as enum ('script', 'video', 'image', 'document', 'other');
create type public.media_status as enum (
  'draft',
  'ready_for_review',
  'changes_requested',
  'approved',
  'archived'
);
create type public.comment_visibility as enum ('client', 'internal');
create type public.comment_status as enum ('open', 'resolved');
create type public.review_decision as enum (
  'ready_for_review',
  'changes_requested',
  'approved',
  'approval_revoked'
);
create type public.record_visibility as enum ('admin_only', 'team', 'client');
create type public.task_status as enum ('todo', 'in_progress', 'blocked', 'done', 'cancelled');
create type public.task_priority as enum ('low', 'normal', 'high', 'urgent');
create type public.gear_status as enum (
  'available',
  'assigned',
  'on_site',
  'maintenance',
  'missing',
  'retired'
);
create type public.gear_custody_action as enum (
  'checked_out',
  'transferred',
  'placed_on_site',
  'returned',
  'sent_to_maintenance',
  'marked_missing',
  'retired'
);
create type public.finance_account_type as enum ('cash', 'bank', 'credit', 'savings', 'other');
create type public.finance_transaction_type as enum ('income', 'expense', 'transfer', 'adjustment');
create type public.debt_direction as enum ('payable', 'receivable');
create type public.debt_status as enum ('open', 'partial', 'paid', 'waived', 'cancelled');
create type public.recurrence_frequency as enum (
  'weekly',
  'monthly',
  'quarterly',
  'yearly',
  'custom'
);

create table public.agencies (
  id uuid primary key default gen_random_uuid(),
  slug extensions.citext not null unique,
  name text not null,
  legal_name text,
  logo_path text,
  timezone text not null default 'Europe/Bucharest',
  default_currency text not null default 'EUR'
    check (default_currency ~ '^[A-Z]{3}$'),
  settings jsonb not null default '{}'::jsonb
    check (jsonb_typeof(settings) = 'object'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  check (length(trim(name)) > 0),
  check (slug::text ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email extensions.citext not null,
  full_name text,
  avatar_path text,
  phone text,
  locale text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (full_name is null or length(trim(full_name)) > 0)
);

create table public.agency_memberships (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.agency_role not null,
  status public.membership_status not null default 'active',
  title text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, user_id),
  unique (id, agency_id)
);

create table public.client_accounts (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  name text not null,
  owner_name text,
  billing_email extensions.citext,
  profile_image_path text,
  location_label text,
  address_line_1 text,
  address_line_2 text,
  city text,
  region text,
  postal_code text,
  country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  timezone text,
  description text,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (id, agency_id),
  check (length(trim(name)) > 0)
);

create table public.client_memberships (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_account_id uuid not null,
  user_id uuid not null,
  role public.client_membership_role not null default 'member',
  status public.membership_status not null default 'active',
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (client_account_id, agency_id)
    references public.client_accounts(id, agency_id) on delete cascade,
  foreign key (agency_id, user_id)
    references public.agency_memberships(agency_id, user_id) on delete cascade,
  unique (client_account_id, user_id),
  unique (id, agency_id)
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_account_id uuid,
  email extensions.citext not null,
  agency_role public.agency_role not null,
  client_role public.client_membership_role,
  token_hash text not null unique,
  status public.invitation_status not null default 'pending',
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_by uuid references public.profiles(id) on delete set null,
  accepted_at timestamptz,
  invited_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (client_account_id, agency_id)
    references public.client_accounts(id, agency_id) on delete cascade,
  unique (id, agency_id),
  check (
    (agency_role = 'client' and client_account_id is not null and client_role is not null)
    or
    (agency_role <> 'client' and client_account_id is null and client_role is null)
  ),
  check (expires_at > created_at)
);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_account_id uuid not null,
  name text not null,
  status public.property_status not null default 'onboarding',
  description text,
  cover_image_path text,
  location_label text,
  address_line_1 text,
  address_line_2 text,
  city text,
  region text,
  postal_code text,
  country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  latitude numeric(9, 6) check (latitude is null or latitude between -90 and 90),
  longitude numeric(9, 6) check (longitude is null or longitude between -180 and 180),
  timezone text,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  foreign key (client_account_id, agency_id)
    references public.client_accounts(id, agency_id) on delete cascade,
  unique (id, agency_id),
  unique (id, agency_id, client_account_id),
  check (length(trim(name)) > 0)
);

create table public.property_team_assignments (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  property_id uuid not null,
  user_id uuid not null,
  assignment_label text,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (property_id, agency_id)
    references public.properties(id, agency_id) on delete cascade,
  foreign key (agency_id, user_id)
    references public.agency_memberships(agency_id, user_id) on delete cascade,
  unique (property_id, user_id),
  unique (id, agency_id)
);

create table public.service_contracts (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_account_id uuid not null,
  property_id uuid,
  title text not null,
  reference_code text,
  status public.contract_status not null default 'draft',
  billing_frequency public.billing_frequency not null default 'monthly',
  recurring_amount numeric(14, 2) not null default 0 check (recurring_amount >= 0),
  total_contract_value numeric(14, 2) check (total_contract_value is null or total_contract_value >= 0),
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  starts_on date,
  ends_on date,
  signed_at timestamptz,
  summary text,
  contract_file_path text,
  client_visible boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  foreign key (client_account_id, agency_id)
    references public.client_accounts(id, agency_id) on delete cascade,
  foreign key (property_id, agency_id, client_account_id)
    references public.properties(id, agency_id, client_account_id) on delete cascade,
  unique (id, agency_id),
  unique (id, agency_id, client_account_id),
  check (length(trim(title)) > 0),
  check (starts_on is null or ends_on is null or ends_on >= starts_on)
);

create table public.contract_deliverables (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  contract_id uuid not null,
  property_id uuid,
  name text not null,
  description text,
  quantity numeric(10, 2) not null default 1 check (quantity > 0),
  unit text not null default 'item',
  cadence public.billing_frequency not null default 'monthly',
  status public.deliverable_status not null default 'planned',
  due_at timestamptz,
  completed_at timestamptz,
  client_visible boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (contract_id, agency_id)
    references public.service_contracts(id, agency_id) on delete cascade,
  foreign key (property_id, agency_id)
    references public.properties(id, agency_id) on delete cascade,
  unique (id, agency_id),
  check (length(trim(name)) > 0)
);

create table public.payment_schedule_items (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_account_id uuid not null,
  contract_id uuid not null,
  label text,
  due_on date not null,
  amount numeric(14, 2) not null check (amount >= 0),
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  status public.payment_status not null default 'upcoming',
  paid_at timestamptz,
  invoice_reference text,
  attachment_path text,
  client_note text,
  client_visible boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (client_account_id, agency_id)
    references public.client_accounts(id, agency_id) on delete cascade,
  foreign key (contract_id, agency_id, client_account_id)
    references public.service_contracts(id, agency_id, client_account_id) on delete cascade,
  unique (id, agency_id),
  unique (id, agency_id, client_account_id),
  check ((status = 'paid' and paid_at is not null) or status <> 'paid')
);

create table public.payment_records (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_account_id uuid not null,
  schedule_item_id uuid,
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  paid_on date not null,
  payment_method text,
  reference text,
  receipt_path text,
  client_note text,
  client_visible boolean not null default true,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (client_account_id, agency_id)
    references public.client_accounts(id, agency_id) on delete cascade,
  foreign key (schedule_item_id, agency_id, client_account_id)
    references public.payment_schedule_items(id, agency_id, client_account_id) on delete restrict,
  unique (id, agency_id)
);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  property_id uuid not null,
  kind public.media_kind not null,
  title text not null,
  description text,
  status public.media_status not null default 'draft',
  client_visible boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  foreign key (property_id, agency_id)
    references public.properties(id, agency_id) on delete cascade,
  unique (id, agency_id),
  check (length(trim(title)) > 0)
);

create table public.media_versions (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  media_asset_id uuid not null,
  version_number integer not null check (version_number > 0),
  storage_path text not null,
  original_filename text not null,
  mime_type text not null,
  byte_size bigint not null check (byte_size >= 0),
  duration_seconds numeric(12, 3) check (duration_seconds is null or duration_seconds >= 0),
  checksum_sha256 text,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (media_asset_id, agency_id)
    references public.media_assets(id, agency_id) on delete cascade,
  unique (media_asset_id, version_number),
  unique (id, agency_id),
  unique (id, agency_id, media_asset_id),
  check (length(trim(storage_path)) > 0),
  check (length(trim(original_filename)) > 0)
);

create table public.review_comments (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  media_asset_id uuid not null,
  media_version_id uuid not null,
  parent_comment_id uuid,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  timestamp_seconds numeric(12, 3)
    check (timestamp_seconds is null or timestamp_seconds >= 0),
  visibility public.comment_visibility not null default 'client',
  status public.comment_status not null default 'open',
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (media_asset_id, agency_id)
    references public.media_assets(id, agency_id) on delete cascade,
  foreign key (media_version_id, agency_id, media_asset_id)
    references public.media_versions(id, agency_id, media_asset_id) on delete cascade,
  foreign key (parent_comment_id, agency_id, media_asset_id)
    references public.review_comments(id, agency_id, media_asset_id) on delete cascade,
  unique (id, agency_id),
  unique (id, agency_id, media_asset_id),
  check (length(trim(body)) > 0),
  check (
    (status = 'resolved' and resolved_at is not null and resolved_by is not null)
    or
    (status = 'open' and resolved_at is null)
  )
);

create table public.review_approval_events (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  media_asset_id uuid not null,
  media_version_id uuid not null,
  decision public.review_decision not null,
  note text,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  foreign key (media_asset_id, agency_id)
    references public.media_assets(id, agency_id) on delete cascade,
  foreign key (media_version_id, agency_id, media_asset_id)
    references public.media_versions(id, agency_id, media_asset_id) on delete cascade,
  unique (id, agency_id)
);

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_account_id uuid,
  property_id uuid,
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  location text,
  visibility public.record_visibility not null default 'team',
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  foreign key (client_account_id, agency_id)
    references public.client_accounts(id, agency_id) on delete cascade,
  foreign key (property_id, agency_id, client_account_id)
    references public.properties(id, agency_id, client_account_id) on delete cascade,
  unique (id, agency_id),
  check (length(trim(title)) > 0),
  check (ends_at is null or ends_at >= starts_at),
  check (property_id is null or client_account_id is not null)
);

create table public.calendar_event_assignees (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  calendar_event_id uuid not null,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  foreign key (calendar_event_id, agency_id)
    references public.calendar_events(id, agency_id) on delete cascade,
  foreign key (agency_id, user_id)
    references public.agency_memberships(agency_id, user_id) on delete cascade,
  unique (calendar_event_id, user_id),
  unique (id, agency_id)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_account_id uuid,
  property_id uuid,
  title text not null,
  description text,
  status public.task_status not null default 'todo',
  priority public.task_priority not null default 'normal',
  due_at timestamptz,
  completed_at timestamptz,
  visibility public.record_visibility not null default 'team',
  assignee_user_id uuid,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  foreign key (client_account_id, agency_id)
    references public.client_accounts(id, agency_id) on delete cascade,
  foreign key (property_id, agency_id, client_account_id)
    references public.properties(id, agency_id, client_account_id) on delete cascade,
  foreign key (agency_id, assignee_user_id)
    references public.agency_memberships(agency_id, user_id) on delete restrict,
  unique (id, agency_id),
  check (length(trim(title)) > 0),
  check (property_id is null or client_account_id is not null),
  check (
    (status = 'done' and completed_at is not null)
    or
    (status <> 'done')
  )
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_account_id uuid,
  property_id uuid,
  calendar_event_id uuid,
  task_id uuid,
  title text,
  body text not null,
  visibility public.record_visibility not null default 'team',
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  foreign key (client_account_id, agency_id)
    references public.client_accounts(id, agency_id) on delete cascade,
  foreign key (property_id, agency_id, client_account_id)
    references public.properties(id, agency_id, client_account_id) on delete cascade,
  foreign key (calendar_event_id, agency_id)
    references public.calendar_events(id, agency_id) on delete cascade,
  foreign key (task_id, agency_id)
    references public.tasks(id, agency_id) on delete cascade,
  unique (id, agency_id),
  check (length(trim(body)) > 0),
  check (property_id is null or client_account_id is not null)
);

create table public.record_attachments (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_account_id uuid,
  property_id uuid,
  calendar_event_id uuid,
  task_id uuid,
  note_id uuid,
  storage_path text not null,
  original_filename text not null,
  mime_type text not null,
  byte_size bigint not null check (byte_size >= 0),
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (client_account_id, agency_id)
    references public.client_accounts(id, agency_id) on delete cascade,
  foreign key (property_id, agency_id, client_account_id)
    references public.properties(id, agency_id, client_account_id) on delete cascade,
  foreign key (calendar_event_id, agency_id)
    references public.calendar_events(id, agency_id) on delete cascade,
  foreign key (task_id, agency_id)
    references public.tasks(id, agency_id) on delete cascade,
  foreign key (note_id, agency_id)
    references public.notes(id, agency_id) on delete cascade,
  unique (id, agency_id),
  check (num_nonnulls(calendar_event_id, task_id, note_id) = 1),
  check (property_id is null or client_account_id is not null),
  check (length(trim(storage_path)) > 0),
  check (length(trim(original_filename)) > 0)
);

create table public.gear_items (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  asset_tag text not null,
  name text not null,
  category text not null,
  serial_number text,
  status public.gear_status not null default 'available',
  condition_label text,
  home_location text,
  current_location text,
  current_custodian_user_id uuid,
  current_property_id uuid,
  image_path text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  foreign key (agency_id, current_custodian_user_id)
    references public.agency_memberships(agency_id, user_id) on delete restrict,
  foreign key (current_property_id, agency_id)
    references public.properties(id, agency_id) on delete restrict,
  unique (agency_id, asset_tag),
  unique (id, agency_id),
  check (length(trim(asset_tag)) > 0),
  check (length(trim(name)) > 0),
  check (
    (status = 'assigned' and current_custodian_user_id is not null)
    or status <> 'assigned'
  ),
  check (
    (status = 'on_site' and current_property_id is not null)
    or status <> 'on_site'
  )
);

create table public.gear_custody_history (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  gear_item_id uuid not null,
  action public.gear_custody_action not null,
  from_user_id uuid,
  to_user_id uuid,
  from_property_id uuid,
  to_property_id uuid,
  from_location text,
  to_location text,
  condition_label text,
  note text,
  transferred_by uuid not null references public.profiles(id) on delete cascade,
  acknowledged_by uuid references public.profiles(id) on delete set null,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (gear_item_id, agency_id)
    references public.gear_items(id, agency_id) on delete cascade,
  foreign key (agency_id, from_user_id)
    references public.agency_memberships(agency_id, user_id) on delete restrict,
  foreign key (agency_id, to_user_id)
    references public.agency_memberships(agency_id, user_id) on delete restrict,
  foreign key (from_property_id, agency_id)
    references public.properties(id, agency_id) on delete restrict,
  foreign key (to_property_id, agency_id)
    references public.properties(id, agency_id) on delete restrict,
  unique (id, agency_id),
  check (
    (acknowledged_at is null and acknowledged_by is null)
    or
    (acknowledged_at is not null and acknowledged_by is not null)
  )
);

create table public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  name text not null,
  account_type public.finance_account_type not null,
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  opening_balance numeric(16, 2) not null default 0,
  institution_name text,
  account_reference text,
  is_active boolean not null default true,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (agency_id, name),
  unique (id, agency_id),
  check (length(trim(name)) > 0)
);

create table public.finance_categories (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  parent_category_id uuid,
  name text not null,
  applies_to public.finance_transaction_type not null,
  color text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (parent_category_id, agency_id)
    references public.finance_categories(id, agency_id) on delete restrict,
  unique (agency_id, name, applies_to),
  unique (id, agency_id),
  check (applies_to in ('income', 'expense')),
  check (length(trim(name)) > 0)
);

create table public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  account_id uuid not null,
  category_id uuid,
  client_account_id uuid,
  transaction_type public.finance_transaction_type not null,
  amount numeric(16, 2) not null check (amount > 0),
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  occurred_on date not null,
  counterparty text,
  description text not null,
  reference text,
  receipt_path text,
  transfer_group_id uuid,
  related_transaction_id uuid,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (account_id, agency_id)
    references public.finance_accounts(id, agency_id) on delete restrict,
  foreign key (category_id, agency_id)
    references public.finance_categories(id, agency_id) on delete restrict,
  foreign key (client_account_id, agency_id)
    references public.client_accounts(id, agency_id) on delete restrict,
  foreign key (related_transaction_id, agency_id)
    references public.finance_transactions(id, agency_id) on delete restrict,
  unique (id, agency_id),
  check (length(trim(description)) > 0)
);

create table public.finance_debts (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_account_id uuid,
  direction public.debt_direction not null,
  status public.debt_status not null default 'open',
  counterparty text not null,
  description text,
  original_amount numeric(16, 2) not null check (original_amount > 0),
  outstanding_amount numeric(16, 2) not null check (outstanding_amount >= 0),
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  issued_on date,
  due_on date,
  reference text,
  attachment_path text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  foreign key (client_account_id, agency_id)
    references public.client_accounts(id, agency_id) on delete restrict,
  unique (id, agency_id),
  check (outstanding_amount <= original_amount),
  check (length(trim(counterparty)) > 0),
  check (issued_on is null or due_on is null or due_on >= issued_on),
  check (
    (status = 'paid' and outstanding_amount = 0)
    or
    (status <> 'paid')
  )
);

create table public.finance_debt_payments (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  debt_id uuid not null,
  account_id uuid,
  transaction_id uuid,
  amount numeric(16, 2) not null check (amount > 0),
  paid_on date not null,
  note text,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (debt_id, agency_id)
    references public.finance_debts(id, agency_id) on delete cascade,
  foreign key (account_id, agency_id)
    references public.finance_accounts(id, agency_id) on delete restrict,
  foreign key (transaction_id, agency_id)
    references public.finance_transactions(id, agency_id) on delete restrict,
  unique (id, agency_id)
);

create table public.recurring_costs (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  account_id uuid,
  category_id uuid,
  name text not null,
  vendor text,
  amount numeric(16, 2) not null check (amount > 0),
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  frequency public.recurrence_frequency not null default 'monthly',
  interval_count integer not null default 1 check (interval_count > 0),
  starts_on date not null,
  next_due_on date not null,
  ends_on date,
  is_active boolean not null default true,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  foreign key (account_id, agency_id)
    references public.finance_accounts(id, agency_id) on delete restrict,
  foreign key (category_id, agency_id)
    references public.finance_categories(id, agency_id) on delete restrict,
  unique (id, agency_id),
  check (length(trim(name)) > 0),
  check (next_due_on >= starts_on),
  check (ends_on is null or ends_on >= starts_on)
);

create table public.recurring_cost_occurrences (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  recurring_cost_id uuid not null,
  transaction_id uuid,
  due_on date not null,
  amount numeric(16, 2) not null check (amount > 0),
  status public.payment_status not null default 'upcoming',
  paid_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (recurring_cost_id, agency_id)
    references public.recurring_costs(id, agency_id) on delete cascade,
  foreign key (transaction_id, agency_id)
    references public.finance_transactions(id, agency_id) on delete restrict,
  unique (recurring_cost_id, due_on),
  unique (id, agency_id),
  check ((status = 'paid' and paid_at is not null) or status <> 'paid')
);

alter table public.payment_records
  add column finance_transaction_id uuid,
  add constraint payment_records_finance_transaction_fkey
    foreign key (finance_transaction_id, agency_id)
    references public.finance_transactions(id, agency_id) on delete restrict;

create table public.audit_events (
  id bigint generated always as identity primary key,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  entity_schema text not null,
  entity_table text not null,
  entity_id uuid,
  old_record jsonb,
  new_record jsonb,
  occurred_at timestamptz not null default now()
);

-- Supporting indexes for joins, common filters, and RLS predicates.
create index agency_memberships_user_active_idx
  on public.agency_memberships (user_id, agency_id, role)
  where status = 'active';
create index client_accounts_agency_active_idx
  on public.client_accounts (agency_id, created_at desc)
  where archived_at is null;
create index client_memberships_user_active_idx
  on public.client_memberships (user_id, client_account_id)
  where status = 'active';
create index invitations_email_pending_idx
  on public.invitations (lower(email::text), expires_at)
  where status = 'pending';
create index properties_client_active_idx
  on public.properties (client_account_id, created_at desc)
  where archived_at is null;
create index property_assignments_user_idx
  on public.property_team_assignments (user_id, property_id);
create index service_contracts_client_status_idx
  on public.service_contracts (client_account_id, status);
create index contract_deliverables_contract_status_idx
  on public.contract_deliverables (contract_id, status, sort_order);
create index payment_schedule_client_due_idx
  on public.payment_schedule_items (client_account_id, due_on, status);
create index payment_records_client_paid_idx
  on public.payment_records (client_account_id, paid_on desc);
create index media_assets_property_status_idx
  on public.media_assets (property_id, status, updated_at desc);
create index media_versions_asset_created_idx
  on public.media_versions (media_asset_id, created_at desc);
create index review_comments_version_time_idx
  on public.review_comments (media_version_id, timestamp_seconds, created_at);
create index review_comments_parent_idx
  on public.review_comments (parent_comment_id)
  where parent_comment_id is not null;
create index review_approval_asset_created_idx
  on public.review_approval_events (media_asset_id, created_at desc);
create index calendar_events_agency_dates_idx
  on public.calendar_events (agency_id, starts_at, ends_at)
  where archived_at is null;
create index calendar_events_property_dates_idx
  on public.calendar_events (property_id, starts_at)
  where property_id is not null and archived_at is null;
create index calendar_event_assignees_user_idx
  on public.calendar_event_assignees (user_id, calendar_event_id);
create index tasks_assignee_due_idx
  on public.tasks (assignee_user_id, due_at, status)
  where archived_at is null;
create index tasks_property_status_idx
  on public.tasks (property_id, status, due_at)
  where archived_at is null;
create index notes_property_created_idx
  on public.notes (property_id, created_at desc)
  where property_id is not null and archived_at is null;
create index attachments_event_idx on public.record_attachments (calendar_event_id);
create index attachments_task_idx on public.record_attachments (task_id);
create index attachments_note_idx on public.record_attachments (note_id);
create index gear_items_custodian_idx
  on public.gear_items (current_custodian_user_id, status)
  where archived_at is null;
create index gear_items_property_idx
  on public.gear_items (current_property_id, status)
  where archived_at is null;
create index gear_history_item_created_idx
  on public.gear_custody_history (gear_item_id, created_at desc);
create index gear_history_to_user_idx
  on public.gear_custody_history (to_user_id, created_at desc);
create index finance_transactions_account_date_idx
  on public.finance_transactions (account_id, occurred_on desc);
create index finance_transactions_agency_type_date_idx
  on public.finance_transactions (agency_id, transaction_type, occurred_on desc);
create index finance_debts_agency_status_due_idx
  on public.finance_debts (agency_id, status, due_on);
create index debt_payments_debt_date_idx
  on public.finance_debt_payments (debt_id, paid_on desc);
create index recurring_costs_agency_due_idx
  on public.recurring_costs (agency_id, next_due_on)
  where is_active and archived_at is null;
create index recurring_occurrences_due_idx
  on public.recurring_cost_occurrences (agency_id, due_on, status);
create index audit_events_agency_time_idx
  on public.audit_events (agency_id, occurred_at desc);
create index audit_events_entity_idx
  on public.audit_events (entity_table, entity_id, occurred_at desc);
