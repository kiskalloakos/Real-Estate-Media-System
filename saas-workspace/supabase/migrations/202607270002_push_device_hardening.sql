begin;

create or replace function public.protect_push_device_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id <> old.id
    or new.user_id <> old.user_id
    or new.expo_push_token <> old.expo_push_token
    or new.created_at <> old.created_at then
    raise exception 'Push device identity is immutable';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_push_device_identity_before_update
  on public.push_devices;

create trigger protect_push_device_identity_before_update
  before update on public.push_devices
  for each row execute function public.protect_push_device_identity();

commit;
