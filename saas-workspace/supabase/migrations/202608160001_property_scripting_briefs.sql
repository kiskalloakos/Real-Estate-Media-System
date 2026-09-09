alter table public.properties
  add column if not exists scripting_brief text not null default '';
comment on column public.properties.scripting_brief is
  'Persistent factual cabana brief used by the scripting workflow. Keep it concrete: amenities, capacity, guest experiences, location context, rules, and booking details.';
