-- Timer and sessions (PRD "Timer, pauza i rekalibracija", Stage 7).
-- 25/5 and 50/10 are reminders only; the mode is stored so every device shows the same countdown.
-- planned_minutes: the block length (Stage 8) or null for a free session.

alter table public.study_sessions
  add column timer_mode text not null default 'pomodoro25'
    check (timer_mode in ('pomodoro25', 'pomodoro50', 'free')),
  add column planned_minutes smallint check (planned_minutes > 0),
  add column created_at timestamptz not null default now();

alter table public.study_segments
  add constraint study_segments_end_after_start check (ended_at is null or ended_at >= started_at);

-- Finished sessions per source (PRD "Prije mjerenja"): below 3 a source shows only a suggested
-- duration, not a range.
alter table public.sources
  add column measured_sessions int not null default 0;
