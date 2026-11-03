-- Replace the email allowlist with a roster of names. Anyone who signs in
-- picks their name from the roster; each name can be claimed by one account,
-- and each account can claim one name.

-- Membership no longer depends on the sign-in email.
alter table public.members alter column email drop not null;

create table public.roster (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    -- Deleting a member (or their Auth user) frees the name to be claimed again.
    claimed_by uuid unique references public.members(id) on delete set null,
    claimed_at timestamptz,
    created_at timestamptz not null default now(),
    constraint roster_name_not_blank check (btrim(name) <> '')
);
create unique index roster_name_unique on public.roster (lower(btrim(name)));

alter table public.roster enable row level security;
revoke all on table public.roster from public, anon, authenticated;
grant all on table public.roster to service_role;
-- No client policy: clients read the roster and claim names only through the
-- RPCs below, which never reveal which account claimed a name.

-- Keep existing members: each one claims the roster entry for their name.
-- A duplicate display name keeps its membership but gets no roster entry.
insert into public.roster (name, claimed_by, claimed_at)
select distinct on (lower(btrim(display_name))) btrim(display_name), id, created_at
from public.members
where btrim(display_name) <> ''
order by lower(btrim(display_name)), created_at
on conflict do nothing;

-- The email allowlist and the automatic sign-up path are gone.
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.claim_membership();
drop function if exists public.handle_new_user();
drop function if exists public.sync_member(uuid);
drop table if exists public.allowlist;

create function public.list_roster()
returns table (id uuid, name text, claimed boolean)
language sql
stable
security definer
set search_path = public
as $$
    select r.id, r.name, r.claimed_by is not null
    from public.roster r
    where auth.uid() is not null
    order by lower(r.name);
$$;

-- Returns true if the caller is a member (has claimed a name).
create function public.claim_membership()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (select 1 from public.members where id = auth.uid());
$$;

-- Claim a roster name for the caller and create their membership.
-- Errors (SQLSTATE P0001) with a stable message the client can show:
--   'name_taken'      someone else already claimed this name
--   'already_claimed' the caller already claimed a different name
--   'not_found'       no such roster entry
--   'not_confirmed'   the caller's sign-in email is not confirmed
--   'draw_done'       the draw has happened; new players can no longer join
create function public.claim_roster_name(p_roster_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_user auth.users%rowtype;
    v_entry public.roster%rowtype;
begin
    if v_uid is null then
        raise exception 'not_authenticated' using errcode = '42501';
    end if;

    select * into v_user from auth.users where id = v_uid;
    if not found then
        raise exception 'not_authenticated' using errcode = '42501';
    end if;
    -- Defence in depth if an email/password provider is ever enabled.
    if v_user.email_confirmed_at is null then
        raise exception 'not_confirmed';
    end if;

    -- Lock the entry so two people cannot claim the same name at once.
    select * into v_entry from public.roster where id = p_roster_id for update;
    if not found then
        raise exception 'not_found';
    end if;

    if v_entry.claimed_by = v_uid then
        return true;
    end if;
    if v_entry.claimed_by is not null then
        raise exception 'name_taken';
    end if;
    if exists (select 1 from public.members where id = v_uid) then
        raise exception 'already_claimed';
    end if;
    if not exists (select 1 from public.app_state where id = 1 and phase = 'setup') then
        raise exception 'draw_done';
    end if;

    insert into public.members (id, email, display_name, avatar_url)
    values (
        v_uid,
        lower(v_user.email),
        v_entry.name,
        v_user.raw_user_meta_data->>'avatar_url'
    );
    update public.roster set claimed_by = v_uid, claimed_at = now()
    where id = p_roster_id;
    return true;
end;
$$;

revoke execute on function public.list_roster(), public.claim_membership(),
    public.claim_roster_name(uuid)
    from public, anon, authenticated, service_role;
grant execute on function public.list_roster(), public.claim_membership(),
    public.claim_roster_name(uuid)
    to authenticated;
