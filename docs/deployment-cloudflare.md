# Deployment: Cloudflare

Only Yours is built to be portable to Cloudflare, but a Node.js host (VPS + Docker, Railway, Fly.io, render.com…) is the zero-friction path today. This page documents both, and exactly what the Cloudflare path requires.

## TL;DR

| Target | Status |
| --- | --- |
| Node server (`pnpm build && pnpm start`) | ✅ works out of the box |
| Cloudflare **Workers** via `@opennextjs/cloudflare` | ⚠️ supported path, needs a serverless-friendly DB driver + the steps below |
| Cloudflare Pages (legacy `next-on-pages`) | ❌ not recommended (superseded by OpenNext) |

## Why the code is already Cloudflare-friendly

- **JWT sessions** (Auth.js v5) — no per-request DB session lookups; middleware/proxy checks only the cookie.
- **Prisma 7 driver adapters** — the DB driver is injected in exactly one place (`src/lib/prisma.ts`), so swapping `@prisma/adapter-pg` for a serverless driver is a one-file change.
- **WebCrypto everywhere** — TOTP (`otpauth`), at-rest encryption and vault crypto use `crypto.subtle`/`crypto.getRandomValues`, not `node:crypto`. All of it runs on Workers.
- **No filesystem or long-lived process assumptions**; MFA lockout and step-up grants are DB-backed, not in-memory.

## Steps for Cloudflare Workers (OpenNext)

1. **Adapter**

   ```bash
   pnpm add -D @opennextjs/cloudflare wrangler
   ```

   Follow the current guide: <https://opennext.js.org/cloudflare> (`wrangler.jsonc` with `nodejs_compat`, `opennextjs-cloudflare build && deploy`). Check the OpenNext compatibility matrix against the Next.js 16 minor you are on.

2. **Database driver** — pick one:
   - **Neon**: `@prisma/adapter-neon` (HTTP/WebSocket) — designed for Workers.
   - **Prisma Accelerate / Prisma Postgres**: `@prisma/client/edge` + Accelerate connection string.
   - **Cloudflare Hyperdrive** + `@prisma/adapter-pg`: Hyperdrive pools TCP Postgres for Workers; bind it in `wrangler.jsonc` and pass the Hyperdrive connection string.

   In every case the only code change is the adapter construction in `src/lib/prisma.ts`.

3. **Environment / secrets** — set as Worker secrets (never in `wrangler.jsonc` plaintext):

   ```bash
   wrangler secret put AUTH_SECRET
   wrangler secret put AUTH_GOOGLE_ID
   wrangler secret put AUTH_GOOGLE_SECRET
   wrangler secret put ENCRYPTION_KEY
   wrangler secret put DATABASE_URL
   ```

   Plus `AUTH_URL=https://oyours.it` and `AUTH_TRUST_HOST=true` as vars.

4. **Google OAuth** — add the production redirect URI:

   ```txt
   https://oyours.it/api/auth/callback/google
   ```

5. **Migrations** — run `pnpm db:deploy` from CI or a local machine against the direct (non-pooled) connection string. Workers never run migrations.

6. **Future schedulers** — `SCHEDULE` automations map naturally to [Cloudflare Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/); incoming `WEBHOOK` triggers become a normal route handler. Both are roadmap items; the data model (`Automation`, `AutomationRun`) is ready.

## Known constraints on Workers

- **PBKDF2 at 600k iterations** runs in the *browser* (vault unlock), so Workers CPU limits are irrelevant to it. Server-side crypto here is cheap (AES-GCM, HMAC).
- **Bundle size**: Prisma’s query compiler (Rust-free client) is Workers-compatible, but watch the 3 MB (free) / 10 MB (paid) compressed limits.
- **`next/font` + Google Fonts** at build time is fine (fonts are bundled statically).
- Outbound webhook `fetch` works natively; `AbortSignal.timeout` is supported.

## Classic Node deployment (reference)

```bash
pnpm install --frozen-lockfile
pnpm db:deploy
pnpm build
pnpm start          # PORT=3000
```

Behind a reverse proxy (Caddy/nginx/Traefik) terminate TLS, forward `Host` and `X-Forwarded-*`, and set `AUTH_URL` + `AUTH_TRUST_HOST=true`. Add platform-level rate limiting there (or Cloudflare in front) — see [security.md](security.md).
