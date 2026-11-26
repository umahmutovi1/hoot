-- Sprint 19: a book's table of contents from the web (`find-toc`, PRD "Izvor bez PDF-a").
-- One search per title, author and edition: the result (also an empty one) is kept here and
-- returned again without an AI call. Written only by the Edge Function with the user's token.
alter type ai_task add value if not exists 'find_toc';

create table public.toc_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  key text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);
alter table public.toc_searches enable row level security;
create policy owner_all on public.toc_searches for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.toc_searches to authenticated;
create trigger set_updated_at before update on public.toc_searches
  for each row execute function public.set_updated_at();
