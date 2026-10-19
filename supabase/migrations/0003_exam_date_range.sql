-- A tentative exam date is a range: `at` is the earliest possible day (the plan targets it),
-- `at_latest` the latest. Both null-safe for exams with a confirmed date.
alter table assessments
  add column at_latest timestamptz,
  add constraint assessments_at_latest_check
    check (at_latest is null or (date_tentative and at_latest >= at));
