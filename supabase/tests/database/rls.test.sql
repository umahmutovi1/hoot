-- RLS (PRD "AI integracija" → "Sigurnosno skeniranje", Stage 10b): every table is closed to anon
-- and to other users. Run with `npx supabase test db` against a local stack (CI job `db`).
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(9);

-- Structure: a new table without RLS, a policy or the grant for signed-in users fails the build.
select is_empty(
  $$ select c.relname::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity $$,
  'every public table has row level security'
);
select is_empty(
  $$ select t.tablename::text from pg_tables t
     where t.schemaname = 'public'
       and not exists (select 1 from pg_policies p
                        where p.schemaname = 'public' and p.tablename = t.tablename) $$,
  'every public table has a policy'
);
select is_empty(
  $$ select p.tablename::text from pg_policies p
     where p.schemaname = 'public' and not ('authenticated' = any (p.roles)) $$,
  'every policy is for signed-in users only'
);
select is_empty(
  $$ select c.relname::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
       and not has_table_privilege('authenticated', c.oid, 'select') $$,
  'signed-in users can read every table (explicit grant)'
);
select is_empty(
  $$ select c.relname::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
       and (has_table_privilege('anon', c.oid, 'select')
         or has_table_privilege('anon', c.oid, 'insert')
         or has_table_privilege('anon', c.oid, 'update')
         or has_table_privilege('anon', c.oid, 'delete')) $$,
  'anon has no privilege on any table'
);

-- Data: user A owns rows in the main tables (written as postgres, past RLS); user B owns nothing.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
  ('00000000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'a@rls.test', '', now(), now()),
  ('00000000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'b@rls.test', '', now(), now());
insert into profiles (id) values
  ('00000000-0000-4000-8000-00000000000a'), ('00000000-0000-4000-8000-00000000000b')
on conflict (id) do nothing;

do $$
declare
  a constant uuid := '00000000-0000-4000-8000-00000000000a';
  s uuid := gen_random_uuid(); src uuid := gen_random_uuid(); u uuid := gen_random_uuid();
  ex uuid := gen_random_uuid(); run uuid := gen_random_uuid(); blk uuid := gen_random_uuid();
  ses uuid := gen_random_uuid(); doc uuid := gen_random_uuid(); conv uuid := gen_random_uuid();
begin
  insert into subjects (id, user_id, name) values (s, a, 'Signali');
  insert into assessments (id, user_id, subject_id, title, at) values (ex, a, s, 'Ispit', now() + interval '10 days');
  insert into deadlines (user_id, subject_id, title, due_at) values (a, s, 'Zadaća', now() + interval '5 days');
  insert into sources (id, user_id, subject_id, kind, title, base_min_per_unit) values (src, a, s, 'book', 'Knjiga', 4);
  insert into units (id, user_id, source_id, title, position) values (u, a, src, '1 Uvod', 0);
  insert into assessment_units (user_id, assessment_id, unit_id) values (a, ex, u);
  insert into cards (user_id, unit_id, front, back) values (a, u, 'p', 'o');
  insert into plan_runs (id, user_id, input_hash) values (run, a, 'h');
  insert into plan_blocks (id, user_id, subject_id, on_date, planned_minutes, plan_run_id) values (blk, a, s, current_date, 50, run);
  insert into plan_block_units (user_id, block_id, unit_id, planned_minutes) values (a, blk, u, 50);
  insert into study_sessions (id, user_id, subject_id, started_at) values (ses, a, s, now());
  insert into study_segments (user_id, session_id, started_at) values (a, ses, now());
  insert into availability_rules (user_id, weekday, start_min, end_min) values (a, 1, 540, 1020);
  insert into availability_exceptions (user_id, on_date) values (a, current_date);
  insert into availability_days (user_id, on_date) values (a, current_date);
  insert into documents (id, user_id, kind, title) values (doc, a, 'other', 'Bilješke');
  insert into owl_conversations (id, user_id) values (conv, a);
  insert into ai_runs (user_id, task, provider, model, ok) values (a, 'quiz', 'test', 'test', true);
end $$;

select ok(
  (select count(*) from subjects where user_id = '00000000-0000-4000-8000-00000000000a') = 1,
  'user A owns data'
);

-- Rows of every public table a role can see that are not its own (owner column: user_id, or id
-- for profiles); a table it may not read counts as nothing visible.
create schema rls_test;
grant usage on schema rls_test to authenticated, anon;
create function rls_test.foreign_rows(me uuid) returns setof text
language plpgsql as $$
declare
  t record;
  n bigint;
begin
  for t in
    select c.relname,
           case when exists (select 1 from information_schema.columns k
                              where k.table_schema = 'public' and k.table_name = c.relname
                                and k.column_name = 'user_id')
                then 'user_id' else 'id' end as owner
      from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
     where ns.nspname = 'public' and c.relkind = 'r'
  loop
    begin
      execute format('select count(*) from public.%I where %I is distinct from $1', t.relname, t.owner)
        into n using me;
      if n > 0 then return next t.relname || ' (' || n || ')'; end if;
    exception when insufficient_privilege then
      null;
    end;
  end loop;
end $$;
grant execute on function rls_test.foreign_rows(uuid) to authenticated, anon;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-00000000000b", "role": "authenticated"}';
select is_empty(
  $$ select rls_test.foreign_rows('00000000-0000-4000-8000-00000000000b') $$,
  'another user sees no row of any table'
);
select is(
  (select count(*) from subjects), 0::bigint,
  'another user sees no subjects (direct check)'
);

reset role;
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select is_empty(
  $$ select rls_test.foreign_rows(null) $$,
  'anon sees no row of any table'
);

reset role;
select * from finish();
rollback;
