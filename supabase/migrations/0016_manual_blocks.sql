-- Stage 8b: manual blocks, temporary priority boost and saving a plan in one call.

-- Manual blocks (PRD flow 7): a block the user added or changed is never moved or deleted by
-- replan and has no plan run.
alter table public.plan_blocks
  add column origin public.assigned_by not null default 'ai',
  add column title text,
  alter column plan_run_id drop not null;

-- Replan deletes future, unstarted AI blocks of a user from a day on.
create index plan_blocks_replan_idx on public.plan_blocks (user_id, on_date)
  where origin = 'ai' and status = 'planned';

-- "Uzmi vrijeme od …": urgency × 1.3 until this day (inclusive), then it ends by itself.
alter table public.subjects
  add column priority_boost_until date;

-- Saves a plan computed in the browser (PRD "Scheduler" → Replan je idempotentan):
-- 1. blocks of past days that are still planned become missed;
-- 2. future (from `p_from`) unstarted AI blocks of other runs are deleted;
-- 3. the run, its blocks and their units are inserted.
-- Ids come from the client, so sending the same call twice changes nothing. Done, missed,
-- skipped and manual blocks are never touched. Runs as the caller (RLS applies).
create function public.replace_plan(
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
    planned_minutes, kind, reason, plan_run_id
  )
  select b.id, b.subject_id, b.assessment_id, b.deadline_id, b.on_date, b.start_min,
         b.planned_start, b.planned_minutes, b.kind, b.reason, p_run_id
    from jsonb_to_recordset(p_blocks) as b(
      id uuid, subject_id uuid, assessment_id uuid, deadline_id uuid, on_date date,
      start_min smallint, planned_start timestamptz, planned_minutes smallint,
      kind public.block_kind, reason text
    );

  insert into public.plan_block_units (block_id, unit_id, page_from, page_to, planned_minutes)
  select u.block_id, u.unit_id, u.page_from, u.page_to, u.planned_minutes
    from jsonb_to_recordset(p_units) as u(
      block_id uuid, unit_id uuid, page_from int, page_to int, planned_minutes smallint
    );
end;
$$;

revoke execute on function public.replace_plan(uuid, text, jsonb, date, date, jsonb, jsonb)
  from public, anon;
grant execute on function public.replace_plan(uuid, text, jsonb, date, date, jsonb, jsonb)
  to authenticated;
