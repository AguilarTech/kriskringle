-- Run with `supabase test db`. Every fixture is rolled back, including Auth users.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

delete from public.roster;
update public.app_state set phase = 'setup' where id = 1;

select ok((select relrowsecurity from pg_class where oid = 'public.members'::regclass),
    'members has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.roster'::regclass),
    'roster has RLS enabled');
select ok(has_table_privilege('authenticated', 'public.members', 'SELECT'),
    'authenticated can read members');
select ok(not has_table_privilege('anon', 'public.members', 'SELECT'),
    'anonymous sessions cannot read members');
select ok(not has_table_privilege('authenticated', 'public.members', 'INSERT,UPDATE,DELETE'),
    'clients cannot write members or promote themselves');
select ok(not has_table_privilege('authenticated', 'public.roster', 'SELECT,INSERT,UPDATE,DELETE'),
    'authenticated has no direct roster access');
select ok(not has_table_privilege('anon', 'public.roster', 'SELECT,INSERT,UPDATE,DELETE'),
    'anon has no roster access');
select ok(has_table_privilege('service_role', 'public.roster', 'SELECT,INSERT,UPDATE,DELETE'),
    'service operations can manage the roster');
select hasnt_table('public', 'allowlist', 'the email allowlist is gone');

select ok(has_function_privilege('authenticated', 'public.claim_membership()', 'EXECUTE'),
    'authenticated can check its own membership');
select ok(has_function_privilege('authenticated', 'public.list_roster()', 'EXECUTE'),
    'authenticated can list roster names');
select ok(has_function_privilege('authenticated', 'public.claim_roster_name(uuid)', 'EXECUTE'),
    'authenticated can claim a roster name');
select ok(not has_function_privilege('anon', 'public.list_roster()', 'EXECUTE'),
    'anon cannot list roster names');
select ok(not has_function_privilege('anon', 'public.claim_roster_name(uuid)', 'EXECUTE'),
    'anon cannot claim a roster name');
select ok((select bool_and(p.prosecdef and 'search_path=public' = any(p.proconfig))
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in
        ('claim_membership', 'list_roster', 'claim_roster_name')),
    'all membership functions are security definer with pinned search_path');

insert into public.roster (id, name) values
    ('ba000000-0000-4000-8000-000000000001', 'Abuela'),
    ('ba000000-0000-4000-8000-000000000002', 'Tío Pepe'),
    ('ba000000-0000-4000-8000-000000000003', 'Cousin Ana');
insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at)
values
    ('ab000000-0000-4000-8000-000000000001', 'Mises.One@Example.Test',
     '{"full_name":"Google Name","avatar_url":"https://example.test/avatar.png","is_admin":true}', now()),
    ('ab000000-0000-4000-8000-000000000002', 'mises.two@example.test', '{}', now()),
    ('ab000000-0000-4000-8000-000000000003', 'mises.three@example.test', '{}', null);

select is((select count(*) from public.members where id in (
    'ab000000-0000-4000-8000-000000000001', 'ab000000-0000-4000-8000-000000000002')),
    0::bigint, 'signing in alone does not create a membership');
select throws_ok($$insert into public.roster (name) values ('  abuela ')$$, '23505', null,
    'roster names are unique regardless of case and spacing');

set local role anon;
select throws_ok('select public.claim_membership()', '42501',
    'permission denied for function claim_membership', 'anonymous membership check is rejected');
select throws_ok('select * from public.list_roster()', '42501',
    'permission denied for function list_roster', 'anonymous roster listing is rejected');
select throws_ok('select * from public.members', '42501',
    'permission denied for table members', 'anonymous member reads are rejected');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"ab000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is(public.claim_membership(), false, 'a new account is not yet a member');
select is((select count(*) from public.list_roster() where not claimed), 3::bigint,
    'all names start unclaimed');
select throws_ok('select * from public.roster', '42501',
    'permission denied for table roster', 'clients cannot read the roster table directly');
select is(public.claim_roster_name('ba000000-0000-4000-8000-000000000001'), true,
    'a signed-in user can claim a name');
select is(public.claim_membership(), true, 'claiming a name creates the membership');
select is(public.claim_roster_name('ba000000-0000-4000-8000-000000000001'), true,
    'claiming your own name again is idempotent');
