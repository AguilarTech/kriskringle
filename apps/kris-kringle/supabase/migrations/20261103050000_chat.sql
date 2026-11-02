create table public.messages (
    id uuid primary key default gen_random_uuid(),
    flavour_id text not null references public.flavours(id) on delete cascade,
    direction text not null check (direction in ('to_flavour', 'to_santa')),
    body text not null,
    week_start date not null,
    created_at timestamptz not null default now()
);
create unique index idx_messages_weekly_quota
    on public.messages (flavour_id, direction, week_start);

create table public.push_subs (
    id uuid primary key default gen_random_uuid(),
    member_id uuid not null references public.members(id) on delete cascade,
    endpoint text not null unique,
    p256dh text not null,
    auth text not null,
    created_at timestamptz not null default now()
);

alter table public.messages enable row level security;
alter table public.push_subs enable row level security;
revoke all on public.messages, public.push_subs from public, anon, authenticated;
grant select, insert, update, delete on public.push_subs to authenticated;
grant all on public.messages, public.push_subs to service_role;
-- messages intentionally has no client policy: every read goes through RPCs.
create policy "Players manage own push subscriptions" on public.push_subs
    for all to authenticated
    using (member_id = auth.uid()) with check (member_id = auth.uid());

create function public.chat_with_flavour()
returns table (id uuid, direction text, body text, created_at timestamptz)
language sql stable
security definer set search_path = public
as $$
    select m.id, m.direction, m.body, m.created_at from public.messages m
    where m.flavour_id = public.thread_for(auth.uid(), 'to_flavour')
    order by m.created_at, m.id;
$$;
create function public.chat_with_santa()
returns table (id uuid, direction text, body text, created_at timestamptz)
language sql stable
security definer set search_path = public
as $$
    select m.id, m.direction, m.body, m.created_at from public.messages m
    where m.flavour_id = public.thread_for(auth.uid(), 'to_santa')
    order by m.created_at, m.id;
$$;

create function public.quota_used(p_member_id uuid, p_direction text, p_week_start date)
returns boolean
language sql stable
security definer set search_path = public
as $$
    select exists (
        select 1 from public.messages m
        where m.flavour_id = public.thread_for(p_member_id, p_direction)
          and m.direction = p_direction and m.week_start = p_week_start
    );
$$;

-- p_body is already reworded by send-message; raw text never reaches this RPC.
create function public.insert_message(
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
    insert into public.messages (flavour_id, direction, body, week_start)
    values (v_flavour_id, p_direction, p_body, p_week_start)
    returning id into v_id;
    return v_id;
end;
$$;

create function public.push_targets_for_message(p_message_id uuid)
returns table (endpoint text, p256dh text, auth text)
language plpgsql stable
security definer set search_path = public
as $$
declare
    v_flavour_id text;
    v_direction text;
    v_target uuid;
begin
    select m.flavour_id, m.direction into v_flavour_id, v_direction
    from public.messages m where m.id = p_message_id;
    if v_direction = 'to_flavour' then
        v_target := public.owner_of(v_flavour_id);
    elsif v_direction = 'to_santa' then
        select s.santa_id into v_target from public.santa s where s.flavour_id = v_flavour_id;
    end if;
    return query select ps.endpoint, ps.p256dh, ps.auth
    from public.push_subs ps where ps.member_id = v_target;
end;
$$;

revoke execute on function
    public.chat_with_flavour(), public.chat_with_santa(),
    public.quota_used(uuid, text, date), public.insert_message(uuid, text, text, date),
    public.push_targets_for_message(uuid)
    from public, anon, authenticated, service_role;
grant execute on function public.chat_with_flavour(), public.chat_with_santa() to authenticated;
grant execute on function
    public.quota_used(uuid, text, date), public.insert_message(uuid, text, text, date),
    public.push_targets_for_message(uuid)
    to service_role;
