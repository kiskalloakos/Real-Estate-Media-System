alter table public.marketing_content
  add column if not exists assignee_user_ids uuid[] not null default '{}'::uuid[];