select throws_ok($$select public.claim_roster_name('ba000000-0000-4000-8000-000000000002')$$,
    'P0001', 'already_claimed', 'one account cannot claim a second name');
select is((select display_name from public.members where id = auth.uid()),
    'Abuela', 'the display name comes from the roster, not Google');
select is((select email from public.members where id = auth.uid()),
    'mises.one@example.test', 'the sign-in email is recorded in lower case');
select is((select avatar_url from public.members where id = auth.uid()),
    'https://example.test/avatar.png', 'the avatar is copied');
select is((select is_admin from public.members where id = auth.uid()),
    false, 'user metadata cannot grant admin status');
select results_eq(
    $$select name, claimed from public.list_roster() order by name$$,
    $$values ('Abuela'::text, true), ('Cousin Ana'::text, false), ('Tío Pepe'::text, false)$$,
    'the roster shows claimed names without revealing who claimed them');
select throws_ok($$update public.members set is_admin = true where id = auth.uid()$$,
    '42501', 'permission denied for table members', 'clients cannot promote themselves');

set local request.jwt.claims = '{"sub":"ab000000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok($$select public.claim_roster_name('ba000000-0000-4000-8000-000000000001')$$,
    'P0001', 'name_taken', 'a claimed name cannot be claimed by someone else');
select is(public.claim_membership(), false, 'a failed claim creates no membership');
select throws_ok($$select public.claim_roster_name('ba000000-0000-4000-8000-0000000000ff')$$,
    'P0001', 'not_found', 'unknown roster entries are rejected');

set local request.jwt.claims = '{"sub":"ab000000-0000-4000-8000-000000000003","role":"authenticated"}';
select throws_ok($$select public.claim_roster_name('ba000000-0000-4000-8000-000000000003')$$,
    'P0001', 'not_confirmed', 'an unconfirmed email cannot claim a name');

set local request.jwt.claims = '{}';
select is(public.claim_membership(), false, 'missing subject fails closed');
select is((select count(*) from public.list_roster()), 0::bigint, 'missing subject lists nothing');
select throws_ok($$select public.claim_roster_name('ba000000-0000-4000-8000-000000000003')$$,
    '42501', 'not_authenticated', 'missing subject cannot claim');
reset role;

update public.app_state set phase = 'drawn' where id = 1;
set local role authenticated;
set local request.jwt.claims = '{"sub":"ab000000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok($$select public.claim_roster_name('ba000000-0000-4000-8000-000000000002')$$,
    'P0001', 'draw_done', 'nobody can join after the draw');
reset role;
update public.app_state set phase = 'setup' where id = 1;

-- Exercise RLS independently of the privilege layer, without persisting grants.
grant select, update on public.roster to authenticated;
set local role authenticated;
select is((select count(*) from public.roster), 0::bigint,
    'RLS still hides the roster if SELECT is accidentally granted');
reset role;

grant update on public.members to authenticated;
set local role authenticated;
set local request.jwt.claims = '{"sub":"ab000000-0000-4000-8000-000000000001","role":"authenticated"}';
select results_eq(
    $$update public.members set is_admin = true where id = auth.uid() returning id$$,
    $$select null::uuid where false$$,
    'RLS blocks member promotion even if UPDATE is accidentally granted');
reset role;

-- The organiser frees a wrongly claimed name by deleting the membership.
delete from public.members where id = 'ab000000-0000-4000-8000-000000000001';
select is((select claimed_by from public.roster where id = 'ba000000-0000-4000-8000-000000000001'),
    null::uuid, 'deleting a member frees their name');
set local role authenticated;
set local request.jwt.claims = '{"sub":"ab000000-0000-4000-8000-000000000002","role":"authenticated"}';
select is(public.claim_roster_name('ba000000-0000-4000-8000-000000000001'), true,
    'a freed name can be claimed again');
reset role;

delete from auth.users where id = 'ab000000-0000-4000-8000-000000000002';
select is((select count(*) from public.members where id = 'ab000000-0000-4000-8000-000000000002'),
    0::bigint, 'deleting an Auth user cascades to membership');
select is((select claimed_by from public.roster where id = 'ba000000-0000-4000-8000-000000000001'),
    null::uuid, 'deleting an Auth user frees their name');

select * from finish();
rollback;
