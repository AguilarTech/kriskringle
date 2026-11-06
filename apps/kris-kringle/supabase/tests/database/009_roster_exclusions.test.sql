begin;
set local search_path = public, extensions;
select no_plan();
delete from public.santa;
delete from public.flavour_owner;
delete from public.members;
delete from public.roster;
update public.app_state set phase = 'setup' where id = 1;
insert into auth.users (id, email, email_confirmed_at) values
    ('ae000000-0000-4000-8000-000000000001', 'roster.a@example.test', now()),
    ('ae000000-0000-4000-8000-000000000002', 'roster.b@example.test', now()),
    ('ae000000-0000-4000-8000-000000000003', 'roster.c@example.test', now());
insert into public.roster (id, name) values
    ('af000000-0000-4000-8000-000000000001', 'Player A'),
    ('af000000-0000-4000-8000-000000000002', 'Player B'),
    ('af000000-0000-4000-8000-000000000003', 'Player C');
select ok(not has_function_privilege('anon', 'public.list_exclusion_options()', 'EXECUTE'),
    'anonymous callers cannot list exclusion options');
set local role authenticated;
set local request.jwt.claims = '{"sub":"ae000000-0000-4000-8000-000000000001","role":"authenticated"}';
select public.claim_roster_name('af000000-0000-4000-8000-000000000001');
select results_eq($$select name from public.list_exclusion_options()$$,
    $$values ('Player B'::text), ('Player C'::text)$$,
    'unclaimed players appear and own name is omitted');
select lives_ok($$insert into public.exclusions (member_id, excluded_id)
    values (auth.uid(), 'af000000-0000-4000-8000-000000000002')$$,
    'a player can exclude a name before it is claimed');
select throws_ok($$insert into public.exclusions (member_id, excluded_id)
    values (auth.uid(), 'af000000-0000-4000-8000-000000000001')$$,
    '23514', 'new row for relation "exclusions" violates check constraint "no_self_exclusion"',
    'own roster name cannot be excluded');
set local request.jwt.claims = '{"sub":"ae000000-0000-4000-8000-000000000002","role":"authenticated"}';
select public.claim_roster_name('af000000-0000-4000-8000-000000000002');
select is((select count(*) from public.exclusions), 0::bigint, 'another player cannot read the exclusion');
set local request.jwt.claims = '{"sub":"ae000000-0000-4000-8000-000000000003","role":"authenticated"}';
select public.claim_roster_name('af000000-0000-4000-8000-000000000003');
reset role;
select is((select r.claimed_by from public.exclusions e join public.roster r on r.id = e.excluded_id),
    'ae000000-0000-4000-8000-000000000002'::uuid, 'the saved choice resolves to the later claimant');
select throws_ok($$select public.commit_draw('[
    {"santa_id":"ae000000-0000-4000-8000-000000000001","recipient_id":"ae000000-0000-4000-8000-000000000002","flavour_id":"mango"},
    {"santa_id":"ae000000-0000-4000-8000-000000000002","recipient_id":"ae000000-0000-4000-8000-000000000003","flavour_id":"lemon"},
    {"santa_id":"ae000000-0000-4000-8000-000000000003","recipient_id":"ae000000-0000-4000-8000-000000000001","flavour_id":"lime"}
]'::jsonb)$$, 'P0001', 'draw refused: pairs are not a valid derangement of all members',
    'draw rejects an excluded name after that player signs up');
update public.app_state set phase = 'drawn' where id = 1;
set local role authenticated;
set local request.jwt.claims = '{"sub":"ae000000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$insert into public.exclusions (member_id, excluded_id)
    values (auth.uid(), 'af000000-0000-4000-8000-000000000003')$$,
    '42501', 'new row violates row-level security policy for table "exclusions"',
    'new roster exclusions lock after the draw');
select results_eq($$delete from public.exclusions returning id$$,
    $$select null::uuid where false$$, 'existing roster exclusions lock after the draw');
reset role;
select * from finish();
rollback;
