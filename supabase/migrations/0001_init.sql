-- 0001_init.sql
-- Initial schema for Hoot. Source: docs/PRD.md, section "Šema baze podataka",
-- plus: updated_at triggers, profile-on-signup trigger, explicit grants (the Data API
-- does not auto-expose new tables), user_id indexes for RLS, and the private "uploads" bucket.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type exam_format as enum ('written','oral','combined','project','other');
create type assessment_kind as enum ('partial','final','integral','makeup','other');
create type deadline_kind as enum ('assignment','custom');
create type source_kind as enum ('book','script','questions','slides','other');
create type unit_kind as enum ('chapter','question');
create type study_mode as enum ('reading','problems','review','questions');
create type block_status as enum ('planned','in_progress','done','missed','skipped');
create type block_kind as enum ('learn','review','questions','recap','deadline');
create type class_kind as enum ('lecture','exercise','lab','other');
create type recall_source as enum ('exam_question','notes','outline','blurt','card','page_photo','general');
create type assigned_by as enum ('ai','user');
create type ai_task as enum ('parse_toc','parse_questions','parse_timetable','recall_questions','propose_answer','quiz','strategist');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  locale text not null default 'bs' check (locale in ('bs','en')),
  timezone text not null default 'Europe/Sarajevo',
  day_start_min smallint not null default 240,          -- 04:00
  buffer_days smallint not null default 1,
  max_subjects_per_day smallint not null default 3,
  min_block_minutes smallint not null default 25,
  timer_mode text not null default '25/5' check (timer_mode in ('25/5','50/10','free')),
  recap_after_lecture boolean not null default true,
  srs_multiplier numeric not null default 1.0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  color text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on subjects (user_id);

create table assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  subject_id uuid not null references subjects on delete cascade,
  kind assessment_kind not null default 'final',
  title text not null,
  at timestamptz not null,
  format exam_format not null default 'written',
  weight_pct numeric,
  scope_all boolean not null default true,
  passed boolean not null default false,
  readiness_before smallint check (readiness_before between 1 and 5),
  result_points numeric,
  result_max numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on assessments (user_id, at);
create index on assessments (subject_id);

create table deadlines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  subject_id uuid references subjects on delete cascade,
  title text not null,
  kind deadline_kind not null default 'custom',
  due_at timestamptz not null,
  est_minutes numeric,                 -- null = display only
  done_minutes numeric not null default 0,
  notes text,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on deadlines (user_id, due_at);

create table sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  subject_id uuid not null references subjects on delete cascade,
  kind source_kind not null,
  title text not null,
  author text,
  weight numeric,                      -- null = share of minutes
  base_min_per_unit numeric not null,  -- heuristic per kind
  learned_min_per_unit numeric,        -- all modes combined
  learned_samples int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on sources (subject_id);

create table source_mode_rates (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  source_id uuid not null references sources on delete cascade,
  mode study_mode not null,
  min_per_unit numeric not null,
  samples int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (source_id, mode)
);

create table units (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  source_id uuid not null references sources on delete cascade,
  parent_id uuid references units on delete cascade,
  kind unit_kind not null default 'chapter',
  position int not null,
  label text,                          -- merge key for re-import
  title text not null,
  page_start int,
  page_end int,
  amount numeric not null default 1,
  ai_difficulty smallint check (ai_difficulty between 1 and 5),
  user_difficulty smallint check (user_difficulty between 1 and 5),
  est_minutes numeric,
  level smallint not null default 0 check (level between 0 and 3),
  confidence smallint check (confidence between 1 and 5),
  notes text,
  answer text,                         -- for questions
  answer_origin assigned_by,
  completed_at timestamptz,
  srs_ease numeric not null default 2.5,
  srs_interval_days numeric,
  srs_success_count smallint not null default 0,
  next_review_on date,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, label)
);
create index on units (source_id, position);
create index on units (user_id, next_review_on) where archived_at is null;
create index on units (parent_id);

create table assessment_units (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  assessment_id uuid not null references assessments on delete cascade,
  unit_id uuid not null references units on delete cascade,
  assigned_by assigned_by not null default 'ai',
  primary key (assessment_id, unit_id)
);
create index on assessment_units (unit_id);

create table topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  subject_id uuid not null references subjects on delete cascade,
  name text not null,
  unique (subject_id, name)
);

create table unit_topics (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  unit_id uuid not null references units on delete cascade,
  topic_id uuid not null references topics on delete cascade,
  assigned_by assigned_by not null default 'ai',
  primary key (unit_id, topic_id)
);
create index on unit_topics (topic_id);

create table timetable_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  subject_id uuid references subjects on delete cascade,
  kind class_kind not null,
  weekday smallint not null check (weekday between 0 and 6),   -- 0 = Monday
  start_min smallint not null,
  end_min smallint not null check (end_min > start_min),
  location text,
  week_parity text check (week_parity in ('odd','even')),
  valid_from date not null,
  valid_to date not null,
  updated_at timestamptz not null default now()
);
create index on timetable_entries (user_id);

