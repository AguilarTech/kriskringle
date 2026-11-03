begin;
set local search_path = public, extensions;
select plan(3);
delete from public.messages;
delete from public.santa;
delete from public.flavour_owner;
delete from public.members;
update public.app_state set phase = 'setup' where id = 1;
insert into auth.users (id, email, email_confirmed_at) values
    ('ae000000-0000-4000-8000-000000000001', 'reply.a@example.test', now()),
    ('ae000000-0000-4000-8000-000000000002', 'reply.b@example.test', now());
insert into public.members (id, email, display_name)
select id, email, split_part(email, '@', 1) from auth.users
where id in ('ae000000-0000-4000-8000-000000000001', 'ae000000-0000-4000-8000-000000000002');
select public.commit_draw('[
    {"santa_id":"ae000000-0000-4000-8000-000000000001","recipient_id":"ae000000-0000-4000-8000-000000000002","flavour_id":"mango"},
    {"santa_id":"ae000000-0000-4000-8000-000000000002","recipient_id":"ae000000-0000-4000-8000-000000000001","flavour_id":"lemon"}
]');
set local role service_role;
-- B's Santa (A) hasn't written yet, so B can't start the chat.
select throws_ok($$select public.insert_message('ae000000-0000-4000-8000-000000000002',
    'to_santa', 'Hi Santa', '2026-12-07')$$, 'P0001', 'nothing to reply to',
    'recipient cannot start a chat with their Santa');
select lives_ok($$select public.insert_message('ae000000-0000-4000-8000-000000000001',
    'to_flavour', 'Question for B', '2026-12-07')$$, 'Santa writes first');
select lives_ok($$select public.insert_message('ae000000-0000-4000-8000-000000000002',
    'to_santa', 'Answer', '2026-12-07')$$, 'recipient can reply');
reset role;
select * from finish();
rollback;
