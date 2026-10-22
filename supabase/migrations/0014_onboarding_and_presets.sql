-- Onboarding, session presets and session signals (PRD "Onboarding", "Timer, pauza i
-- rekalibracija" → Predlošci sesije, "Podaci za strategista", Stage 8a).
-- Backward compatible with v0.7: only new nullable/defaulted columns and a dropped check.

alter table public.profiles
  add column onboarded_at timestamptz,                         -- null = onboarding not finished
  add column onboarding_step smallint not null default 0
    check (onboarding_step between 0 and 8),
  add column wake_min smallint[]                               -- {weekday, weekend}, min after midnight
    check (wake_min is null or (cardinality(wake_min) = 2 and 0 <= all (wake_min) and 1440 > all (wake_min))),
  add column sleep_min smallint[]                              -- {weekday, weekend}
    check (sleep_min is null or (cardinality(sleep_min) = 2 and 0 <= all (sleep_min) and 1440 > all (sleep_min))),
  add column preferred_slots text[] not null default '{}'      -- prior for study slots
    check (preferred_slots <@ array['morning', 'midday', 'afternoon', 'evening', 'night']),
  add column session_presets jsonb not null default '[]'       -- custom presets (Zod in _shared)
    check (jsonb_typeof(session_presets) = 'array'),
  add column default_preset text not null default 'standard',
  add column exam_eve_end_min smallint not null default 1380   -- 23:00, sleep before an exam
    check (exam_eve_end_min between 0 and 1440),
  add column ics_token text;                                   -- plan export; null = off

-- Users who already use the app are not sent through onboarding.
update public.profiles set onboarded_at = now(), onboarding_step = 8 where name_confirmed_at is not null;

-- timer_mode is now a preset id (built-in or 'custom:<uuid>'); the Stage 7 values stay valid.
alter table public.study_sessions
  drop constraint study_sessions_timer_mode_check,
  alter column timer_mode set default 'standard',
  add constraint study_sessions_timer_mode_check check (char_length(timer_mode) between 1 and 64),
  add column break_ends_at timestamptz,                        -- Web Push at the end of a break (Stage 9)
  add column focus_reasons text[]                              -- with focus 1
    check (focus_reasons is null or focus_reasons <@ array['tired', 'phone', 'noise', 'hard', 'sleep']),
  add column distractions smallint not null default 0 check (distractions >= 0);

-- Temporary source from the rough size of the material; replaced by real content later.
alter table public.sources
  add column is_rough boolean not null default false;
