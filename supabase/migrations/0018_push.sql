-- Web Push (PRD "Timer, pauza i rekalibracija" → kraj pauze, Stage 9). The app computes when a
-- notification is due (first block of the day, end of a planned break) and writes it to
-- `push_jobs` with its text in the user's language; `notify` (pg_cron, every minute, service
-- role) sends the due ones to every subscription of the user. Leaving a break deletes its job.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  endpoint text not null unique check (endpoint ~* '^https://' and char_length(endpoint) <= 2048),
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.push_subscriptions (user_id);

create table public.push_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null check (kind in ('first_block', 'break_end', 'test')),
  ref text not null,                     -- local date (first block), session id (break end)
  send_at timestamptz not null,
  title text not null check (char_length(title) <= 120),
  body text not null check (char_length(body) <= 240),
  url text check (url is null or url ~ '^/'),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, kind, ref)
);
create index push_jobs_due_idx on public.push_jobs (send_at) where sent_at is null;

do $$
declare t text;
begin
  foreach t in array array['push_subscriptions', 'push_jobs']
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

grant select, insert, update, delete on public.push_subscriptions, public.push_jobs to authenticated;
-- notify reads due jobs and subscriptions, marks jobs sent and drops expired subscriptions.
grant select, delete on public.push_subscriptions to service_role;
grant select, update, delete on public.push_jobs to service_role;

alter table public.profiles
  add column notify_first_block boolean not null default true,
  add column notify_break_end boolean not null default true;
