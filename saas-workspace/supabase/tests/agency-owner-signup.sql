-- Run only through scripts/verify-agency-signup.mjs, inside a rollback transaction.
create function pg_temp.assert(condition boolean, message text) returns void
language plpgsql as $$ begin
  if condition is distinct from true then raise exception 'FAIL: %', message; end if;
end; $$;

create temporary table signup_test_context (
  owner_a uuid, owner_b uuid, team_user uuid, client_user uuid,
  agency_a uuid, agency_b uuid, client_a uuid, client_b uuid,
  task_a uuid, task_b uuid, original_agency_count bigint
);
insert into signup_test_context (owner_a, owner_b, team_user, client_user, client_a, client_b, task_a, task_b, original_agency_count)
values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), (select count(*) from public.agencies));
grant select, update on signup_test_context to authenticated;

-- Non-owner intent and a forged user_metadata provisioning flag are rejected.
do $$ declare kind text; rejected boolean; begin
  foreach kind in array array['client', 'team_member', ''] loop
    rejected := false;
    begin
      insert into auth.users (id, email, raw_user_meta_data)
      values (gen_random_uuid(), gen_random_uuid()::text || '@example.invalid',
        jsonb_build_object('signup_role', kind, 'agency_provisioned', true, 'agency_name', 'Test', 'full_name', 'Test Owner'));
    exception when raise_exception then
      if sqlerrm like 'Only agency owners can register.%' then rejected := true; else raise; end if;
    end;
    perform pg_temp.assert(rejected, 'direct non-owner signup must fail');
  end loop;
end; $$;

insert into auth.users (id, email, raw_user_meta_data)
select owner_a, owner_a::text || '@example.invalid',
  jsonb_build_object('signup_role', 'agency_owner', 'agency_name', ' Test Agency ', 'full_name', ' Test Owner A ',
    'agency_id', (select id from public.agencies limit 1), 'role', 'admin')
from signup_test_context;
select pg_temp.assert((select count(*) from public.agencies) = original_agency_count, 'unverified owner must not create an agency') from signup_test_context;
select pg_temp.assert(not exists(select 1 from public.agency_memberships where user_id = owner_a), 'unverified owner must not have membership') from signup_test_context;

-- Mutable metadata cannot replace captured agency identity or join another tenant.
update auth.users set raw_user_meta_data = '{"signup_role":"client","agency_name":"Spoofed Agency","full_name":"Spoofed Owner"}'
where id = (select owner_a from signup_test_context);
update auth.users set email_confirmed_at = now() where id = (select owner_a from signup_test_context);
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
select owner_b, owner_b::text || '@example.invalid', now(),
  '{"signup_role":"agency_owner","agency_name":"Test Agency","full_name":"Test Owner B"}' from signup_test_context;
update signup_test_context set
  agency_a = (select agency_id from public.agency_memberships where user_id = owner_a),
  agency_b = (select agency_id from public.agency_memberships where user_id = owner_b);
select pg_temp.assert(agency_a is not null and agency_b is not null and agency_a <> agency_b, 'owners must get separate fresh agencies') from signup_test_context;
select pg_temp.assert((select count(*) from public.agencies) = original_agency_count + 2, 'each owner creates exactly one agency') from signup_test_context;
select pg_temp.assert((select name from public.agencies where id = agency_a) = 'Test Agency', 'captured agency name must be normalized and immutable') from signup_test_context;
select pg_temp.assert((select full_name from public.profiles where id = owner_a) = 'Test Owner A', 'captured owner name must be normalized') from signup_test_context;
select pg_temp.assert((select count(*) from public.agency_memberships where user_id in (owner_a, owner_b) and role = 'admin' and status = 'active') = 2, 'verified owners must be active admins') from signup_test_context;
update auth.users set email_confirmed_at = now() where id = (select owner_a from signup_test_context);
select pg_temp.assert((select count(*) from public.agencies) = original_agency_count + 2, 'repeated confirmation must be idempotent') from signup_test_context;

