-- Stage 10: AI content and the assistant (PRD "AI uvoz, dokumenti i asistent", "AI integracija").
-- Additive only.
-- - gte-small embeddings (384 dims, no LLM) on units, cards and topics: question <-> chapter
--   candidates, topic dedupe and the notes search. A trigger clears an embedding when its text
--   changes; the app embeds rows whose embedding is null.
-- - question_links: an exam question linked directly to a chapter (besides links through topics).
--   AI suggestions are 'ai'; the user's choice is 'user' and is never overwritten. A rejected AI
--   suggestion stays as a 'user' row with linked = false, so a new import does not bring it back.
-- - timetable_entries.note ("napomena uz termin" from parse-timetable).
-- - The app links a Moodle event to the deadline it imported (external_events.deadline_id).

alter type ai_task add value if not exists 'link_questions';

alter table public.units add column embedding extensions.vector(384);
alter table public.cards add column embedding extensions.vector(384);
alter table public.topics add column embedding extensions.vector(384);

create index units_embedding_idx on public.units
  using hnsw (embedding extensions.vector_cosine_ops);
create index cards_embedding_idx on public.cards
  using hnsw (embedding extensions.vector_cosine_ops);
create index topics_embedding_idx on public.topics
  using hnsw (embedding extensions.vector_cosine_ops);
create index units_unembedded_idx on public.units (user_id)
  where embedding is null and archived_at is null;

-- An edit of the embedded text makes the stored vector stale, unless the same update sets it.
create or replace function public.clear_stale_embedding()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.embedding is not distinct from old.embedding then
    if (tg_table_name = 'units' and (new.title is distinct from old.title
                                     or new.notes is distinct from old.notes))
       or (tg_table_name = 'cards' and (new.front is distinct from old.front
                                        or new.back is distinct from old.back))
       or (tg_table_name = 'topics' and new.name is distinct from old.name) then
      new.embedding := null;
    end if;
  end if;
  return new;
end;
$$;

create trigger clear_stale_embedding before update on public.units
  for each row execute function public.clear_stale_embedding();
create trigger clear_stale_embedding before update on public.cards
  for each row execute function public.clear_stale_embedding();
create trigger clear_stale_embedding before update on public.topics
  for each row execute function public.clear_stale_embedding();

create table public.question_links (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  question_id uuid not null references public.units on delete cascade,
  unit_id uuid not null references public.units on delete cascade,
  assigned_by assigned_by not null default 'ai',
  linked boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (question_id, unit_id),
  constraint question_links_distinct check (question_id <> unit_id),
  constraint question_links_rejected_by_user check (linked or assigned_by = 'user')
);
create index on public.question_links (unit_id);
create index on public.question_links (user_id);

alter table public.question_links enable row level security;
create policy owner_all on public.question_links for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.question_links to authenticated;
create trigger set_updated_at before update on public.question_links
  for each row execute function public.set_updated_at();

alter table public.timetable_entries
  add column note text check (note is null or char_length(note) <= 200);

grant update (deadline_id) on public.external_events to authenticated;

-- Chapters nearest to each exam question (cosine), within the question's subject. Candidates for
-- the AI to confirm (link-questions); security invoker, so RLS applies.
create or replace function public.question_candidates(
  question_ids uuid[],
  match_count int default 5
)
returns table (question_id uuid, unit_id uuid, similarity float)
language sql
stable
security invoker
set search_path = ''
as $$
  select q.id, c.id, c.similarity
  from public.units q
  join public.sources qs on qs.id = q.source_id
  cross join lateral (
    select u.id,
           1 - (u.embedding operator(extensions.<=>) q.embedding) as similarity
    from public.units u
    join public.sources s on s.id = u.source_id
    where s.subject_id = qs.subject_id
      and u.kind = 'chapter'
      and u.archived_at is null
      and u.embedding is not null
      and not s.is_rough
    order by u.embedding operator(extensions.<=>) q.embedding
    limit least(greatest(match_count, 1), 10)
  ) c
  where q.id = any(question_ids)
    and q.user_id = (select auth.uid())
    and q.embedding is not null;
$$;
revoke execute on function public.question_candidates(uuid[], int) from public, anon;
grant execute on function public.question_candidates(uuid[], int) to authenticated;

-- "Gdje sam pisala o …": units with notes and cards nearest to a query. No LLM call.
create or replace function public.match_notes(
  query_embedding extensions.vector(384),
  match_count int default 8
)
returns table (kind text, id uuid, unit_id uuid, similarity float)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from (
    select 'unit'::text, u.id, u.id,
           1 - (u.embedding operator(extensions.<=>) query_embedding)
    from public.units u
    where u.user_id = (select auth.uid()) and u.archived_at is null
      and u.embedding is not null and coalesce(u.notes, '') <> ''
    union all
    select 'card'::text, c.id, c.unit_id,
           1 - (c.embedding operator(extensions.<=>) query_embedding)
    from public.cards c
    where c.user_id = (select auth.uid()) and c.embedding is not null
  ) m (kind, id, unit_id, similarity)
  order by similarity desc
  limit least(greatest(match_count, 1), 20);
$$;
revoke execute on function public.match_notes(extensions.vector, int) from public, anon;
grant execute on function public.match_notes(extensions.vector, int) to authenticated;
