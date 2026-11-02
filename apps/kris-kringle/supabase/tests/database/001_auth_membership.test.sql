-- Run with `supabase test db`. Every fixture is rolled back, including Auth users.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select ok((select relrowsecurity from pg_class where oid = 'public.members'::regclass),
    'members has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.allowlist'::regclass),
    'allowlist has RLS enabled');
select ok(has_table_privilege('authenticated', 'public.members', 'SELECT'),
    'authenticated can read members');
select ok(not has_table_privilege('anon', 'public.members', 'SELECT'),
    'anonymous sessions cannot read members');
select ok(not has_table_privilege('authenticated', 'public.members', 'INSERT,UPDATE,DELETE'),
    'clients cannot write members or promote themselves');
select ok(not has_table_privilege('authenticated', 'public.allowlist', 'SELECT,INSERT,UPDATE,DELETE'),
    'authenticated has no allowlist access');
select ok(not has_table_privilege('anon', 'public.allowlist', 'SELECT,INSERT,UPDATE,DELETE'),
    'anon has no allowlist access');
select ok(has_table_privilege('service_role', 'public.allowlist', 'SELECT,INSERT,UPDATE,DELETE'),
    'service operations can manage the allowlist');

select ok(has_function_privilege('authenticated', 'public.claim_membership()', 'EXECUTE'),
    'authenticated can claim its own membership');
select ok(not has_function_privilege('anon', 'public.claim_membership()', 'EXECUTE'),
    'anon cannot claim membership');
select ok(not has_function_privilege('authenticated', 'public.sync_member(uuid)', 'EXECUTE'),
    'authenticated cannot sync an arbitrary user');
select ok(not has_function_privilege('anon', 'public.sync_member(uuid)', 'EXECUTE'),
    'anon cannot sync an arbitrary user');
select ok(not has_function_privilege('service_role', 'public.sync_member(uuid)', 'EXECUTE'),
    'sync_member is internal even for the service role');
select ok(not has_function_privilege('authenticated', 'public.handle_new_user()', 'EXECUTE'),
    'trigger helper is not a client RPC');
select ok((select bool_and(p.prosecdef and 'search_path=public' = any(p.proconfig))
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in
        ('sync_member', 'handle_new_user', 'claim_membership')),
    'all membership functions are security definer with pinned search_path');

insert into public.allowlist (email)
values ('mises.invited@example.test'), ('mises.fallback@example.test');
insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at)
values
    ('ab000000-0000-4000-8000-000000000001', 'Mises.Invited@Example.Test',
     '{"full_name":"Invited Santa","name":"Fallback name","avatar_url":"https://example.test/avatar.png","is_admin":true}', now()),
    ('ab000000-0000-4000-8000-000000000002', 'mises.late@example.test',
     '{"name":"Late Santa"}', now()),
    ('ab000000-0000-4000-8000-000000000003', 'mises.fallback@example.test', '{}', now()),
    ('ab000000-0000-4000-8000-000000000004', 'mises.stranger@example.test', '{}', now()),
    ('ab000000-0000-4000-8000-000000000005', null, null, now());

select is((select email from public.members where id = 'ab000000-0000-4000-8000-000000000001'),
    'mises.invited@example.test', 'trigger matches a mixed-case email and stores lower case');
select is((select display_name from public.members where id = 'ab000000-0000-4000-8000-000000000001'),
    'Invited Santa', 'full_name takes precedence over name');
select is((select avatar_url from public.members where id = 'ab000000-0000-4000-8000-000000000001'),
    'https://example.test/avatar.png', 'trigger copies the avatar');
select is((select is_admin from public.members where id = 'ab000000-0000-4000-8000-000000000001'),
    false, 'user metadata cannot grant admin status');
select is((select count(*) from public.members where id in (
    'ab000000-0000-4000-8000-000000000002', 'ab000000-0000-4000-8000-000000000004')),
    0::bigint, 'uninvited Auth users have no membership');
select is((select display_name from public.members where id = 'ab000000-0000-4000-8000-000000000003'),
    'mises.fallback', 'missing profile names fall back to the email prefix');
select is((select avatar_url from public.members where id = 'ab000000-0000-4000-8000-000000000003'),
    null::text, 'missing avatar remains null');
