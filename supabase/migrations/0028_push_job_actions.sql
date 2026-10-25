-- Stage 10c (additive): texts of a block reminder's buttons (Započni / Preskoči) and of the
-- "Preskočeno" notification, in the user's language. The app writes them with the job; notify
-- has no locale of its own.
alter table public.push_jobs
  add column actions jsonb;
