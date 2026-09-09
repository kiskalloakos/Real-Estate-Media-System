begin;

create extension if not exists pg_net with schema extensions;

create type public.notification_kind as enum (
  'review',
  'task',
  'calendar',
  'payment',
  'system'
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  kind public.notification_kind not null,
  title text not null,
  body text not null,
  web_screen text not null default 'dashboard',
  native_route text,
  entity_type text,
  entity_id uuid,
  dedupe_key text,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (length(trim(title)) > 0),
  check (length(trim(body)) > 0),
  check (
    web_screen in (
      'dashboard',
      'clients',
      'team',
      'members',
      'properties',
      'reviews',
      'tasks',
      'calendar',
      'billing',
      'gear',
      'finances'
    )
  )
);

create unique index notifications_recipient_dedupe_unique
  on public.notifications(recipient_user_id, dedupe_key)
  where dedupe_key is not null;

create index notifications_recipient_created_idx
  on public.notifications(recipient_user_id, created_at desc);

create index notifications_recipient_unread_idx
  on public.notifications(recipient_user_id, created_at desc)
  where read_at is null;

create table public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  in_app_enabled boolean not null default true,
  push_enabled boolean not null default false,
  reviews_enabled boolean not null default true,
  tasks_enabled boolean not null default true,
  calendar_enabled boolean not null default true,
  payments_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  device_name text,
  app_version text,
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    expo_push_token like 'ExpoPushToken[%'
    or expo_push_token like 'ExponentPushToken[%'
  )
);

create index push_devices_user_enabled_idx
  on public.push_devices(user_id, enabled);

create trigger set_notification_preferences_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();

create trigger set_push_devices_updated_at
  before update on public.push_devices
  for each row execute function public.set_updated_at();

create or replace function public.protect_push_device_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id <> old.id
    or new.user_id <> old.user_id
    or new.expo_push_token <> old.expo_push_token
    or new.created_at <> old.created_at then
    raise exception 'Push device identity is immutable';
  end if;

  return new;
end;
$$;

create trigger protect_push_device_identity_before_update
  before update on public.push_devices
  for each row execute function public.protect_push_device_identity();

create or replace function public.protect_notification_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id <> old.id
    or new.agency_id <> old.agency_id
    or new.recipient_user_id <> old.recipient_user_id
    or new.kind <> old.kind
    or new.title <> old.title
    or new.body <> old.body
    or new.web_screen <> old.web_screen
    or new.native_route is distinct from old.native_route
    or new.entity_type is distinct from old.entity_type
    or new.entity_id is distinct from old.entity_id
    or new.dedupe_key is distinct from old.dedupe_key
    or new.metadata <> old.metadata
    or new.created_at <> old.created_at then
    raise exception 'Only notification read state can be changed';
  end if;

  return new;
end;
$$;

create trigger protect_notification_before_update
  before update on public.notifications
  for each row execute function public.protect_notification_update();

alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.push_devices enable row level security;

create policy notifications_select_own
  on public.notifications for select
  to authenticated
  using (recipient_user_id = auth.uid());

create policy notifications_update_own
  on public.notifications for update
  to authenticated
  using (recipient_user_id = auth.uid())
  with check (recipient_user_id = auth.uid());

create policy notification_preferences_select_own
  on public.notification_preferences for select
  to authenticated
  using (user_id = auth.uid());

create policy notification_preferences_insert_own
  on public.notification_preferences for insert
  to authenticated
  with check (user_id = auth.uid());

create policy notification_preferences_update_own
  on public.notification_preferences for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy push_devices_select_own
  on public.push_devices for select
  to authenticated
  using (user_id = auth.uid());

create policy push_devices_insert_own
  on public.push_devices for insert
  to authenticated
  with check (user_id = auth.uid());

create policy push_devices_update_own
  on public.push_devices for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy push_devices_delete_own
  on public.push_devices for delete
  to authenticated
  using (user_id = auth.uid());

grant select, update on public.notifications to authenticated;
grant select, insert, update on public.notification_preferences to authenticated;
grant select, insert, update, delete on public.push_devices to authenticated;
grant usage on type public.notification_kind to authenticated;