-- Internal team/client provisioning bypasses public signup but creates no agency.
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
select team_user, team_user::text || '@example.invalid', now(), '{"role":"team_member","full_name":"Test Team"}' from signup_test_context;
insert into auth.users (id, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
select client_user, client_user::text || '@example.invalid', now(), '{"agency_provisioned":true}', '{"role":"client","full_name":"Test Client"}' from signup_test_context;
select pg_temp.assert(not exists(select 1 from public.agency_owner_signups where user_id in (team_user, client_user)), 'agency-provisioned users must not create workspaces') from signup_test_context;

select set_config('request.jwt.claim.sub', owner_a::text, true) from signup_test_context;
set local role authenticated;
select pg_temp.assert((select count(*) from public.agencies) = 1, 'owner A sees only its own agency');
select pg_temp.assert(not public.is_agency_admin(agency_b), 'owner A must not administer agency B') from signup_test_context;
select public.admin_attach_team_user(agency_a, team_user, 'Test Team') is not null as team_invitation_attached from signup_test_context;
insert into public.client_accounts (id, agency_id, name, created_by) select client_a, agency_a, 'Client A', owner_a from signup_test_context;
select public.attach_client_user(agency_a, client_user, client_a, 'owner', 'Test Client') is not null as client_invitation_attached from signup_test_context;
insert into public.tasks (id, agency_id, title, created_by) select task_a, agency_a, 'Task A', owner_a from signup_test_context;
reset role;
select set_config('request.jwt.claim.sub', owner_b::text, true) from signup_test_context;
set local role authenticated;
insert into public.client_accounts (id, agency_id, name, created_by) select client_b, agency_b, 'Client B', owner_b from signup_test_context;
insert into public.tasks (id, agency_id, title, created_by) select task_b, agency_b, 'Task B', owner_b from signup_test_context;
select pg_temp.assert((select count(*) from public.client_accounts) = 1, 'owner B sees only its client');
select pg_temp.assert((select count(*) from public.tasks) = 1, 'owner B sees only its task');
select pg_temp.assert(not exists(select 1 from public.profiles where id = owner_a), 'profiles must not leak across agencies') from signup_test_context;

-- Check every public table with an agency_id column, including existing real data.
do $$ declare target record; leaked bigint; my_agency uuid; begin
  select agency_b into my_agency from signup_test_context;
  for target in
    select table_name from information_schema.columns where table_schema = 'public' and column_name = 'agency_id' and table_name <> 'agency_owner_signups'
  loop
    execute format('select count(*) from public.%I where agency_id <> $1', target.table_name) into leaked using my_agency;
    perform pg_temp.assert(leaked = 0, 'cross-agency reads in ' || target.table_name);
  end loop;
end; $$;

do $$ declare rejected boolean := false; affected integer; begin
  begin
    insert into public.client_accounts (agency_id, name) select agency_a, 'Forbidden' from signup_test_context;
  exception when insufficient_privilege then rejected := true; end;
  perform pg_temp.assert(rejected, 'cross-agency inserts must fail');
  update public.tasks set title = 'Forbidden' where id = (select task_a from signup_test_context);
  get diagnostics affected = row_count;
  perform pg_temp.assert(affected = 0, 'cross-agency updates must be blocked');
  delete from public.tasks where id = (select task_a from signup_test_context);
  get diagnostics affected = row_count;
  perform pg_temp.assert(affected = 0, 'cross-agency deletes must be blocked');
  rejected := false;
  begin
    perform public.admin_attach_team_user((select agency_a from signup_test_context), auth.uid(), 'Forbidden');
  exception when raise_exception then rejected := true; end;
  perform pg_temp.assert(rejected, 'membership RPC cannot attach into another agency');
  rejected := false;
  begin
    perform public.provision_verified_agency_owner(auth.uid());
  exception when insufficient_privilege then rejected := true; end;
  perform pg_temp.assert(rejected, 'public caller cannot invoke provisioning');
  rejected := false;
  begin
    perform 1 from public.agency_owner_signups;
  exception when insufficient_privilege then rejected := true; end;
  perform pg_temp.assert(rejected, 'pending signup details are private');
end; $$;
select pg_temp.assert(not public.can_manage_client_storage_path(agency_a::text || '/' || client_a::text || '/property/files/test.pdf'), 'cross-agency storage writes must be blocked') from signup_test_context;
select pg_temp.assert(not has_function_privilege('authenticated', 'public.recalculate_debt_balance(uuid,uuid)', 'execute'), 'internal debt helper is not a cross-agency RPC');
-- Removing direct RPC access must preserve the agency's normal payment triggers.
insert into public.finance_debts (agency_id, direction, counterparty, original_amount, outstanding_amount, created_by)
select agency_b, 'receivable', 'Test Debt', 100, 100, owner_b from signup_test_context;
insert into public.finance_debt_payments (agency_id, debt_id, amount, paid_on, recorded_by)
select agency_id, id, 25, current_date, auth.uid() from public.finance_debts where counterparty = 'Test Debt';
select pg_temp.assert((select outstanding_amount from public.finance_debts where counterparty = 'Test Debt') = 75, 'internal payment balance calculation still works');

-- Invited users remain in their agency; they receive no owner powers.
reset role;
select set_config('request.jwt.claim.sub', team_user::text, true) from signup_test_context;
set local role authenticated;
select pg_temp.assert(public.is_active_agency_member(agency_a) and not public.is_agency_admin(agency_a), 'invited team login retains team access') from signup_test_context;
select pg_temp.assert(not public.is_active_agency_member(agency_b), 'invited team login cannot access agency B') from signup_test_context;
reset role;
select set_config('request.jwt.claim.sub', client_user::text, true) from signup_test_context;
set local role authenticated;
select pg_temp.assert(public.has_client_access(client_a) and not public.has_client_access(client_b), 'invited client login is isolated') from signup_test_context;
reset role;
select pg_temp.assert((select count(*) from public.agencies) = original_agency_count + 2, 'invitation flows create no extra agency') from signup_test_context;
