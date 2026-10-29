-- Event classification (docs/CALENDAR-SYNC.md "Klasifikacija", Stage 10d). Rules run in the app
-- and are not stored; only the AI's answer for titles the rules cannot read and the user's own
-- choice are kept. sync-calendar does not write these columns, so they survive every sync.
alter table public.external_events
  add column kind text check (kind in ('busy', 'lecture', 'exam', 'deadline', 'free')),
  add column kind_by text check (kind_by in ('ai', 'user'));

grant update (kind, kind_by) on public.external_events to authenticated;

alter type ai_task add value if not exists 'classify_events';
