-- Signed-in client requests; existing external calendar exports stay unchanged.
begin;
create table public.calendar_booking_requests (
  id uuid primary key default gen_random_uuid(), agency_id uuid not null references public.agencies(id) on delete cascade,
  client_account_id uuid not null, requested_by uuid not null references public.profiles(id),
  category text not null check(category in ('call','shoot')), title text not null check(length(trim(title)) between 1 and 200),
  starts_at timestamptz not null, ends_at timestamptz not null, location text not null default '', note text not null default '',
  status text not null default 'pending' check(status in ('pending','confirmed','declined')),
  calendar_event_id uuid, created_at timestamptz not null default now(),
  foreign key(client_account_id,agency_id) references public.client_accounts(id,agency_id),
  foreign key(calendar_event_id,agency_id) references public.calendar_events(id,agency_id),
  check(ends_at>starts_at and ends_at<=starts_at+interval '24 hours'),
  check((status='confirmed')=(calendar_event_id is not null))
);
alter table public.calendar_booking_requests enable row level security;
create policy calendar_requests_read on public.calendar_booking_requests for select to authenticated using(
  public.is_agency_admin(agency_id) or (public.has_client_access(client_account_id) and requested_by=auth.uid())
);
grant select on public.calendar_booking_requests to authenticated;
revoke all on public.calendar_booking_requests from anon;
revoke insert,update,delete on public.calendar_booking_requests from authenticated;
create function public.request_calendar_booking(p_client_id uuid,p_category text,p_title text,p_starts_at timestamptz,p_ends_at timestamptz,p_location text default '',p_note text default '')
returns uuid language plpgsql security definer set search_path='' as $$
declare client public.client_accounts; request_id uuid;
begin
  if auth.uid() is null or not public.has_client_access(p_client_id) then raise exception 'Sign in with access to this client to request a booking'; end if;
  select * into client from public.client_accounts where id=p_client_id and archived_at is null;
  if not found then raise exception 'Client account is unavailable'; end if;
  if p_starts_at is null or p_ends_at is null or p_starts_at<=now() or p_ends_at<=p_starts_at or p_ends_at>p_starts_at+interval '24 hours'
    or p_category is null or p_category not in ('call','shoot') or p_title is null or length(trim(p_title)) not between 1 and 200
    or length(coalesce(p_location,''))>500 or length(coalesce(p_note,''))>4000 then raise exception 'Choose a future call or shoot, with a valid title and duration'; end if;
  -- Retrying an identical submission must not create duplicate requests.
  perform 1 from public.client_accounts where id=p_client_id for update;
  select id into request_id from public.calendar_booking_requests where requested_by=auth.uid() and client_account_id=p_client_id
    and category=p_category and starts_at=p_starts_at and ends_at=p_ends_at and title=trim(p_title) and status in ('pending','confirmed') limit 1;
  if request_id is not null then return request_id; end if;
  insert into public.calendar_booking_requests(agency_id,client_account_id,requested_by,category,title,starts_at,ends_at,location,note)
    values(client.agency_id,p_client_id,auth.uid(),p_category,trim(p_title),p_starts_at,p_ends_at,coalesce(p_location,''),coalesce(p_note,'')) returning id into request_id;
  return request_id;
end; $$;
create function public.decide_calendar_booking(p_request_id uuid,p_confirm boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare request public.calendar_booking_requests; event_id uuid;
begin
  select * into request from public.calendar_booking_requests where id=p_request_id;
  if not found or auth.uid() is null or not public.is_agency_admin(request.agency_id) then raise exception 'Only agency owners can confirm booking requests'; end if;
  if p_confirm is null then raise exception 'Choose confirm or decline'; end if;
  -- Serialize request confirmations within an agency.
  perform 1 from public.agencies where id=request.agency_id for update;
  select * into request from public.calendar_booking_requests where id=p_request_id for update;
  if request.status='confirmed' and p_confirm then return request.calendar_event_id; end if;
  if request.status<>'pending' then raise exception 'This request has already been decided'; end if;
  if p_confirm then
    if request.starts_at<=now() then raise exception 'This requested time has passed. Ask the client to choose a new time'; end if;
    if exists(select 1 from public.calendar_events e where e.agency_id=request.agency_id and e.archived_at is null
      and e.starts_at<request.ends_at and coalesce(e.ends_at,e.starts_at+interval '1 hour')>request.starts_at) then
      raise exception 'This time overlaps an existing calendar event. Choose a different time with the client';
    end if;
    insert into public.calendar_events(agency_id,client_account_id,title,description,starts_at,ends_at,location,visibility,created_by)
      values(request.agency_id,request.client_account_id,request.title,'[rm:type='||request.category||'][rm:scope=client]'||E'\n'||request.note,
        request.starts_at,request.ends_at,request.location,'client',auth.uid()) returning id into event_id;
    insert into public.calendar_event_assignees(agency_id,calendar_event_id,user_id) values(request.agency_id,event_id,auth.uid());
  end if;
  update public.calendar_booking_requests set status=case when p_confirm then 'confirmed' else 'declined' end,calendar_event_id=event_id where id=p_request_id;
  return event_id;
end; $$;
revoke all on function public.request_calendar_booking(uuid,text,text,timestamptz,timestamptz,text,text),public.decide_calendar_booking(uuid,boolean) from public,anon;
grant execute on function public.request_calendar_booking(uuid,text,text,timestamptz,timestamptz,text,text),public.decide_calendar_booking(uuid,boolean) to authenticated;
commit;
