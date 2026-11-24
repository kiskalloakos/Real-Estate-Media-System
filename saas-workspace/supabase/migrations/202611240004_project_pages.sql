-- Project writing pages: explicit sharing, immutable revisions and conflict-safe saves.
begin;
create table public.project_pages (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  job_id uuid not null,
  parent_page_id uuid,
  kind text not null default 'document' check(kind in ('document','script')),
  title text not null check(length(trim(title)) between 1 and 300),
  blocks jsonb not null default '[]'::jsonb check(jsonb_typeof(blocks)='array'),
  client_visible boolean not null default false,
  revision integer not null default 1 check(revision>0),
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique(id,agency_id,job_id),
  foreign key(job_id,agency_id) references public.jobs(id,agency_id) on delete cascade,
  foreign key(parent_page_id,agency_id,job_id) references public.project_pages(id,agency_id,job_id),
  check(parent_page_id is distinct from id)
);
create index project_pages_project_idx on public.project_pages(agency_id,job_id,parent_page_id) where archived_at is null;
create table public.project_page_revisions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.project_pages(id) on delete cascade,
  revision integer not null,
  title text not null,
  blocks jsonb not null,
  saved_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(page_id,revision)
);
alter table public.project_pages enable row level security;
alter table public.project_page_revisions enable row level security;
create policy project_pages_read on public.project_pages for select to authenticated using (
  archived_at is null and exists(select 1 from public.jobs j where j.id=job_id and j.agency_id=project_pages.agency_id and j.archived_at is null
    and (public.is_agency_admin(j.agency_id) or public.is_agency_team_member(j.agency_id)
      or (client_visible and public.has_client_access(j.client_account_id))))
);
create policy project_page_history_team on public.project_page_revisions for select to authenticated using (
  exists(select 1 from public.project_pages p where p.id=page_id
    and (public.is_agency_admin(p.agency_id) or public.is_agency_team_member(p.agency_id)))
);
grant select on public.project_pages,public.project_page_revisions to authenticated;
-- Writes only through the checked RPC, so direct updates cannot bypass revision checks.
revoke insert,update,delete on public.project_pages,public.project_page_revisions from authenticated,anon;
revoke all on public.project_pages,public.project_page_revisions from anon;

create function public.save_project_page(p_page_id uuid,p_job_id uuid,p_parent_id uuid,p_title text,p_blocks jsonb,
  p_client_visible boolean,p_expected_revision integer,p_kind text default 'document',p_archived boolean default false)
returns public.project_pages language plpgsql security definer set search_path='' as $$
declare project public.jobs; current_page public.project_pages; saved public.project_pages; ancestor uuid; seen uuid[]; b jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in to edit project pages'; end if;
  -- Serialize hierarchy edits per project, including simultaneous moves and client changes.
  select * into project from public.jobs where id=p_job_id and archived_at is null for update;
  if not found or not (public.is_agency_admin(project.agency_id) or public.is_agency_team_member(project.agency_id)) then
    raise exception 'You cannot edit pages in this project';
  end if;
  if p_page_id is null or p_title is null or length(trim(p_title)) not between 1 and 300 or p_kind not in ('document','script') then
    raise exception 'Choose a page title and valid page type';
  end if;
  if p_blocks is null or jsonb_typeof(p_blocks)<>'array' or jsonb_array_length(p_blocks)>1000 or octet_length(p_blocks::text)>2000000 then
    raise exception 'This page exceeds the writing limit';
  end if;
  for b in select value from jsonb_array_elements(p_blocks) loop
    if jsonb_typeof(b)<>'object' or jsonb_typeof(b->'id') is distinct from 'string'
      or jsonb_typeof(b->'text') is distinct from 'string' or (b->>'type') is null
      or b->>'type' not in ('paragraph','heading1','heading2','bullet','number','check','quote','callout','code','divider','scene','action','character','dialogue')
      or (b ? 'checked' and jsonb_typeof(b->'checked')<>'boolean') then raise exception 'Invalid writing block'; end if;
  end loop;
  if (select count(distinct value->>'id') from jsonb_array_elements(p_blocks))<>jsonb_array_length(p_blocks) then raise exception 'Writing block IDs must be unique'; end if;
  select * into current_page from public.project_pages where id=p_page_id for update;
  if found then
    if current_page.job_id<>p_job_id or current_page.agency_id<>project.agency_id or current_page.archived_at is not null then raise exception 'Page is unavailable'; end if;
    if p_expected_revision is distinct from current_page.revision then raise exception 'PAGE_CONFLICT: This page changed elsewhere. Your draft has been kept'; end if;
  elsif p_expected_revision is distinct from 0 or p_archived then raise exception 'Page is unavailable'; end if;
  if p_client_visible and project.client_account_id is null then raise exception 'Internal project pages cannot be shared with a client'; end if;
  ancestor:=p_parent_id; seen:=array[p_page_id];
  while ancestor is not null loop
    if ancestor=any(seen) then raise exception 'A page cannot be nested inside itself or its children'; end if;
    seen:=array_append(seen,ancestor);
    select parent_page_id into ancestor from public.project_pages where id=ancestor and job_id=p_job_id
      and agency_id=project.agency_id and archived_at is null;
    if not found then raise exception 'Parent page must be active in the same project'; end if;
  end loop;
  if p_archived and exists(select 1 from public.project_pages where parent_page_id=p_page_id and archived_at is null) then
    raise exception 'Move or archive child pages first';
  end if;
  if current_page.id is null then
    insert into public.project_pages(id,agency_id,job_id,parent_page_id,title,blocks,client_visible,kind,created_by,updated_by)
      values(p_page_id,project.agency_id,p_job_id,p_parent_id,trim(p_title),p_blocks,coalesce(p_client_visible,false),p_kind,auth.uid(),auth.uid()) returning * into saved;
  else
    update public.project_pages set parent_page_id=p_parent_id,title=trim(p_title),blocks=p_blocks,client_visible=coalesce(p_client_visible,false),kind=p_kind,
      revision=revision+1,updated_by=auth.uid(),updated_at=clock_timestamp(),archived_at=case when p_archived then clock_timestamp() else null end
      where id=p_page_id returning * into saved;
  end if;
  insert into public.project_page_revisions(page_id,revision,title,blocks,saved_by)
    values(saved.id,saved.revision,saved.title,saved.blocks,auth.uid());
  return saved;
end; $$;
revoke all on function public.save_project_page(uuid,uuid,uuid,text,jsonb,boolean,integer,text,boolean) from public,anon;
grant execute on function public.save_project_page(uuid,uuid,uuid,text,jsonb,boolean,integer,text,boolean) to authenticated;

create function public.protect_project_page_client() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.client_account_id is distinct from old.client_account_id and exists(select 1 from public.project_pages where job_id=old.id) then
    raise exception 'Keep the client unchanged while this project has writing pages';
  end if;
  return new;
end; $$;
revoke all on function public.protect_project_page_client() from public,anon,authenticated;
create trigger jobs_protect_page_client before update on public.jobs for each row execute function public.protect_project_page_client();
commit;
