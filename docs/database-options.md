# Database options

Only Yours needs one PostgreSQL database. Prisma 7 with the `@prisma/adapter-pg` driver adapter talks to any of the options below — only `DATABASE_URL` changes.

## 1. Local Docker (default for development)

```bash
docker compose up -d
```

```txt
DATABASE_URL="postgresql://onlyyours:onlyyours-dev@localhost:5432/onlyyours"
```

## 2. Supabase

Use the **pooled** connection (PgBouncer, port 6543) for the app and the **direct** connection (port 5432) for migrations.

```txt
# App (pooled):
DATABASE_URL="postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true"

# Migrations (direct) — run: DATABASE_URL=<direct-url> pnpm db:deploy
postgresql://postgres.<project-ref>:<password>@aws-0-<region>.supabase.com:5432/postgres
```

Notes:

- With PgBouncer in transaction mode keep `?pgbouncer=true` so prepared statements are disabled.
- Only Yours uses its own tables via Prisma — Supabase RLS/auth features are not used and can stay disabled for these tables.

## 3. Neon

```txt
DATABASE_URL="postgresql://<user>:<password>@<endpoint>.neon.tech/<db>?sslmode=require"
```

- Neon's pooled endpoint (`-pooler` suffix) is recommended for the app; use the direct endpoint for migrations.
- For Cloudflare Workers deployments swap the driver adapter to `@prisma/adapter-neon` (HTTP/WebSocket driver) — see [deployment-cloudflare.md](deployment-cloudflare.md).

## 4. Any other Postgres

Anything reachable over TCP with TLS works (RDS, Cloud SQL, a VPS, a homelab box):

```txt
DATABASE_URL="postgresql://user:password@host:5432/dbname?sslmode=require"
```

Recommendations:

- PostgreSQL 14+.
- A dedicated database and role with least privilege.
- `sslmode=require` for anything that leaves localhost.
- Backups: `pg_dump` covers everything; vault items are stored encrypted, so dumps never contain plaintext secrets (keep them safe anyway — metadata is metadata).

## Applying the schema

```bash
pnpm db:deploy        # applies committed migrations (prisma/migrations)
pnpm db:migrate       # development: create + apply a new migration
```
