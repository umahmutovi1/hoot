-- Sprint 17: aggregate the caller's own history. SECURITY INVOKER preserves all underlying
-- owner-only RLS policies. Expected minutes per amount come from the same TS duration model
-- used by the scheduler; this avoids a second, drifting implementation of the model in SQL.
create function public.progress_statistics(p_from date, p_to date, p_rates jsonb default '{}'::jsonb)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
with profile as (
  select timezone, day_start_min from public.profiles where id = (select auth.uid())
), sessions as (
  select s.id, s.timer_mode, s.focus, s.origin,
    ((s.started_at at time zone p.timezone) - make_interval(mins => p.day_start_min))::date as day,
    coalesce((select sum(greatest(0, extract(epoch from (least(g.ended_at, s.ended_at) - g.started_at)))) / 60
      from public.study_segments g where g.session_id = s.id and g.ended_at is not null),
      (select sum(u.minutes) from public.session_units u where u.session_id = s.id), 0) as minutes,
    (select sum(u.minutes) / nullif(sum(u.amount_done * (p_rates ->> u.unit_id::text)::numeric), 0)
      from public.session_units u where u.session_id = s.id and u.amount_done > 0
        and p_rates ? u.unit_id::text) as speed,
    case when extract(hour from s.started_at at time zone p.timezone) < p.day_start_min / 60.0 then 'night'
      when extract(hour from s.started_at at time zone p.timezone) < 12 then 'morning'
      when extract(hour from s.started_at at time zone p.timezone) < 15 then 'midday'
      when extract(hour from s.started_at at time zone p.timezone) < 19 then 'afternoon'
      when extract(hour from s.started_at at time zone p.timezone) < 23 then 'evening' else 'night' end as part
  from public.study_sessions s cross join profile p
  where s.ended_at is not null and s.user_id = (select auth.uid())
), selected as (
  select * from sessions where day between p_from and p_to
), days as (
  select d::date as day from pg_catalog.generate_series(p_from::timestamp, p_to::timestamp, '1 day') d
), daily as (
  select d.day,
    coalesce((select sum(s.minutes) from selected s where s.day = d.day), 0) as minutes,
    coalesce((select sum(b.planned_minutes) from public.plan_blocks b where b.on_date = d.day), 0) as planned,
    (select count(*) from public.plan_blocks b where b.on_date = d.day) as blocks,
    (select count(*) from public.plan_blocks b where b.on_date = d.day and b.status = 'done') as done
  from days d
), presets as (
  select timer_mode as id, count(*) as sessions, avg(focus) as focus, avg(speed) as speed
  from selected where origin = 'timer' group by timer_mode
), slots as (
  select part, count(*) as sessions, avg(focus) as focus, avg(speed) as speed
  from selected where origin = 'timer' group by part
)
select jsonb_build_object(
  'daily', coalesce((select jsonb_agg(to_jsonb(d) order by day) from daily d), '[]'::jsonb),
  'presets', coalesce((select jsonb_agg(to_jsonb(p)) from presets p), '[]'::jsonb),
  'slots', coalesce((select jsonb_agg(to_jsonb(s)) from slots s), '[]'::jsonb),
  'focus', (select avg(focus) from selected where origin = 'timer'),
  'sessions', (select count(*) from selected)
);
$$;
revoke all on function public.progress_statistics(date, date, jsonb) from public, anon;
grant execute on function public.progress_statistics(date, date, jsonb) to authenticated;
