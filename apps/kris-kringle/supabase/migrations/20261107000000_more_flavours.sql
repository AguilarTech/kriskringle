-- Five more Paleta flavours (18 in total).
insert into public.flavours (id, name, hero_hex, ink_hex, sort_order) values
    ('kiwifruit', 'Kiwifruit', '#6B8E23', '#1E1310', 14),
    ('horchata', 'Horchata', '#D7B48F', '#1E1310', 15),
    ('screwdriver', 'Screwdriver', '#FFB300', '#1E1310', 16),
    ('kulfi', 'Kulfi', '#F2C14E', '#1E1310', 17),
    ('melon', 'Melon', '#AED581', '#1E1310', 18)
on conflict (id) do nothing;

-- Up to 18 players now that there are 18 flavours. Same as the 20261106 version
-- of commit_draw() apart from the member cap.
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

    if v_members < 2 or v_members > 18 or v_pairs <> v_members
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
