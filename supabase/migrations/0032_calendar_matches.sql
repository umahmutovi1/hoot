-- Duplicates between connected calendars and Hoot (docs/CALENDAR-SYNC.md "Duplikati"): one row per
-- lecture series or exam event of a feed, with what the user decided, so nothing is asked twice.
--   linked    the same thing: one item in Hoot, the calendar's event is not written again
--   distinct  "Zadrži oba": two different things
--   skipped   not wanted in Hoot
--   hoot      "Hoot zamjenjuje": the calendar's event was deleted, Hoot's own stays
create table public.calendar_matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  feed_id uuid not null references public.calendar_feeds on delete cascade,
  match_key text not null check (char_length(match_key) <= 400),  -- series:<title>|<weekday>|<min> or event:<uid>
  kind text not null check (kind in ('lecture', 'exam')),
  target_id uuid,                     -- timetable_entries.id or assessments.id
  decision text not null check (decision in ('linked', 'distinct', 'skipped', 'hoot')),
  seen_start timestamptz,             -- the event's start when decided: a later move is "changed"
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (feed_id, match_key)
);
create index on public.calendar_matches (user_id);

alter table public.calendar_matches enable row level security;
create policy owner_all on public.calendar_matches for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create trigger set_updated_at before update on public.calendar_matches
  for each row execute function public.set_updated_at();
grant select, insert, update, delete on public.calendar_matches to authenticated;
grant select, insert, update, delete on public.calendar_matches to service_role;
