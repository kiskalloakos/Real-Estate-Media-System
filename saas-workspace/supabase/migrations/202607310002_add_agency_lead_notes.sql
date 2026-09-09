alter table public.agency_leads
  add column if not exists notes text;
