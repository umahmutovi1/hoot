-- Stage 6: AI foundation, import and documents.
-- University documents (calendar, rules, syllabus, exam schedule, notice) are kept in the
-- private "uploads" bucket until the user deletes them; their text is split into chunks with a
-- gte-small embedding (384 dims) for answers that cite document and page.

create extension if not exists vector with schema extensions;

alter type ai_task add value if not exists 'parse_academic_calendar';
alter type ai_task add value if not exists 'parse_exam_schedule';
alter type ai_task add value if not exists 'parse_document';
alter type ai_task add value if not exists 'answer';

create table documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  subject_id uuid references subjects on delete set null,      -- null = general (calendar, rules)
  kind text not null
    check (kind in ('academic_calendar','rules','syllabus','exam_schedule','notice','other')),
  title text not null,
  storage_path text,                                           -- <user_id>/documents/<id>.<ext>; null = pasted text
  media_type text
    check (media_type is null or media_type in ('image/jpeg','image/png','image/webp','application/pdf')),
  pages int check (pages is null or pages > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint documents_file check ((storage_path is null) = (media_type is null))
);
create index on documents (user_id, created_at desc);
create index on documents (subject_id) where subject_id is not null;

create table document_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  document_id uuid not null references documents on delete cascade,
  page int check (page is null or page > 0),
  position int not null check (position >= 0),
  content text not null,
  embedding extensions.vector(384),
  created_at timestamptz not null default now(),
  unique (document_id, position)
);
create index on document_chunks (user_id);
create index on document_chunks using hnsw (embedding extensions.vector_cosine_ops);

do $$
declare t text;
begin
  foreach t in array array['documents','document_chunks']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy owner_all on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t
    );
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

create trigger set_updated_at before update on public.documents
  for each row execute function public.set_updated_at();

-- Nearest chunks of the caller's own documents (security invoker: RLS applies).
create or replace function public.match_document_chunks(
  query_embedding extensions.vector(384),
  match_count int default 6
)
returns table (
  id uuid,
  document_id uuid,
  title text,
  page int,
  content text,
  similarity float
)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.id, c.document_id, d.title, c.page, c.content,
         1 - (c.embedding operator(extensions.<=>) query_embedding) as similarity
  from public.document_chunks c
  join public.documents d on d.id = c.document_id
  where c.user_id = (select auth.uid()) and c.embedding is not null
  order by c.embedding operator(extensions.<=>) query_embedding
  limit least(greatest(match_count, 1), 20);
$$;
revoke execute on function public.match_document_chunks(extensions.vector, int) from public, anon;
grant execute on function public.match_document_chunks(extensions.vector, int) to authenticated;
