-- Stage 10b: swipe "Arhiviraj" on a source (PRD "Navigacija, pretraga, teme i geste"). An archived
-- source leaves the plan, progress and scope; its units and history stay. Additive only.
alter table public.sources
  add column archived_at timestamptz;
