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
select owner_a,owner_a::text||'@example.invalid',now(),'{"signup_role":"agency_owner","agency_name":"Pages verification A","full_name":"Pages owner A"}'::jsonb from page_test_context
union all select owner_b,owner_b::text||'@example.invalid',now(),'{"signup_role":"agency_owner","agency_name":"Pages verification B","full_name":"Pages owner B"}'::jsonb from page_test_context;
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
select public.save_project_page(brief,project_a,null,'Creative brief','[{"id":"one","type":"paragraph","text":"Original private text"}]',false,0) from page_test_context;
select public.save_project_page(concept,project_a,brief,'Private concepts','[]',false,0) from page_test_context;
select public.save_project_page(script,project_a,concept,'Script','[{"id":"scene","type":"scene","text":"INT. CABIN - DAY"}]',false,0,'script') from page_test_context;
select public.save_project_page(other_page,other_project,null,'Other client page','[]',true,0) from page_test_context;
select public.save_project_page(internal_page,internal_project,null,'Internal page','[]',false,0) from page_test_context;
select pg_temp.page_assert((select not client_visible and revision=1 from public.project_pages where id=brief),'new page is private') from page_test_context;
select public.save_project_page(brief,project_a,null,'Creative brief','[{"id":"one","type":"paragraph","text":"Approved for sharing"}]',true,1) from page_test_context;
select pg_temp.page_reject(format('select public.save_project_page(%L,%L,null,%L,%L,false,1)',brief,project_a,'Overwrite','[]'),'PAGE_CONFLICT') from page_test_context;
select pg_temp.page_reject(format('select public.save_project_page(%L,%L,%L,%L,%L,false,2)',brief,project_a,script,'Cycle','[]'),'nested inside itself') from page_test_context;
select pg_temp.page_reject(format('select public.save_project_page(%L,%L,%L,%L,%L,false,2)',brief,project_a,other_page,'Move','[]'),'same project') from page_test_context;
select pg_temp.page_reject(format('select public.save_project_page(%L,%L,null,%L,%L,true,1)',internal_page,internal_project,'Internal','[]'),'Internal project') from page_test_context;
select pg_temp.page_reject(format('update public.project_pages set title=%L where id=%L','Bypass',brief),'permission denied') from page_test_context;
select set_config('request.jwt.claim.sub',editor::text,true) from page_test_context;
select public.save_project_page(script,project_a,concept,'Script','[{"id":"scene","type":"scene","text":"EXT. CABIN - MORNING"}]',false,1,'script') from page_test_context;
select pg_temp.page_assert((select count(*)=2 from public.project_page_revisions where page_id=script),'team save retains revisions') from page_test_context;
select set_config('request.jwt.claim.sub',client_user::text,true) from page_test_context;
select pg_temp.page_assert((select count(*)=1 from public.project_pages where job_id in(project_a,other_project,internal_project)),'client sees only own explicitly shared page') from page_test_context;
select pg_temp.page_assert(not exists(select 1 from public.project_page_revisions where page_id in(brief,concept,script)),'client cannot read private revision history') from page_test_context;
select pg_temp.page_reject(format('select public.save_project_page(%L,%L,null,%L,%L,false,2)',brief,project_a,'Client edit','[]'),'cannot edit') from page_test_context;
select set_config('request.jwt.claim.sub',owner_b::text,true) from page_test_context;
select pg_temp.page_assert(not exists(select 1 from public.project_pages where job_id=project_a),'other agency sees no pages') from page_test_context;
select pg_temp.page_reject(format('select public.save_project_page(%L,%L,null,%L,%L,false,2)',brief,project_a,'Foreign edit','[]'),'cannot edit') from page_test_context;
select set_config('request.jwt.claim.sub',owner_a::text,true) from page_test_context;
select public.save_project_page(brief,project_a,null,'Creative brief','[{"id":"one","type":"paragraph","text":"Original private text"}]',false,2) from page_test_context;
select pg_temp.page_assert((select count(*)=3 from public.project_page_revisions where page_id=brief),'restore creates a new revision') from page_test_context;
select pg_temp.page_reject(format('update public.jobs set client_account_id=%L where id=%L',client_b,project_a),'client unchanged') from page_test_context;
select set_config('request.jwt.claim.sub',client_user::text,true) from page_test_context;
select pg_temp.page_assert(not exists(select 1 from public.project_pages where job_id=project_a),'unshared page disappears for client') from page_test_context;
reset role;
select pg_temp.page_assert(not has_function_privilege('anon','public.save_project_page(uuid,uuid,uuid,text,jsonb,boolean,integer,text,boolean)','execute'),'anonymous writes denied');
rollback;
select 'Project pages: live-schema rollback checks passed' as verification;
