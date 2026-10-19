-- Stage 4: academic calendar, timetable periods, lecture tracking.
-- See docs/PRD.md "Akademski kalendar", "Raspored nastave" and "Praćenje predavanja".

-- Periods of the academic calendar: teaching, partial-exam weeks, exam periods, holidays.
-- Local dates (inclusive). Exam periods say whether they are regular or makeup.
create table academic_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null check (kind in ('teaching','partial_exams','exam','holiday')),
  exam_session text check (exam_session in ('regular','makeup')),
  title text not null,
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academic_periods_range check (ends_on >= starts_on),
  constraint academic_periods_exam_session check ((kind = 'exam') = (exam_session is not null))
);
create index on academic_periods (user_id, starts_on);

-- The teaching period a timetable entry belongs to; valid_from / valid_to mirror its dates.
alter table timetable_entries
  add column period_id uuid references academic_periods on delete set null;

-- "Exam in a period": a tentative exam whose possible range is an exam period.
alter table assessments
  add column exam_period_id uuid references academic_periods on delete set null;

-- "Dokle ste stigli?": how far a class got in one source. cancelled = no class that day.
create table lecture_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  subject_id uuid not null references subjects on delete cascade,
  timetable_entry_id uuid references timetable_entries on delete set null,
  on_date date not null,                               -- local day (day boundary)
  source_id uuid references sources on delete cascade,
  up_to_unit_id uuid references units on delete set null,
  cancelled boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lecture_logs_reached check (cancelled or up_to_unit_id is not null)
);
create index on lecture_logs (user_id, subject_id, on_date);

-- Days after a lecture by which the covered material should be learned (soft deadline).
alter table profiles
  add column lecture_pace_days smallint not null default 7 check (lecture_pace_days between 1 and 60);

-- "Nastava otkazana" frees the class slot; deleting the log removes the exception too.
alter table availability_exceptions
  add column lecture_log_id uuid references lecture_logs on delete cascade;
create index on availability_exceptions (lecture_log_id);

-- RLS, grants and updated_at triggers for the new tables.
do $$
declare t text;
begin
  foreach t in array array['academic_periods','lecture_logs']
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
