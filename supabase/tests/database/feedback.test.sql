-- Sprint 17 feedback is private, writable only by its owner, including reflected text.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(5);
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
 ('90000000-0000-4000-8000-00000000000a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','a@feedback.test','',now(),now()),
 ('90000000-0000-4000-8000-00000000000b','00000000-0000-0000-0000-000000000000','authenticated','authenticated','b@feedback.test','',now(),now());
set local role authenticated;
set local request.jwt.claim.sub = '90000000-0000-4000-8000-00000000000a';
insert into progress_feedback (id,insight_id,status,payload) values
 ('91000000-0000-4000-8000-00000000000a','checkin:2026-11-02','accepted','{"worked":"private reflection"}');
select is((select count(*)::int from progress_feedback),1,'owner can read saved feedback');
select throws_ok($$ insert into progress_feedback (id,user_id,candidate_id,status) values ('91000000-0000-4000-8000-00000000000b','90000000-0000-4000-8000-00000000000b','x','accepted') $$,'42501',null,'cannot forge another owner');
set local request.jwt.claim.sub = '90000000-0000-4000-8000-00000000000b';
select is((select count(*)::int from progress_feedback),0,'other user cannot read the reflection');
with modified as (update progress_feedback set status='rejected' returning id)
select is((select count(*)::int from modified),0,'other user cannot change the feedback');
reset role;
select ok(not has_table_privilege('anon','public.progress_feedback','select'),'anonymous access is closed');
select * from finish();
rollback;
