-- Signed-in, version-specific reviews for engagements and legacy property work.
begin;
alter table public.media_assets add column client_account_id uuid,
  alter column property_id drop not null;
update public.media_assets a set client_account_id=p.client_account_id
  from public.properties p where p.id=a.property_id and p.agency_id=a.agency_id;
alter table public.media_assets
  add constraint media_asset_client_fk foreign key(client_account_id,agency_id) references public.client_accounts(id,agency_id),
  add constraint media_asset_context_required check (property_id is not null or job_id is not null);
alter table public.review_approval_events add column batch_id uuid;

create or replace function public.can_manage_media_asset(p_media_asset_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.media_assets a where a.id=p_media_asset_id and (
    public.is_agency_admin(a.agency_id) or public.is_property_team_member(a.property_id)
    or (public.is_agency_team_member(a.agency_id) and a.job_id is not null and (
      a.created_by=auth.uid() or exists(select 1 from public.jobs j where j.id=a.job_id and j.owner_user_id=auth.uid())
    ))
  ));
$$;
create or replace function public.can_access_media_asset(p_media_asset_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.media_assets a where a.id=p_media_asset_id and a.archived_at is null and (
    public.can_manage_media_asset(a.id) or (a.client_visible and public.has_client_access(a.client_account_id))
  ));
$$;
drop policy if exists media_assets_manage_admin_team on public.media_assets;
create policy media_assets_insert_manager on public.media_assets for insert to authenticated with check (
  created_by=auth.uid() and (public.is_agency_admin(agency_id) or public.is_property_team_member(property_id)
    or (public.is_agency_team_member(agency_id) and exists (
      select 1 from public.jobs j where j.id=media_assets.job_id and j.agency_id=media_assets.agency_id and j.owner_user_id=auth.uid()
    )))
);
create policy media_assets_update_manager on public.media_assets for update to authenticated
  using(public.can_manage_media_asset(id)) with check(public.can_manage_media_asset(id));
create policy media_assets_delete_manager on public.media_assets for delete to authenticated using(public.can_manage_media_asset(id));

create function public.validate_review_asset_context() returns trigger
language plpgsql security definer set search_path='' as $$
declare p public.properties; j public.jobs;
begin
  if new.property_id is not null then
    select * into p from public.properties where id=new.property_id and agency_id=new.agency_id and archived_at is null;
    if not found then raise exception 'Review property is unavailable'; end if;
    if new.client_account_id is null then new.client_account_id:=p.client_account_id; end if;
    if new.client_account_id is distinct from p.client_account_id then raise exception 'Review property must belong to its client'; end if;
  end if;
  if new.job_id is not null then
    select * into j from public.jobs where id=new.job_id and agency_id=new.agency_id and archived_at is null;
    if not found then raise exception 'Review project is unavailable'; end if;
    if new.client_account_id is null then new.client_account_id:=j.client_account_id; end if;
    if new.client_account_id is distinct from j.client_account_id then raise exception 'Review must use its project client'; end if;
  end if;
  if new.client_account_id is null then new.client_visible:=false; end if;
  if tg_op='UPDATE' and (new.agency_id is distinct from old.agency_id or new.created_by is distinct from old.created_by) then
    raise exception 'Review ownership is immutable';
  end if;
  if tg_op='UPDATE' and (new.property_id is distinct from old.property_id or new.client_account_id is distinct from old.client_account_id
    or (old.property_id is null and new.job_id is distinct from old.job_id))
    and exists(select 1 from public.media_versions where media_asset_id=old.id) then
    raise exception 'Keep existing review files in their original client and property context';
  end if;
  return new;
end; $$;
revoke all on function public.validate_review_asset_context() from public,anon,authenticated;
create trigger media_assets_validate_context before insert or update on public.media_assets
  for each row execute function public.validate_review_asset_context();

