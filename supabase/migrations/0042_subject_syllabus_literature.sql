-- Sprint 19: literature from the plan i program stays on the subject, so Dodaj izvor can ask
-- "Koje od ovoga koristiš?" later (PRD "Literatura iz plana i programa na potvrdu").
-- [{ title, authors, required }] as read; null = no syllabus, [] = "Ne koristim nijednu".
alter table public.subjects add column syllabus_literature jsonb;
