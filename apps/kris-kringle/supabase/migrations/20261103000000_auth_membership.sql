-- Sprint 0 / R1: Google Auth membership and the private family allowlist.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table public.members (
    id uuid primary key references auth.users(id) on delete cascade,
    email text not null unique,
    display_name text not null,
    avatar_url text,
    is_admin boolean not null default false,
    created_at timestamptz not null default now()
);

create table public.allowlist (
    email text primary key,
    created_at timestamptz not null default now(),
    constraint allowlist_email_lowercase check (email = lower(email))
);

alter table public.members enable row level security;
alter table public.allowlist enable row level security;

-- Explicit privileges avoid relying on Supabase's default table grants.
revoke all on table public.members, public.allowlist from public, anon, authenticated;
grant select on table public.members to authenticated;
grant all on table public.members, public.allowlist to service_role;

create policy "Members are viewable by all authenticated users"
on public.members for select to authenticated using (true);

-- No allowlist policy: deny every client operation by default, even if a
-- future change accidentally grants table privileges to a client role.

-- Remove explicit per-schema default grants. The R1 hardening migration also
-- revokes the global PUBLIC default, which a per-schema revoke cannot remove.
alter default privileges in schema public
    revoke execute on functions from public, anon, authenticated;

create function public.sync_member(p_user_id uuid)
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
    if v_email is null or not exists (
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

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    perform public.sync_member(new.id);
    return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create function public.claim_membership()
returns boolean
language sql
security definer
set search_path = public
as $$
    select public.sync_member(auth.uid());
$$;

revoke execute on function public.sync_member(uuid), public.handle_new_user()
    from public, anon, authenticated, service_role;
revoke execute on function public.claim_membership()
    from public, anon, authenticated, service_role;
grant execute on function public.claim_membership() to authenticated;
