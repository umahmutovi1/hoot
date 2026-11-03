-- Sprint 17: aggregation, local day boundaries, and RPC isolation between users.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(8);
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
 ('10000000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@progress.test', '', now(), now()),
 ('10000000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@progress.test', '', now(), now());
insert into profiles (id, timezone, day_start_min) values
 ('10000000-0000-4000-8000-00000000000a', 'Europe/Sarajevo', 240),
 ('10000000-0000-4000-8000-00000000000b', 'Europe/Sarajevo', 240)
on conflict (id) do update set timezone = excluded.timezone, day_start_min = excluded.day_start_min;
insert into subjects (id, user_id, name) values
 ('20000000-0000-4000-8000-00000000000a','10000000-0000-4000-8000-00000000000a','Signali');
insert into study_sessions (id, user_id, subject_id, started_at, ended_at, focus, timer_mode) values
 ('30000000-0000-4000-8000-00000000000a','10000000-0000-4000-8000-00000000000a','20000000-0000-4000-8000-00000000000a','2026-11-02 00:00Z','2026-11-02 01:00Z',3,'standard');
insert into study_segments (user_id, session_id, started_at, ended_at) values
 ('10000000-0000-4000-8000-00000000000a','30000000-0000-4000-8000-00000000000a','2026-11-02 00:00Z','2026-11-02 00:20Z'),
 ('10000000-0000-4000-8000-00000000000a','30000000-0000-4000-8000-00000000000a','2026-11-02 00:30Z','2026-11-02 01:00Z');
select ok(not has_function_privilege('anon', 'public.progress_statistics(date,date,jsonb)', 'execute'), 'anon cannot call the RPC');
set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-4000-8000-00000000000a';
select is((progress_statistics('2026-11-01','2026-11-01')->'daily'->0->>'minutes')::numeric, 50::numeric, 'active minutes exclude the break and sum segments once');
select is((progress_statistics('2026-11-01','2026-11-01')->>'sessions')::integer, 1, 'after midnight before boundary belongs to the previous day');
select is((progress_statistics('2026-11-02','2026-11-02')->>'sessions')::integer, 0, 'session does not leak to the calendar day');
select is((progress_statistics('2026-11-01','2026-11-01')->>'focus')::numeric, 3::numeric, 'focus from timer sessions');
select is(progress_statistics('2026-11-01','2026-11-01')->'slots'->0->>'part', 'night', 'after midnight before boundary is the night slot');
set local request.jwt.claim.sub = '10000000-0000-4000-8000-00000000000b';
select is((progress_statistics('2026-11-01','2026-11-01')->>'sessions')::integer, 0, 'other user cannot aggregate owner sessions');
select is((progress_statistics('2026-11-01','2026-11-01')->'daily'->0->>'minutes')::numeric, 0::numeric, 'other user sees no owner minutes');
select * from finish();
rollback;
