begin;

-- Notifications are an individual inbox, not an activity feed. Property access
-- continues to control which work someone can open, while only an explicit
-- assignment may create a task or calendar alert for that person.
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
      (
        membership.role = 'team_member'
        and p_visibility <> 'admin_only'
        and p_property_id is not null
        and exists (
          select 1
          from public.property_team_assignments assignment
          where assignment.agency_id = p_agency_id
            and assignment.property_id = p_property_id
            and assignment.user_id = membership.user_id
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

create or replace function public.notify_task_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := coalesce(auth.uid(), new.created_by);
  v_body text;
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

  if new.assignee_user_id is null or new.assignee_user_id = v_actor_id then
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

  perform public.create_user_notification(
    new.agency_id,
    new.assignee_user_id,
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

  return new;
end;
$$;

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
    select assignment.user_id
    from public.calendar_event_assignees assignment
    where assignment.calendar_event_id = new.id
      and assignment.user_id <> v_actor_id
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

  if not new.client_visible then
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
    select membership.user_id
    from public.client_memberships membership
    where membership.agency_id = new.agency_id
      and membership.client_account_id = new.client_account_id
      and membership.status = 'active'
      and membership.user_id <> v_actor_id
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

-- Remove historic feed-style entries that would no longer be delivered to the
-- current recipient. Personal system messages and review feedback are retained.
delete from public.notifications notification
using public.tasks task
where notification.entity_type = 'task'
  and notification.entity_id = task.id
  and notification.recipient_user_id is distinct from task.assignee_user_id;

delete from public.notifications notification
where notification.entity_type = 'calendar_event'
  and not exists (
    select 1
    from public.calendar_event_assignees assignment
    where assignment.calendar_event_id = notification.entity_id
      and assignment.user_id = notification.recipient_user_id
  );

delete from public.notifications notification
where notification.entity_type = 'payment_schedule_item'
  and not exists (
    select 1
    from public.payment_schedule_items payment
    join public.client_memberships membership
      on membership.agency_id = payment.agency_id
      and membership.client_account_id = payment.client_account_id
      and membership.user_id = notification.recipient_user_id
      and membership.status = 'active'
    where payment.id = notification.entity_id
  );

commit;
