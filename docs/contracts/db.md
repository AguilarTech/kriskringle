# Database contract

Owner: Mises. Source: `docs/03-tech-spec.md` sections 2–4 and 5.8.

## Name roster (replaces the email allowlist)

Implementation: `20261103060000_name_roster.sql`. This supersedes the
allowlist, trigger and `sync_member` parts of the Sprint 0 section below,
which is kept as history.

The organiser adds family names to `public.roster` (service role or SQL
editor). Anyone who signs in with Google picks their name from that list.

### Sign-in flow

1. Sign in with Supabase Google OAuth.
2. Call `supabase.rpc('claim_membership')`. It returns `true` if the caller
   already has a `members` row. An RPC error is retryable.
3. If `false`, call `supabase.rpc('list_roster')` and show the names. It
   returns `id`, `name` and `claimed boolean` only; it never reveals which
   account claimed a name.
4. Call `supabase.rpc('claim_roster_name', { p_roster_id })`. It creates the
   member row (display name = roster name) and marks the name claimed, in one
   transaction with the roster row locked. Errors use SQLSTATE `P0001` with
   the message `name_taken`, `already_claimed`, `not_found`, `not_confirmed`
   or `draw_done` (claims are only allowed while `app_state.phase = 'setup'`).
   Claiming your own name again returns `true`.

