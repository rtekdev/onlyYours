# Deployment: Cloudflare Workers

The repo ships **ready-to-deploy** Cloudflare Workers support via
[`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare): `wrangler.jsonc`,
`open-next.config.ts` and the `cf:*` scripts are already configured, and the
Workers build is verified (`pnpm cf:build`).

## Requirements

- Cloudflare account with the **Workers Paid** plan ($5/mo). The bundle is
  ~3.7 MiB gzipped — over the 3 MiB free-plan limit, comfortably under the
  10 MiB paid limit.
- A PostgreSQL reachable from Workers (Supabase pooler works out of the box —
  `pg` uses its `pg-cloudflare` TCP shim; Hyperdrive is an optional upgrade).
- `oyours.it` (or your domain) added to Cloudflare for the custom domain.

## What is already configured

| Piece | Where | Notes |
| --- | --- | --- |
| Worker config | `wrangler.jsonc` | name `only-yours`, `nodejs_compat`, assets binding, `AUTH_TRUST_HOST` var |
| OpenNext config | `open-next.config.ts` | no ISR cache backend — every route is dynamic |
| Scripts | `package.json` | `cf:build`, `cf:preview` (local workerd), `cf:deploy` |
| Edge middleware | `src/middleware.ts` | deliberately the deprecated `middleware.ts` convention: Next 16's `proxy.ts` is pinned to the Node runtime, which `@opennextjs/cloudflare` does not support yet |
| pg on Workers | `next.config.ts` + `pg-cloudflare` dep | the shim is loaded conditionally at runtime, so it is force-included via `outputFileTracingIncludes` |

## Deploying from your machine

```bash
npx wrangler login

# secrets (never put these in wrangler.jsonc):
npx wrangler secret put AUTH_SECRET
npx wrangler secret put AUTH_GOOGLE_ID
npx wrangler secret put AUTH_GOOGLE_SECRET
npx wrangler secret put ENCRYPTION_KEY
npx wrangler secret put DATABASE_URL     # Supabase pooled URL (6543, pgbouncer=true)

pnpm cf:deploy
```

`pnpm cf:preview` runs the exact Workers build locally in workerd before you
ship it.

## Deploying with Workers Builds (Git integration)

In the Cloudflare dashboard wizard (*Workers → Create → Import a repository*):

| Field | Value |
| --- | --- |
| Project name | `only-yours` (must match `name` in `wrangler.jsonc`) |
| Build command | `pnpm run cf:build` |
| Deploy command | `npx wrangler deploy` |
| Non-production branch deploy command | `npx wrangler versions upload` |
| Path | `/` |
| API token | create a fresh one from the wizard (needs Workers Scripts edit) |

No build-time variables are required (`prisma generate` runs via
`postinstall` and needs no database). After the first deploy, add the runtime
secrets under *Worker → Settings → Variables and Secrets*: `AUTH_SECRET`,
`AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ENCRYPTION_KEY`, `DATABASE_URL`
(all as **Secret**). Use the **same `ENCRYPTION_KEY` as any existing
environment** — it decrypts stored TOTP secrets; changing it forces everyone
to re-enroll MFA. Vault items are unaffected (they are encrypted client-side).

## After the first deploy

1. **Google OAuth** — add the production pair in the OAuth client:
   origin `https://oyours.it` and redirect
   `https://oyours.it/api/auth/callback/google` (plus the `*.workers.dev`
   equivalents if you want to test before attaching the domain).
2. **Custom domain** — *Worker → Settings → Domains & Routes → Add → Custom
   domain* → `oyours.it`.
3. **Migrations** — always from your machine or CI, never from the Worker:
   `pnpm db:deploy` (uses `DIRECT_URL`, see `prisma.config.ts`).

## Optional: Hyperdrive

For lower latency and pooling at Cloudflare's edge, create a Hyperdrive
config pointing at the Supabase **session pooler (port 5432)**, add the
binding to `wrangler.jsonc`, and pass
`env.HYPERDRIVE.connectionString` to `PrismaPg` in `src/lib/prisma.ts`
(via `getCloudflareContext()` from `@opennextjs/cloudflare`). Not required —
direct `pg` → Supabase pooler works.

## Known constraints

- **Workers Paid required** (bundle size, see above).
- `SCHEDULE` automations will map to [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
  when the worker/scheduler lands (roadmap) — the data model is ready.
- Client-side vault crypto (PBKDF2 600k) runs in the browser, so Workers CPU
  limits are irrelevant to it.

## Classic Node deployment (reference)

```bash
pnpm install --frozen-lockfile
pnpm db:deploy
pnpm build
pnpm start          # PORT=3000
```

Behind a reverse proxy (Caddy/nginx/Traefik) terminate TLS, forward `Host`
and `X-Forwarded-*`, and set `AUTH_URL` + `AUTH_TRUST_HOST=true`. Add
platform-level rate limiting there — see [security.md](security.md).
