-- Run the entire file. Fresh test agencies, users and notifications are rolled back.
begin;
set local statement_timeout = '30s';
create function pg_temp.handoff_assert(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %', message; end if; end; $$;
create function pg_temp.handoff_reject(statement text, expected text) returns void language plpgsql as $$
declare rejected boolean := false; begin
  begin execute statement; exception when others then
    if sqlerrm ilike '%' || expected || '%' then rejected := true; else raise; end if;
  end;
  perform pg_temp.handoff_assert(rejected, 'Expected rejection: ' || expected);
end; $$;
create temporary table handoff_test_context (
  owner_a uuid default gen_random_uuid(), owner_b uuid default gen_random_uuid(),
  editor uuid default gen_random_uuid(), agency_a uuid, agency_b uuid,
  project_a uuid default gen_random_uuid(), project_b uuid default gen_random_uuid(),
  film uuid default gen_random_uuid(), edit uuid default gen_random_uuid(),
  completion timestamptz default clock_timestamp()
);
insert into handoff_test_context default values;
grant select on handoff_test_context to authenticated;
insert into auth.users(id, email, email_confirmed_at, raw_user_meta_data)
select owner_a, owner_a::text || '@example.invalid', now(),
  '{"signup_role":"agency_owner","agency_name":"Handoff verification A","full_name":"Handoff owner A"}'::jsonb from handoff_test_context
union all select owner_b, owner_b::text || '@example.invalid', now(),
  '{"signup_role":"agency_owner","agency_name":"Handoff verification B","full_name":"Handoff owner B"}'::jsonb from handoff_test_context;
insert into auth.users(id, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
select editor, editor::text || '@example.invalid', now(), '{"agency_provisioned":true}',
  '{"role":"team_member","full_name":"Handoff editor"}' from handoff_test_context;
update handoff_test_context set
  agency_a = (select agency_id from public.agency_memberships where user_id = owner_a),
  agency_b = (select agency_id from public.agency_memberships where user_id = owner_b);
select set_config('request.jwt.claim.sub', owner_a::text, true) from handoff_test_context;
set local role authenticated;
select public.admin_attach_team_user(agency_a, editor, 'Handoff editor') from handoff_test_context;
insert into public.jobs(id, agency_id, name, kind, created_by)
select project_a, agency_a, 'Handoff test shoot', 'internal'::public.job_kind, owner_a from handoff_test_context
union all select project_b, agency_a, 'Other engagement', 'internal'::public.job_kind, owner_a from handoff_test_context;
insert into public.tasks(id,agency_id,job_id,title,created_by,assignee_user_id,visibility)
select film,agency_a,project_a,'Private filming details',owner_a,owner_a,'admin_only' from handoff_test_context;
insert into public.tasks(id,agency_id,job_id,title,created_by,assignee_user_id,waits_for_task_id)
select edit,agency_a,project_a,'Edit the reel',owner_a,editor,film from handoff_test_context;
select pg_temp.handoff_assert(not exists(select 1 from public.notifications where metadata->>'reason'='handoff_ready'), 'no premature handoff');
select pg_temp.handoff_reject(format('update public.tasks set waits_for_task_id=%L where id=%L',edit,film),'cannot form a loop') from handoff_test_context;
select pg_temp.handoff_reject(format('update public.tasks set job_id=%L where id=%L',project_b,edit),'same project') from handoff_test_context;
select pg_temp.handoff_reject(format('update public.tasks set job_id=%L where id=%L',project_b,film),'Unlink dependent tasks') from handoff_test_context;

reset role;
select set_config('request.jwt.claim.sub', editor::text, true) from handoff_test_context;
set local role authenticated;
select pg_temp.handoff_assert(not exists(select 1 from public.tasks where id=(select film from handoff_test_context)), 'editor cannot read private filming details');
select pg_temp.handoff_reject(format('update public.tasks set waits_for_task_id=null where id=%L',edit),'Only agency admins') from handoff_test_context;
select pg_temp.handoff_reject(format('update public.tasks set status=%L where id=%L','in_progress',edit),'Complete the preceding task') from handoff_test_context;
update public.tasks set handoff_ready_at=now() where id=(select edit from handoff_test_context);
select pg_temp.handoff_assert((select handoff_ready_at is null from public.tasks where id=edit), 'readiness cannot be forged') from handoff_test_context;

reset role;
select set_config('request.jwt.claim.sub', owner_a::text, true) from handoff_test_context;
set local role authenticated;
update public.tasks set status='done',completed_at=(select completion from handoff_test_context) where id=(select film from handoff_test_context);
select pg_temp.handoff_assert((select handoff_ready_at is not null and status='todo' from public.tasks where id=edit), 'completion makes editing ready without starting it') from handoff_test_context;
-- Notification RLS means only the editor can read the alert.
reset role;
select set_config('request.jwt.claim.sub', editor::text, true) from handoff_test_context;
set local role authenticated;
select pg_temp.handoff_assert((select count(*) from public.notifications where metadata->>'reason'='handoff_ready' and entity_id=edit and recipient_user_id=editor and title='Task ready: Edit the reel' and web_screen='tasks')=1, 'exactly one correctly routed editor notification') from handoff_test_context;
select pg_temp.handoff_assert(not exists(select 1 from public.notifications where metadata->>'reason'='handoff_ready' and body like '%Private filming%'), 'private predecessor title stays private');
update public.tasks set title='Edit the reel carefully' where id=(select edit from handoff_test_context);
select pg_temp.handoff_assert((select count(*) from public.notifications where metadata->>'reason'='handoff_ready')=1, 'normal saves do not duplicate handoffs');
update public.tasks set status='in_progress' where id=(select edit from handoff_test_context);
select pg_temp.handoff_assert((select status='in_progress' from public.tasks where id=edit), 'editor can start when ready') from handoff_test_context;
update public.tasks set status='todo' where id=(select edit from handoff_test_context);

reset role;
select set_config('request.jwt.claim.sub', owner_a::text, true) from handoff_test_context;
set local role authenticated;
update public.tasks set status='todo',completed_at=null where id=(select film from handoff_test_context);
select pg_temp.handoff_assert((select handoff_ready_at is null from public.tasks where id=edit), 'reopening filming resets readiness') from handoff_test_context;
update public.tasks set status='done',completed_at=(select completion + interval '1 minute' from handoff_test_context) where id=(select film from handoff_test_context);
reset role;
select set_config('request.jwt.claim.sub', editor::text, true) from handoff_test_context;
set local role authenticated;
select pg_temp.handoff_assert((select count(*) from public.notifications where metadata->>'reason'='handoff_ready')=2, 'new completion sends one fresh handoff');
reset role;
select set_config('request.jwt.claim.sub', owner_b::text, true) from handoff_test_context;
set local role authenticated;
select pg_temp.handoff_assert(not exists(select 1 from public.tasks), 'other agency cannot read tasks');
select pg_temp.handoff_assert(not exists(select 1 from public.notifications), 'other agency cannot read handoffs');
reset role;
rollback;
select 'PASS: automatic handoffs, editor RLS, private predecessor, deduplication, reopening, cycle and project guards; all test data rolled back' as verification;