create table availability_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_min smallint not null,
  end_min smallint not null check (end_min > start_min),
  updated_at timestamptz not null default now()
);
create index on availability_rules (user_id);

create table availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  on_date date not null,
  start_min smallint,
  end_min smallint,
  is_busy boolean not null default true,
  updated_at timestamptz not null default now()
);
create index on availability_exceptions (user_id, on_date);

create table plan_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  input_hash text not null,
  with_times boolean not null default false,
  deficit jsonb,
  created_at timestamptz not null default now()
);
create index on plan_runs (user_id, created_at desc);

create table plan_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  subject_id uuid not null references subjects on delete cascade,
  assessment_id uuid references assessments on delete cascade,
  deadline_id uuid references deadlines on delete cascade,
  on_date date not null,                -- local day (day boundary)
  start_min smallint,                   -- null until the time slot is generated
  planned_start timestamptz,
  planned_minutes smallint not null,
  kind block_kind not null default 'learn',
  status block_status not null default 'planned',
  reason text,                          -- "why this today"
  plan_run_id uuid not null references plan_runs on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on plan_blocks (user_id, on_date);
create index on plan_blocks (plan_run_id);

create table plan_block_units (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  block_id uuid not null references plan_blocks on delete cascade,
  unit_id uuid not null references units on delete cascade,
  page_from int,
  page_to int,
  planned_minutes smallint not null,
  primary key (block_id, unit_id)
);
create index on plan_block_units (unit_id);

create table study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  subject_id uuid not null references subjects on delete cascade,
  block_id uuid references plan_blocks on delete set null,   -- null = free session
  mode study_mode,
  started_at timestamptz not null,
  ended_at timestamptz,
  focus smallint check (focus between 1 and 3),
  reflection text,
  updated_at timestamptz not null default now()
);
create unique index one_active_session on study_sessions (user_id) where ended_at is null;
create index on study_sessions (user_id, started_at desc);

create table study_segments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  session_id uuid not null references study_sessions on delete cascade,
  unit_id uuid references units on delete set null,
  started_at timestamptz not null,
  ended_at timestamptz
);
create index on study_segments (session_id);

create table session_units (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  session_id uuid not null references study_sessions on delete cascade,
  unit_id uuid not null references units on delete cascade,
  minutes numeric not null,
  amount_done numeric,
  level_before smallint,
  level_after smallint,
  difficulty smallint check (difficulty between 1 and 5),
  primary key (session_id, unit_id)
);
create index on session_units (unit_id);

create table review_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  unit_id uuid not null references units on delete cascade,
  reviewed_at timestamptz not null default now(),
  source recall_source not null,
  recall smallint not null check (recall between 0 and 2),
  was_scheduled boolean not null default false,   -- for personal calibration
  interval_before numeric,
  interval_after numeric
);
create index on review_logs (user_id, reviewed_at desc);
create index on review_logs (unit_id);

create table cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  unit_id uuid not null references units on delete cascade,
  front text not null,
  back text not null,
  origin assigned_by not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on cards (unit_id);

create table ai_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  task ai_task not null,
  provider text not null,
  model text not null,
  input_tokens int,
  output_tokens int,
  cost_usd numeric(10,6),
  ok boolean not null,
  error text,
  created_at timestamptz not null default now()
);
create index on ai_runs (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at trigger (last-write-wins sync relies on it)
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  for t in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables tb
      on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'updated_at'
      and tb.table_type = 'BASE TABLE'
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Create a profile row for every new auth user
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS: owners see and change only their own rows
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['subjects','assessments','assessment_units','deadlines','sources',
    'source_mode_rates','units','topics','unit_topics','timetable_entries',
    'availability_rules','availability_exceptions','plan_runs','plan_blocks','plan_block_units',
    'study_sessions','study_segments','session_units','review_logs','cards','ai_runs']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy owner_all on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t
    );
  end loop;
end $$;

alter table profiles enable row level security;
create policy own_profile on profiles for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Grants: new tables are not auto-exposed, so only signed-in users get access.
-- anon gets nothing. ai_runs is written by Edge Functions; users can only read it.
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke insert, update, delete on public.ai_runs from authenticated;
revoke delete on public.profiles from authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private bucket for photos of tables of contents / timetables.
-- Files live under "<user_id>/..." and are deleted after parsing.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', false)
on conflict (id) do nothing;

create policy "uploads own folder" on storage.objects for all to authenticated
  using (bucket_id = 'uploads' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- Functions: keepalive is the only thing anon may call (GitHub Action pings it so the
-- free-tier project is not paused). Trigger functions are not callable via the API.
-- ---------------------------------------------------------------------------
create or replace function public.keepalive()
returns timestamptz
language sql
stable
set search_path = ''
as $$ select now() $$;

revoke execute on function public.keepalive() from public;
grant execute on function public.keepalive() to anon, authenticated;

revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
