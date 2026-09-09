begin;

create table public.tiktok_connections (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_account_id uuid,
  open_id text not null,
  union_id text,
  username text,
  display_name text,
  profile_picture_url text,
  profile_url text,
  token_secret_id uuid,
  refresh_token_secret_id uuid,
  token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
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
  unique (agency_id, open_id),
  unique (id, agency_id),
  check (length(trim(open_id)) > 0)
);

create table public.tiktok_oauth_states (
  state_hash text primary key,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_account_id uuid,
  initiated_by uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  foreign key (client_account_id, agency_id)
    references public.client_accounts(id, agency_id) on delete cascade,
  check (length(state_hash) = 64),
  check (expires_at > created_at)
);

create table public.tiktok_account_daily_metrics (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_account_id uuid,
  connection_id uuid not null,
  metric_date date not null,
  followers_count bigint,
  follows_count bigint,
  media_count bigint,
  views bigint,
  likes bigint,
  comments bigint,
  shares bigint,
  saves bigint,
  total_interactions bigint,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (connection_id, agency_id)
    references public.tiktok_connections(id, agency_id)
    on delete cascade,
  unique (connection_id, metric_date),
  check (followers_count is null or followers_count >= 0),
  check (follows_count is null or follows_count >= 0),
  check (media_count is null or media_count >= 0),
  check (views is null or views >= 0),
  check (likes is null or likes >= 0),
  check (comments is null or comments >= 0),
  check (shares is null or shares >= 0),
  check (saves is null or saves >= 0),
  check (total_interactions is null or total_interactions >= 0)
);

create table public.tiktok_media (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_account_id uuid,
  connection_id uuid not null,
  tiktok_video_id text not null,
  caption text,
  media_type text,
  permalink text,
  thumbnail_url text,
  posted_at timestamptz,
  views bigint,
  likes bigint,
  comments bigint,
  shares bigint,
  saves bigint,
  total_interactions bigint,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (connection_id, agency_id)
    references public.tiktok_connections(id, agency_id)
    on delete cascade,
  unique (connection_id, tiktok_video_id),
  check (length(trim(tiktok_video_id)) > 0),
  check (views is null or views >= 0),
  check (likes is null or likes >= 0),
  check (comments is null or comments >= 0),
  check (shares is null or shares >= 0),
  check (saves is null or saves >= 0),
  check (total_interactions is null or total_interactions >= 0)
);

create table public.tiktok_sync_runs (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_account_id uuid,
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
  foreign key (connection_id, agency_id)
    references public.tiktok_connections(id, agency_id)
    on delete cascade
);

create index tiktok_connections_client_idx
  on public.tiktok_connections (client_account_id, status, created_at desc)
  where archived_at is null;

create index tiktok_connections_agency_scope_idx
  on public.tiktok_connections (agency_id, status, created_at desc)
  where archived_at is null;

create index tiktok_connections_due_sync_idx
  on public.tiktok_connections (next_sync_at)
  where archived_at is null and status in ('active', 'sync_error');

create index tiktok_daily_connection_date_idx
  on public.tiktok_account_daily_metrics (connection_id, metric_date desc);

create index tiktok_media_connection_posted_idx
  on public.tiktok_media (connection_id, posted_at desc);

create trigger set_tiktok_connections_updated_at
  before update on public.tiktok_connections
  for each row execute function public.set_updated_at();

create trigger set_tiktok_daily_metrics_updated_at
  before update on public.tiktok_account_daily_metrics
  for each row execute function public.set_updated_at();

create trigger set_tiktok_media_updated_at
  before update on public.tiktok_media
  for each row execute function public.set_updated_at();

alter table public.tiktok_connections enable row level security;
alter table public.tiktok_oauth_states enable row level security;
alter table public.tiktok_account_daily_metrics enable row level security;
alter table public.tiktok_media enable row level security;
alter table public.tiktok_sync_runs enable row level security;

create policy tiktok_connections_select_admin_or_client
  on public.tiktok_connections for select
  to authenticated
  using (
    archived_at is null
    and (
      public.is_agency_admin(agency_id)
      or public.has_client_access(client_account_id)
    )
  );

