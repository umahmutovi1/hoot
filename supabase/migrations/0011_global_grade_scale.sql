-- Global grade scale (PRD "Bodovi, skala ocjena i projekcija ocjene"): points total and
-- thresholds live on the profile and apply to every subject, unless the subject has its own
-- (custom_scale = true; then subjects.points_total / grade_scale apply as before).

alter table public.profiles
  add column points_total numeric not null default 100 check (points_total > 0),
  add column grade_scale jsonb
    check (grade_scale is null or (jsonb_typeof(grade_scale) = 'array' and jsonb_array_length(grade_scale) = 5));

alter table public.subjects
  add column custom_scale boolean not null default false;

-- Subjects that already changed the defaults keep their own scale.
update public.subjects set custom_scale = true
  where points_total <> 100 or grade_scale is not null;
