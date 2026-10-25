-- After the Stage 10b preview (additive only: the released app keeps working).

-- Partial reading: how much of a unit is read so far (pages, slides…), across sessions. A unit
-- read to its end becomes "Pročitano"; until then the plan, progress and the next session
-- continue from here. Null = nothing read yet.
alter table public.units
  add column read_amount numeric check (read_amount is null or read_amount >= 0);

-- Archived exam: out of Danas, the calendar, the plan and grades; restorable from the subject.
alter table public.assessments
  add column archived_at timestamptz;
