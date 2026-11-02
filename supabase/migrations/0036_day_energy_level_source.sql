-- Stage 11b (PRD "Dopune, 29. okt 2026"): energy of the day and the manual "Razumijem".

-- "Nemam energije" / "Pun/a sam energije" for one date: a scheduler input (`plan()`, input_hash)
-- and a signal for the models (joined to blocks by date in the ML export). Only that date; no row
-- = normal. The factor a low / high day means is learned from these rows (`energyFactors()`).
create table public.day_energy (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  on_date date not null,
  energy text not null check (energy in ('low', 'high')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, on_date)
);

alter table public.day_energy enable row level security;
create policy owner_all on public.day_energy for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.day_energy to authenticated;
create trigger set_updated_at before update on public.day_energy
  for each row execute function public.set_updated_at();

-- Where a unit's level came from: the recall gate / check, or "Označi bez provjere" (level 2
-- without FSRS memory, checked after READ_CHECK_DAYS). Null on levels set before this migration.
-- For the self-assessment calibration insight (Stage 11).
alter table public.units
  add column level_source text check (level_source in ('gate', 'manual'));
