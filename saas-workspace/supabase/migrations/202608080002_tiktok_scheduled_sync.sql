begin;

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.request_tiktok_scheduled_sync()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_id bigint;
  v_sync_secret text;
begin
  select secret.decrypted_secret
  into v_sync_secret
  from vault.decrypted_secrets secret
  where secret.name = 'realty-media-tiktok-sync-secret'
  limit 1;

  if nullif(v_sync_secret, '') is null then
    raise exception 'TikTok scheduled sync secret is not configured in Vault.';
  end if;

  select net.http_post(
    url := 'https://iivfqkqbvdugjxvjyvfr.supabase.co/functions/v1/tiktok-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-tiktok-sync-secret', v_sync_secret
    ),
    body := '{"allDue":true}'::jsonb,
    timeout_milliseconds := 120000
  )
  into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.request_tiktok_scheduled_sync()
  from public, anon, authenticated;

do $$
declare
  v_existing_job bigint;
begin
  select jobid
  into v_existing_job
  from cron.job
  where jobname = 'tiktok-analytics-sync';

  if v_existing_job is not null then
    perform cron.unschedule(v_existing_job);
  end if;

  perform cron.schedule(
    'tiktok-analytics-sync',
    '*/15 * * * *',
    'select public.request_tiktok_scheduled_sync();'
  );
end
$$;

commit;
