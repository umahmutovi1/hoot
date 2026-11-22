-- Tekst izvora (PRD "Tekst izvora, sažetak i kartice", Sprint 18). The PDF of a source is read on
-- the device; only its text per unit (by the unit's page range) is stored, as passages that never
-- cross a page, so the tutor can cite one. The original is never uploaded. Vectors live in their
-- own table (as in 0021) so reading passages never fetches them.

create table public.source_chunks (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  source_id uuid not null references public.sources on delete cascade,
  unit_id uuid not null references public.units on delete cascade,
  -- The book's page (the unit's numbering), not the PDF's.
  page int not null check (page > 0),
  position int not null check (position >= 0),
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unit_id, position)
);
create index on public.source_chunks (user_id);
create index on public.source_chunks (source_id);

create table public.source_chunk_embeddings (
  chunk_id uuid primary key references public.source_chunks on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  embedding extensions.vector(384) not null,
  updated_at timestamptz not null default now()
);
create index on public.source_chunk_embeddings (user_id);
create index on public.source_chunk_embeddings using hnsw (embedding extensions.vector_cosine_ops);

do $$
declare t text;
begin
  foreach t in array array['source_chunks', 'source_chunk_embeddings']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy owner_all on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t
    );
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t
    );
  end loop;
end $$;

-- What the Izvor screen shows about the text ("260 str. · 6 poglavlja"); null = no text yet.
alter table public.sources
  add column text_pages int check (text_pages is null or text_pages > 0),
  add column text_read_at timestamptz;

-- Passages without a vector join the rows the app embeds in the background (EmbedRunner).
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
  union all
  (select 'chunk'::text, c.id
   from public.source_chunks c
   left join public.source_chunk_embeddings e on e.chunk_id = c.id
   where c.user_id = (select auth.uid()) and e.chunk_id is null
   order by c.source_id, c.unit_id, c.position)
  limit least(greatest(max_rows, 1), 256);
$$;
revoke execute on function public.unembedded(int) from public, anon;
grant execute on function public.unembedded(int) to authenticated;

-- Passages of the given units nearest to a query (the tutor's "Objasni", with the page to cite).
create or replace function public.match_source_chunks(
  query_embedding extensions.vector(384),
  unit_ids uuid[],
  match_count int default 6
)
returns table (id uuid, unit_id uuid, page int, content text, similarity float)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.id, c.unit_id, c.page, c.content,
         1 - (e.embedding operator(extensions.<=>) query_embedding) as similarity
  from public.source_chunks c
  join public.source_chunk_embeddings e on e.chunk_id = c.id
  where c.user_id = (select auth.uid()) and c.unit_id = any(unit_ids)
  order by e.embedding operator(extensions.<=>) query_embedding
  limit least(greatest(match_count, 1), 20);
$$;
revoke execute on function public.match_source_chunks(extensions.vector, uuid[], int) from public, anon;
grant execute on function public.match_source_chunks(extensions.vector, uuid[], int) to authenticated;
