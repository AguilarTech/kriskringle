# Paleta Kris Kringle

A mobile-friendly, double-blind gift exchange app. Each participant shops for a paleta flavour without knowing its owner, and can exchange anonymous messages with their recipient and their own Santa.

The app uses Vue 3, TypeScript, Vite, and Supabase. Supabase Edge Functions handle the draw, message rewording, and push notifications. This is a single-season project; some features and deployment checks are still in progress.

## Development

Requirements: Node.js and npm; Docker and the Supabase CLI are needed for the local backend.

```sh
cd apps/kris-kringle
npm install
npm run dev
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in a local `.env` file. Never put service-role keys, OAuth secrets, or other private keys in frontend environment variables or commit them. Google sign-in requires a configured Google OAuth client and Supabase Auth provider.

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

The [design](docs/02-design.md), [technical specification](docs/03-tech-spec.md), and [backend contracts](docs/contracts/) describe the intended interfaces. They are working documents; consult the implementation and migrations for current behavior.
