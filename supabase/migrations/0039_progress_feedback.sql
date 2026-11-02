-- Sprint 17: approved feedback history. Stable rule IDs survive rerenders and replans.
-- A check-in is an accepted insight_id `checkin:<week>`; its optional reflection is kept here,
-- never in the strategist request. Each event has a client ID for idempotent offline upserts.
create table public.progress_feedback (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  insight_id text,
  candidate_id text,
  status text not null check (status in ('accepted','rejected','not_useful')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((insight_id is not null)::int + (candidate_id is not null)::int = 1)
);
create index on public.progress_feedback (user_id, created_at desc);
create index on public.progress_feedback (user_id, insight_id);
alter table public.progress_feedback enable row level security;
create policy owner_all on public.progress_feedback for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.progress_feedback to authenticated;
create trigger set_updated_at before update on public.progress_feedback
  for each row execute function public.set_updated_at();
