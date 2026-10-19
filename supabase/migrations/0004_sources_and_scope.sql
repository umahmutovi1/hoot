-- Stage 3: sources and units entered manually, exam scope.
-- See docs/PRD.md "Procjena težine i vremena" (measure) and "Obim ispita" (included).

-- What one unit amount counts: pages (book, script, other), slides, questions, or items
-- (other sources measured per unit, with minutes per unit set by the user).
alter table sources
  add column measure text not null default 'pages'
    check (measure in ('pages','slides','questions','items'));

-- "Ne ulazi": the unit is excluded from this exam, also when the exam has scope_all.
-- Only the user excludes material; AI suggestions are always positive rows.
alter table assessment_units
  add column included boolean not null default true,
  add constraint assessment_units_excluded_by_user check (included or assigned_by = 'user');