`roster.claimed_by` is unique and references `members.id` with
`on delete set null`. To fix a wrong pick, the organiser deletes that
`members` row (this also deletes that person's answers and exclusions), which
frees the name. `members.email` is now nullable and is informational only.
`roster` has RLS enabled and no client privileges.

Existing members at migration time get a claimed roster entry for their
display name; a member whose name duplicates another (case-insensitive) keeps
their membership without a roster entry.

Add names, for example:

```sql
insert into public.roster (name) values ('Abuela'), ('Tío Pepe');
```

## Roster exclusions (6 Nov 2026)

`20261106000000_roster_exclusions.sql` changes `exclusions.excluded_id` to
reference `roster.id`, so choices can be saved before the excluded person
signs in. Existing choices are backfilled through `roster.claimed_by`; the
migration refuses a missing legacy roster mapping rather than dropping a choice.

`list_exclusion_options()` returns `{ id: string, name: string }[]`, ordered
by name, including unclaimed names and excluding the caller's own name.
Only `authenticated` may execute it. It exposes no account mapping.
The setup screen reads and writes roster IDs in `exclusions.excluded_id`.
Existing own-row RLS and setup phase locks remain, and an insert/update trigger
rejects the caller's own roster name.

The draw adapter resolves each excluded roster name through `claimed_by`;
unclaimed targets have no participating member yet. `commit_draw()` also joins
the roster to reject any excluded pairing after a name is claimed. Resetting
members still cascades to their exclusions as before.

## Sprint 0: membership (v1, superseded by the name roster)

Implementation: `20261103000000_auth_membership.sql` and the incremental R1 fix
`20261103010000_auth_r1_hardening.sql`. Both migrations and the seed
have been applied locally, all 56 pgTAP assertions pass, database lint reports
no schema errors, and `src/types/database.ts` has been generated from that
schema. **G1 passed R1 review on 3 Nov**, as recorded in the agent workplan.
No merge or production migration has been performed.

The team is working in the same directory at the organiser's explicit request.
Mises changes are limited to the database files/types, this contract, and the
Mises commands subsection in `CLAUDE.md`.

### Sign-in flow

1. Sign in with Supabase Google OAuth.
2. After **every** successful sign-in, call `supabase.rpc('claim_membership')`.
3. On a successful RPC response, read `members` with `id = session.user.id`
   using `maybeSingle()`. A missing row means Not Invited. An RPC/database
   error is a retryable error, not proof that the user is not invited.

`claim_membership()` takes no arguments and returns a boolean: `true` if the
caller's Auth email is confirmed, allowlisted and membership is synchronized;
`false` if no Auth user/email, email confirmation, or allowlist match exists.
Confirmation is checked using `auth.users.email_confirmed_at`, never a
user-controlled `email_verified` metadata field. Only `authenticated` clients can
execute it. The caller cannot supply another member's ID or metadata.

The first Auth insert invokes the same logic through `handle_new_user()` and
the internal `sync_member(p_user_id uuid)` function. Repeated claims are safe.
An allowlist entry added after first sign-in takes effect on the next claim.
The email match is case-insensitive; stored member/allowlist emails are lower
case. A claim refreshes display name and avatar, and preserves `is_admin`.

### Tables and access

| Table | Columns | Client access |
| --- | --- | --- |
| `members` | `id uuid`, `email text`, `display_name text`, `avatar_url text \| null`, `is_admin boolean`, `created_at timestamptz` | `authenticated`: SELECT only; all member rows per spec, for the exclusions checklist |
| `allowlist` | `email text`, `created_at timestamptz` | No client access |

`members.id` references `auth.users.id` with cascade deletion. `email` is unique;
`is_admin` defaults to false and is changed only by trusted operations. A user
cannot insert, update, delete, or promote a member through the client API.
`service_role` has table access for server operations; never put that key in
the frontend. RLS is enabled on both tables.

`sync_member(uuid)` and `handle_new_user()` are internal, with execution revoked
from `PUBLIC`, `anon`, `authenticated`, and `service_role`. Only owner-executed
trigger/RPC code invokes them. All membership functions pin `search_path`.
For functions created by the `postgres` migration role, the global default
`PUBLIC` execution grant is revoked, together with explicit per-schema client
grants. A schema-only revoke cannot remove a global default grant (see
[PostgreSQL default privileges](https://www.postgresql.org/docs/current/sql-alterdefaultprivileges.html)).
Later migrations must explicitly grant each client RPC; other creator roles
need their own default-privilege configuration. The sweep test checks every
public routine: `anon` can execute none, and `authenticated` can execute only
the explicit allowlist, currently `claim_membership()`. Extend that allowlist
when adding reviewed client RPCs.

Removing an allowlist entry does not delete an existing membership in this
specification. Account revocation needs a separate deliberate operation.

### Local fixtures and checks

`supabase/seed.sql` allowlists three fictional `example.test` addresses only;
it creates no Auth accounts, passwords, sessions, or admin users. The pgTAP
test creates its own isolated fixtures and rolls them back.

From `apps/kris-kringle`, after Hayek's pinned CLI dependency is installed:

```powershell
npx supabase start
npx supabase db reset --local
npx supabase test db
npx supabase db lint --local --level warning
# Create src/types first if it does not exist.
npx supabase gen types typescript --local --schema public > src/types/database.ts
```

`db reset --local` recreates the local database and applies migrations/seeds;
use it only when local test data may be discarded. Generate the types only
from an applied schema; no handwritten `database.ts` substitute is supplied.

The first local verification used the same pinned CLI 2.75.0 binary downloaded
to a temporary tools directory because Node/npm were not on this session's
PATH. No package manifest, lockfile or existing `.env` was changed by Mises.

The database, Auth, REST gateway and metadata service are running locally.
The startup check used:

```powershell
npx supabase start --exclude realtime,storage-api,imgproxy,mailpit,studio,edge-runtime,logflare,vector,supavisor
```

Studio, edge-runtime and other excluded services have not been verified yet.
Google OAuth is configured to read `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`
and `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`, but remains disabled in the local
config until the organiser supplies the credentials and enables the provider.
The Google callback is `http://127.0.0.1:54321/auth/v1/callback`; frontend site
and redirect URLs use `localhost:5173` / `127.0.0.1:5173`.

### R1 review handoff

Rothbard's first review is in
`.claude/worktrees/rothbard/docs/reviews/R1-auth-membership.md` (commit
`c1f27b6`, subsequently copied to `docs/reviews/R1-auth-membership.md`). Both
required findings were addressed by the incremental hardening migration;
Rothbard signed off G1 on 3 Nov.

Review both auth migrations, seed and the two `supabase/tests/database/` suites. The suite
covers both initial-trigger and late-allowlist paths, missing identity/email,
case folding, safe profile synchronization, repeat claims, no metadata-based
admin grants, no client table writes, and denied helper execution. It tests
the privilege and RLS layers independently, with role changes and temporary
grants inside a transaction. The whole test rolls back, including Auth users.

The R1 regression suite creates a function with no explicit revoke to exercise
the real default privileges, sweeps every public routine, and checks that an
unconfirmed allowlisted user gets no membership from either the trigger or
the claim RPC. It also verifies that confirming the email later lets a claim
succeed without another Auth insert.

Rothbard verified the trigger under the real `supabase_auth_admin` role in
the first review. Mises repeated that check with a confirmed-email fixture
after R1 hardening, in a rolled-back transaction, and it passed. The ordinary
pgTAP command runs as `postgres`; the Auth-role probe uses a local
`supabase_admin` connection to switch roles.

the organiser must still disable email/password in the production dashboard; local
`config.toml` alone does not configure the cloud project's providers.

No client should query sensitive ownership/chat tables directly.

## Sprint 1 contracts: G3 setup, then G4 draw save

Both migrations are applied locally. All **103 database assertions pass**
(including the existing auth tests), database lint is clean, and TypeScript
types are regenerated. Rothbard approved G3/R2 and G4/R3 on 3 Nov in
`docs/reviews/R2-R3-setup-and-draw.md`. The review's older the organiser-approval note
is superseded by the trimmed roadmap; the organiser still controls the live draw.

### G3: setup

| Table | Columns | Client access |
| --- | --- | --- |
| `app_state` | `id int` (always 1), `phase text`, `draw_at timestamptz`, `updated_at timestamptz` | authenticated SELECT |
| `questions` | `id int`, `prompt text`, `sort_order int` | authenticated SELECT, sort by `sort_order` |
| `answers` | `id uuid`, `member_id uuid`, `question_id int`, `answer_text text`, `updated_at timestamptz` | own rows SELECT; own INSERT/UPDATE during `setup` |
| `exclusions` | `id uuid`, `member_id uuid`, `excluded_id uuid`, `created_at timestamptz` | own rows SELECT; own INSERT/DELETE during `setup` |

`app_state` is seeded as `setup`, with `draw_at` at
`2026-12-05 20:00:00 Australia/Melbourne`. Phase values are `setup`, `drawn`,
`closed`. The backend controls the phase. Reads of one's setup remain available
after the draw, but editing is locked.

Five survey questions are seeded in the migration. Upsert answers on the
unique key `member_id,question_id`, supplying the caller's member ID; debounce
and flush saves in the UI. `updated_at` defaults to insertion time; the client
may set it when updating an answer. Toggle exclusions with INSERT/DELETE;
`member_id,excluded_id` is unique and self-exclusion is rejected. Survey
completion means a non-blank answer to each question; no extra completion flag
or workflow is needed. Zero exclusions is valid.

### G4: draw storage

`flavours(id text, name text, hero_hex text, ink_hex text, sort_order int)`
contains the 13 design-spec flavours and is readable by authenticated users.
`santa(santa_id uuid, flavour_id text, assigned_at timestamptz)` lets a Santa
read only their shopping assignment. No client can read `flavour_owner`, which
stores `flavour_id text`, `encrypted_member_id bytea`, `assigned_at timestamptz`.
Client writes to all three tables are disabled.

Only the server's `service_role` may call:

```ts
commit_draw({ p_pairs: [
  { santa_id: 'uuid', recipient_id: 'uuid', flavour_id: 'mango' },
  // exactly one pair per member
] }) // SQL returns void; Supabase reports success with no result value
```

The server checks admin authorization before invoking the RPC. The database
locks `app_state`, requires `setup`, validates a complete derangement of 2–13
members respecting exclusions and unique existing flavours, encrypts each
recipient with `kringle_encryption_key` from Vault, inserts both assignment
tables, and changes phase to `drawn` in one transaction. A rejected save changes
nothing. A second draw is refused. No pairing data is returned or logged.

`kringle_key()` is an internal helper with no client or service-role execution
grant. The service calls `commit_draw`, which runs as its database owner.
`seed.sql` creates a random local development Vault key only when absent;
the organiser supplies the real cloud key separately. No real key is committed.

## G5: shopping flavour and survey reads

Implemented in `20261103040000_flavour_reads.sql` and applied locally.
All 121 database assertions pass, lint is clean, and types are regenerated.
Rothbard approved R4 on 3 Nov (`docs/reviews/R4-flavour-and-chat-reads.md`),
so G5 has passed. Both RPCs take no arguments and are
executable by `authenticated` only:

| RPC | Row shape |
| --- | --- |
| `my_flavour()` | `{ flavour_id: string, name: string, hero_hex: string, ink_hex: string }` |
| `my_flavour_survey()` | `{ question_id: number, prompt: string, answer_text: string \| null }` |

Supabase returns arrays. `my_flavour` has zero or one row; survey results are
ordered by question sort order. Missing answers have null text. Both return
no rows before the draw or for a caller with no assignment, and remain readable
when `closed`. They always describe the recipient the caller shops for, never
the caller's own flavour. No member IDs, timestamps, emails or profile data
are included in survey rows.

Internal helpers `owner_of(p_flavour_id text)` and
`thread_for(p_member_id uuid, p_direction text)` run only inside owner-executed
RPCs. Neither clients nor the service role can call them directly.

## G6: anonymous chat and optional push

Implemented in `20261103050000_chat.sql` and applied locally. All 153 database
assertions pass, lint is clean, and types are regenerated. G6 has passed:
Rothbard approved R4 and tested the real send-message endpoint end to end
(`docs/reviews/R4-flavour-and-chat-reads.md`); Mises approved R5 code, stubbed
failure checks and the live Claude rewrite smoke check in
`docs/reviews/R3-R5-edge-functions.md`. the organiser supplied
the local key on 3 Nov; it stays in the ignored functions environment.
Client RPCs `chat_with_flavour()` and
`chat_with_santa()` take no arguments, return arrays ordered oldest first,
and have the same row shape:

```ts
{ id: string, direction: 'to_flavour' | 'to_santa', body: string, created_at: string }
```

They return no rows before the draw or without an assignment. History remains
readable when `closed`. Neither returns a flavour ID or member ID.
`chat_with_flavour` is the thread the caller shops for; sent messages have
direction `to_flavour`. `chat_with_santa` is the caller's own recipient thread,
resolved internally; sent messages have direction `to_santa`. Use incoming
timestamps for unread state and sent timestamps for the Melbourne weekly chip.

The client has **no direct access** to `messages`. The server alone may call:

| RPC | Arguments | Result |
| --- | --- | --- |
| `quota_used` | `p_member_id uuid`, `p_direction text`, `p_week_start date` | boolean |
| `insert_message` | same plus `p_body text` (rewritten text only) | message UUID |
| `push_targets_for_message` | `p_message_id uuid` | array of `{ endpoint, p256dh, auth }` |

These signatures match the committed `send-message` and `push-notify` adapters.
They are executable only by `service_role`. `insert_message` requires phase
`drawn`, resolves the thread internally, and inserts once per flavour,
direction and Melbourne Monday date. Duplicate insert raises PostgreSQL
`23505`, which `send-message` maps to 429. No original message is accepted from
the client by these RPCs; rewording happens in the edge function before insert.
The weekly date is supplied by its existing Melbourne helper.

`push_subs(id uuid, member_id uuid, endpoint text, p256dh text, auth text,
created_at timestamptz)` supports own-row SELECT/INSERT/UPDATE/DELETE for
authenticated players. Upsert on unique `endpoint`, including `member_id`.
Only service operations can see other players' endpoints. Push target lookup
resolves the stored message's receiver, without returning message text,
flavour information or member identity. Push remains optional.
