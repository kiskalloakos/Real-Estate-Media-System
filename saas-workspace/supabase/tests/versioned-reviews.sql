-- Full live-schema test. New test agencies/users, review records and storage metadata all roll back.
begin;
set local statement_timeout='30s';
create function pg_temp.review_assert(ok boolean,message text) returns void language plpgsql as $$begin
  if ok is distinct from true then raise exception 'FAIL: %',message; end if;
end;$$;
create function pg_temp.review_reject(statement text,expected text) returns void language plpgsql as $$
declare rejected boolean:=false;begin
  begin execute statement;exception when others then
    if sqlerrm ilike '%'||expected||'%' then rejected:=true;else raise;end if;
  end;
  perform pg_temp.review_assert(rejected,'Expected rejection: '||expected);
end;$$;
create function pg_temp.review_no_access(statement text) returns boolean language plpgsql as $$
declare visible boolean;begin
  execute 'select exists('||statement||')' into visible;
  return not visible;
exception when insufficient_privilege then return true;
end;$$;
create temporary table review_test_context(
  owner_a uuid default gen_random_uuid(),owner_b uuid default gen_random_uuid(),editor uuid default gen_random_uuid(),client_user uuid default gen_random_uuid(),
  agency_a uuid,agency_b uuid,client_a uuid default gen_random_uuid(),client_b uuid default gen_random_uuid(),
  project_a uuid default gen_random_uuid(),project_b uuid default gen_random_uuid(),project_foreign uuid default gen_random_uuid(),internal_project uuid default gen_random_uuid(),property_a uuid default gen_random_uuid(),
  asset_a uuid default gen_random_uuid(),asset_b uuid default gen_random_uuid(),asset_other uuid default gen_random_uuid(),asset_private uuid default gen_random_uuid(),asset_foreign uuid default gen_random_uuid(),asset_internal uuid default gen_random_uuid(),asset_legacy uuid default gen_random_uuid(),
  v1 uuid default gen_random_uuid(),v2 uuid default gen_random_uuid(),v3 uuid default gen_random_uuid(),cover_v1 uuid default gen_random_uuid(),cover_v2 uuid default gen_random_uuid(),
  other_v1 uuid default gen_random_uuid(),
  comment_public uuid default gen_random_uuid(),comment_internal uuid default gen_random_uuid(),original_events bigint
);
insert into review_test_context default values;
grant select on review_test_context to authenticated,anon;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
select owner_a,owner_a::text||'@example.invalid',now(),'{"signup_role":"agency_owner","agency_name":"Review verification A","full_name":"Review owner A"}'::jsonb from review_test_context
union all select owner_b,owner_b::text||'@example.invalid',now(),'{"signup_role":"agency_owner","agency_name":"Review verification B","full_name":"Review owner B"}'::jsonb from review_test_context;
insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
select editor,editor::text||'@example.invalid',now(),'{"agency_provisioned":true}'::jsonb,'{"role":"team_member","full_name":"Review editor"}'::jsonb from review_test_context
union all select client_user,client_user::text||'@example.invalid',now(),'{"agency_provisioned":true}'::jsonb,'{"role":"client","full_name":"Review client"}'::jsonb from review_test_context;
update review_test_context set agency_a=(select agency_id from public.agency_memberships where user_id=owner_a),agency_b=(select agency_id from public.agency_memberships where user_id=owner_b);
select set_config('request.jwt.claim.sub',owner_a::text,true) from review_test_context;
set local role authenticated;
select public.admin_attach_team_user(agency_a,editor,'Review editor') from review_test_context;
insert into public.client_accounts(id,agency_id,name,created_by)
select client_a,agency_a,'Review client A',owner_a from review_test_context
union all select client_b,agency_a,'Other client',owner_a from review_test_context;
select public.attach_client_user(agency_a,client_user,client_a,'owner','Review client') from review_test_context;
insert into public.properties(id,agency_id,client_account_id,name,created_by)
select property_a,agency_a,client_a,'Review legacy location',owner_a from review_test_context;
insert into public.jobs(id,agency_id,client_account_id,name,created_by,owner_user_id)
select project_a,agency_a,client_a,'Social media',owner_a,editor from review_test_context
union all select project_b,agency_a,client_a,'Website',owner_a,editor from review_test_context
union all select project_foreign,agency_a,client_b,'Other client work',owner_a,owner_a from review_test_context
union all select internal_project,agency_a,null,'Internal review work',owner_a,owner_a from review_test_context;
insert into public.media_assets(id,agency_id,job_id,kind,title,client_visible,created_by)
select asset_a,agency_a,project_a,'video'::public.media_kind,'Hero reel',true,owner_a from review_test_context
union all select asset_b,agency_a,project_a,'image'::public.media_kind,'Cover',true,owner_a from review_test_context
union all select asset_other,agency_a,project_b,'image'::public.media_kind,'Website image',true,owner_a from review_test_context
union all select asset_private,agency_a,project_a,'image'::public.media_kind,'Private file',false,owner_a from review_test_context
union all select asset_foreign,agency_a,project_foreign,'image'::public.media_kind,'Other client file',true,owner_a from review_test_context
union all select asset_internal,agency_a,internal_project,'image'::public.media_kind,'Agency-only file',false,owner_a from review_test_context;
insert into public.media_assets(id,agency_id,property_id,kind,title,client_visible,created_by)
select asset_legacy,agency_a,property_a,'image','Legacy property file',true,owner_a from review_test_context;
insert into public.media_versions(id,agency_id,media_asset_id,version_number,storage_path,original_filename,mime_type,byte_size,uploaded_by)
select v1,agency_a,asset_a,999,agency_a::text||'/'||client_a::text||'/'||project_a::text||'/'||asset_a::text||'/v1.mp4','v1.mp4','video/mp4',0,owner_a from review_test_context
union all select cover_v1,agency_a,asset_b,999,agency_a::text||'/'||client_a::text||'/'||project_a::text||'/'||asset_b::text||'/cover.png','cover.png','image/png',0,owner_a from review_test_context
union all select other_v1,agency_a,asset_other,1,agency_a::text||'/'||client_a::text||'/'||project_b::text||'/'||asset_other::text||'/website.png','website.png','image/png',0,owner_a from review_test_context;
select pg_temp.review_assert((select version_number=1 from public.media_versions where id=v1),'version numbers allocated by server') from review_test_context;
select pg_temp.review_reject(format('update public.media_assets set status=%L where id=%L','approved',asset_other),'version-specific review decision') from review_test_context;
insert into storage.objects(bucket_id,name)
select 'media-review',agency_a::text||'/'||client_a::text||'/'||project_a::text||'/'||asset_a::text||'/v1.mp4' from review_test_context
union all select 'media-review',agency_a::text||'/'||client_a::text||'/'||project_a::text||'/'||asset_private::text||'/private.png' from review_test_context
union all select 'media-review',agency_a::text||'/'||client_a::text||'/'||property_a::text||'/'||asset_legacy::text||'/legacy.png' from review_test_context;

