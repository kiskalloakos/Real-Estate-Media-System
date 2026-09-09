begin;

create extension if not exists supabase_vault cascade;

do $$
begin
  create type public.instagram_connection_status as enum (
    'active',
    'needs_reauth',
    'sync_error',
    'disconnected'
  );
exception
  when duplicate_object then null;
end
$$;

create table public.instagram_connections (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_account_id uuid not null,
  instagram_business_id text not null,
  facebook_page_id text not null,
  facebook_page_name text,
  username text,
  display_name text,
  profile_picture_url text,
  token_secret_id uuid,
  token_expires_at timestamptz,
  status public.instagram_connection_status not null default 'active',
  connected_by uuid references public.profiles(id) on delete set null,
  connected_at timestamptz not null default now(),
  last_synced_at timestamptz,
  last_sync_error text,
  next_sync_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  foreign key (client_account_id, agency_id)
    references public.client_accounts(id, agency_id) on delete cascade,
  unique (agency_id, instagram_business_id),
  unique (id, agency_id, client_account_id),
  check (length(trim(instagram_business_id)) > 0),
  check (length(trim(facebook_page_id)) > 0)
);

create table public.instagram_oauth_states (
  state_hash text primary key,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_account_id uuid not null,
  initiated_by uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  foreign key (client_account_id, agency_id)
    references public.client_accounts(id, agency_id) on delete cascade,
  check (length(state_hash) = 64),
  check (expires_at > created_at)
);

create table public.instagram_account_daily_metrics (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_account_id uuid not null,
  connection_id uuid not null,
  metric_date date not null,
  followers_count bigint,
  follows_count bigint,
  media_count bigint,
  views bigint,
  reach bigint,
  profile_views bigint,
  likes bigint,
  comments bigint,
  shares bigint,
  saves bigint,
  total_interactions bigint,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (connection_id, agency_id, client_account_id)
    references public.instagram_connections(id, agency_id, client_account_id)
    on delete cascade,
  unique (connection_id, metric_date),
  check (followers_count is null or followers_count >= 0),
  check (follows_count is null or follows_count >= 0),
  check (media_count is null or media_count >= 0),
  check (views is null or views >= 0),
  check (reach is null or reach >= 0),
  check (profile_views is null or profile_views >= 0),
  check (likes is null or likes >= 0),
  check (comments is null or comments >= 0),
  check (shares is null or shares >= 0),
  check (saves is null or saves >= 0),
  check (total_interactions is null or total_interactions >= 0)
);

create table public.instagram_media (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_account_id uuid not null,
  connection_id uuid not null,
  instagram_media_id text not null,
  caption text,
  media_type text,
  media_product_type text,
  permalink text,
  thumbnail_url text,
  posted_at timestamptz,
  views bigint,
  reach bigint,
  likes bigint,
  comments bigint,
  shares bigint,
  saves bigint,
  total_interactions bigint,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (connection_id, agency_id, client_account_id)
    references public.instagram_connections(id, agency_id, client_account_id)
    on delete cascade,
  unique (connection_id, instagram_media_id),
  check (length(trim(instagram_media_id)) > 0),
  check (views is null or views >= 0),
  check (reach is null or reach >= 0),
  check (likes is null or likes >= 0),
  check (comments is null or comments >= 0),
  check (shares is null or shares >= 0),
  check (saves is null or saves >= 0),
  check (total_interactions is null or total_interactions >= 0)
);

create table public.instagram_sync_runs (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_account_id uuid not null,
  connection_id uuid not null,
  status text not null
    check (status in ('running', 'succeeded', 'partial', 'failed')),
  trigger_source text not null
    check (trigger_source in ('connect', 'manual', 'scheduled')),
  warning_messages jsonb not null default '[]'::jsonb
    check (jsonb_typeof(warning_messages) = 'array'),
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (connection_id, agency_id, client_account_id)
    references public.instagram_connections(id, agency_id, client_account_id)
    on delete cascade
);

create index instagram_connections_client_idx
  on public.instagram_connections (client_account_id, status, created_at desc)
  where archived_at is null;

create index instagram_connections_due_sync_idx
  on public.instagram_connections (next_sync_at)
  where archived_at is null and status in ('active', 'sync_error');

create index instagram_daily_connection_date_idx
  on public.instagram_account_daily_metrics (connection_id, metric_date desc);

create index instagram_media_connection_posted_idx
  on public.instagram_media (connection_id, posted_at desc);

create index instagram_sync_runs_connection_started_idx
  on public.instagram_sync_runs (connection_id, started_at desc);

create trigger set_instagram_connections_updated_at
  before update on public.instagram_connections
  for each row execute function public.set_updated_at();

create trigger set_instagram_daily_metrics_updated_at
  before update on public.instagram_account_daily_metrics
  for each row execute function public.set_updated_at();

create trigger set_instagram_media_updated_at
  before update on public.instagram_media
  for each row execute function public.set_updated_at();

alter table public.instagram_connections enable row level security;
alter table public.instagram_oauth_states enable row level security;
alter table public.instagram_account_daily_metrics enable row level security;
alter table public.instagram_media enable row level security;
alter table public.instagram_sync_runs enable row level security;

create policy instagram_connections_select_admin_or_client
  on public.instagram_connections for select
  to authenticated
  using (
    archived_at is null
    and (
      public.is_agency_admin(agency_id)
      or public.has_client_access(client_account_id)
    )
  );

