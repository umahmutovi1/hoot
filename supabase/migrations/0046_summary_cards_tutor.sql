-- Sprint 18, rest of "Tekst izvora i AI tutor" (PRD "Tekst izvora, sažetak i kartice", "AI tutor").
-- All of it reads the source text (source_chunks, 0045), so the AI tasks are private: paid model
-- only, or the beta switch LLM_PRIVATE_FREE.
alter type ai_task add value if not exists 'unit_summary';
alter type ai_task add value if not exists 'material_cards';
alter type ai_task add value if not exists 'tutor';

-- Tutor questions written from the source text (not an exam question or a card).
alter type recall_source add value if not exists 'source_text';

-- Summary of a unit or of its whole chapter (the unit and its sub-units), made on tap and kept
-- while the text is the same (`text_hash` of the passages it was made from). Written only by the
-- Edge Function with the user's token.
create table public.unit_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  unit_id uuid not null references public.units on delete cascade,
  scope text not null check (scope in ('unit', 'chapter')),
  text_hash text not null,
  -- { points: [{ text, page }], formula: { tex, page } | null }
  content jsonb not null,
  words int not null check (words > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unit_id, scope)
);
create index on public.unit_summaries (user_id);
alter table public.unit_summaries enable row level security;
create policy owner_all on public.unit_summaries for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.unit_summaries to authenticated;
create trigger set_updated_at before update on public.unit_summaries
  for each row execute function public.set_updated_at();

-- "Sažetak umjesto čitanja": the plan gives this unit a summary block instead of reading it
-- (scheduler input, part of input_hash). Set from the deficit card; cleared by "Pročitaj cijelo".
alter table public.units add column use_summary boolean not null default false;
-- "Pročitano (sažetak)": the unit was read through its summary; null = read in full or not read.
alter table public.units add column read_via text check (read_via is null or read_via = 'summary');

-- A unit studied through its summary in a session: the summary's length, so the user's summary
-- pace (minutes per 100 words) is learned like the reading pace.
alter table public.session_units add column summary_words int check (summary_words is null or summary_words > 0);

-- Time with the tutor is session time (PRD "Vrijeme sa tutorom je vrijeme sesije"): a segment
-- with the tutor open is `tutor`.
alter table public.study_segments
  add column kind text not null default 'study' check (kind in ('study', 'tutor'));
