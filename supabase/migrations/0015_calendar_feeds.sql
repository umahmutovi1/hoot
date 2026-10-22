-- Connected calendars (PRD "Povezani kalendari i integracije", Stage 8a). The secret iCal link
-- is a password: the app can write it but never read it back. Reads get `url_hint` (host and
-- the last 4 characters); only `sync-calendar` (service role) reads `url`.

create table public.calendar_feeds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  url text not null check (url ~* '^(https?|webcal)://' and char_length(url) <= 2048),
  url_hint text generated always as (
    coalesce(substring(url from '^[A-Za-z]+://([^/?#]+)'), '') || ' …' || right(url, 4)
  ) stored,
  kind text not null check (kind in ('busy', 'deadlines')),
  color text,
  all_day_busy boolean not null default false,
  busy_only boolean not null default false,      -- keep no title or location
  last_synced_at timestamptz,
  last_error text,                               -- an error code, never the link
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.calendar_feeds (user_id);

create table public.external_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  feed_id uuid not null references public.calendar_feeds on delete cascade,
  uid text not null,
  -- Timed: UTC instants. All-day: UTC midnights of the dates, end exclusive.
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at >= starts_at),
  all_day boolean not null default false,
  title text,
  location text,
  ignored boolean not null default false,        -- "ignoriši"; kept across syncs
  deadline_id uuid references public.deadlines on delete set null,   -- Moodle (Stage 10)
  updated_at timestamptz not null default now(),
  unique (feed_id, uid, starts_at)
);
create index on public.external_events (user_id, starts_at);

do $$
declare t text;
begin
  foreach t in array array['calendar_feeds', 'external_events']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy owner_all on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t
    );
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t
    );
  end loop;
end $$;

-- Column privileges: every column but `url` is readable; `url` can be written. A table-wide
-- grant (e.g. from default privileges) would override them, so start from nothing.
revoke all on public.calendar_feeds, public.external_events from anon, authenticated;
grant select (id, user_id, title, url_hint, kind, color, all_day_busy, busy_only,
  last_synced_at, last_error, created_at, updated_at) on public.calendar_feeds to authenticated;
grant insert (id, title, url, kind, color, all_day_busy, busy_only) on public.calendar_feeds to authenticated;
grant update (title, url, kind, color, all_day_busy, busy_only) on public.calendar_feeds to authenticated;
grant delete on public.calendar_feeds to authenticated;

-- Events are written by sync-calendar; the app reads them and can only (un)ignore one.
grant select on public.external_events to authenticated;
grant update (ignored) on public.external_events to authenticated;

grant select, insert, update, delete on public.calendar_feeds, public.external_events to service_role;