create or replace function public.create_user_notification(
  p_agency_id uuid,
  p_recipient_user_id uuid,
  p_kind public.notification_kind,
  p_title text,
  p_body text,
  p_web_screen text,
  p_native_route text default null,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_dedupe_key text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_notification_id uuid;
begin
  if not exists (
    select 1
    from public.agency_memberships membership
    where membership.agency_id = p_agency_id
      and membership.user_id = p_recipient_user_id
      and membership.status = 'active'
  ) then
    return null;
  end if;

  insert into public.notifications (
    agency_id,
    recipient_user_id,
    kind,
    title,
    body,
    web_screen,
    native_route,
    entity_type,
    entity_id,
    dedupe_key,
    metadata
  )
  values (
    p_agency_id,
    p_recipient_user_id,
    p_kind,
    trim(p_title),
    trim(p_body),
    p_web_screen,
    p_native_route,
    p_entity_type,
    p_entity_id,
    p_dedupe_key,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict do nothing
  returning id into v_notification_id;

  return v_notification_id;
end;
$$;

revoke all on function public.create_user_notification(
  uuid,
  uuid,
  public.notification_kind,
  text,
  text,
  text,
  text,
  text,
  uuid,
  text,
  jsonb
) from public, anon, authenticated;

create or replace function public.notification_recipients_for_property(
  p_agency_id uuid,
  p_property_id uuid,
  p_client_account_id uuid,
  p_visibility public.record_visibility,
  p_include_clients boolean default true
)
returns table(user_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct membership.user_id
  from public.agency_memberships membership
  where membership.agency_id = p_agency_id
    and membership.status = 'active'
    and (
      membership.role = 'admin'
      or (
        membership.role = 'team_member'
        and p_visibility <> 'admin_only'
        and (
          p_property_id is null
          or exists (
            select 1
            from public.property_team_assignments assignment
            where assignment.agency_id = p_agency_id
              and assignment.property_id = p_property_id
              and assignment.user_id = membership.user_id
          )
        )
      )
      or (
        membership.role = 'client'
        and p_include_clients
        and p_visibility = 'client'
        and p_client_account_id is not null
        and exists (
          select 1
          from public.client_memberships client_membership
          where client_membership.agency_id = p_agency_id
            and client_membership.client_account_id = p_client_account_id
            and client_membership.user_id = membership.user_id
            and client_membership.status = 'active'
        )
      )
    );
$$;

revoke all on function public.notification_recipients_for_property(
  uuid,
  uuid,
  uuid,
  public.record_visibility,
  boolean
) from public, anon, authenticated;

create or replace function public.dispatch_notification_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_badge_count integer;
  v_messages jsonb;
begin
  select count(*)::integer
  into v_badge_count
  from public.notifications notification
  where notification.recipient_user_id = new.recipient_user_id
    and notification.read_at is null;

  select jsonb_agg(
    jsonb_build_object(
      'to', device.expo_push_token,
      'title', new.title,
      'body', new.body,
      'sound', 'default',
      'badge', v_badge_count,
      'data', jsonb_build_object(
        'notificationId', new.id,
        'route', new.native_route,
        'screen', new.web_screen,
        'kind', new.kind
      )
    )
  )
  into v_messages
  from public.push_devices device
  join public.notification_preferences preference
    on preference.user_id = device.user_id
  where device.user_id = new.recipient_user_id
    and device.enabled
    and preference.push_enabled
    and case new.kind
      when 'review' then preference.reviews_enabled
      when 'task' then preference.tasks_enabled
      when 'calendar' then preference.calendar_enabled
      when 'payment' then preference.payments_enabled
      else true
    end;

  if v_messages is not null then
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := jsonb_build_object(
        'Accept', 'application/json',
        'Content-Type', 'application/json'
      ),
      body := v_messages,
      timeout_milliseconds := 5000
    );
  end if;

  return new;
exception
  when others then
    return new;
end;
$$;

create trigger dispatch_notification_push_after_insert
  after insert on public.notifications
  for each row execute function public.dispatch_notification_push();

create or replace function public.register_push_device(
  p_expo_push_token text,
  p_platform text,
  p_device_name text default null,
  p_app_version text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agency_id uuid;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_platform not in ('ios', 'android') then
    raise exception 'Unsupported push platform';
  end if;

  if not (
    p_expo_push_token like 'ExpoPushToken[%'
    or p_expo_push_token like 'ExponentPushToken[%'
  ) then
    raise exception 'Invalid Expo push token';
  end if;

  select membership.agency_id
  into v_agency_id
  from public.agency_memberships membership
  where membership.user_id = v_user_id
    and membership.status = 'active'
  order by
    case membership.role when 'admin' then 0 when 'team_member' then 1 else 2 end,
    membership.created_at
  limit 1;

  if v_agency_id is null then
    raise exception 'Active agency membership required';
  end if;

  insert into public.notification_preferences (user_id, push_enabled)
  values (v_user_id, true)
  on conflict (user_id) do update
    set push_enabled = true,
        updated_at = now();

  insert into public.push_devices (
    user_id,
    expo_push_token,
    platform,
    device_name,
    app_version,
    enabled,
    last_seen_at
  )
  values (
    v_user_id,
    p_expo_push_token,
    p_platform,
    nullif(trim(p_device_name), ''),
    nullif(trim(p_app_version), ''),
    true,
    now()
  )
  on conflict (expo_push_token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        device_name = excluded.device_name,
        app_version = excluded.app_version,
        enabled = true,
        last_seen_at = now(),
        updated_at = now();

  perform public.create_user_notification(
    v_agency_id,
    v_user_id,
    'system',
    'Push notifications enabled',
    'This device is connected to the Realty Media notification service.',
    'dashboard',
    '/(portal)/(home)',
    'push_device',
    null,
    'push-enabled:' || p_expo_push_token,
    jsonb_build_object('platform', p_platform)
  );
end;
$$;

grant execute on function public.register_push_device(text, text, text, text)
  to authenticated;

create or replace function public.disable_push_device(
  p_expo_push_token text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  update public.push_devices
  set enabled = false,
      updated_at = now()
  where user_id = v_user_id
    and expo_push_token = p_expo_push_token;

  update public.notification_preferences
  set push_enabled = false,
      updated_at = now()
  where user_id = v_user_id;
end;
$$;

grant execute on function public.disable_push_device(text)
  to authenticated;

create or replace function public.notify_review_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_name text;
  v_asset_title text;
  v_client_account_id uuid;
  v_property_id uuid;
  v_recipient uuid;
begin
  select
    asset.title,
    asset.property_id,
    property.client_account_id,
    coalesce(nullif(trim(profile.full_name), ''), 'A workspace member')
  into
    v_asset_title,
    v_property_id,
    v_client_account_id,
    v_actor_name
  from public.media_assets asset
  join public.properties property on property.id = asset.property_id
  left join public.profiles profile on profile.id = new.author_id
  where asset.id = new.media_asset_id;

  for v_recipient in
    select recipient.user_id
    from public.notification_recipients_for_property(
      new.agency_id,
      v_property_id,
      v_client_account_id,
      case when new.visibility = 'client'
        then 'client'::public.record_visibility
        else 'team'::public.record_visibility
      end,
      new.visibility = 'client'
    ) recipient
    where recipient.user_id <> new.author_id
  loop
    perform public.create_user_notification(
      new.agency_id,
      v_recipient,
      'review',
      'New comment on ' || v_asset_title,
      v_actor_name || case
        when new.timestamp_seconds is not null
          then ' commented at ' ||
            floor(new.timestamp_seconds / 60)::text || ':' ||
            lpad(floor(mod(new.timestamp_seconds, 60))::text, 2, '0') || '.'
        else ' left review feedback.'
      end,
      'reviews',
      '/(portal)/(reviews)/' || new.media_asset_id::text,
      'review_comment',
      new.id,
      'review-comment:' || new.id::text,
      jsonb_build_object('mediaAssetId', new.media_asset_id)
    );
  end loop;

  return new;
end;
$$;

create trigger notify_review_comment_after_insert
  after insert on public.review_comments
  for each row execute function public.notify_review_comment();

create or replace function public.notify_review_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asset_title text;
  v_body text;
  v_client_account_id uuid;
  v_property_id uuid;
  v_recipient uuid;
  v_title text;
begin
  select asset.title, asset.property_id, property.client_account_id
  into v_asset_title, v_property_id, v_client_account_id
  from public.media_assets asset
  join public.properties property on property.id = asset.property_id
  where asset.id = new.media_asset_id;

  v_title := case new.decision
    when 'ready_for_review' then 'Ready for review: ' || v_asset_title
    when 'changes_requested' then 'Changes requested: ' || v_asset_title
    when 'approved' then 'Approved: ' || v_asset_title
    else 'Approval reopened: ' || v_asset_title
  end;

  v_body := coalesce(nullif(trim(new.note), ''), case new.decision
    when 'ready_for_review' then 'A new version is ready for feedback.'
    when 'changes_requested' then 'The review needs another editing pass.'
    when 'approved' then 'The latest version has been approved.'
    else 'The review has been reopened.'
  end);

  for v_recipient in
    select recipient.user_id
    from public.notification_recipients_for_property(
      new.agency_id,
      v_property_id,
      v_client_account_id,
      'client',
      true
    ) recipient
    where recipient.user_id <> new.actor_id
  loop
    perform public.create_user_notification(
      new.agency_id,
      v_recipient,
      'review',
      v_title,
      v_body,
      'reviews',
      '/(portal)/(reviews)/' || new.media_asset_id::text,
      'review_approval_event',
      new.id,
      'review-decision:' || new.id::text,
      jsonb_build_object(
        'decision', new.decision,
        'mediaAssetId', new.media_asset_id
      )
    );
  end loop;

  return new;
end;
$$;

create trigger notify_review_decision_after_insert
  after insert on public.review_approval_events
  for each row execute function public.notify_review_decision();

create or replace function public.notify_task_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := coalesce(auth.uid(), new.created_by);
  v_body text;
  v_recipient uuid;
  v_title text;
begin
  if tg_op = 'UPDATE'
    and new.title is not distinct from old.title
    and new.status is not distinct from old.status
    and new.priority is not distinct from old.priority
    and new.due_at is not distinct from old.due_at
    and new.assignee_user_id is not distinct from old.assignee_user_id
    and new.archived_at is not distinct from old.archived_at then
    return new;
  end if;

  v_title := case
    when new.archived_at is not null then 'Task archived: '
    when tg_op = 'INSERT' then 'New task: '
    else 'Task updated: '
  end || new.title;

  v_body := case
    when new.archived_at is not null then 'This task has been archived.'
    when new.status = 'done' then 'This task is now complete.'
    when new.due_at is not null then
      initcap(replace(new.status::text, '_', ' ')) ||
      ' · due ' || to_char(new.due_at, 'DD Mon, HH24:MI')
    else initcap(replace(new.status::text, '_', ' '))
  end;

  for v_recipient in
    select distinct recipient_id
    from (
      select recipient.user_id as recipient_id
      from public.notification_recipients_for_property(
        new.agency_id,
        new.property_id,
        new.client_account_id,
        new.visibility,
        true
      ) recipient
      union
      select new.assignee_user_id
      where new.assignee_user_id is not null
    ) recipients
    where recipient_id is not null
      and recipient_id <> v_actor_id
  loop
    perform public.create_user_notification(
      new.agency_id,
      v_recipient,
      'task',
      v_title,
      v_body,
      'tasks',
      '/(portal)/(more)/tasks',
      'task',
      new.id,
      'task:' || new.id::text || ':' || new.updated_at::text,
      jsonb_build_object('status', new.status, 'priority', new.priority)
    );
  end loop;

  return new;
end;
$$;

create trigger notify_task_activity_after_write
  after insert or update on public.tasks
  for each row execute function public.notify_task_activity();

create or replace function public.notify_calendar_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := coalesce(auth.uid(), new.created_by);
  v_body text;
  v_recipient uuid;
  v_timezone text;
  v_title text;
begin
  if tg_op = 'UPDATE'
    and new.title is not distinct from old.title
    and new.starts_at is not distinct from old.starts_at
    and new.ends_at is not distinct from old.ends_at
    and new.location is not distinct from old.location
    and new.visibility is not distinct from old.visibility
    and new.archived_at is not distinct from old.archived_at then
    return new;
  end if;

  select agency.timezone
  into v_timezone
  from public.agencies agency
  where agency.id = new.agency_id;

  v_title := case
    when new.archived_at is not null then 'Event cancelled: '
    when tg_op = 'INSERT' then 'New event: '
    else 'Event updated: '
  end || new.title;

  v_body := case
    when new.archived_at is not null then 'This calendar event has been removed.'
    when new.all_day then
      to_char(new.starts_at at time zone coalesce(v_timezone, 'Europe/Bucharest'), 'DD Mon') ||
      ' · All day'
    else
      to_char(new.starts_at at time zone coalesce(v_timezone, 'Europe/Bucharest'), 'DD Mon, HH24:MI')
  end || coalesce(' · ' || nullif(trim(new.location), ''), '');

  for v_recipient in
    select distinct recipient_id
    from (
      select recipient.user_id as recipient_id
      from public.notification_recipients_for_property(
        new.agency_id,
        new.property_id,
        new.client_account_id,
        new.visibility,
        true
      ) recipient
      union
      select assignee.user_id
      from public.calendar_event_assignees assignee
      where assignee.calendar_event_id = new.id
    ) recipients
    where recipient_id is not null
      and recipient_id <> v_actor_id
  loop
    perform public.create_user_notification(
      new.agency_id,
      v_recipient,
      'calendar',
      v_title,
      v_body,
      'calendar',
      '/(portal)/(calendar)/' || new.id::text,
      'calendar_event',
      new.id,
      'calendar:' || new.id::text || ':' || new.updated_at::text,
      jsonb_build_object('startsAt', new.starts_at)
    );
  end loop;

  return new;
end;
$$;

create trigger notify_calendar_activity_after_write
  after insert or update on public.calendar_events
  for each row execute function public.notify_calendar_activity();

create or replace function public.notify_calendar_assignee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.calendar_events%rowtype;
begin
  if new.user_id = auth.uid() then
    return new;
  end if;

  select *
  into v_event
  from public.calendar_events event
  where event.id = new.calendar_event_id;

  perform public.create_user_notification(
    new.agency_id,
    new.user_id,
    'calendar',
    'Added to event: ' || v_event.title,
    to_char(v_event.starts_at, 'DD Mon, HH24:MI') ||
      coalesce(' · ' || nullif(trim(v_event.location), ''), ''),
    'calendar',
    '/(portal)/(calendar)/' || new.calendar_event_id::text,
    'calendar_event',
    new.calendar_event_id,
    'calendar-assignee:' || new.id::text,
    jsonb_build_object('startsAt', v_event.starts_at)
  );

  return new;
end;
$$;

create trigger notify_calendar_assignee_after_insert
  after insert on public.calendar_event_assignees
  for each row execute function public.notify_calendar_assignee();

create or replace function public.notify_payment_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := coalesce(auth.uid(), new.created_by);
  v_body text;
  v_recipient uuid;
  v_title text;
begin
  if tg_op = 'UPDATE'
    and new.label is not distinct from old.label
    and new.due_on is not distinct from old.due_on
    and new.amount is not distinct from old.amount
    and new.status is not distinct from old.status
    and new.client_visible is not distinct from old.client_visible
    and new.archived_at is not distinct from old.archived_at then
    return new;
  end if;

  v_title := case
    when new.archived_at is not null then 'Payment removed'
    when new.status = 'paid' then 'Payment recorded'
    when tg_op = 'INSERT' then 'Upcoming payment'
    else 'Payment updated'
  end;

  v_body := coalesce(nullif(trim(new.label), ''), 'Scheduled payment') ||
    ' · ' || trim(to_char(new.amount, 'FM9999999990D00')) || ' ' || new.currency ||
    ' · ' || to_char(new.due_on, 'DD Mon YYYY');

  for v_recipient in
    select distinct membership.user_id
    from public.agency_memberships membership
    where membership.agency_id = new.agency_id
      and membership.status = 'active'
      and membership.user_id <> v_actor_id
      and (
        membership.role = 'admin'
        or (
          membership.role = 'client'
          and new.client_visible
          and exists (
            select 1
            from public.client_memberships client_membership
            where client_membership.agency_id = new.agency_id
              and client_membership.client_account_id = new.client_account_id
              and client_membership.user_id = membership.user_id
              and client_membership.status = 'active'
          )
        )
      )
  loop
    perform public.create_user_notification(
      new.agency_id,
      v_recipient,
      'payment',
      v_title,
      v_body,
      'billing',
      '/(portal)/(more)/deal',
      'payment_schedule_item',
      new.id,
      'payment:' || new.id::text || ':' || new.updated_at::text,
      jsonb_build_object('status', new.status, 'dueOn', new.due_on)
    );
  end loop;

  return new;
end;
$$;

create trigger notify_payment_activity_after_write
  after insert or update on public.payment_schedule_items
  for each row execute function public.notify_payment_activity();

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

insert into public.notifications (
  agency_id,
  recipient_user_id,
  kind,
  title,
  body,
  web_screen,
  native_route,
  entity_type,
  dedupe_key
)
select
  membership.agency_id,
  membership.user_id,
  'system',
  'Notifications are live',
  'Reviews, tasks, calendar changes, and payments now collect in one private inbox.',
  'dashboard',
  '/(portal)/(home)',
  'notification_system',
  'notifications-v1'
from public.agency_memberships membership
where membership.status = 'active'
on conflict do nothing;

commit;
