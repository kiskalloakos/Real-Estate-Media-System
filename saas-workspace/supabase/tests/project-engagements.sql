-- Live-schema verification. All fixtures belong to new test agencies and roll back.
begin;
set local statement_timeout = '30s';

create function pg_temp.project_assert(condition boolean, message text) returns void
language plpgsql as $$ begin
  if condition is distinct from true then raise exception 'FAIL: %', message; end if;
end; $$;
create function pg_temp.project_reject(statement text, expected text) returns void
language plpgsql as $$ declare rejected boolean := false; begin
  begin execute statement;
  exception when others then
    if sqlerrm ilike '%' || expected || '%' then rejected := true; else raise; end if;
  end;
  perform pg_temp.project_assert(rejected, 'Expected rejection: ' || expected);
end; $$;

create temporary table project_test_context (
  owner_a uuid default gen_random_uuid(), owner_b uuid default gen_random_uuid(),
  agency_a uuid, agency_b uuid,
  client_a uuid default gen_random_uuid(), client_b uuid default gen_random_uuid(),
  contract_a uuid default gen_random_uuid(), contract_b uuid default gen_random_uuid(),
  social uuid default gen_random_uuid(), website uuid default gen_random_uuid(),
  internal_job uuid default gen_random_uuid(), november uuid default gen_random_uuid(),
  launch uuid default gen_random_uuid(), task_a uuid default gen_random_uuid()
);
insert into project_test_context default values;
grant select on project_test_context to authenticated;
insert into auth.users(id, email, email_confirmed_at, raw_user_meta_data)
select owner_a, owner_a::text || '@example.invalid', now(),
  '{"signup_role":"agency_owner","agency_name":"Project verification A","full_name":"Project test owner A"}'::jsonb from project_test_context
union all
select owner_b, owner_b::text || '@example.invalid', now(),
  '{"signup_role":"agency_owner","agency_name":"Project verification B","full_name":"Project test owner B"}'::jsonb from project_test_context;
update project_test_context set
  agency_a = (select agency_id from public.agency_memberships where user_id = owner_a),
  agency_b = (select agency_id from public.agency_memberships where user_id = owner_b);
select pg_temp.project_assert(agency_a is not null and agency_b is not null and agency_a <> agency_b, 'isolated test agencies') from project_test_context;

select set_config('request.jwt.claim.sub', owner_a::text, true) from project_test_context;
set local role authenticated;
insert into public.client_accounts(id, agency_id, name, created_by)
select client_a, agency_a, 'Project test client A', owner_a from project_test_context
union all select client_b, agency_a, 'Project test client B', owner_a from project_test_context;
insert into public.service_contracts(id, agency_id, client_account_id, title, created_by)
select contract_a, agency_a, client_a, 'Social media agreement', owner_a from project_test_context
union all select contract_b, agency_a, client_b, 'Other client agreement', owner_a from project_test_context;
insert into public.jobs(id, agency_id, client_account_id, name, created_by, agreement_id, owner_user_id, starts_on, due_on, status)
select social, agency_a, client_a, 'Social media', owner_a, contract_a, owner_a, date '2026-11-01', date '2027-04-30', 'active'::public.job_status from project_test_context
union all select website, agency_a, client_a, 'Website', owner_a, null, null, null, null, 'planned'::public.job_status from project_test_context;
insert into public.jobs(id, agency_id, name, kind, created_by)
select internal_job, agency_a, 'Agency branding', 'internal', owner_a from project_test_context;
select pg_temp.project_assert(not exists(select 1 from public.job_sections), 'sections are not generated automatically');
insert into public.job_sections(id, agency_id, job_id, name)
select november, agency_a, social, 'November' from project_test_context
union all select launch, agency_a, website, 'Launch' from project_test_context;
insert into public.tasks(id, agency_id, client_account_id, job_id, job_section_id, production_phase, title, created_by)
select task_a, agency_a, client_a, social, november, 'pre-production', 'Plan shoot', owner_a from project_test_context;
insert into public.tasks(agency_id, client_account_id, job_id, job_section_id, production_phase, title, created_by)
select agency_a, client_a, social, november, 'post-production', 'Edit previous shoot', owner_a from project_test_context;
insert into public.tasks(agency_id, job_id, production_phase, title, created_by)
select agency_a, internal_job, 'production', 'Agency branding work', owner_a from project_test_context;
insert into public.calendar_events(agency_id, job_id, title, starts_at, created_by)
select agency_a, internal_job, 'Agency planning', now(), owner_a from project_test_context;

select pg_temp.project_reject(format('update public.jobs set agreement_id=%L where id=%L', contract_b, social), 'foreign key') from project_test_context;
select pg_temp.project_reject(format('update public.jobs set agreement_id=%L where id=%L', contract_a, website), 'unique') from project_test_context;
select pg_temp.project_reject(format('update public.jobs set owner_user_id=%L where id=%L', owner_b, social), 'foreign key') from project_test_context;
select pg_temp.project_reject(format('update public.tasks set job_section_id=%L where id=%L', launch, task_a), 'foreign key') from project_test_context;
select pg_temp.project_reject(format('update public.tasks set client_account_id=%L where id=%L', client_b, task_a), 'project client') from project_test_context;
select pg_temp.project_reject(format('update public.jobs set client_account_id=%L, agreement_id=null where id=%L', client_b, social), 'Move existing project work') from project_test_context;
select pg_temp.project_reject(format('update public.jobs set due_on=%L where id=%L', '2026-01-01', social), 'check constraint') from project_test_context;
select pg_temp.project_assert((select count(distinct production_phase) from public.tasks where job_id = social) = 2, 'simultaneous task phases') from project_test_context;
select pg_temp.project_assert(not exists(select 1 from public.tasks where job_id = website), 'projects do not inherit work from the same client') from project_test_context;
delete from public.job_sections where id = (select november from project_test_context);
select pg_temp.project_assert((select job_id = social and job_section_id is null from public.tasks where id = task_a), 'removing section retains project tasks') from project_test_context;

reset role;
select set_config('request.jwt.claim.sub', owner_b::text, true) from project_test_context;
set local role authenticated;
select pg_temp.project_assert(not exists(select 1 from public.jobs), 'other agency cannot read projects');
select pg_temp.project_assert(not exists(select 1 from public.job_sections), 'other agency cannot read sections');
select pg_temp.project_reject(format('insert into public.job_sections(agency_id,job_id,name) values(%L,%L,%L)', agency_a, social, 'Forbidden'), 'row-level security') from project_test_context;
reset role;
rollback;
select 'PASS: project contracts, ownership, arbitrary sections, concurrent phases, internal work, task preservation, and tenant isolation; fixtures rolled back' as verification;
