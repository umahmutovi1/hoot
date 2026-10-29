-- Google Calendar two-way sync (docs/CALENDAR-SYNC.md, Stage 10d).
--   calendar_accounts  the connected Google account; tokens are readable by the service role only
--   calendar_feeds     + source 'google': picked Google calendars are busy feeds like iCal links
--   calendar_channels  Google push channels (service role only)
--   calendar_items     what Hoot wants in its Google calendar; the app computes it (it computes the
--                      plan), the server pushes it
--   calendar_links     Google event <-> item; written by the server, read by the app for "u Google-u"

create table public.calendar_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid() references auth.users on delete cascade,
  provider text not null default 'google' check (provider = 'google'),
  email text,
  hoot_calendar_id text,
  app_origin text,                                 -- for the "Započni" link in events
  push_enabled boolean not null default true,      -- "Prikaži plan u Google kalendaru"
  status text not null default 'active' check (status in ('active', 'reconnect')),
  last_error text,                                 -- an error code, never a token
  last_synced_at timestamptz,
  last_pushed_at timestamptz,
  push_requested_at timestamptz,                   -- a push asked while another one ran
  push_lock_until timestamptz,
  refresh_token text,
  access_token text,
  access_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.calendar_feeds
  alter column url drop not null,
  add column source text not null default 'ics' check (source in ('ics', 'google')),
  add column account_id uuid references public.calendar_accounts on delete cascade,
  add column google_calendar_id text,
  add constraint calendar_feeds_source_fields check (
    (source = 'ics' and url is not null)
    or (source = 'google' and account_id is not null and google_calendar_id is not null)
  );
create unique index on public.calendar_feeds (account_id, google_calendar_id)
  where google_calendar_id is not null;

create table public.calendar_channels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  account_id uuid not null references public.calendar_accounts on delete cascade,
  google_calendar_id text not null,
  channel_id text not null unique,
  resource_id text not null,
  token text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.calendar_channels (account_id);

create table public.calendar_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  key text not null check (char_length(key) <= 200),   -- block:<id>, exam:<id>, deadline:<id>, class:<id>:<date>
  kind text not null check (kind in ('block', 'exam', 'deadline', 'class')),
  ref_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at >= starts_at),
  all_day boolean not null default false,
  title text not null check (char_length(title) <= 300),
  description text check (char_length(description) <= 4000),
  url_path text check (char_length(url_path) <= 300),
  color text,
  hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);

create table public.calendar_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  account_id uuid not null references public.calendar_accounts on delete cascade,
  google_calendar_id text not null,
  google_event_id text not null,
  item_key text,
  kind text not null,
  ref_id uuid,
  pushed_hash text,
  pushed_start timestamptz,                        -- reuse a block's event for the nearest new block
  etag text,
  -- 'deleted': the user deleted it in Google; the item is not pushed again until it changes.
  state text not null default 'ok' check (state in ('ok', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, google_event_id)
);
create unique index on public.calendar_links (user_id, item_key) where item_key is not null;

do $$
declare t text;
begin
  foreach t in array array['calendar_accounts', 'calendar_channels', 'calendar_items', 'calendar_links']
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

-- Tokens never reach the app: column grants only (as calendar_feeds.url). The account and links
-- are written by the google-calendar functions; the app reads them and switches push on or off.
revoke all on public.calendar_accounts, public.calendar_channels, public.calendar_items,
  public.calendar_links from anon, authenticated;
grant select (id, user_id, provider, email, hoot_calendar_id, push_enabled, status, last_error,
  last_synced_at, last_pushed_at, created_at, updated_at) on public.calendar_accounts to authenticated;
grant update (push_enabled) on public.calendar_accounts to authenticated;
grant select, insert, update, delete on public.calendar_items to authenticated;
grant select on public.calendar_links to authenticated;
-- calendar_channels: service role only (channel tokens).

grant select (source, account_id, google_calendar_id) on public.calendar_feeds to authenticated;

grant select, insert, update, delete on public.calendar_accounts, public.calendar_channels,
  public.calendar_items, public.calendar_links to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    -- Links only: calendar_accounts has column grants (tokens), which Realtime cannot filter.
    alter publication supabase_realtime add table public.calendar_links;
  end if;
end $$;
