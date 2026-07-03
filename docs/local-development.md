# Local development

## Prerequisites

- Node.js ≥ 20 and pnpm ≥ 9 (`corepack enable` is the easiest way)
- Docker (for the local Postgres) — or any reachable Postgres, see [database-options.md](database-options.md)
- A Google Cloud project for the OAuth client (free tier is fine)

## 1. Database (Docker Compose)

```bash
docker compose up -d        # starts postgres:17-alpine with a healthcheck
docker compose ps           # wait until "healthy"
```

Connection string (already present in `.env.example`):

```txt
postgresql://onlyyours:onlyyours-dev@localhost:5432/onlyyours
```

Data persists in the `only-yours-pgdata` volume. `docker compose down -v` wipes it.

## 2. Environment

```bash
cp .env.example .env
```

Fill in:

| Variable | How |
| --- | --- |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `ENCRYPTION_KEY` | `openssl rand -base64 32` — **exactly 32 bytes**, base64. Losing it invalidates stored TOTP secrets (users would re-enroll MFA). It does **not** affect vault items. |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | see below |
| `AUTH_TRUST_HOST` | `true` for local/self-hosted setups |

Never commit `.env` — the repo ignores it.

## 3. Google OAuth client

1. [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)
2. *Create credentials → OAuth client ID → Web application*
3. Authorized redirect URI (development):

   ```txt
   http://localhost:3000/api/auth/callback/google
   ```

   For production add `https://<your-domain>/api/auth/callback/google`.
4. Copy the client ID/secret into `.env`.

If the consent screen is in *Testing* mode, add your Google account under *Test users*.

## 4. Migrations & seed

```bash
pnpm db:deploy   # applies prisma/migrations (initial migration is committed)
pnpm dev         # http://localhost:3000
```

After your **first Google sign-in** you can load demo data:

```bash
SEED_USER_EMAIL=you@example.com pnpm db:seed
```

The seed creates notes, a scenario and an automation — never secrets. Schema changes during development: `pnpm db:migrate` (creates a new migration; requires the DB to be up).

## 5. Quality gates

```bash
pnpm lint
pnpm typecheck
pnpm test        # vitest — no database needed (crypto/guards/validation are pure or mocked)
pnpm build
```

## Troubleshooting

- **`ENCRYPTION_KEY must be exactly 32 bytes`** — regenerate with `openssl rand -base64 32`; don't hand-edit the value.
- **Google returns `redirect_uri_mismatch`** — the redirect URI in Google Console must match the URL you are actually browsing (host *and* port).
- **`AUTH_SECRET` missing** — Auth.js refuses to start sessions without it in production mode.
- **Port 5432 taken** — change the port mapping in `docker-compose.yml` and `DATABASE_URL` accordingly.
