-- LOCAL fixtures only. Production family names are loaded through the runbook.
-- No passwords, Auth users or admin memberships are seeded here.
insert into public.roster (name)
values
    ('Umpa Lumpa 1'),
    ('Umpa Lumpa 2'),
    ('Umpa Lumpa 3')
on conflict do nothing;

-- Local development key only. Production key creation is the organiser's task.
select vault.create_secret(
    encode(extensions.gen_random_bytes(32), 'hex'), 'kringle_encryption_key'
)
where not exists (
    select 1 from vault.secrets where name = 'kringle_encryption_key'
);
