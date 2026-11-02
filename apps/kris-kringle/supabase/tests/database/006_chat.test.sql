begin;
set local search_path = public, extensions;
select no_plan();
delete from public.messages;
delete from public.santa;
delete from public.flavour_owner;
delete from public.members;
update public.app_state set phase = 'setup' where id = 1;
insert into public.allowlist (email) values
    ('chat.a@example.test'), ('chat.b@example.test'), ('chat.c@example.test');
insert into auth.users (id, email, email_confirmed_at) values
    ('af000000-0000-4000-8000-000000000001', 'chat.a@example.test', now()),
    ('af000000-0000-4000-8000-000000000002', 'chat.b@example.test', now()),
    ('af000000-0000-4000-8000-000000000003', 'chat.c@example.test', now());
create temporary table chat_sent (label text primary key, id uuid);
grant all on chat_sent to service_role;
grant select on chat_sent to authenticated;

select ok((select relrowsecurity from pg_class where oid = 'public.messages'::regclass), 'messages has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.push_subs'::regclass), 'push subscriptions have RLS');
set local role authenticated;
set local request.jwt.claims = '{"sub":"af000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*) from public.chat_with_flavour()), 0::bigint, 'shopping chat empty before draw');
select is((select count(*) from public.chat_with_santa()), 0::bigint, 'recipient chat empty before draw');
select throws_ok('select * from public.messages', '42501', 'permission denied for table messages',
    'player cannot read the messages table');
select throws_ok($$select public.insert_message(auth.uid(), 'to_flavour', 'bypass', '2026-12-07')$$,
    '42501', 'permission denied for function insert_message', 'player cannot bypass rewriting');
select throws_ok($$select public.quota_used(auth.uid(), 'to_santa', '2026-12-07')$$,
    '42501', 'permission denied for function quota_used', 'quota helper is service-only');
select throws_ok($$select * from public.push_targets_for_message(gen_random_uuid())$$,
    '42501', 'permission denied for function push_targets_for_message', 'player cannot resolve push receiver');
reset role;
set local role service_role;
select throws_ok($$select public.insert_message('af000000-0000-4000-8000-000000000001',
    'to_flavour', 'not yet', '2026-12-07')$$, 'P0001', 'chat is not open', 'no send before draw');
reset role;

select public.commit_draw('[
    {"santa_id":"af000000-0000-4000-8000-000000000001","recipient_id":"af000000-0000-4000-8000-000000000002","flavour_id":"mango"},
    {"santa_id":"af000000-0000-4000-8000-000000000002","recipient_id":"af000000-0000-4000-8000-000000000003","flavour_id":"lemon"},
    {"santa_id":"af000000-0000-4000-8000-000000000003","recipient_id":"af000000-0000-4000-8000-000000000001","flavour_id":"lime"}
]');
set local role service_role;
select is(public.quota_used('af000000-0000-4000-8000-000000000001', 'to_flavour', '2026-12-07'),
    false, 'new week starts with quota available');
insert into chat_sent select 'a_to_b', public.insert_message(
    'af000000-0000-4000-8000-000000000001', 'to_flavour', 'Question for B', '2026-12-07');
select is(public.quota_used('af000000-0000-4000-8000-000000000001', 'to_flavour', '2026-12-07'),
    true, 'successful send uses that thread and direction quota');
select is(public.quota_used('af000000-0000-4000-8000-000000000001', 'to_santa', '2026-12-07'),
    false, 'other chat has an independent quota');
select throws_ok($$select public.insert_message('af000000-0000-4000-8000-000000000001',
    'to_flavour', 'Duplicate', '2026-12-07')$$, '23505',
    'duplicate key value violates unique constraint "idx_messages_weekly_quota"', 'duplicate send gets the expected quota SQLSTATE');
insert into chat_sent select 'b_to_a', public.insert_message(
    'af000000-0000-4000-8000-000000000002', 'to_santa', 'Reply from B', '2026-12-07');
insert into chat_sent select 'c_to_a', public.insert_message(
    'af000000-0000-4000-8000-000000000003', 'to_flavour', 'Question for A', '2026-12-07');
insert into chat_sent select 'a_to_c', public.insert_message(
    'af000000-0000-4000-8000-000000000001', 'to_santa', 'Reply from A', '2026-12-07');
insert into chat_sent select 'b_to_c', public.insert_message(
    'af000000-0000-4000-8000-000000000002', 'to_flavour', 'Other private thread', '2026-12-07');
reset role;

set local role authenticated;
select results_eq($$select body from public.chat_with_flavour() order by body$$,
    $$values ('Question for B'::text), ('Reply from B'::text)$$, 'A shopping chat contains only A and B messages');