create policy instagram_daily_select_admin_or_client
  on public.instagram_account_daily_metrics for select
  to authenticated
  using (
    public.is_agency_admin(agency_id)
    or public.has_client_access(client_account_id)
  );

create policy instagram_media_select_admin_or_client
  on public.instagram_media for select
  to authenticated
  using (
    public.is_agency_admin(agency_id)
    or public.has_client_access(client_account_id)
  );

create policy instagram_sync_runs_select_admin_or_client
  on public.instagram_sync_runs for select
  to authenticated
  using (
    public.is_agency_admin(agency_id)
    or public.has_client_access(client_account_id)
  );

create or replace function public.upsert_instagram_connection_secret(
  p_agency_id uuid,
  p_client_account_id uuid,
  p_instagram_business_id text,
  p_facebook_page_id text,
  p_facebook_page_name text,
  p_username text,
  p_display_name text,
  p_profile_picture_url text,
  p_access_token text,
  p_token_expires_at timestamptz,
  p_connected_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection public.instagram_connections%rowtype;
  v_secret_id uuid;
begin
  select *
  into v_connection
  from public.instagram_connections connection
  where connection.agency_id = p_agency_id
    and connection.instagram_business_id = trim(p_instagram_business_id)
  for update;

  if v_connection.id is not null
    and v_connection.client_account_id <> p_client_account_id then
    raise exception 'This Instagram account is already connected to another client.';
  end if;

  if v_connection.id is null then
    select vault.create_secret(
      p_access_token,
      'realty-media-instagram-' || p_agency_id::text || '-' || trim(p_instagram_business_id),
      'Instagram Page access token for Realty Media connection'
    )
    into v_secret_id;

    insert into public.instagram_connections (
      agency_id,
      client_account_id,
      instagram_business_id,
      facebook_page_id,
      facebook_page_name,
      username,
      display_name,
      profile_picture_url,
      token_secret_id,
      token_expires_at,
      status,
      connected_by,
      connected_at,
      next_sync_at
    )
    values (
      p_agency_id,
      p_client_account_id,
      trim(p_instagram_business_id),
      trim(p_facebook_page_id),
      nullif(trim(p_facebook_page_name), ''),
      nullif(trim(p_username), ''),
      nullif(trim(p_display_name), ''),
      nullif(trim(p_profile_picture_url), ''),
      v_secret_id,
      p_token_expires_at,
      'active',
      p_connected_by,
      now(),
      now()
    )
    returning id into v_connection.id;
  else
    if v_connection.token_secret_id is null then
      select vault.create_secret(
        p_access_token,
        'realty-media-instagram-' || p_agency_id::text || '-' || trim(p_instagram_business_id),
        'Instagram Page access token for Realty Media connection'
      )
      into v_secret_id;
    else
      v_secret_id := v_connection.token_secret_id;
      perform vault.update_secret(v_secret_id, p_access_token);
    end if;

    update public.instagram_connections
    set
      facebook_page_id = trim(p_facebook_page_id),
      facebook_page_name = nullif(trim(p_facebook_page_name), ''),
      username = nullif(trim(p_username), ''),
      display_name = nullif(trim(p_display_name), ''),
      profile_picture_url = nullif(trim(p_profile_picture_url), ''),
      token_secret_id = v_secret_id,
      token_expires_at = p_token_expires_at,
      status = 'active',
      connected_by = p_connected_by,
      connected_at = now(),
      last_sync_error = null,
      next_sync_at = now(),
      archived_at = null
    where id = v_connection.id;
  end if;

  return v_connection.id;
end;
$$;

create or replace function public.get_instagram_connection_secret(
  p_connection_id uuid
)
returns text
language sql
security definer
set search_path = ''
as $$
  select secret.decrypted_secret
  from public.instagram_connections connection
  join vault.decrypted_secrets secret
    on secret.id = connection.token_secret_id
  where connection.id = p_connection_id
    and connection.archived_at is null
    and connection.status <> 'disconnected';
$$;

create or replace function public.disconnect_instagram_connection(
  p_connection_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret_id uuid;
begin
  select token_secret_id
  into v_secret_id
  from public.instagram_connections
  where id = p_connection_id
  for update;

  update public.instagram_connections
  set
    status = 'disconnected',
    token_secret_id = null,
    last_sync_error = null,
    next_sync_at = now() + interval '100 years'
  where id = p_connection_id;

  if v_secret_id is not null then
    delete from vault.secrets where id = v_secret_id;
  end if;
end;
$$;

revoke all on function public.upsert_instagram_connection_secret(
  uuid, uuid, text, text, text, text, text, text, text, timestamptz, uuid
) from public, anon, authenticated;
revoke all on function public.get_instagram_connection_secret(uuid)
  from public, anon, authenticated;
revoke all on function public.disconnect_instagram_connection(uuid)
  from public, anon, authenticated;

grant execute on function public.upsert_instagram_connection_secret(
  uuid, uuid, text, text, text, text, text, text, text, timestamptz, uuid
) to service_role;
grant execute on function public.get_instagram_connection_secret(uuid)
  to service_role;
grant execute on function public.disconnect_instagram_connection(uuid)
  to service_role;

create trigger audit_instagram_connections_changes
  after insert or update or delete on public.instagram_connections
  for each row execute function public.audit_row_change();

commit;
