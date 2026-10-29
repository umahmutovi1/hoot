-- Google Calendar sync (docs/CALENDAR-SYNC.md) writes as the service role: a block moved in the
-- "Hoot" Google calendar gets its new day and time and becomes Fixed, which needs these columns
-- (0027 only allowed skip_requested_at). Profiles: the zone and day start to read the new time.
grant update (on_date, start_min, planned_start, planned_minutes, origin, plan_run_id, reason)
  on public.plan_blocks to service_role;
grant select (id, timezone, day_start_min) on public.profiles to service_role;
