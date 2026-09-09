drop policy if exists notifications_delete_own on public.notifications;

create policy notifications_delete_own
on public.notifications
for delete
to authenticated
using (recipient_user_id = auth.uid());