create policy tiktok_daily_select_admin_or_client
  on public.tiktok_account_daily_metrics for select
  to authenticated
  using (
    public.is_agency_admin(agency_id)
    or public.has_client_access(client_account_id)
  );

create policy tiktok_media_select_admin_or_client
  on public.tiktok_media for select
  to authenticated
  using (
    public.is_agency_admin(agency_id)
    or public.has_client_access(client_account_id)
  );

create policy tiktok_sync_runs_select_admin_or_client
  on public.tiktok_sync_runs for select
  to authenticated
  using (
    public.is_agency_admin(agency_id)
    or public.has_client_access(client_account_id)
  );

create or replace function public.upsert_tiktok_connection_secret(
  p_agency_id uuid,
  p_client_account_id uuid,
  p_open_id text,
  p_union_id text,
  p_username text,
  p_display_name text,
  p_profile_picture_url text,
  p_profile_url text,
  p_access_token text,
  p_refresh_token text,
  p_token_expires_at timestamptz,
  p_refresh_token_expires_at timestamptz,
  p_connected_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection public.tiktok_connections%rowtype;
  v_access_secret_id uuid;
  v_refresh_secret_id uuid;
begin
  select *
  into v_connection
  from public.tiktok_connections connection
  where connection.agency_id = p_agency_id
    and connection.open_id = trim(p_open_id)
  for update;

  if v_connection.id is not null
    and v_connection.client_account_id is distinct from p_client_account_id then
    raise exception 'This TikTok account is already connected to another workspace.';
  end if;

  if v_connection.id is null then
    select vault.create_secret(
      p_access_token,
      'realty-media-tiktok-access-' || p_agency_id::text || '-' || trim(p_open_id),
      'TikTok access token for Realty Media connection'
    )
    into v_access_secret_id;

    select vault.create_secret(
      p_refresh_token,
      'realty-media-tiktok-refresh-' || p_agency_id::text || '-' || trim(p_open_id),
      'TikTok refresh token for Realty Media connection'
    )
    into v_refresh_secret_id;

    insert into public.tiktok_connections (
      agency_id,
      client_account_id,
      open_id,
      union_id,
      username,
      display_name,
      profile_picture_url,
      profile_url,
      token_secret_id,
      refresh_token_secret_id,
      token_expires_at,
      refresh_token_expires_at,
      status,
      connected_by,
      connected_at,
      next_sync_at
    )
    values (
      p_agency_id,
      p_client_account_id,
      trim(p_open_id),
      nullif(trim(p_union_id), ''),
      nullif(trim(p_username), ''),
      nullif(trim(p_display_name), ''),
      nullif(trim(p_profile_picture_url), ''),
      nullif(trim(p_profile_url), ''),
      v_access_secret_id,
      v_refresh_secret_id,
      p_token_expires_at,
      p_refresh_token_expires_at,
      'active',
      p_connected_by,
      now(),
      now()
    )
    returning * into v_connection;
  else
    v_access_secret_id := v_connection.token_secret_id;
    v_refresh_secret_id := v_connection.refresh_token_secret_id;

    if v_access_secret_id is null then
      select vault.create_secret(
        p_access_token,
        'realty-media-tiktok-access-' || p_agency_id::text || '-' || trim(p_open_id),
        'TikTok access token for Realty Media connection'
      )
      into v_access_secret_id;
    else
      perform vault.update_secret(v_access_secret_id, p_access_token);
    end if;

    if v_refresh_secret_id is null then
      select vault.create_secret(
        p_refresh_token,
        'realty-media-tiktok-refresh-' || p_agency_id::text || '-' || trim(p_open_id),
        'TikTok refresh token for Realty Media connection'
      )
      into v_refresh_secret_id;
    else
      perform vault.update_secret(v_refresh_secret_id, p_refresh_token);
    end if;

    update public.tiktok_connections
    set
      union_id = nullif(trim(p_union_id), ''),
      username = nullif(trim(p_username), ''),
      display_name = nullif(trim(p_display_name), ''),
      profile_picture_url = nullif(trim(p_profile_picture_url), ''),
      profile_url = nullif(trim(p_profile_url), ''),
      token_secret_id = v_access_secret_id,
      refresh_token_secret_id = v_refresh_secret_id,
      token_expires_at = p_token_expires_at,
      refresh_token_expires_at = p_refresh_token_expires_at,
      status = 'active',
      connected_by = p_connected_by,
      connected_at = now(),
      last_sync_error = null,
      next_sync_at = now(),
      archived_at = null
    where id = v_connection.id
    returning * into v_connection;
  end if;

  return v_connection.id;
end;
$$;

create or replace function public.get_tiktok_connection_secrets(
  p_connection_id uuid
)
returns table (
  access_token text,
  refresh_token text
)
language sql
security definer
set search_path = ''
as $$
  select access_secret.decrypted_secret, refresh_secret.decrypted_secret
  from public.tiktok_connections connection
  left join vault.decrypted_secrets access_secret
    on access_secret.id = connection.token_secret_id
  left join vault.decrypted_secrets refresh_secret
    on refresh_secret.id = connection.refresh_token_secret_id
  where connection.id = p_connection_id
    and connection.archived_at is null
    and connection.status <> 'disconnected';
$$;

create or replace function public.update_tiktok_connection_secrets(
  p_connection_id uuid,
  p_access_token text,
  p_refresh_token text,
  p_token_expires_at timestamptz,
  p_refresh_token_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection public.tiktok_connections%rowtype;
begin
  select *
  into v_connection
  from public.tiktok_connections
  where id = p_connection_id
  for update;

  if v_connection.id is null then
    raise exception 'TikTok connection not found.';
  end if;

  if v_connection.token_secret_id is null or v_connection.refresh_token_secret_id is null then
    raise exception 'TikTok connection token secrets are missing.';
  end if;

  perform vault.update_secret(v_connection.token_secret_id, p_access_token);
  perform vault.update_secret(v_connection.refresh_token_secret_id, p_refresh_token);

  update public.tiktok_connections
  set
    token_expires_at = p_token_expires_at,
    refresh_token_expires_at = p_refresh_token_expires_at
  where id = p_connection_id;
end;
$$;

create or replace function public.disconnect_tiktok_connection(
  p_connection_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_access_secret_id uuid;
  v_refresh_secret_id uuid;
begin
  select token_secret_id, refresh_token_secret_id
  into v_access_secret_id, v_refresh_secret_id
  from public.tiktok_connections
  where id = p_connection_id
  for update;

  update public.tiktok_connections
  set
    status = 'disconnected',
    token_secret_id = null,
    refresh_token_secret_id = null,
    last_sync_error = null,
    next_sync_at = now() + interval '100 years'
  where id = p_connection_id;

  if v_access_secret_id is not null then
    delete from vault.secrets where id = v_access_secret_id;
  end if;

  if v_refresh_secret_id is not null then
    delete from vault.secrets where id = v_refresh_secret_id;
  end if;
end;
$$;

revoke all on function public.upsert_tiktok_connection_secret(
  uuid, uuid, text, text, text, text, text, text, text, text, timestamptz, timestamptz, uuid
) from public, anon, authenticated;
revoke all on function public.get_tiktok_connection_secrets(uuid)
  from public, anon, authenticated;
revoke all on function public.update_tiktok_connection_secrets(
  uuid, text, text, timestamptz, timestamptz
) from public, anon, authenticated;
revoke all on function public.disconnect_tiktok_connection(uuid)
  from public, anon, authenticated;

grant execute on function public.upsert_tiktok_connection_secret(
  uuid, uuid, text, text, text, text, text, text, text, text, timestamptz, timestamptz, uuid
) to service_role;
grant execute on function public.get_tiktok_connection_secrets(uuid)
  to service_role;
grant execute on function public.update_tiktok_connection_secrets(
  uuid, text, text, timestamptz, timestamptz
) to service_role;
grant execute on function public.disconnect_tiktok_connection(uuid)
  to service_role;

create trigger audit_tiktok_connections_changes
  after insert or update or delete on public.tiktok_connections
  for each row execute function public.audit_row_change();

commit;
