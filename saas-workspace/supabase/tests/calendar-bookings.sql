-- Run the entire script. Fresh identities and test agencies are rolled back.
begin;
set local statement_timeout='30s';
create function pg_temp.page_assert(ok boolean,message text) returns void language plpgsql as $$begin
  if ok is distinct from true then raise exception 'FAIL: %',message;end if;
end;$$;
create function pg_temp.page_reject(statement text,expected text) returns void language plpgsql as $$
declare rejected boolean:=false;begin
  begin execute statement;exception when others then
    if sqlerrm ilike '%'||expected||'%' then rejected:=true;else raise;end if;
  end;
  perform pg_temp.page_assert(rejected,'Expected rejection: '||expected);
end;$$;
create temporary table page_test_context(
  owner_a uuid default gen_random_uuid(),owner_b uuid default gen_random_uuid(),editor uuid default gen_random_uuid(),client_user uuid default gen_random_uuid(),
  agency_a uuid,agency_b uuid,client_a uuid default gen_random_uuid(),client_b uuid default gen_random_uuid(),
  project_a uuid default gen_random_uuid(),other_project uuid default gen_random_uuid(),internal_project uuid default gen_random_uuid(),
  brief uuid default gen_random_uuid(),concept uuid default gen_random_uuid(),script uuid default gen_random_uuid(),other_page uuid default gen_random_uuid(),internal_page uuid default gen_random_uuid()
);
insert into page_test_context default values;
grant select on page_test_context to authenticated,anon;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
select owner_a,owner_a::text||'@example.invalid',now(),'{"signup_role":"agency_owner","agency_name":"Calendar verification A","full_name":"Pages owner A"}'::jsonb from page_test_context
union all select owner_b,owner_b::text||'@example.invalid',now(),'{"signup_role":"agency_owner","agency_name":"Calendar verification B","full_name":"Pages owner B"}'::jsonb from page_test_context;
insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
select editor,editor::text||'@example.invalid',now(),'{"agency_provisioned":true}'::jsonb,'{"role":"team_member","full_name":"Pages editor"}'::jsonb from page_test_context
union all select client_user,client_user::text||'@example.invalid',now(),'{"agency_provisioned":true}'::jsonb,'{"role":"client","full_name":"Pages client"}'::jsonb from page_test_context;
update page_test_context set agency_a=(select agency_id from public.agency_memberships where user_id=owner_a),agency_b=(select agency_id from public.agency_memberships where user_id=owner_b);
select set_config('request.jwt.claim.sub',owner_a::text,true) from page_test_context;
set local role authenticated;
select public.admin_attach_team_user(agency_a,editor,'Pages editor') from page_test_context;
insert into public.client_accounts(id,agency_id,name,created_by)
select client_a,agency_a,'Pages client A',owner_a from page_test_context
union all select client_b,agency_a,'Other pages client',owner_a from page_test_context;
select public.attach_client_user(agency_a,client_user,client_a,'owner','Pages client') from page_test_context;
insert into public.jobs(id,agency_id,client_account_id,name,created_by)
select project_a,agency_a,client_a,'Pages engagement',owner_a from page_test_context
union all select other_project,agency_a,client_b,'Other client engagement',owner_a from page_test_context
union all select internal_project,agency_a,null,'Internal pages work',owner_a from page_test_context;
select set_config('request.jwt.claim.sub',client_user::text,true) from page_test_context;
select public.request_calendar_booking(client_a,'call','Booking call','2030-01-01 09:00Z','2030-01-01 10:00Z') from page_test_context;
select public.request_calendar_booking(client_a,'call','Booking call','2030-01-01 09:00Z','2030-01-01 10:00Z') from page_test_context;
select pg_temp.page_assert((select count(*)=1 from public.calendar_booking_requests where client_account_id=client_a),'duplicate requests collapse') from page_test_context;
select pg_temp.page_reject(format('select public.request_calendar_booking(%L,%L,%L,%L,%L)',client_b,'shoot','Foreign','2030-01-01 09:00Z','2030-01-01 10:00Z'),'Sign in') from page_test_context;
select pg_temp.page_reject(format('select public.decide_calendar_booking(%L,true)',(select id from public.calendar_booking_requests where client_account_id=client_a)),'Only agency') from page_test_context;
select set_config('request.jwt.claim.sub',owner_a::text,true) from page_test_context;
select public.decide_calendar_booking((select id from public.calendar_booking_requests where client_account_id=client_a),true) from page_test_context;
select public.decide_calendar_booking((select id from public.calendar_booking_requests where client_account_id=client_a),true) from page_test_context;
select pg_temp.page_assert((select count(*)=1 from public.calendar_events where client_account_id=client_a and title='Booking call'),'one confirmed event') from page_test_context;
select pg_temp.page_assert((select description like '[rm:type=call][rm:scope=client]%' from public.calendar_events where client_account_id=client_a and title='Booking call'),'call category retained') from page_test_context;
select set_config('request.jwt.claim.sub',client_user::text,true) from page_test_context;
select public.request_calendar_booking(client_a,'shoot','Overlapping shoot','2030-01-01 09:30Z','2030-01-01 11:00Z') from page_test_context;
select pg_temp.page_reject('update public.calendar_booking_requests set status=''confirmed''','permission denied');
select set_config('request.jwt.claim.sub',owner_a::text,true) from page_test_context;
select pg_temp.page_reject(format('select public.decide_calendar_booking(%L,true)',(select id from public.calendar_booking_requests where client_account_id=client_a and title='Overlapping shoot')),'overlaps') from page_test_context;
select public.decide_calendar_booking((select id from public.calendar_booking_requests where client_account_id=client_a and title='Overlapping shoot'),false) from page_test_context;
select set_config('request.jwt.claim.sub',owner_b::text,true) from page_test_context;
select pg_temp.page_assert(not exists(select 1 from public.calendar_booking_requests where agency_id=agency_a),'other agency cannot read requests') from page_test_context;
reset role;
select pg_temp.page_assert(not has_function_privilege('anon','public.request_calendar_booking(uuid,text,text,timestamptz,timestamptz,text,text)','execute'),'anonymous requests denied');
rollback;
select 'Calendar booking live-schema checks passed' as verification;
