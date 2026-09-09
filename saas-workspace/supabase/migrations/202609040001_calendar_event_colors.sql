-- NULL follows the shared event-type palette. Existing events need no backfill.
alter table public.calendar_events
  add column color text
  constraint calendar_events_color_check
  check (color in ('blue', 'green', 'amber', 'red', 'purple', 'pink', 'slate'));

comment on column public.calendar_events.color is
  'Shared iOS/web event color. NULL uses the automatic event-type color.';
