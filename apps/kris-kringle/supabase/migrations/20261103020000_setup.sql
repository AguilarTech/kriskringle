create table public.app_state (
    id int primary key default 1 check (id = 1),
    phase text not null default 'setup' check (phase in ('setup', 'drawn', 'closed')),
    draw_at timestamptz,
    updated_at timestamptz not null default now()
);

create table public.questions (
    id int primary key,
    prompt text not null,
    sort_order int not null default 0
);

create table public.answers (
    id uuid primary key default gen_random_uuid(),
    member_id uuid not null references public.members(id) on delete cascade,
    question_id int not null references public.questions(id) on delete cascade,
    answer_text text not null,
    updated_at timestamptz not null default now(),
    constraint unique_member_question unique (member_id, question_id)
);

create table public.exclusions (
    id uuid primary key default gen_random_uuid(),
    member_id uuid not null references public.members(id) on delete cascade,
    excluded_id uuid not null references public.members(id) on delete cascade,
    created_at timestamptz not null default now(),
    constraint unique_member_exclusion unique (member_id, excluded_id),
    constraint no_self_exclusion check (member_id <> excluded_id)
);

alter table public.app_state enable row level security;
alter table public.questions enable row level security;
alter table public.answers enable row level security;
alter table public.exclusions enable row level security;

revoke all on public.app_state, public.questions, public.answers, public.exclusions
    from public, anon, authenticated;
grant select on public.app_state, public.questions, public.answers, public.exclusions
    to authenticated;
grant insert, update on public.answers to authenticated;
grant insert, delete on public.exclusions to authenticated;
grant all on public.app_state, public.questions, public.answers, public.exclusions
    to service_role;

create policy "Players read app state" on public.app_state
    for select to authenticated using (true);
create policy "Players read questions" on public.questions
    for select to authenticated using (true);
create policy "Players read own answers" on public.answers
    for select to authenticated using (member_id = auth.uid());
create policy "Players insert own answers during setup" on public.answers
    for insert to authenticated with check (
        member_id = auth.uid() and exists (
            select 1 from public.app_state where id = 1 and phase = 'setup'
        )
    );
create policy "Players update own answers during setup" on public.answers
    for update to authenticated
    using (member_id = auth.uid() and exists (
        select 1 from public.app_state where id = 1 and phase = 'setup'
    ))
    with check (member_id = auth.uid() and exists (
        select 1 from public.app_state where id = 1 and phase = 'setup'
    ));
create policy "Players read own exclusions" on public.exclusions
    for select to authenticated using (member_id = auth.uid());
create policy "Players insert own exclusions during setup" on public.exclusions
    for insert to authenticated with check (
        member_id = auth.uid() and exists (
            select 1 from public.app_state where id = 1 and phase = 'setup'
        )
    );
create policy "Players delete own exclusions during setup" on public.exclusions
    for delete to authenticated using (
        member_id = auth.uid() and exists (
            select 1 from public.app_state where id = 1 and phase = 'setup'
        )
    );

insert into public.app_state (id, phase, draw_at)
values (1, 'setup', '2026-12-05 20:00:00 Australia/Melbourne');

insert into public.questions (id, prompt, sort_order) values
    (1, 'What does your ideal Sunday morning look like?', 1),
    (2, 'What snack or treat can you never resist?', 2),
    (3, 'What is your favourite coffee, tea or other drink?', 3),
    (4, 'What hobby or little activity brings you joy?', 4),
    (5, 'Is there anything you would rather not receive as a gift?', 5);
