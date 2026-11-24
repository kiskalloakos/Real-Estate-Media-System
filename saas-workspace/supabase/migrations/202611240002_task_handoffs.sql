-- Agencies link individual tasks; no templates or generated workflows.
begin;
alter table public.tasks
  add column waits_for_task_id uuid,
  add column handoff_ready_at timestamptz,
  add constraint tasks_handoff_requires_project check (waits_for_task_id is null or job_id is not null),
  add constraint tasks_handoff_not_self check (waits_for_task_id is distinct from id),
  add constraint tasks_handoff_agency_fk foreign key (waits_for_task_id, agency_id)
    references public.tasks(id, agency_id) on delete restrict;
create index tasks_handoff_idx on public.tasks(waits_for_task_id) where waits_for_task_id is not null;

create function public.prepare_task_handoff() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  prerequisite public.tasks;
  link_changed boolean;
begin
  link_changed := tg_op = 'INSERT';
  if tg_op = 'UPDATE' then
    link_changed := new.waits_for_task_id is distinct from old.waits_for_task_id
      or new.job_id is distinct from old.job_id;
  end if;
  if link_changed and (new.waits_for_task_id is not null or
    (tg_op = 'UPDATE' and old.waits_for_task_id is not null)) then
    if auth.uid() is not null and not public.is_agency_admin(new.agency_id) then
      raise exception 'Only agency admins can change task handoffs';
    end if;
    -- Serialize graph changes in one project so concurrent edits cannot form a cycle.
    perform 1 from public.jobs where id = new.job_id and agency_id = new.agency_id for update;
  end if;
  if tg_op = 'UPDATE' and new.job_id is distinct from old.job_id and exists (
    select 1 from public.tasks where waits_for_task_id = new.id
  ) then raise exception 'Unlink dependent tasks before moving this task to another project'; end if;

  -- This value is derived on the server, including for callers who cannot read the preceding task.
  new.handoff_ready_at := null;
  if new.waits_for_task_id is null then return new; end if;
  select * into prerequisite from public.tasks
    where id = new.waits_for_task_id and agency_id = new.agency_id;
  if not found or prerequisite.job_id is distinct from new.job_id or new.job_id is null then
    raise exception 'The preceding task must belong to the same project';
  end if;
  if link_changed then
    if prerequisite.archived_at is not null then raise exception 'Choose an active preceding task'; end if;
    if exists (
      with recursive chain as (
        select id, waits_for_task_id from public.tasks where id = new.waits_for_task_id
        union
        select t.id, t.waits_for_task_id from public.tasks t join chain c on t.id = c.waits_for_task_id
      ) select 1 from chain where id = new.id
    ) then raise exception 'Task handoffs cannot form a loop'; end if;
  end if;
  if prerequisite.status = 'done' and prerequisite.archived_at is null then
    new.handoff_ready_at := prerequisite.completed_at;
  end if;
  if new.handoff_ready_at is null and new.status in ('in_progress', 'done') and (
    tg_op = 'INSERT' or new.status is distinct from old.status or link_changed
  ) then raise exception 'Complete the preceding task before starting or completing this task'; end if;
  return new;
end; $$;
revoke all on function public.prepare_task_handoff() from public, anon, authenticated;
create trigger tasks_prepare_handoff before insert or update on public.tasks
  for each row execute function public.prepare_task_handoff();

create function public.dispatch_task_handoff() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and (
    new.status is distinct from old.status or new.completed_at is distinct from old.completed_at
    or new.archived_at is distinct from old.archived_at
  ) then
    -- The before trigger recalculates readiness. It never starts another person's work.
    update public.tasks set handoff_ready_at = null
      where waits_for_task_id = new.id and archived_at is null;
  end if;
  if new.waits_for_task_id is not null and new.handoff_ready_at is not null
    and new.archived_at is null and new.status in ('todo', 'blocked')
    and exists (
      select 1 from public.agency_memberships m
      where m.agency_id = new.agency_id and m.user_id = new.assignee_user_id and m.status = 'active'
        and (m.role = 'admin' or (m.role = 'team_member' and new.visibility <> 'admin_only')
          or (m.role = 'client' and new.visibility = 'client' and exists (
            select 1 from public.client_memberships c where c.agency_id = new.agency_id
              and c.client_account_id = new.client_account_id and c.user_id = m.user_id and c.status = 'active'
          )))
    ) then
    perform public.create_user_notification(
      new.agency_id, new.assignee_user_id, 'task', 'Task ready: ' || new.title,
      'The preceding task is complete. Your task is ready to start.',
      'tasks', '/(portal)/(more)/tasks', 'task', new.id,
      'handoff:' || new.id::text || ':' || new.waits_for_task_id::text || ':' || new.handoff_ready_at::text,
      jsonb_build_object('reason', 'handoff_ready', 'task_id', new.id)
    );
  end if;
  return new;
end; $$;
revoke all on function public.dispatch_task_handoff() from public, anon, authenticated;
create trigger tasks_dispatch_handoff after insert or update on public.tasks
  for each row execute function public.dispatch_task_handoff();
commit;