select is(public.sync_member('ab000000-0000-4000-8000-000000000099'),
    false, 'unknown Auth user cannot become a member');
select is(public.sync_member('ab000000-0000-4000-8000-000000000005'),
    false, 'Auth user without an email cannot become a member');

set local role anon;
select throws_ok('select public.claim_membership()', '42501',
    'permission denied for function claim_membership', 'anonymous RPC claim is rejected');
select throws_ok('select * from public.members', '42501',
    'permission denied for table members', 'anonymous member reads are rejected');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"ab000000-0000-4000-8000-000000000002","role":"authenticated"}';
select is(public.claim_membership(), false, 'claim before allowlisting returns false');
select throws_ok('select * from public.allowlist', '42501',
    'permission denied for table allowlist', 'clients cannot browse family allowlist');
select throws_ok($$select public.sync_member('ab000000-0000-4000-8000-000000000001')$$,
    '42501', 'permission denied for function sync_member', 'clients cannot sync another user');
select throws_ok($$update public.members set is_admin = true where id = auth.uid()$$,
    '42501', 'permission denied for table members', 'clients cannot promote themselves');
reset role;

insert into public.allowlist (email) values ('mises.late@example.test');
set local role authenticated;
select is(public.claim_membership(), true, 'late allowlisting works without a second Auth insert');
select is(public.claim_membership(), true, 'repeated claims are idempotent');
select is((select display_name from public.members where id = auth.uid()),
    'Late Santa', 'name metadata is used when full_name is absent');
reset role;
select is((select count(*) from public.members where id = 'ab000000-0000-4000-8000-000000000002'),
    1::bigint, 'idempotent claims create only one member row');

update public.members set is_admin = true where id = 'ab000000-0000-4000-8000-000000000001';
update auth.users set raw_user_meta_data = '{"full_name":"Updated Santa","avatar_url":"https://example.test/new.png"}'
where id = 'ab000000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claims = '{"sub":"ab000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is(public.claim_membership(), true, 'existing member can refresh profile');
select is((select display_name from public.members where id = auth.uid()),
    'Updated Santa', 'claim refreshes the display name from Auth');
select is((select avatar_url from public.members where id = auth.uid()),
    'https://example.test/new.png', 'claim refreshes the avatar from Auth');
select is((select is_admin from public.members where id = auth.uid()),
    true, 'claim preserves trusted admin status');

set local request.jwt.claims = '{"sub":"ab000000-0000-4000-8000-000000000004","role":"authenticated"}';
select is(public.claim_membership(), false, 'claim is bound to caller, not another allowlisted user');
set local request.jwt.claims = '{}';
select is(public.claim_membership(), false, 'missing subject fails closed');
reset role;

-- Exercise RLS independently of the privilege layer, without persisting grants.
grant select, insert on public.allowlist to authenticated;
set local role authenticated;
select is((select count(*) from public.allowlist), 0::bigint,
    'RLS still hides the allowlist if SELECT is accidentally granted');
select throws_ok($$insert into public.allowlist (email) values ('mises.injected@example.test')$$,
    '42501', 'new row violates row-level security policy for table "allowlist"',
    'RLS still blocks allowlist writes if INSERT is accidentally granted');
reset role;

grant update on public.members to authenticated;
set local role authenticated;
set local request.jwt.claims = '{"sub":"ab000000-0000-4000-8000-000000000002","role":"authenticated"}';
select results_eq(
    $$update public.members set is_admin = true where id = auth.uid() returning id$$,
    $$select null::uuid where false$$,
    'RLS blocks member promotion even if UPDATE is accidentally granted');
reset role;
select is((select is_admin from public.members where id = 'ab000000-0000-4000-8000-000000000002'),
    false, 'attempted RLS bypass leaves admin status unchanged');

delete from auth.users where id = 'ab000000-0000-4000-8000-000000000003';
select is((select count(*) from public.members where id = 'ab000000-0000-4000-8000-000000000003'),
    0::bigint, 'deleting an Auth user cascades to membership');
select throws_ok($$insert into public.allowlist (email) values ('UPPER@example.test')$$,
    '23514', 'new row for relation "allowlist" violates check constraint "allowlist_email_lowercase"',
    'allowlist storage requires lower-case email');

select * from finish();
rollback;
