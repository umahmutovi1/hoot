-- Signals for the Stage 11a models (docs/RESEARCH-ML-2026-10.md 1.2, 5.1–5.3). Labels for a block
-- are done (confirmed), skipped (explicit) or unconfirmed (its time passed with nothing marked);
-- "done" never follows from elapsed time, so `missed` is read as unconfirmed, not as a failure.

-- FSRS: the rating given and the memory state just before the review (personal FSRS parameters).
alter table public.review_logs
  add column rating smallint check (rating between 1 and 4),  -- 1 Again, 2 Hard, 3 Good, 4 Easy
  add column state_before smallint check (state_before between 0 and 3),
  add column difficulty_before numeric,
  add column retrievability_before numeric check (retrievability_before between 0 and 1);

-- What the plan knew when it created the block (block completion model). Null on manual blocks
-- and on blocks planned before this migration.
alter table public.plan_blocks
  add column plan_start_min smallint,  -- start the plan gave it; start_min may move later
  add column day_load_min smallint,    -- planned minutes that day, manual blocks included
  add column days_to_goal smallint,    -- days from the block to its exam or deadline
  add column demand real;              -- placement demand from plan() (first pass, difficulty)

-- "Preskoči": the block moves (its material keeps priority), so one row may have two outcomes.
-- Every skip is its own explicit "skipped" example for the slot it left, with that slot's
-- features copied, because a replan may delete the moved block later.
create table public.block_skips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  block_id uuid references public.plan_blocks on delete set null,
  subject_id uuid not null references public.subjects on delete cascade,
  kind public.block_kind not null,
  reason text not null check (reason in ('skip', 'notification')),
  skipped_at timestamptz not null,
  on_date date not null,               -- local day of the slot that was left
  start_min smallint,
  planned_minutes smallint not null,
  day_load_min smallint,
  days_to_goal smallint,
  demand real,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.block_skips (user_id, on_date);
create index on public.block_skips (block_id);

alter table public.block_skips enable row level security;
create policy owner_all on public.block_skips for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create trigger set_updated_at before update on public.block_skips
  for each row execute function public.set_updated_at();
grant select, insert, update, delete on public.block_skips to authenticated;

-- Leaving the app during a running session (moved here from Stage 11, "Uvidi" → ometanja).
alter table public.study_sessions
  add column app_leaves integer not null default 0 check (app_leaves >= 0),
  add column app_away_sec integer not null default 0 check (app_away_sec >= 0);

-- replace_plan() lists its columns, so it is redefined to carry the features.
create or replace function public.replace_plan(
  p_run_id uuid,
  p_input_hash text,
  p_deficit jsonb,
  p_today date,
  p_from date,
  p_blocks jsonb,
  p_units jsonb
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.plan_blocks
     set status = 'missed'
   where user_id = (select auth.uid())
     and on_date < p_today
     and status = 'planned';

  if exists (select 1 from public.plan_runs where id = p_run_id) then
    return;
  end if;

  insert into public.plan_runs (id, input_hash, with_times, deficit)
  values (p_run_id, p_input_hash, true, p_deficit);

  delete from public.plan_blocks
   where user_id = (select auth.uid())
     and origin = 'ai'
     and status = 'planned'
     and on_date >= p_from
     and plan_run_id is distinct from p_run_id;

  insert into public.plan_blocks (
    id, subject_id, assessment_id, deadline_id, on_date, start_min, planned_start,
    planned_minutes, kind, reason, plan_run_id,
    plan_start_min, day_load_min, days_to_goal, demand
  )
  select b.id, b.subject_id, b.assessment_id, b.deadline_id, b.on_date, b.start_min,
         b.planned_start, b.planned_minutes, b.kind, b.reason, p_run_id,
         b.start_min, b.day_load_min, b.days_to_goal, b.demand
    from jsonb_to_recordset(p_blocks) as b(
      id uuid, subject_id uuid, assessment_id uuid, deadline_id uuid, on_date date,
      start_min smallint, planned_start timestamptz, planned_minutes smallint,
      kind public.block_kind, reason text,
      day_load_min smallint, days_to_goal smallint, demand real
    );

  insert into public.plan_block_units (block_id, unit_id, page_from, page_to, planned_minutes)
  select u.block_id, u.unit_id, u.page_from, u.page_to, u.planned_minutes
    from jsonb_to_recordset(p_units) as u(
      block_id uuid, unit_id uuid, page_from int, page_to int, planned_minutes smallint
    );
end;
$$;
