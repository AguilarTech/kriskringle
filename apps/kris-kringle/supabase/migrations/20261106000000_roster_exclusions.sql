-- Exclusions belong to roster names, including players who have not signed in.
-- Refuse a missing legacy roster mapping rather than discard an existing choice.
do $$
begin
    if exists (
        select 1 from public.exclusions e
        where not exists (select 1 from public.roster r where r.claimed_by = e.excluded_id)
    ) then
        raise exception 'exclusions migration: add claimed roster entries for existing excluded members first';
    end if;
end;
$$;

alter table public.exclusions drop constraint exclusions_excluded_id_fkey;
alter table public.exclusions drop constraint no_self_exclusion;
update public.exclusions e set excluded_id = r.id
from public.roster r where r.claimed_by = e.excluded_id;
alter table public.exclusions add constraint exclusions_excluded_id_fkey
    foreign key (excluded_id) references public.roster(id) on delete cascade;

create function public.check_exclusion_target()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
    if exists (select 1 from public.roster r
        where r.id = new.excluded_id and r.claimed_by = new.member_id) then
        raise exception 'new row for relation "exclusions" violates check constraint "no_self_exclusion"'
            using errcode = '23514', constraint = 'no_self_exclusion';
    end if;
    return new;
end;
$$;
revoke execute on function public.check_exclusion_target()
    from public, anon, authenticated, service_role;
create trigger check_exclusion_target before insert or update on public.exclusions
for each row execute function public.check_exclusion_target();

-- Return roster IDs and names only; never reveal their account mapping.
create function public.list_exclusion_options()
returns table (id uuid, name text)
language sql stable
security definer set search_path = public
as $$
    select r.id, r.name from public.roster r
    where auth.uid() is not null and r.claimed_by is distinct from auth.uid()
    order by lower(r.name);
$$;
revoke execute on function public.list_exclusion_options()
    from public, anon, authenticated, service_role;
grant execute on function public.list_exclusion_options() to authenticated;

create or replace function public.commit_draw(p_pairs jsonb)
returns void
language plpgsql
security definer set search_path = public, extensions
as $$
declare
    v_key text;
    v_members int;
    v_pairs int;
    v_santas int;
    v_recipients int;
    v_flavours int;
    v_invalid int;
begin
    perform 1 from public.app_state where id = 1 and phase = 'setup' for update;
    if not found then
        raise exception 'draw refused: phase is not setup';
    end if;
    if p_pairs is null or jsonb_typeof(p_pairs) <> 'array' then
        raise exception 'draw refused: pairs must be an array';
    end if;

    select count(*) into v_members from public.members;
    select count(*), count(distinct p.santa_id), count(distinct p.recipient_id),
           count(distinct p.flavour_id),
           count(*) filter (where ms.id is null or mr.id is null or f.id is null
               or p.santa_id = p.recipient_id or e.member_id is not null)
    into v_pairs, v_santas, v_recipients, v_flavours, v_invalid
    from jsonb_to_recordset(p_pairs) as p(santa_id uuid, recipient_id uuid, flavour_id text)
    left join public.members ms on ms.id = p.santa_id
    left join public.members mr on mr.id = p.recipient_id
    left join public.flavours f on f.id = p.flavour_id
    left join public.roster r on r.claimed_by = p.recipient_id
    left join public.exclusions e on e.member_id = p.santa_id and e.excluded_id = r.id;

    if v_members < 2 or v_members > 13 or v_pairs <> v_members
       or v_santas <> v_members or v_recipients <> v_members
       or v_flavours <> v_members or v_invalid > 0 then
        raise exception 'draw refused: pairs are not a valid derangement of all members';
    end if;

    v_key := public.kringle_key();
    if v_key is null then
        raise exception 'draw refused: kringle_encryption_key missing from Vault';
    end if;

    insert into public.flavour_owner (flavour_id, encrypted_member_id)
    select p.flavour_id, pgp_sym_encrypt(p.recipient_id::text, v_key)
    from jsonb_to_recordset(p_pairs) as p(santa_id uuid, recipient_id uuid, flavour_id text);

    insert into public.santa (santa_id, flavour_id)
    select p.santa_id, p.flavour_id
    from jsonb_to_recordset(p_pairs) as p(santa_id uuid, recipient_id uuid, flavour_id text);

    update public.app_state set phase = 'drawn', updated_at = now() where id = 1;
end;
$$;
revoke execute on function public.commit_draw(jsonb)
    from public, anon, authenticated, service_role;
grant execute on function public.commit_draw(jsonb) to service_role;
