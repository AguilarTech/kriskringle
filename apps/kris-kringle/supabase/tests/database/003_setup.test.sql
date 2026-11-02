begin;
set local search_path = public, extensions;
select no_plan();

insert into public.allowlist (email) values ('setup.a@example.test'), ('setup.b@example.test');
insert into auth.users (id, email, email_confirmed_at) values
    ('ac000000-0000-4000-8000-000000000001', 'setup.a@example.test', now()),
    ('ac000000-0000-4000-8000-000000000002', 'setup.b@example.test', now());
update public.app_state set phase = 'setup' where id = 1;
insert into public.answers (member_id, question_id, answer_text)
values ('ac000000-0000-4000-8000-000000000002', 1, 'B private answer');
insert into public.exclusions (member_id, excluded_id)
values ('ac000000-0000-4000-8000-000000000002', 'ac000000-0000-4000-8000-000000000001');

select is((select draw_at from public.app_state where id = 1),
    '2026-12-05 20:00:00 Australia/Melbourne'::timestamptz, 'draw time is seeded in Melbourne time');
select ok((select bool_and(relrowsecurity) from pg_class where oid in (
    'public.app_state'::regclass, 'public.questions'::regclass,
    'public.answers'::regclass, 'public.exclusions'::regclass)), 'setup tables have RLS');

set local role authenticated;
set local request.jwt.claims = '{"sub":"ac000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*) from public.questions), 5::bigint, 'players can read the five survey questions');
select is((select count(*) from public.answers), 0::bigint, 'A cannot read B answers');
select is((select count(*) from public.exclusions), 0::bigint, 'A cannot read B exclusions');
select lives_ok($$insert into public.answers (member_id, question_id, answer_text)
    values (auth.uid(), 1, 'A original answer')$$, 'A can save own answer');
select lives_ok($$insert into public.answers (member_id, question_id, answer_text)
    values (auth.uid(), 1, 'A edited answer')
    on conflict (member_id, question_id) do update set answer_text = excluded.answer_text$$,
    'answer upsert updates the same question');
select is((select answer_text from public.answers where question_id = 1),
    'A edited answer', 'saved edit is readable');
select throws_ok($$insert into public.answers (member_id, question_id, answer_text)
    values ('ac000000-0000-4000-8000-000000000002', 2, 'forbidden')$$,
    '42501', 'new row violates row-level security policy for table "answers"', 'A cannot insert B answers');
select throws_ok($$update public.answers set member_id = 'ac000000-0000-4000-8000-000000000002'$$,
    '42501', 'new row violates row-level security policy for table "answers"', 'answer update checks the new owner');
select results_eq($$update public.answers set answer_text = 'forbidden'
    where member_id = 'ac000000-0000-4000-8000-000000000002' returning id$$,
    $$select null::uuid where false$$, 'A cannot update B answers');
select lives_ok($$insert into public.exclusions (member_id, excluded_id)
    values (auth.uid(), 'ac000000-0000-4000-8000-000000000002')$$, 'A can add own exclusion');
select throws_ok($$insert into public.exclusions (member_id, excluded_id) values (auth.uid(), auth.uid())$$,
    '23514', 'new row for relation "exclusions" violates check constraint "no_self_exclusion"',
    'self-exclusion is rejected');
select results_eq($$delete from public.exclusions
    where member_id = 'ac000000-0000-4000-8000-000000000002' returning id$$,
    $$select null::uuid where false$$, 'A cannot delete B exclusions');
select lives_ok('delete from public.exclusions where member_id = auth.uid()', 'A can remove own exclusion');
insert into public.exclusions (member_id, excluded_id)
values (auth.uid(), 'ac000000-0000-4000-8000-000000000002');
select throws_ok($$update public.app_state set phase = 'drawn'$$,
    '42501', 'permission denied for table app_state', 'player cannot control phase');
reset role;

update public.app_state set phase = 'drawn' where id = 1;
set local role authenticated;
select throws_ok($$insert into public.answers (member_id, question_id, answer_text) values (auth.uid(), 2, 'late')$$,
    '42501', 'new row violates row-level security policy for table "answers"', 'answer inserts lock after draw');
select results_eq($$update public.answers set answer_text = 'late' where member_id = auth.uid() returning id$$,
    $$select null::uuid where false$$, 'answer edits lock after draw');
select results_eq($$delete from public.exclusions where member_id = auth.uid() returning id$$,
    $$select null::uuid where false$$, 'exclusion deletes lock after draw');
select throws_ok($$insert into public.exclusions (member_id, excluded_id)
    values (auth.uid(), 'ac000000-0000-4000-8000-000000000001')$$,
    '42501', 'new row violates row-level security policy for table "exclusions"', 'exclusion inserts lock after draw');
reset role;

update public.app_state set phase = 'closed' where id = 1;
set local role authenticated;
select results_eq($$update public.answers set answer_text = 'late' where member_id = auth.uid() returning id$$,
    $$select null::uuid where false$$, 'answer edits stay locked when closed');
select results_eq($$delete from public.exclusions where member_id = auth.uid() returning id$$,
    $$select null::uuid where false$$, 'exclusion deletes stay locked when closed');
select is((select answer_text from public.answers where question_id = 1),
    'A edited answer', 'own setup remains readable after closing');
reset role;

select * from finish();
rollback;
