-- Stage 10: Moodle deadlines (PRD "Povezani kalendari", vrsta "Rokovi"). The course a Moodle event
-- belongs to (ICS CATEGORIES), used to match the deadline to a subject. Written by sync-calendar;
-- null when the feed keeps busy time only. Readable through the existing table-wide select grant.
alter table public.external_events
  add column category text check (category is null or char_length(category) <= 300);
