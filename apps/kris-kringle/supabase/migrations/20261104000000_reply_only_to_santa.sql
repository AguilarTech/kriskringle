-- Recipients can't start a chat with their Santa: a to_santa message is only
-- allowed as a reply, i.e. when the latest message in the thread came from the
-- Santa. The weekly quota still applies on top.
create or replace function public.insert_message(
    p_member_id uuid, p_direction text, p_body text, p_week_start date
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
    v_flavour_id text;
    v_id uuid;
begin
    if not exists (select 1 from public.app_state where id = 1 and phase = 'drawn') then
        raise exception 'chat is not open';
    end if;
    v_flavour_id := public.thread_for(p_member_id, p_direction);
    if v_flavour_id is null then
        raise exception 'no chat thread for this member and direction';
    end if;
    if p_direction = 'to_santa' and coalesce((
        select m.direction from public.messages m
        where m.flavour_id = v_flavour_id
        order by m.created_at desc, m.id desc limit 1
    ), '') <> 'to_flavour' then
        raise exception 'nothing to reply to';
    end if;
    insert into public.messages (flavour_id, direction, body, week_start)
    values (v_flavour_id, p_direction, p_body, p_week_start)
    returning id into v_id;
    return v_id;
end;
$$;
