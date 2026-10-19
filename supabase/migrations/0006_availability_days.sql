-- Stage 4 polish: exam periods with a subtype, default availability, daily study cap,
-- per-date availability. See docs/PRD.md "Akademski kalendar" and "Dostupnost".

-- Partial-exam weeks become exam periods with the 'partial' session.
alter table academic_periods
  drop constraint if exists academic_periods_kind_check,
  drop constraint if exists academic_periods_exam_session_check,
  drop constraint if exists academic_periods_exam_session;
update academic_periods set kind = 'exam', exam_session = 'partial' where kind = 'partial_exams';
alter table academic_periods
  add constraint academic_periods_kind_check check (kind in ('teaching','exam','holiday')),
  add constraint academic_periods_exam_session_check
    check (exam_session in ('partial','regular','makeup')),
  add constraint academic_periods_exam_session check ((kind = 'exam') = (exam_session is not null));

-- "Učim umjesto nastave": this slot counts as free even where a class is.
alter table availability_rules
  add column over_classes boolean not null default false;

-- Most minutes of study per day, Monday..Sunday (default 3 h weekdays, 5 h weekend).
alter table profiles
  add column daily_cap_min smallint[] not null default '{180,180,180,180,180,300,300}'
    check (cardinality(daily_cap_min) = 7);

-- One date that differs from the weekly template: its own slots and/or cap.
-- slots: [{"start_min":540,"end_min":660,"over_classes":false}], null = template slots.
create table availability_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  on_date date not null,
  slots jsonb check (slots is null or jsonb_typeof(slots) = 'array'),
  cap_min smallint check (cap_min between 0 and 1440),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, on_date)
);

alter table availability_days enable row level security;
create policy owner_all on availability_days for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update, delete on availability_days to authenticated;
create trigger set_updated_at before update on availability_days
  for each row execute function public.set_updated_at();

-- Default availability: every day 06:00–24:00, for existing users without any rule...
insert into availability_rules (user_id, weekday, start_min, end_min)
select p.id, d, 360, 1440
from profiles p cross join generate_series(0, 6) d
where not exists (select 1 from availability_rules r where r.user_id = p.id);

-- ...and for every new user, together with the profile.
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
  insert into public.availability_rules (user_id, weekday, start_min, end_min)
  select new.id, d, 360, 1440 from generate_series(0, 6) d;
  return new;
end;
$$;
