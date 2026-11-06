-- Isolate the three-player fixture inside this rolled-back transaction.
begin;
set local search_path = public, extensions;
select no_plan();
delete from public.santa;
delete from public.flavour_owner;
delete from public.members;
update public.app_state set phase = 'setup' where id = 1;
insert into auth.users (id, email, email_confirmed_at) values
    ('ad000000-0000-4000-8000-000000000001', 'draw.a@example.test', now()),
    ('ad000000-0000-4000-8000-000000000002', 'draw.b@example.test', now()),
    ('ad000000-0000-4000-8000-000000000003', 'draw.c@example.test', now());
insert into public.members (id, email, display_name)
select id, email, split_part(email, '@', 1) from auth.users
where id in ('ad000000-0000-4000-8000-000000000001', 'ad000000-0000-4000-8000-000000000002', 'ad000000-0000-4000-8000-000000000003');
-- Roster IDs are deliberately the same as the old member fixtures here.
insert into public.roster (id, name, claimed_by)
select id, display_name, id from public.members
where id::text like 'ad000000-%';
insert into public.exclusions (member_id, excluded_id)
values ('ad000000-0000-4000-8000-000000000001', 'ad000000-0000-4000-8000-000000000003');

create temporary table fixture_pairs (payload jsonb);
insert into fixture_pairs values ('[
    {"santa_id":"ad000000-0000-4000-8000-000000000001","recipient_id":"ad000000-0000-4000-8000-000000000002","flavour_id":"mango"},
    {"santa_id":"ad000000-0000-4000-8000-000000000002","recipient_id":"ad000000-0000-4000-8000-000000000003","flavour_id":"lemon"},
    {"santa_id":"ad000000-0000-4000-8000-000000000003","recipient_id":"ad000000-0000-4000-8000-000000000001","flavour_id":"lime"}
]');
grant select on fixture_pairs to service_role, authenticated;

select is((select count(*) from public.flavours), 18::bigint, '18 flavours are seeded');
select ok(has_function_privilege('service_role', 'public.commit_draw(jsonb)', 'EXECUTE'), 'service role can save draw');
select ok(not has_function_privilege('authenticated', 'public.commit_draw(jsonb)', 'EXECUTE'), 'players cannot save draw');
select ok(not has_function_privilege('anon', 'public.commit_draw(jsonb)', 'EXECUTE'), 'anon cannot save draw');
select ok(not has_function_privilege('service_role', 'public.kringle_key()', 'EXECUTE'), 'service role cannot fetch Vault key');

set local role authenticated;
set local request.jwt.claims = '{"sub":"ad000000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok('select public.commit_draw((select payload from fixture_pairs))',
    '42501', 'permission denied for function commit_draw', 'client RPC draw attempt is denied');
select throws_ok('select * from public.flavour_owner', '42501',
    'permission denied for table flavour_owner', 'client cannot read encrypted ownership');
reset role;

select throws_ok($$select public.commit_draw('[]'::jsonb)$$,
    'P0001', 'draw refused: pairs are not a valid derangement of all members', 'incomplete matching is rejected');
select throws_ok($$select public.commit_draw(jsonb_set((select payload from fixture_pairs),
    '{0,recipient_id}', '"ad000000-0000-4000-8000-000000000001"'))$$,
    'P0001', 'draw refused: pairs are not a valid derangement of all members', 'self-match is rejected');
select throws_ok($$select public.commit_draw(jsonb_set(jsonb_set(jsonb_set(
    (select payload from fixture_pairs),
    '{0,recipient_id}', '"ad000000-0000-4000-8000-000000000003"'),
    '{1,recipient_id}', '"ad000000-0000-4000-8000-000000000001"'),
    '{2,recipient_id}', '"ad000000-0000-4000-8000-000000000002"'))$$,
    'P0001', 'draw refused: pairs are not a valid derangement of all members', 'otherwise valid matching with an excluded pair is rejected');
select throws_ok($$select public.commit_draw(jsonb_set((select payload from fixture_pairs),
    '{0,flavour_id}', '"lemon"'))$$,
    'P0001', 'draw refused: pairs are not a valid derangement of all members', 'duplicate flavour is rejected');
select throws_ok($$select public.commit_draw(jsonb_set((select payload from fixture_pairs),
    '{0,flavour_id}', '"unknown"'))$$,
    'P0001', 'draw refused: pairs are not a valid derangement of all members', 'unknown flavour is rejected');

-- Force a failure after assignment inserts to prove the save is atomic.
create function pg_temp.fail_phase_change() returns trigger language plpgsql as $$
begin
    raise exception 'simulated phase update failure';
end;
$$;
create trigger test_fail_phase before update on public.app_state
for each row execute function pg_temp.fail_phase_change();
set local role service_role;
select throws_ok('select public.commit_draw((select payload from fixture_pairs))',
    'P0001', 'simulated phase update failure', 'late save failure is reported');
reset role;
select is((select count(*) from public.santa), 0::bigint, 'failed save leaves no Santa assignments');
select is((select count(*) from public.flavour_owner), 0::bigint, 'failed save leaves no encrypted owners');
select is((select phase from public.app_state), 'setup', 'failed save keeps setup phase');
drop trigger test_fail_phase on public.app_state;

set local role service_role;
select lives_ok('select public.commit_draw((select payload from fixture_pairs))', 'service role saves the valid draw');
select throws_ok('select public.commit_draw((select payload from fixture_pairs))',
    'P0001', 'draw refused: phase is not setup', 'second draw is refused');
reset role;
select is((select phase from public.app_state), 'drawn', 'successful save advances phase');
select is((select count(*) from public.santa), 3::bigint, 'every Santa has one shopping assignment');
select is((select count(*) from public.flavour_owner), 3::bigint, 'every recipient has an encrypted flavour');
select results_eq(
    $$select fo.flavour_id, extensions.pgp_sym_decrypt(fo.encrypted_member_id, public.kringle_key())::uuid
      from public.flavour_owner fo order by fo.flavour_id$$,
    $$select p.flavour_id, p.recipient_id from jsonb_to_recordset((select payload from fixture_pairs))
      as p(santa_id uuid, recipient_id uuid, flavour_id text) order by p.flavour_id$$,
    'encrypted ownership decrypts to exactly the supplied recipients');

set local role authenticated;
select is((select flavour_id from public.santa), 'mango', 'Santa sees only their shopping assignment');
select is((select count(*) from public.santa), 1::bigint, 'other Santa assignments stay hidden');
reset role;

select * from finish();
rollback;
