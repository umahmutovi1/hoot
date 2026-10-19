-- Stage 5: points, pass thresholds, retakes, grade scale and target grade.
-- See docs/PRD.md "Bodovi, skala ocjena i projekcija ocjene". Everything derived (contribution,
-- "imam / treba", grade) is computed in src/lib/grades/; only inputs are stored.

-- weight_pct was never used; an item now carries points (or a share of the grade in %).
alter table assessments rename column weight_pct to points_max;
alter table assessments
  add constraint assessments_points_max_check check (points_max > 0),
  add column points_unit text not null default 'points' check (points_unit in ('points','percent')),
  add column pass_min_pct numeric check (pass_min_pct between 0 and 100),
  add column entry_min_points numeric check (entry_min_points >= 0),
  -- A makeup exam repeats exactly one exam and carries its points.
  add column retake_of uuid references assessments on delete cascade,
  -- "Poništi rezultat" (waiver): the result stays visible but does not count.
  add column result_annulled boolean not null default false,
  add constraint assessments_retake_of_makeup check (retake_of is null or kind = 'makeup'),
  add constraint assessments_retake_of_self check (retake_of is null or retake_of <> id),
  add constraint assessments_result_check
    check (result_max is null or (result_max > 0 and result_points between 0 and result_max));
create index on assessments (retake_of) where retake_of is not null;

-- Homework and seminar papers carry points like exams.
alter table deadlines
  add column points_max numeric check (points_max > 0),
  add column points_unit text not null default 'points' check (points_unit in ('points','percent')),
  add column pass_min_pct numeric check (pass_min_pct between 0 and 100),
  add column result_points numeric,
  add column result_max numeric,
  add constraint deadlines_result_check
    check (result_max is null or (result_max > 0 and result_points between 0 and result_max));

-- grade_scale: lower bounds in % of points_total for grades 6..10, e.g. [55,65,75,85,95];
-- null = the default scale. Strictly increasing order is validated with Zod.
alter table subjects
  add column points_total numeric not null default 100 check (points_total > 0),
  add column grade_scale jsonb
    check (grade_scale is null or (jsonb_typeof(grade_scale) = 'array' and jsonb_array_length(grade_scale) = 5)),
  add column target_grade smallint check (target_grade between 6 and 10);