reset role;
select set_config('request.jwt.claim.sub',client_user::text,true) from review_test_context;
set local role authenticated;
select pg_temp.review_assert(not exists(select 1 from public.media_assets where id in(asset_private,asset_foreign,asset_internal)),'client cannot read private, internal or other-client files') from review_test_context;
select pg_temp.review_assert(not public.can_read_review_storage_path(agency_a::text||'/'||client_a::text||'/'||project_a::text||'/'||asset_private::text||'/private.png'),'private file storage remains hidden') from review_test_context;
select pg_temp.review_assert(public.can_read_review_storage_path(agency_a::text||'/'||client_a::text||'/'||property_a::text||'/'||asset_legacy::text||'/legacy.png'),'legacy property file paths remain readable') from review_test_context;
select pg_temp.review_assert(not exists(select 1 from storage.objects where name like '%/private.png'),'storage RLS hides private objects');
select public.decide_review_versions(jsonb_build_array(jsonb_build_object('assetId',asset_a,'versionId',v1)),'approved') from review_test_context;
select pg_temp.review_assert((select status='approved' from public.media_assets where id=asset_a),'single-version approval works for signed-in client') from review_test_context;
select pg_temp.review_reject(format('select public.decide_review_versions(%L::jsonb,%L)',jsonb_build_array(jsonb_build_object('assetId',asset_a,'versionId',v1)),'approval_revoked'),'cannot make this review decision') from review_test_context;
insert into public.review_comments(id,agency_id,media_asset_id,media_version_id,author_id,body,timestamp_seconds)
select comment_public,agency_a,asset_a,v1,client_user,'V1 public feedback',1 from review_test_context;
update public.review_comments set status='resolved' where id=(select comment_public from review_test_context);
select pg_temp.review_assert((select resolved_by=client_user and resolved_at is not null from public.review_comments where id=comment_public),'client can resolve their own feedback') from review_test_context;