-- Parent-row locks serialize uploads with decisions and allocate version numbers.
create function public.prepare_review_version() returns trigger language plpgsql set search_path='' as $$
begin
  perform 1 from public.media_assets where id=new.media_asset_id and agency_id=new.agency_id and archived_at is null for update;
  if not found then raise exception 'Review is unavailable'; end if;
  select coalesce(max(version_number),0)+1 into new.version_number from public.media_versions where media_asset_id=new.media_asset_id;
  return new;
end; $$;
revoke all on function public.prepare_review_version() from public,anon,authenticated;
create trigger media_versions_prepare before insert on public.media_versions for each row execute function public.prepare_review_version();
create function public.reopen_review_for_version() returns trigger language plpgsql security definer set search_path='' as $$
begin
  update public.media_assets set status=case when client_visible then 'ready_for_review'::public.media_status else 'draft'::public.media_status end
    where id=new.media_asset_id and agency_id=new.agency_id;
  return new;
end; $$;
revoke all on function public.reopen_review_for_version() from public,anon,authenticated;
create trigger media_versions_reopen_review after insert on public.media_versions for each row execute function public.reopen_review_for_version();

drop trigger apply_review_decision_before_insert on public.review_approval_events;
create function public.validate_review_decision_target() returns trigger language plpgsql security definer set search_path='' as $$
declare latest uuid;
begin
  perform 1 from public.media_assets where id=new.media_asset_id and agency_id=new.agency_id and archived_at is null for update;
  if not found then raise exception 'Review is unavailable'; end if;
  if auth.uid() is not null and (not public.can_access_media_asset(new.media_asset_id)
    or (new.decision not in ('approved','changes_requested') and not public.can_manage_media_asset(new.media_asset_id))) then
    raise exception 'You cannot make this review decision';
  end if;
  select id into latest from public.media_versions where media_asset_id=new.media_asset_id order by version_number desc limit 1;
  if latest is null or new.media_version_id is distinct from latest then
    raise exception 'A selected file has a newer version. Refresh and review it before deciding';
  end if;
  if auth.uid() is not null then new.actor_id:=auth.uid(); end if;
  new.created_at:=clock_timestamp();
  return new;
end; $$;
revoke all on function public.validate_review_decision_target() from public,anon,authenticated;
create trigger review_decisions_validate before insert on public.review_approval_events for each row execute function public.validate_review_decision_target();
create or replace function public.apply_review_decision() returns trigger language plpgsql security definer set search_path='' as $$
begin
  update public.media_assets set status=case new.decision
    when 'approved' then 'approved'::public.media_status
    when 'changes_requested' then 'changes_requested'::public.media_status
    else 'ready_for_review'::public.media_status end,
    client_visible=case when new.decision='ready_for_review' then true else client_visible end
    where id=new.media_asset_id and agency_id=new.agency_id;
  return new;
end; $$;
create trigger apply_review_decision_after_insert after insert on public.review_approval_events for each row execute function public.apply_review_decision();

-- Publishing and metadata edits cannot manufacture a client approval.
create function public.protect_review_status() returns trigger language plpgsql security definer set search_path='' as $$
declare expected public.review_decision;
begin
  if new.status in ('approved','changes_requested') and (tg_op='INSERT' or new.status is distinct from old.status) then
    select e.decision into expected from public.review_approval_events e join public.media_versions v on v.id=e.media_version_id
      where e.media_asset_id=new.id and v.version_number=(select max(version_number) from public.media_versions where media_asset_id=new.id)
      order by e.created_at desc,e.id desc limit 1;
    if expected is null or expected::text<>new.status::text then raise exception 'Use a version-specific review decision to change approval status'; end if;
  end if;
  return new;
end; $$;
revoke all on function public.protect_review_status() from public,anon,authenticated;
create trigger media_assets_protect_review_status before insert or update on public.media_assets for each row execute function public.protect_review_status();

