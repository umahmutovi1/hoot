-- Calendar sync foundation (docs/CALENDAR-SYNC.md, PR 1): server-side writes to events and plan
-- blocks (cron sync now, Google webhooks later) reach an open app through Realtime, so it
-- refetches and replans without a reload. Realtime applies the tables' RLS (owner only).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and tablename = 'external_events') then
      alter publication supabase_realtime add table public.external_events;
    end if;
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and tablename = 'plan_blocks') then
      alter publication supabase_realtime add table public.plan_blocks;
    end if;
  end if;
end $$;
