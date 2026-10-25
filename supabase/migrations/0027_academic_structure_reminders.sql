-- Stage 10c (additive only: dev and prod share the database, the released app keeps working).
-- PRD "Akademska godina i semestar", "Materijali", "Dan pred ispit", "Podsjetnici i notifikacije".

-- Academic year: label ("2026/27"), year of study, dates. Periods and subjects belong to one.
create table public.academic_years (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  label text not null check (char_length(label) between 1 and 20),
  year_of_study smallint check (year_of_study between 1 and 6),
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academic_years_range check (ends_on >= starts_on)
);
create index on public.academic_years (user_id, starts_on);
alter table public.academic_years enable row level security;
create policy owner_all on public.academic_years for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create trigger set_updated_at before update on public.academic_years
  for each row execute function public.set_updated_at();
grant select, insert, update, delete on public.academic_years to authenticated;

alter table public.academic_periods
  add column academic_year_id uuid references public.academic_years on delete set null;

-- Semester 1–12 in the faculty's numbering (3 = winter semester of the 2nd year).
alter table public.subjects
  add column academic_year_id uuid references public.academic_years on delete set null,
  add column semester_no smallint check (semester_no between 1 and 12);

-- Faculty for "Fakultet s interneta"; reminders before every block (empty = off). The last web
-- search (key = faculty|program|year, time, found documents) waits there until it is reviewed.
alter table public.profiles
  add column institution text check (char_length(institution) <= 120),
  add column study_program text check (char_length(study_program) <= 120),
  add column year_of_study smallint check (year_of_study between 1 and 6),
  add column reminder_offsets_min smallint[] not null default '{30}'
    check (reminder_offsets_min <@ '{120,60,30,15,5}'::smallint[]),
  add column academic_search jsonb;
-- Reminders replace "first block of the day": whoever had it off starts with none.
update public.profiles set reminder_offsets_min = '{}' where not notify_first_block;

-- Day before the exam only for its subject: null = not asked, false = declined (scheduler input).
alter table public.assessments
  add column eve_reserved boolean;

-- Materials: a PDF read on the device or picked from Google Drive (the file is never uploaded).
alter table public.sources
  add column file_name text check (char_length(file_name) <= 255),
  add column drive_file_id text check (char_length(drive_file_id) <= 128),
  add column external_url text check (external_url is null or external_url ~* '^https://');

-- "Preskoči" from a notification: push-action records it, the app applies skipBlock() on open.
alter table public.plan_blocks
  add column skip_requested_at timestamptz;

-- Reminder before a block and "Kasniš 15 min". The job points at its block (gone with it); the
-- one-time action token is created by notify when it sends and only its hash is kept.
alter table public.push_jobs
  drop constraint if exists push_jobs_kind_check,
  add constraint push_jobs_kind_check
    check (kind in ('first_block', 'break_end', 'test', 'block_reminder', 'block_late')),
  add column block_id uuid references public.plan_blocks on delete cascade,
  add column action_token_hash text,
  add column action_used_at timestamptz;
create index on public.push_jobs (block_id) where block_id is not null;
create unique index push_jobs_action_token_idx on public.push_jobs (action_token_hash)
  where action_token_hash is not null;

-- notify checks the block before sending; push-action records the skip.
grant select on public.plan_blocks, public.study_sessions to service_role;
grant update (skip_requested_at) on public.plan_blocks to service_role;

alter type ai_task add value if not exists 'parse_syllabus';
alter type ai_task add value if not exists 'find_academic_info';