create function public.decide_review_versions(p_targets jsonb,p_decision public.review_decision,p_note text default '')
returns void language plpgsql security invoker set search_path='' as $$
declare target record; a public.media_assets; first_scope text; scope text; decision_batch uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to review content'; end if;
  if p_targets is null or jsonb_typeof(p_targets)<>'array' or jsonb_array_length(p_targets)<1 or jsonb_array_length(p_targets)>200 then raise exception 'Choose between 1 and 200 review items'; end if;
  if p_decision is null or p_decision not in ('approved','changes_requested','approval_revoked') then raise exception 'Unsupported review decision'; end if;
  if jsonb_array_length(p_targets)>1 then decision_batch:=gen_random_uuid(); end if;
  if (select count(distinct x->>'assetId') from jsonb_array_elements(p_targets) x)<>jsonb_array_length(p_targets) then raise exception 'Choose each review item once'; end if;
  for target in select (x->>'assetId')::uuid as asset_id,(x->>'versionId')::uuid as version_id from jsonb_array_elements(p_targets) x order by 1 loop
    select * into a from public.media_assets where id=target.asset_id and archived_at is null;
    if not found then raise exception 'A selected review is unavailable'; end if;
    scope:=a.agency_id::text||':'||coalesce(a.job_id::text,a.property_id::text);
    if first_scope is null then first_scope:=scope; elsif scope<>first_scope then raise exception 'Approve items from one project or property at a time'; end if;
    insert into public.review_approval_events(agency_id,media_asset_id,media_version_id,decision,note,actor_id,batch_id)
      values(a.agency_id,a.id,target.version_id,p_decision,nullif(trim(p_note),''),auth.uid(),decision_batch);
  end loop;
end; $$;
revoke all on function public.decide_review_versions(jsonb,public.review_decision,text) from public,anon;
grant execute on function public.decide_review_versions(jsonb,public.review_decision,text) to authenticated;

create function public.validate_review_reply() returns trigger language plpgsql set search_path='' as $$
declare parent public.review_comments;
begin
  if tg_op='UPDATE' and new.visibility is distinct from old.visibility then raise exception 'Comment visibility is fixed when posted'; end if;
  if new.parent_comment_id is not null then
    select * into parent from public.review_comments where id=new.parent_comment_id and agency_id=new.agency_id;
    if not found or parent.media_version_id<>new.media_version_id or parent.visibility<>new.visibility then
      raise exception 'Replies must stay in the same version and conversation visibility';
    end if;
  end if;
  return new;
end; $$;
revoke all on function public.validate_review_reply() from public,anon,authenticated;
create trigger review_comments_validate_reply before insert or update on public.review_comments for each row execute function public.validate_review_reply();

-- Both old property paths and new project paths remain private and asset-scoped.
create function public.can_read_review_storage_path(p_path text) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.media_assets a where a.id::text=split_part(p_path,'/',4)
    and a.agency_id::text=split_part(p_path,'/',1)
    and coalesce(a.client_account_id::text,'internal')=split_part(p_path,'/',2)
    and (a.property_id::text=split_part(p_path,'/',3) or a.job_id::text=split_part(p_path,'/',3))
    and public.can_access_media_asset(a.id));
$$;
create function public.can_manage_review_storage_path(p_path text) returns boolean language sql stable security definer set search_path='' as $$
  select public.can_read_review_storage_path(p_path) and exists(select 1 from public.media_assets a
    where a.id::text=split_part(p_path,'/',4) and public.can_manage_media_asset(a.id));
