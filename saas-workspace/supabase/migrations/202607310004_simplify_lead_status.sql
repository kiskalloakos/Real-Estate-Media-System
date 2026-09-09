-- Retire the legacy intermediate workflow states. Existing rows return
-- to Lead so every agency lead uses the four-state sales workflow.

alter table public.agency_leads
  alter column status drop default;

create type public.lead_status_v2 as enum (
  'pending',
  'follow_up',
  'won',
  'lost'
);

alter table public.agency_leads
  alter column status type public.lead_status_v2
  using (
    case
      when status::text in ('contacted', 'interested') then 'pending'
      else status::text
    end
  )::public.lead_status_v2;

drop type public.lead_status;

alter type public.lead_status_v2 rename to lead_status;

alter table public.agency_leads
  alter column status set default 'pending'::public.lead_status;
