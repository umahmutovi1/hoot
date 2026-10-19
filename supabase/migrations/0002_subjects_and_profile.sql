-- Stage 2: subject priority and study mode, contingent / tentative exams, display name onboarding.
-- See docs/PRD.md "Prioritet i režim učenja" and "Kasnije migracije".

alter table subjects
  add column priority smallint not null default 3 check (priority between 1 and 5),
  add column study_mode text not null default 'regular' check (study_mode in ('regular','campaign')),
  add column campaign_start_on date,                  -- null = computed by plan()
  add constraint subjects_color_check
    check (color is null or color in ('pink','lavender','blue','green','orange','slate'));

alter table assessments
  add column contingent boolean not null default false,       -- "only if needed" (integral, makeup)
  add column date_tentative boolean not null default false;   -- date not announced yet

-- null = the user has not confirmed their name yet; the app asks "What should I call you?"
alter table profiles
  add column name_confirmed_at timestamptz;
