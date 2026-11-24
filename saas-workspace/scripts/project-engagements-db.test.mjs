import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Run against an isolated PostgreSQL-compatible runtime, never the linked Supabase project.
// PROJECT_SQL_RUNTIME points to an externally installed @electric-sql/pglite entry module.
const runtime = process.env.PROJECT_SQL_RUNTIME;
if (!runtime) throw new Error('Set PROJECT_SQL_RUNTIME to a temporary @electric-sql/pglite module path.');
const { PGlite } = await import(pathToFileURL(resolve(runtime)).href);
const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
try {
  await db.exec(`
    create role authenticated;
    create role anon;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id', true), '')::uuid $$;
    create function public.is_agency_admin(a uuid) returns boolean language sql stable as $$ select current_setting('test.role', true) = 'admin' and a::text = current_setting('test.agency', true) $$;
    create function public.is_agency_team_member(a uuid) returns boolean language sql stable as $$ select false $$;
    create function public.has_client_context(a uuid) returns boolean language sql stable as $$ select false $$;
    create function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
    create type public.task_status as enum ('todo','in_progress','blocked','done','cancelled');
    create table agencies(id uuid primary key);
    create table profiles(id uuid primary key);
    create table agency_memberships(agency_id uuid, user_id uuid, primary key(agency_id,user_id));
    create table client_accounts(id uuid primary key, agency_id uuid, unique(id,agency_id));
    create table properties(id uuid primary key, agency_id uuid, client_account_id uuid, archived_at timestamptz, unique(id,agency_id), unique(id,agency_id,client_account_id));
    create table service_contracts(id uuid primary key, agency_id uuid, client_account_id uuid, unique(id,agency_id,client_account_id));
    create table tasks(id uuid primary key default gen_random_uuid(), agency_id uuid, client_account_id uuid, property_id uuid, status public.task_status default 'todo', due_at timestamptz, archived_at timestamptz, assignee_user_id uuid);
    create table calendar_events(id uuid primary key default gen_random_uuid(), agency_id uuid, client_account_id uuid, property_id uuid, starts_at timestamptz, archived_at timestamptz);
    create table media_assets(id uuid primary key, agency_id uuid);
    create table notes(id uuid primary key, agency_id uuid);
  `);
  for (const file of ['202609090001_jobs_and_campaigns.sql', '202611240001_project_engagements.sql']) {
    await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'));
  }
  await db.exec(`
    insert into agencies values('${id(1)}'),('${id(2)}');
    insert into profiles values('${id(3)}'),('${id(4)}');
    insert into agency_memberships values('${id(1)}','${id(3)}'),('${id(2)}','${id(4)}');
    insert into client_accounts values('${id(5)}','${id(1)}'),('${id(6)}','${id(1)}'),('${id(7)}','${id(2)}');
    insert into properties values('${id(8)}','${id(1)}','${id(5)}',null);
    insert into service_contracts values('${id(9)}','${id(1)}','${id(5)}'),('${id(10)}','${id(1)}','${id(6)}');
    insert into jobs(id,agency_id,client_account_id,name,created_by,agreement_id,owner_user_id,starts_on,due_on)
      values('${id(11)}','${id(1)}','${id(5)}','Social media','${id(3)}','${id(9)}','${id(3)}','2026-09-01','2027-01-31'),
      ('${id(12)}','${id(1)}','${id(5)}','Website','${id(3)}',null,null,null,null),
      ('${id(13)}','${id(1)}',null,'Internal brand work','${id(3)}',null,null,null,null);
    insert into job_sections(id,agency_id,job_id,name) values('${id(14)}','${id(1)}','${id(11)}','November'),('${id(15)}','${id(1)}','${id(12)}','Launch');
    insert into tasks(id,agency_id,client_account_id,job_id,job_section_id,production_phase) values
      ('${id(16)}','${id(1)}','${id(5)}','${id(11)}','${id(14)}','pre-production'),
      ('${id(17)}','${id(1)}','${id(5)}','${id(11)}','${id(14)}','post-production'),
      ('${id(18)}','${id(1)}',null,'${id(13)}',null,'production');
  `);
  assert.equal((await db.query('select count(*)::int n from jobs')).rows[0].n, 3);
  await assert.rejects(() => db.exec(`update jobs set agreement_id='${id(10)}' where id='${id(11)}'`), /foreign key/i);
  await assert.rejects(() => db.exec(`update jobs set agreement_id='${id(9)}' where id='${id(12)}'`), /unique/i);
  await assert.rejects(() => db.exec(`update jobs set owner_user_id='${id(4)}' where id='${id(11)}'`), /foreign key/i);
  await assert.rejects(() => db.exec(`update tasks set client_account_id='${id(6)}' where id='${id(16)}'`), /project client/i);
  await assert.rejects(() => db.exec(`update tasks set job_section_id='${id(15)}' where id='${id(16)}'`), /foreign key/i);
  await assert.rejects(() => db.exec(`update jobs set client_account_id='${id(6)}',agreement_id=null where id='${id(11)}'`), /Move existing project work/i);
  await assert.rejects(() => db.exec(`update jobs set due_on='2026-01-01' where id='${id(11)}'`), /check constraint/i);
  await assert.rejects(() => db.exec(`insert into calendar_events(agency_id,client_account_id,job_id) values('${id(1)}','${id(6)}','${id(11)}')`), /project client/i);
  await db.exec(`delete from job_sections where id='${id(14)}'`);
  const task = (await db.query(`select job_id,job_section_id from tasks where id='${id(16)}'`)).rows[0];
  assert.equal(task.job_id, id(11)); assert.equal(task.job_section_id, null);
  // Exercise section policies as an unprivileged database role. Tasks use a minimal
  // isolation policy here; production task policies remain unchanged by this migration.
  await db.exec(`alter table tasks enable row level security; create policy test_tasks_read on tasks for select to authenticated using(false);
    grant usage on schema public,auth to authenticated; grant select,insert,update,delete on all tables in schema public to authenticated;
    set role authenticated; set test.role='outsider'; set test.agency='${id(2)}';`);
  assert.equal((await db.query('select count(*)::int n from job_sections')).rows[0].n, 0);
  await assert.rejects(() => db.exec(`insert into job_sections(agency_id,job_id,name) values('${id(1)}','${id(11)}','Forbidden')`), /row-level security/i);
  await db.exec(`set test.role='admin'; set test.agency='${id(1)}'`);
  assert.equal((await db.query('select count(*)::int n from job_sections')).rows[0].n, 1);
  await db.exec(`reset role;
    alter table tasks add column title text default 'Test task', add column completed_at timestamptz, add column visibility text default 'team', add unique(id,agency_id);
    alter table agency_memberships add column role text default 'team_member', add column status text default 'active';
    create table client_memberships(agency_id uuid,client_account_id uuid,user_id uuid,status text);
    create type public.notification_kind as enum ('task');
    create table notifications(id uuid default gen_random_uuid(), recipient_user_id uuid, entity_id uuid, dedupe_key text, unique(recipient_user_id,dedupe_key));
    create function public.create_user_notification(a uuid, recipient uuid, kind public.notification_kind, title text, body text, screen text, route text, entity text, entity_id uuid, dedupe text, metadata jsonb) returns uuid language plpgsql as $$
    declare result uuid; begin
      insert into public.notifications(recipient_user_id,entity_id,dedupe_key) values(recipient,entity_id,dedupe) on conflict do nothing returning id into result;
      return result;
    end; $$;
    insert into agency_memberships(agency_id,user_id) values('${id(1)}','${id(4)}');
  `);
  await db.exec(await readFile(new URL('../supabase/migrations/202611240002_task_handoffs.sql', import.meta.url), 'utf8'));
  await db.exec(`insert into tasks(id,agency_id,client_account_id,job_id,title,assignee_user_id,waits_for_task_id) values
    ('${id(20)}','${id(1)}','${id(5)}','${id(11)}','Edit reel','${id(3)}','${id(16)}'),
    ('${id(21)}','${id(1)}','${id(5)}','${id(11)}','Select photos','${id(4)}','${id(16)}');`);
  assert.equal((await db.query('select count(*)::int n from notifications')).rows[0].n, 0);
  await assert.rejects(() => db.exec(`update tasks set status='in_progress' where id='${id(20)}'`), /Complete the preceding task/i);
  await assert.rejects(() => db.exec(`update tasks set waits_for_task_id='${id(20)}' where id='${id(16)}'`), /cannot form a loop/i);
  await assert.rejects(() => db.exec(`update tasks set waits_for_task_id='${id(18)}' where id='${id(20)}'`), /same project/i);
  await assert.rejects(() => db.exec(`update tasks set job_id='${id(12)}' where id='${id(16)}'`), /Unlink dependent tasks/i);
  await db.exec(`update tasks set handoff_ready_at=now() where id='${id(20)}'`);
  assert.equal((await db.query(`select handoff_ready_at from tasks where id='${id(20)}'`)).rows[0].handoff_ready_at, null);
  await db.exec(`update tasks set status='done',completed_at='2026-11-24T10:00:00Z' where id='${id(16)}'`);
  assert.equal((await db.query('select count(*)::int n from notifications')).rows[0].n, 2);
  assert.ok((await db.query(`select handoff_ready_at from tasks where id='${id(20)}'`)).rows[0].handoff_ready_at);
  await db.exec(`update tasks set title='Edit the hero reel' where id='${id(20)}'; update tasks set status='done' where id='${id(16)}'`);
  assert.equal((await db.query('select count(*)::int n from notifications')).rows[0].n, 2);
  await db.exec(`update tasks set status='todo',completed_at=null where id='${id(16)}'`);
  assert.equal((await db.query(`select handoff_ready_at from tasks where id='${id(20)}'`)).rows[0].handoff_ready_at, null);
  await db.exec(`update tasks set status='done',completed_at='2026-11-24T11:00:00Z' where id='${id(16)}'`);
  assert.equal((await db.query('select count(*)::int n from notifications')).rows[0].n, 4);
  await db.exec(`update tasks set status='in_progress' where id='${id(20)}'`);
  console.log('Project and handoff migrations verified: engagement constraints and RLS; same-project task links; cycle/start guards; fan-out, readiness, reopening, and notification deduplication.');
} catch (error) { console.error(error.message); process.exitCode = 1; } finally { await db.close(); }
