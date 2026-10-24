-- Stage 10b (additive only: the released app keeps working).

-- Colour theme (PRD "Navigacija, pretraga, teme i geste"); synced across devices.
alter table public.profiles
  add column theme text not null default 'lavender'
    check (theme in ('lavender', 'graphite', 'sand', 'sage', 'ocean'));

-- Today's free slots and timed manual blocks at the time of the run (PRD "Današnji dan se
-- preslaže"): when they differ on the next run, today's unstarted AI blocks get new times.
-- Older runs and the released app leave it null. Owners update it right after replace_plan().
alter table public.plan_runs
  add column today_slots text;