$$;
revoke all on function public.can_read_review_storage_path(text),public.can_manage_review_storage_path(text) from public,anon;
grant execute on function public.can_read_review_storage_path(text),public.can_manage_review_storage_path(text) to authenticated;
drop policy media_review_select_access on storage.objects;
drop policy media_review_insert_access on storage.objects;
drop policy media_review_update_manager on storage.objects;
drop policy media_review_delete_manager on storage.objects;
create policy media_review_select_access on storage.objects for select to authenticated using(bucket_id='media-review' and public.can_read_review_storage_path(name));
create policy media_review_insert_access on storage.objects for insert to authenticated with check(bucket_id='media-review' and public.can_manage_review_storage_path(name));
create policy media_review_update_manager on storage.objects for update to authenticated using(bucket_id='media-review' and public.can_manage_review_storage_path(name)) with check(bucket_id='media-review' and public.can_manage_review_storage_path(name));
create policy media_review_delete_manager on storage.objects for delete to authenticated using(bucket_id='media-review' and public.can_manage_review_storage_path(name));
-- Review alerts follow the owner/creator, assigned property team and signed-in client.
create function public.review_notification_recipients(p_asset_id uuid,p_clients boolean)
returns table(user_id uuid) language sql stable security definer set search_path='' as $$
  select distinct m.user_id from public.media_assets a join public.agency_memberships m on m.agency_id=a.agency_id and m.status='active'
  where a.id=p_asset_id and a.archived_at is null and (
    (m.role in ('admin','team_member') and (m.user_id=a.created_by
      or exists(select 1 from public.jobs j where j.id=a.job_id and j.owner_user_id=m.user_id)
      or exists(select 1 from public.property_team_assignments t where t.property_id=a.property_id and t.user_id=m.user_id)))
    or (p_clients and a.client_visible and m.role='client' and exists(
      select 1 from public.client_memberships c where c.client_account_id=a.client_account_id and c.user_id=m.user_id and c.status='active'
    ))
  );
$$;
revoke all on function public.review_notification_recipients(uuid,boolean) from public,anon,authenticated;
create or replace function public.notify_review_comment() returns trigger language plpgsql security definer set search_path='' as $$
declare a public.media_assets; recipient uuid; begin
  select * into a from public.media_assets where id=new.media_asset_id;
  for recipient in select user_id from public.review_notification_recipients(a.id,new.visibility='client') where user_id<>new.author_id loop
    perform public.create_user_notification(new.agency_id,recipient,'review','New feedback: '||a.title,
      case when new.visibility='internal' then 'A team-only note was added.' else 'New feedback was added to a file version.' end,
      'reviews','/(portal)/(reviews)/'||a.id::text,'review_comment',new.id,'review-comment:'||new.id::text,
      jsonb_build_object('mediaAssetId',a.id,'versionId',new.media_version_id));
  end loop;
  return new;
end; $$;
create or replace function public.notify_review_decision() returns trigger language plpgsql security definer set search_path='' as $$
declare a public.media_assets; recipient uuid; begin
  select * into a from public.media_assets where id=new.media_asset_id;
  for recipient in select user_id from public.review_notification_recipients(a.id,true) where user_id<>new.actor_id loop
    perform public.create_user_notification(new.agency_id,recipient,'review',
      case new.decision when 'approved' then 'Approved: ' when 'changes_requested' then 'Changes requested: ' else 'Review updated: ' end||a.title,
      coalesce(nullif(trim(new.note),''),'A version-specific review decision was recorded.'),
      'reviews','/(portal)/(reviews)/'||a.id::text,'review_approval_event',new.id,'review-decision:'||new.id::text,
      jsonb_build_object('mediaAssetId',a.id,'versionId',new.media_version_id,'decision',new.decision));
  end loop;
  return new;
end; $$;
create function public.notify_review_version() returns trigger language plpgsql security definer set search_path='' as $$
declare a public.media_assets; recipient uuid; begin
  select * into a from public.media_assets where id=new.media_asset_id;
  for recipient in select user_id from public.review_notification_recipients(a.id,true) where user_id is distinct from new.uploaded_by loop
    perform public.create_user_notification(new.agency_id,recipient,'review','New version v'||new.version_number||': '||a.title,
      'A new file version is ready for review. Previous feedback and decisions remain in history.',
      'reviews','/(portal)/(reviews)/'||a.id::text,'media_version',new.id,'review-version:'||new.id::text,
      jsonb_build_object('mediaAssetId',a.id,'versionId',new.id));
  end loop;
  return new;
end; $$;
revoke all on function public.notify_review_version() from public,anon,authenticated;
create trigger media_versions_notify_review after insert on public.media_versions for each row execute function public.notify_review_version();
commit;
