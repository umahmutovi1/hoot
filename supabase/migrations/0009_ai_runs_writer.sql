-- Edge Functions log every AI call with the service role. Tables are not auto-exposed to the
-- Data API, so service_role needs its own grant; users still only read their rows.
grant usage on schema public to service_role;
grant select, insert on public.ai_runs to service_role;
