-- R1: per-schema defaults cannot subtract the global EXECUTE grant to PUBLIC.
-- Migrations run as postgres. Other creator roles need their own defaults;
-- every client RPC must still receive an explicit, reviewed grant.
alter default privileges for role postgres
    revoke execute on functions from public;
alter default privileges for role postgres in schema public
    revoke execute on functions from public, anon, authenticated;

-- Require proof of email ownership even if an email/password provider is
-- accidentally enabled in the production dashboard.
create or replace function public.sync_member(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user auth.users%rowtype;
    v_email text;
begin
    select * into v_user from auth.users where id = p_user_id;
    if not found then
        return false;
    end if;

    v_email := lower(v_user.email);
    if v_user.email_confirmed_at is null or v_email is null or not exists (
        select 1 from public.allowlist where email = v_email
    ) then
        return false;
    end if;

    insert into public.members (id, email, display_name, avatar_url)
    values (
        v_user.id,
        v_email,
        coalesce(
            v_user.raw_user_meta_data->>'full_name',
            v_user.raw_user_meta_data->>'name',
            split_part(v_email, '@', 1)
        ),
        v_user.raw_user_meta_data->>'avatar_url'
    )
    on conflict (id) do update set
        display_name = excluded.display_name,
        avatar_url = excluded.avatar_url;

    return true;
end;
$$;

revoke execute on function public.sync_member(uuid)
    from public, anon, authenticated, service_role;
