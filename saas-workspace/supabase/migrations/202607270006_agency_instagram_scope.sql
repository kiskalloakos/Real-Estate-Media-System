begin;

alter table public.instagram_connections
  alter column client_account_id drop not null;

alter table public.instagram_oauth_states
  alter column client_account_id drop not null;

alter table public.instagram_account_daily_metrics
  alter column client_account_id drop not null;

alter table public.instagram_media
  alter column client_account_id drop not null;

alter table public.instagram_sync_runs
  alter column client_account_id drop not null;

do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select
      constraint_record.conname,
      constraint_record.conrelid::regclass as table_name
    from pg_constraint constraint_record
    where constraint_record.contype = 'f'
      and constraint_record.confrelid = 'public.instagram_connections'::regclass
  loop
    execute format(
      'alter table %s drop constraint %I',
      constraint_row.table_name,
      constraint_row.conname
    );
  end loop;
end
$$;

alter table public.instagram_connections
  add constraint instagram_connections_id_agency_key
  unique (id, agency_id);

alter table public.instagram_account_daily_metrics
  add constraint instagram_daily_connection_agency_fkey
  foreign key (connection_id, agency_id)
  references public.instagram_connections(id, agency_id)
  on delete cascade;

alter table public.instagram_media
  add constraint instagram_media_connection_agency_fkey
  foreign key (connection_id, agency_id)
  references public.instagram_connections(id, agency_id)
  on delete cascade;

alter table public.instagram_sync_runs
  add constraint instagram_sync_runs_connection_agency_fkey
  foreign key (connection_id, agency_id)
  references public.instagram_connections(id, agency_id)
  on delete cascade;

create index instagram_connections_agency_scope_idx
  on public.instagram_connections (agency_id, status, created_at desc)
  where client_account_id is null and archived_at is null;

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
    and v_connection.client_account_id is distinct from p_client_account_id then
    raise exception 'This Instagram account is already connected in another workspace.';
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

revoke all on function public.upsert_instagram_connection_secret(
  uuid, uuid, text, text, text, text, text, text, text, timestamptz, uuid
) from public, anon, authenticated;

grant execute on function public.upsert_instagram_connection_secret(
  uuid, uuid, text, text, text, text, text, text, text, timestamptz, uuid
) to service_role;

commit;
