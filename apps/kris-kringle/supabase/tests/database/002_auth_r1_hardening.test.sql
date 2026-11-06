begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

-- No explicit REVOKE on this probe: it must be private from creation time.
-- The transaction rolls it back, along with all fixtures below.
create function public.mises_r1_default_privilege_probe()
returns integer language sql as 'select 1';
select ok(not has_function_privilege('anon', 'public.mises_r1_default_privilege_probe()', 'EXECUTE'),
    'a new postgres-owned function does not inherit anonymous execution');
select ok(not has_function_privilege('authenticated', 'public.mises_r1_default_privilege_probe()', 'EXECUTE'),
    'a new postgres-owned function does not inherit authenticated execution');
select ok(not exists (
    select 1 from aclexplode((select proacl from pg_proc
        where oid = 'public.mises_r1_default_privilege_probe()'::regprocedure))
    where grantee = 0 and privilege_type = 'EXECUTE'
), 'a new function has no PUBLIC execution grant');

-- Review this explicit allowlist whenever a migration adds a client RPC.
-- Scan every public routine, including the newly created default probe.
select results_eq(
    $$select p.oid::regprocedure::text
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE')
      order by 1$$,
    $$select null::text where false$$,
    'anon can execute no public functions');
select results_eq(
    $$select p.oid::regprocedure::text
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and has_function_privilege('authenticated', p.oid, 'EXECUTE')
        and p.oid <> all(array[
            'public.claim_membership()'::regprocedure::oid,
            'public.list_roster()'::regprocedure::oid,
            'public.list_exclusion_options()'::regprocedure::oid,
            'public.claim_roster_name(uuid)'::regprocedure::oid,
            'public.my_flavour()'::regprocedure::oid,
            'public.my_flavour_survey()'::regprocedure::oid,
            'public.chat_with_flavour()'::regprocedure::oid,
            'public.chat_with_santa()'::regprocedure::oid
        ])
      order by 1$$,
    $$select null::text where false$$,
    'authenticated can execute only the reviewed public RPC allowlist');

update public.app_state set phase = 'setup' where id = 1;
insert into public.roster (id, name) values ('ba000000-0000-4000-8000-000000000006', 'Unconfirmed Santa');
insert into auth.users (id, email, raw_user_meta_data)
values ('ab000000-0000-4000-8000-000000000006', 'mises.unconfirmed@example.test',
        '{"full_name":"Unconfirmed Santa","email_verified":true}');

set local role authenticated;
set local request.jwt.claims = '{"sub":"ab000000-0000-4000-8000-000000000006","role":"authenticated"}';
select throws_ok($$select public.claim_roster_name('ba000000-0000-4000-8000-000000000006')$$,
    'P0001', 'not_confirmed', 'unconfirmed caller cannot claim, regardless of metadata');
select is(public.claim_membership(), false, 'failed unconfirmed claim creates no membership');
reset role;

-- Confirmation after first sign-in must recover through the normal claim RPC.
update auth.users set email_confirmed_at = now()
where id = 'ab000000-0000-4000-8000-000000000006';
set local role authenticated;
select is(public.claim_roster_name('ba000000-0000-4000-8000-000000000006'), true,
    'confirmed user can claim without another Auth insert');
select is((select email from public.members where id = auth.uid()),
    'mises.unconfirmed@example.test', 'confirmed claim creates the intended member');
reset role;

select * from finish();
rollback;
