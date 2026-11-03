begin;
set local search_path = public, extensions;
select no_plan();
delete from public.santa;
delete from public.flavour_owner;
delete from public.members;
update public.app_state set phase = 'setup' where id = 1;
insert into auth.users (id, email, email_confirmed_at) values
    ('ae000000-0000-4000-8000-000000000001', 'reads.a@example.test', now()),
    ('ae000000-0000-4000-8000-000000000002', 'reads.b@example.test', now()),
    ('ae000000-0000-4000-8000-000000000003', 'reads.c@example.test', now());
insert into public.members (id, email, display_name)
select id, email, split_part(email, '@', 1) from auth.users
where id in ('ae000000-0000-4000-8000-000000000001', 'ae000000-0000-4000-8000-000000000002', 'ae000000-0000-4000-8000-000000000003');
insert into public.answers (member_id, question_id, answer_text) values
    ('ae000000-0000-4000-8000-000000000001', 1, 'A private hint'),
    ('ae000000-0000-4000-8000-000000000002', 1, 'B recipient hint'),
    ('ae000000-0000-4000-8000-000000000003', 1, 'C private hint');

set local role authenticated;
set local request.jwt.claims = '{"sub":"ae000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*) from public.my_flavour()), 0::bigint, 'no shopping flavour before draw');
select is((select count(*) from public.my_flavour_survey()), 0::bigint, 'no recipient hints before draw');
select throws_ok($$select public.owner_of('mango')$$, '42501',
    'permission denied for function owner_of', 'player cannot resolve a flavour owner');
select throws_ok($$select public.thread_for(auth.uid(), 'to_santa')$$, '42501',
    'permission denied for function thread_for', 'player cannot ask for their own flavour');
reset role;

select public.commit_draw('[
    {"santa_id":"ae000000-0000-4000-8000-000000000001","recipient_id":"ae000000-0000-4000-8000-000000000002","flavour_id":"mango"},
    {"santa_id":"ae000000-0000-4000-8000-000000000002","recipient_id":"ae000000-0000-4000-8000-000000000003","flavour_id":"lemon"},
    {"santa_id":"ae000000-0000-4000-8000-000000000003","recipient_id":"ae000000-0000-4000-8000-000000000001","flavour_id":"lime"}
]');

set local role authenticated;
select is((select flavour_id from public.my_flavour()), 'mango', 'A sees B shopping flavour, not own lime');
select is((select name from public.my_flavour()), 'Mango', 'shopping flavour name is returned');
select is((select answer_text from public.my_flavour_survey() where question_id = 1),
    'B recipient hint', 'A sees only assigned recipient hints');
select is((select count(*) from public.my_flavour_survey()), 5::bigint, 'survey includes all five prompts');
select is((select answer_text from public.my_flavour_survey() where question_id = 2),
    null::text, 'unanswered prompt has null text');
select results_eq(
    $$select jsonb_object_keys(to_jsonb(s)) from public.my_flavour_survey() s where question_id = 1 order by 1$$,
    $$values ('answer_text'::text), ('prompt'::text), ('question_id'::text)$$,
    'survey shape contains no identifiers or timestamps');

set local request.jwt.claims = '{"sub":"ae000000-0000-4000-8000-000000000002","role":"authenticated"}';
select is((select flavour_id from public.my_flavour()), 'lemon', 'B sees a different shopping assignment');
select is((select answer_text from public.my_flavour_survey() where question_id = 1),
    'C private hint', 'B sees only C hints');
set local request.jwt.claims = '{"sub":"ae000000-0000-4000-8000-000000000099","role":"authenticated"}';
select is((select count(*) from public.my_flavour()), 0::bigint, 'unassigned caller receives no flavour');
select is((select count(*) from public.my_flavour_survey()), 0::bigint, 'unassigned caller receives no hints');
reset role;

update public.app_state set phase = 'closed' where id = 1;
set local role authenticated;
set local request.jwt.claims = '{"sub":"ae000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select flavour_id from public.my_flavour()), 'mango', 'shopping flavour remains readable when closed');
select is((select answer_text from public.my_flavour_survey() where question_id = 1),
    'B recipient hint', 'shopping hints remain readable when closed');
reset role;
set local role anon;
select throws_ok('select * from public.my_flavour()', '42501',
    'permission denied for function my_flavour', 'anonymous flavour RPC denied');
select throws_ok('select * from public.my_flavour_survey()', '42501',
    'permission denied for function my_flavour_survey', 'anonymous survey RPC denied');
reset role;

select * from finish();
rollback;
