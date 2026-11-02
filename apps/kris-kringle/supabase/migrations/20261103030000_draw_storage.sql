create table public.flavours (
    id text primary key,
    name text not null,
    hero_hex text not null,
    ink_hex text not null,
    sort_order int not null default 0
);
create table public.flavour_owner (
    flavour_id text primary key references public.flavours(id) on delete cascade,
    encrypted_member_id bytea not null,
    assigned_at timestamptz not null default now()
);
create table public.santa (
    santa_id uuid primary key references public.members(id) on delete cascade,
    flavour_id text not null unique references public.flavours(id) on delete cascade,
    assigned_at timestamptz not null default now()
);

alter table public.flavours enable row level security;
alter table public.flavour_owner enable row level security;
alter table public.santa enable row level security;
revoke all on public.flavours, public.flavour_owner, public.santa
    from public, anon, authenticated;
grant select on public.flavours, public.santa to authenticated;
grant all on public.flavours, public.flavour_owner, public.santa to service_role;
create policy "Players read flavour metadata" on public.flavours
    for select to authenticated using (true);
create policy "Santas read own shopping assignment" on public.santa
    for select to authenticated using (santa_id = auth.uid());

insert into public.flavours (id, name, hero_hex, ink_hex, sort_order) values
    ('hibiscus', 'Hibiscus', '#C2185B', '#FFFFFF', 1),
    ('chocolate', 'Chocolate', '#4A2C21', '#FFFFFF', 2),
    ('mango', 'Mango', '#FF9E00', '#1E1310', 3),
    ('lemon', 'Lemon', '#FFD600', '#1E1310', 4),
    ('lime', 'Lime', '#7CB342', '#1E1310', 5),
    ('orange', 'Orange', '#FF6D00', '#1E1310', 6),
    ('raspberry', 'Raspberry', '#D81B60', '#FFFFFF', 7),
    ('strawberry', 'Strawberry', '#E53935', '#FFFFFF', 8),
    ('watermelon', 'Watermelon', '#E91E63', '#FFFFFF', 9),
    ('mandarin', 'Mandarin', '#F4511E', '#FFFFFF', 10),
    ('blueberry', 'Blueberry', '#3949AB', '#FFFFFF', 11),
    ('mojito', 'Mojito', '#43A047', '#FFFFFF', 12),
    ('margarita', 'Margarita', '#C0CA33', '#1E1310', 13);

create function public.kringle_key()
returns text
language sql stable
security definer set search_path = public
as $$
    select decrypted_secret from vault.decrypted_secrets
    where name = 'kringle_encryption_key' limit 1;
$$;
revoke execute on function public.kringle_key()
    from public, anon, authenticated, service_role;

create function public.commit_draw(p_pairs jsonb)
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
    left join public.exclusions e on e.member_id = p.santa_id and e.excluded_id = p.recipient_id;

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
