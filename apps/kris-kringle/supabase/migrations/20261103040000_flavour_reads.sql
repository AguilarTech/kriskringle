-- Internal ownership/thread resolution. Neither helper is a client RPC.
create function public.owner_of(p_flavour_id text)
returns uuid
language sql stable
security definer set search_path = public, extensions
as $$
    select pgp_sym_decrypt(fo.encrypted_member_id, public.kringle_key())::uuid
    from public.flavour_owner fo where fo.flavour_id = p_flavour_id;
$$;

create function public.thread_for(p_member_id uuid, p_direction text)
returns text
language plpgsql stable
security definer set search_path = public, extensions
as $$
declare
    v_flavour_id text;
begin
    if not exists (select 1 from public.app_state where id = 1 and phase in ('drawn', 'closed')) then
        return null;
    end if;

    if p_direction = 'to_flavour' then
        select s.flavour_id into v_flavour_id from public.santa s where s.santa_id = p_member_id;
    elsif p_direction = 'to_santa' then
        select fo.flavour_id into v_flavour_id from public.flavour_owner fo
        where pgp_sym_decrypt(fo.encrypted_member_id, public.kringle_key())::uuid = p_member_id;
    end if;
    return v_flavour_id;
end;
$$;

revoke execute on function public.owner_of(text), public.thread_for(uuid, text)
    from public, anon, authenticated, service_role;

create function public.my_flavour()
returns table (flavour_id text, name text, hero_hex text, ink_hex text)
language sql stable
security definer set search_path = public
as $$
    select f.id, f.name, f.hero_hex, f.ink_hex from public.flavours f
    where f.id = public.thread_for(auth.uid(), 'to_flavour');
$$;

create function public.my_flavour_survey()
returns table (question_id int, prompt text, answer_text text)
language plpgsql stable
security definer set search_path = public
as $$
declare
    v_owner_id uuid := public.owner_of(public.thread_for(auth.uid(), 'to_flavour'));
begin
    if v_owner_id is null then
        return;
    end if;
    return query
    select q.id, q.prompt, a.answer_text from public.questions q
    left join public.answers a on a.question_id = q.id and a.member_id = v_owner_id
    order by q.sort_order, q.id;
end;
$$;

revoke execute on function public.my_flavour(), public.my_flavour_survey()
    from public, anon, authenticated, service_role;
grant execute on function public.my_flavour(), public.my_flavour_survey()
    to authenticated;
