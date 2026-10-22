-- FSRS (PRD "Spaced repetition (FSRS)", Stage 9). Additive only: v0.8.0 still reads the SM-2
-- columns (units.srs_ease, srs_interval_days, srs_success_count, profiles.srs_multiplier) and dev
-- and prod share this database, so they are dropped in a separate migration after v0.9.0.

alter table public.units
  add column fsrs_stability numeric,
  add column fsrs_difficulty numeric,
  add column fsrs_state smallint check (fsrs_state between 0 and 3),   -- ts-fsrs State: 0 new, 1 learning, 2 review, 3 relearning
  add column fsrs_reps smallint not null default 0,
  add column fsrs_lapses smallint not null default 0,
  add column review_streak smallint not null default 0,               -- "Sjećam se" in a row (level 3 after 4)
  add column last_review_at timestamptz;                              -- next_review_on stays

alter table public.cards
  add column fsrs_stability numeric,
  add column fsrs_difficulty numeric,
  add column fsrs_state smallint check (fsrs_state between 0 and 3),
  add column fsrs_reps smallint not null default 0,
  add column fsrs_lapses smallint not null default 0,
  add column review_streak smallint not null default 0,
  add column last_review_at timestamptz,
  add column next_review_on date;
create index cards_review_idx on public.cards (user_id, next_review_on);

alter table public.profiles
  add column review_cap_pct smallint not null default 40 check (review_cap_pct between 10 and 100),
  add column fsrs_params jsonb;                                        -- null = default parameters

alter table public.review_logs
  add column card_id uuid references public.cards on delete cascade,  -- a card's review (unit_id = its unit)
  add column elapsed_days numeric,
  add column stability_before numeric,
  add column stability_after numeric;
create index review_logs_card_idx on public.review_logs (card_id) where card_id is not null;

-- A skipped recall gate is recorded with the session (then a check of what was read follows).
alter table public.session_units
  add column recall_skipped boolean not null default false;
