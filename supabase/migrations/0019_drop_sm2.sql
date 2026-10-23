-- SM-2 columns replaced by FSRS in 0017 (Stage 9). Dropped only after v0.9.0 is in production:
-- v0.8.0 still read them on the shared database, v0.9.0 never does.
alter table public.units
  drop column srs_ease,
  drop column srs_interval_days,
  drop column srs_success_count;
alter table public.profiles
  drop column srs_multiplier;