select results_eq($$select body from public.chat_with_santa() order by body$$,
    $$values ('Question for A'::text), ('Reply from A'::text)$$, 'A recipient chat contains only A and C messages');
select results_eq(
    $$select jsonb_object_keys(to_jsonb(m)) from public.chat_with_santa() m
      where id = (select id from chat_sent where label = 'c_to_a') order by 1$$,
    $$values ('body'::text), ('created_at'::text), ('direction'::text), ('id'::text)$$,
    'recipient chat shape reveals no member or own-flavour identity');
select results_eq(
    $$select jsonb_object_keys(to_jsonb(m)) from public.chat_with_flavour() m
      where id = (select id from chat_sent where label = 'a_to_b') order by 1$$,
    $$values ('body'::text), ('created_at'::text), ('direction'::text), ('id'::text)$$,
    'shopping chat also returns only message fields');

insert into public.push_subs (member_id, endpoint, p256dh, auth) values
    (auth.uid(), 'https://push.example.test/a1', 'a-key', 'a-auth'),
    (auth.uid(), 'https://push.example.test/a2', 'a2-key', 'a2-auth');
select lives_ok($$insert into public.push_subs (member_id, endpoint, p256dh, auth)
    values (auth.uid(), 'https://push.example.test/a1', 'updated-key', 'a-auth')
    on conflict (endpoint) do update set p256dh = excluded.p256dh$$,
    'player can upsert their subscription by endpoint');
reset role;
insert into public.push_subs (member_id, endpoint, p256dh, auth) values
    ('af000000-0000-4000-8000-000000000002', 'https://push.example.test/b', 'b-key', 'b-auth'),
    ('af000000-0000-4000-8000-000000000003', 'https://push.example.test/c', 'c-key', 'c-auth');
set local role authenticated;
select is((select count(*) from public.push_subs), 2::bigint, 'A cannot browse other push subscriptions');
select results_eq($$delete from public.push_subs where endpoint = 'https://push.example.test/b' returning id$$,
    $$select null::uuid where false$$, 'A cannot remove B subscriptions');
select throws_ok($$update public.push_subs set member_id = 'af000000-0000-4000-8000-000000000002'
    where endpoint = 'https://push.example.test/a1'$$,
    '42501', 'new row violates row-level security policy for table "push_subs"', 'subscription owner cannot be reassigned by client');
reset role;
set local role service_role;
select is((select endpoint from public.push_targets_for_message((select id from chat_sent where label = 'a_to_b'))),
    'https://push.example.test/b', 'Santa message targets the recipient device');
select is((select count(*) from public.push_targets_for_message((select id from chat_sent where label = 'b_to_a'))),
    2::bigint, 'recipient reply targets both devices of their Santa');
select is((select endpoint from public.push_targets_for_message((select id from chat_sent where label = 'a_to_c'))),
    'https://push.example.test/c', 'A recipient reply goes to C, not their shopping recipient B');
select is((select count(*) from public.push_targets_for_message(gen_random_uuid())),
    0::bigint, 'unknown message has no push receiver');
select results_eq(
    $$select jsonb_object_keys(to_jsonb(t)) from public.push_targets_for_message(
      (select id from chat_sent where label = 'a_to_b')) t order by 1$$,
    $$values ('auth'::text), ('endpoint'::text), ('p256dh'::text)$$,
    'push target shape contains endpoints only');

select lives_ok($$select public.insert_message('af000000-0000-4000-8000-000000000001',
    'to_flavour', 'Next week', '2026-12-14')$$, 'new Monday has a fresh quota');
reset role;
update public.app_state set phase = 'closed' where id = 1;
set local role service_role;
select throws_ok($$select public.insert_message('af000000-0000-4000-8000-000000000001',
    'to_flavour', 'Too late', '2026-12-21')$$, 'P0001', 'chat is not open', 'closing the app blocks writes');
reset role;
set local role authenticated;
select is((select count(*) from public.chat_with_flavour()), 3::bigint, 'shopping history remains readable when closed');
select is((select count(*) from public.chat_with_santa()), 2::bigint, 'recipient history remains readable when closed');
set local request.jwt.claims = '{"sub":"af000000-0000-4000-8000-000000000099","role":"authenticated"}';
select is((select count(*) from public.chat_with_santa()), 0::bigint, 'unassigned caller has no history');
reset role;
set local role anon;
select throws_ok('select * from public.chat_with_santa()', '42501',
    'permission denied for function chat_with_santa', 'anonymous chat read denied');
reset role;

select * from finish();
rollback;