reset role;
select set_config('request.jwt.claim.sub',owner_a::text,true) from review_test_context;
set local role authenticated;
insert into public.media_versions(id,agency_id,media_asset_id,version_number,storage_path,original_filename,mime_type,byte_size,uploaded_by)
select v2,agency_a,asset_a,1,agency_a::text||'/'||client_a::text||'/'||project_a::text||'/'||asset_a::text||'/v2.mp4','v2.mp4','video/mp4',0,owner_a from review_test_context
union all select cover_v2,agency_a,asset_b,1,agency_a::text||'/'||client_a::text||'/'||project_a::text||'/'||asset_b::text||'/cover-v2.png','cover-v2.png','image/png',0,owner_a from review_test_context;
select pg_temp.review_assert((select status='ready_for_review' from public.media_assets where id=asset_a),'new revision reopens review') from review_test_context;
select pg_temp.review_reject(format('update public.media_assets set job_id=%L where id=%L',project_b,asset_a),'original client and property context') from review_test_context;
insert into public.review_comments(id,agency_id,media_asset_id,media_version_id,author_id,body,visibility)
select comment_internal,agency_a,asset_a,v2,owner_a,'Private internal review note','internal' from review_test_context;
reset role;
update review_test_context set original_events=(select count(*) from public.review_approval_events where agency_id=agency_a);
select set_config('request.jwt.claim.sub',client_user::text,true) from review_test_context;
set local role authenticated;
select pg_temp.review_assert(not exists(select 1 from public.review_comments where id=comment_internal),'internal feedback is invisible to client') from review_test_context;
select pg_temp.review_assert(not exists(select 1 from public.notifications where entity_id=comment_internal),'internal feedback sends no client alert') from review_test_context;
select pg_temp.review_reject(format('select public.decide_review_versions(%L::jsonb,%L)',jsonb_build_array(jsonb_build_object('assetId',asset_a,'versionId',v1)),'approved'),'newer version') from review_test_context;
select pg_temp.review_reject(format('insert into public.review_comments(agency_id,media_asset_id,media_version_id,parent_comment_id,author_id,body) values(%L,%L,%L,%L,%L,%L)',agency_a,asset_a,v2,comment_public,client_user,'Wrong-version reply'),'same version') from review_test_context;
select pg_temp.review_reject(format('select public.decide_review_versions(%L::jsonb,%L)',jsonb_build_array(jsonb_build_object('assetId',asset_a,'versionId',v2),jsonb_build_object('assetId',asset_b,'versionId',cover_v1)),'approved'),'newer version') from review_test_context;
select pg_temp.review_assert((select count(*) from public.review_approval_events)=original_events,'stale batch inserts no decisions') from review_test_context;
select pg_temp.review_reject(format('select public.decide_review_versions(%L::jsonb,%L)',jsonb_build_array(jsonb_build_object('assetId',asset_a,'versionId',v2),jsonb_build_object('assetId',asset_other,'versionId',other_v1)),'approved'),'one project or property') from review_test_context;
select public.decide_review_versions(jsonb_build_array(jsonb_build_object('assetId',asset_a,'versionId',v2),jsonb_build_object('assetId',asset_b,'versionId',cover_v2)),'approved','Batch approved') from review_test_context;
select pg_temp.review_assert((select count(distinct batch_id)=1 and count(*)=2 from public.review_approval_events where media_version_id in(v2,cover_v2)),'batch decisions share one receipt') from review_test_context;
select pg_temp.review_assert(not exists(select 1 from public.notifications where metadata->>'mediaAssetId'=asset_private::text),'private reviews send no client notification') from review_test_context;

reset role;
select set_config('request.jwt.claim.sub',owner_a::text,true) from review_test_context;
set local role authenticated;
insert into public.media_versions(id,agency_id,media_asset_id,version_number,storage_path,original_filename,mime_type,byte_size,uploaded_by)
select v3,agency_a,asset_a,1,agency_a::text||'/'||client_a::text||'/'||project_a::text||'/'||asset_a::text||'/v3.mp4','v3.mp4','video/mp4',0,owner_a from review_test_context;
select pg_temp.review_assert((select version_number=3 from public.media_versions where id=v3),'two revision rounds preserve allocation') from review_test_context;
select pg_temp.review_assert((select count(*)=1 from public.review_comments where media_version_id=v1),'v1 feedback remains in history') from review_test_context;
select pg_temp.review_assert((select count(*)=1 from public.review_approval_events where media_version_id=v2),'v2 approval remains in history') from review_test_context;
select pg_temp.review_assert((select status='ready_for_review' from public.media_assets where id=asset_a),'v3 does not inherit v2 approval') from review_test_context;
reset role;
select set_config('request.jwt.claim.sub',owner_b::text,true) from review_test_context;
set local role authenticated;
select pg_temp.review_assert(not exists(select 1 from public.media_assets),'other agency sees no review assets');
select pg_temp.review_assert(not exists(select 1 from public.review_comments),'other agency sees no feedback');
select pg_temp.review_assert(not exists(select 1 from storage.objects where bucket_id='media-review'),'other agency sees no review files');
reset role;
set local role anon;
select pg_temp.review_assert(pg_temp.review_no_access('select 1 from public.media_assets'),'anonymous review access is denied');
select pg_temp.review_reject(format('select public.decide_review_versions(%L::jsonb,%L)',jsonb_build_array(jsonb_build_object('assetId',asset_a,'versionId',v3)),'approved'),'permission denied') from review_test_context;
reset role;
rollback;
select 'PASS: signed-in individual/batch approvals, stale batch rollback, two revision rounds, private notes/files, legacy paths, notifications, and tenant isolation; all test data rolled back' as verification;
