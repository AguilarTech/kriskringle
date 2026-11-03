# Kris Kringle

A mobile-friendly, double-blind gift exchange app. Each participant shops for a paleta flavour without knowing its owner, and can exchange anonymous messages with their recipient and their own Santa.

The app uses Vue 3, TypeScript, Vite, and Supabase. Supabase Edge Functions handle the draw, message rewording, and push notifications. This is a single-season project; some features and deployment checks are still in progress.

## Development

Requirements: Node.js and npm; Docker and the Supabase CLI are needed for the local backend.

```sh
cd apps/kris-kringle
npm install
npm run dev
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in a local `.env` file. Never give a private key (service-role key, OAuth secret) a `VITE_` name, put it in Cloudflare build variables, or commit it. The organiser script reads `SUPABASE_SERVICE_ROLE_KEY` from the same `.env` (see Organiser tools). Google sign-in requires a configured Google OAuth client and Supabase Auth provider.

Useful commands: `npm run build`, `npm run typecheck`, and `npm run lint`. Run the local Supabase stack with `npx supabase start` and its database tests with `npx supabase test db`.

## Cloudflare Workers deployment

Connect this repository to Workers Builds with these settings:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Root directory | `apps/kris-kringle` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Preview command | `npx wrangler preview` |

The app's `wrangler.jsonc` serves the built `dist` directory with single-page
application routing. Set the dashboard Worker name to `kriskringle`, matching
the configuration. Preview deployments require Wrangler 4.135.0 or newer.

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` as **build** environment
variables in Cloudflare; add `VITE_VAPID_PUBLIC_KEY` if using push. The local
ignored `.env` is not available to Cloudflare builds. Keep Anthropic and private
VAPID keys in Supabase Edge Function secrets. Supabase migrations and functions
are deployed separately. Set the Supabase Auth site/redirect URLs to the deployed
frontend address before testing Google sign-in.

## Family list

Players sign in with Google and then pick their own name from a list; each name
can be claimed once. Add the names in the Supabase SQL editor:

```sql
insert into public.roster (name) values ('Abuela'), ('Tío Pepe');
```

If someone picks the wrong name, delete their row from `public.members` (this
also removes their survey answers and exclusions) and the name becomes free.

## Organiser tools

The draw is **not** automatic. `app_state.draw_at` only drives the countdown;
the organiser runs the draw by hand. Add the project's legacy `service_role`
key (Project Settings → API Keys) to the gitignored `apps/kris-kringle/.env`,
next to the existing `VITE_SUPABASE_URL`:

```sh
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
```

Never prefix it with `VITE_` or add it to Cloudflare's build variables: any
`VITE_*` value is published inside the website, and this key can read and
delete everything.

Then:

```sh
npm run admin -- status          # who has signed up and answered every question
npm run admin -- draw --dry-run  # check a valid draw exists; saves nothing
npm run admin -- draw            # run the draw and notify everyone
npm run admin -- reset           # delete all players, answers, the draw and chats
```

`reset` keeps the name list, questions and countdown date, and asks you to type
`reset` first. None of these commands reveal who has whose flavour. The draw
supports 2 to 13 players.

The [design](docs/02-design.md), [technical specification](docs/03-tech-spec.md), and [backend contracts](docs/contracts/) describe the intended interfaces. They are working documents; consult the implementation and migrations for current behavior.
