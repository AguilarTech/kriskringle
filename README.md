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

The [design](docs/02-design.md), [technical specification](docs/03-tech-spec.md), and [backend contracts](docs/contracts/) describe the intended interfaces. They are working documents; consult the implementation and migrations for current behavior.
