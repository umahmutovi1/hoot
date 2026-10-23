-- Embeddings move out of units / cards / topics into their own tables: the app reads those tables
-- with `select('*')` (also v0.9.0 on the shared database), and a 384-dim vector would be fetched
-- and cached with every row. The columns from 0020 are still empty and nothing reads them.
-- A row is deleted when its text changes; the app embeds what has no row (RPC `unembedded`).

drop trigger clear_stale_embedding on public.units;
drop trigger clear_stale_embedding on public.cards;
drop trigger clear_stale_embedding on public.topics;
drop function public.clear_stale_embedding();
drop function public.question_candidates(uuid[], int);
drop function public.match_notes(extensions.vector, int);
drop index public.units_unembedded_idx;
alter table public.units drop column embedding;
alter table public.cards drop column embedding;
alter table public.topics drop column embedding;

create table public.unit_embeddings (
  unit_id uuid primary key references public.units on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  embedding extensions.vector(384) not null,
  updated_at timestamptz not null default now()
);
create table public.card_embeddings (
  card_id uuid primary key references public.cards on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  embedding extensions.vector(384) not null,
  updated_at timestamptz not null default now()
);
create table public.topic_embeddings (
  topic_id uuid primary key references public.topics on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  embedding extensions.vector(384) not null,
  updated_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['unit_embeddings', 'card_embeddings', 'topic_embeddings']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy owner_all on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t
    );
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create index on public.%I (user_id)', t);
    execute format(
      'create index on public.%I using hnsw (embedding extensions.vector_cosine_ops)', t
    );
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t
    );
  end loop;
end $$;

-- An edit of the embedded text makes the vector stale.
create or replace function public.drop_stale_embedding()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_table_name = 'units' and (new.title is distinct from old.title
                                  or new.notes is distinct from old.notes) then
    delete from public.unit_embeddings where unit_id = new.id;
  elsif tg_table_name = 'cards' and (new.front is distinct from old.front
                                     or new.back is distinct from old.back) then
    delete from public.card_embeddings where card_id = new.id;
  elsif tg_table_name = 'topics' and new.name is distinct from old.name then
    delete from public.topic_embeddings where topic_id = new.id;
  end if;
  return new;
end;
$$;

create trigger drop_stale_embedding after update on public.units
  for each row execute function public.drop_stale_embedding();
create trigger drop_stale_embedding after update on public.cards
  for each row execute function public.drop_stale_embedding();
create trigger drop_stale_embedding after update on public.topics
  for each row execute function public.drop_stale_embedding();

-- What still needs a vector: active units (not of a rough source), cards and topics without a row.
create or replace function public.unembedded(max_rows int default 64)
returns table (kind text, id uuid)
language sql
stable
security invoker
set search_path = ''
as $$
  (select 'unit'::text, u.id
   from public.units u
   join public.sources s on s.id = u.source_id
   left join public.unit_embeddings e on e.unit_id = u.id
   where u.user_id = (select auth.uid()) and u.archived_at is null and not s.is_rough
     and e.unit_id is null
   order by u.created_at)
  union all
  (select 'card'::text, c.id
   from public.cards c
   left join public.card_embeddings e on e.card_id = c.id
   where c.user_id = (select auth.uid()) and e.card_id is null
   order by c.created_at)
  union all
  (select 'topic'::text, t.id
   from public.topics t
   left join public.topic_embeddings e on e.topic_id = t.id
   where t.user_id = (select auth.uid()) and e.topic_id is null)
  limit least(greatest(max_rows, 1), 256);
$$;
revoke execute on function public.unembedded(int) from public, anon;
grant execute on function public.unembedded(int) to authenticated;

-- Chapters nearest to each exam question (cosine), within the question's subject. Candidates for
-- the AI to confirm (link-questions).
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
  join public.unit_embeddings qe on qe.unit_id = q.id
  cross join lateral (
    select u.id,
           1 - (e.embedding operator(extensions.<=>) qe.embedding) as similarity
    from public.unit_embeddings e
    join public.units u on u.id = e.unit_id
    join public.sources s on s.id = u.source_id
    where s.subject_id = qs.subject_id
      and u.kind = 'chapter'
      and u.archived_at is null
      and not s.is_rough
    order by e.embedding operator(extensions.<=>) qe.embedding
    limit least(greatest(match_count, 1), 10)
  ) c
  where q.id = any(question_ids)
    and q.user_id = (select auth.uid());
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
           1 - (e.embedding operator(extensions.<=>) query_embedding)
    from public.unit_embeddings e
    join public.units u on u.id = e.unit_id
    where u.user_id = (select auth.uid()) and u.archived_at is null
      and coalesce(u.notes, '') <> ''
    union all
    select 'card'::text, c.id, c.unit_id,
           1 - (e.embedding operator(extensions.<=>) query_embedding)
    from public.card_embeddings e
    join public.cards c on c.id = e.card_id
    where c.user_id = (select auth.uid())
  ) m (kind, id, unit_id, similarity)
  order by similarity desc
  limit least(greatest(match_count, 1), 20);
$$;
revoke execute on function public.match_notes(extensions.vector, int) from public, anon;
grant execute on function public.match_notes(extensions.vector, int) to authenticated;
