-- Sessions added afterwards (PRD "Timer, pauza i rekalibracija" → Odluke, after Stage 7):
-- 'manual' sessions count for minutes, progress and unit status, never for speed calibration.

alter table public.study_sessions
  add column origin text not null default 'timer' check (origin in ('timer', 'manual'));

create index on public.study_sessions (user_id, subject_id, started_at desc);
