# Only Yours

**Only Yours** — open-source, self-hosted personal workspace for notes, encrypted secrets, scenarios and automations.

> Only Yours — open-source prywatna przestrzeń do notatek, szyfrowanych sekretów, scenariuszy i automatyzacji.

Run it locally or on your own hosting. Your data stays with you — the vault is encrypted end-to-end in the browser, and the server never sees a single plaintext secret.

**Domain:** [oyours.it](https://oyours.it) · **Default language:** Polish (`/pl`) · **Secondary:** English (`/en`)

## Features

| Area | What you get |
| --- | --- |
| 🔑 **Auth** | Google OAuth (Auth.js v5), JWT sessions, protected routes |
| 🛡️ **Progressive security** | `SESSION` → `MFA_VERIFIED` → `VAULT_UNLOCKED`; critical actions force an MFA step-up |
| 📱 **MFA (TOTP)** | QR enrollment, replay protection, one-time backup codes (keyed hashes only), lockout after failed attempts |
| 🔒 **Vault** | Client-side AES-256-GCM, PBKDF2-derived key from a master password, auto-lock, encrypted export — the server stores ciphertext only |
| 📝 **Notes** | CRUD, tags, search, archive, trash (soft delete) |
| ✅ **Scenarios** | Checklists/procedures with steps, statuses (draft/active/archived), duplication |
| ⚙️ **Automations** | Create notes/scenarios from templates or call webhooks; run log; schedule/webhook triggers modeled for a future worker |
| 🔌 **Integrations** | Data model + MFA guard + token encryption ready; provider flows on the roadmap |
| 🌍 **i18n** | Polish-first with English fallback (next-intl), locale routing `/pl` & `/en` |
| 🧾 **Audit** | Security event log (MFA, vault, integrations) with IP/user-agent |

## Stack

Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind CSS 4 · Prisma 7 (driver adapters) · PostgreSQL · Auth.js v5 · Zod 4 · Vitest · pnpm

## Quick start

```bash
# 1. Install dependencies
pnpm install

# 2. Start a local Postgres (Docker)
docker compose up -d

# 3. Configure environment
cp .env.example .env
# fill in: AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, ENCRYPTION_KEY
# generate secrets with: openssl rand -base64 32

# 4. Apply migrations
pnpm db:deploy

# 5. Run
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with Google. Optionally seed demo data (after first sign-in):

```bash
SEED_USER_EMAIL=you@example.com pnpm db:seed
```

Full walkthrough (including Google OAuth setup): [docs/local-development.md](docs/local-development.md).

## Requirements

- Node.js ≥ 20 (WebCrypto), pnpm ≥ 9
- PostgreSQL 14+ — local via Docker Compose, or hosted (Supabase / Neon / any Postgres, see [docs/database-options.md](docs/database-options.md))
- A Google OAuth client (free) for sign-in

## Commands

| Command | Description |
| --- | --- |
| `pnpm dev` | Development server |
| `pnpm build` / `pnpm start` | Production build / serve |
| `pnpm lint` / `pnpm typecheck` | ESLint / TypeScript |
| `pnpm test` | Vitest suite (crypto, MFA, guards, validation) |
| `pnpm db:migrate` | Create & apply a migration (dev) |
| `pnpm db:deploy` | Apply committed migrations |
| `pnpm db:seed` | Seed demo data for `SEED_USER_EMAIL` |
| `pnpm db:studio` | Prisma Studio |

## Security model (short version)

1. **SESSION** — Google sign-in unlocks notes, scenarios and automations.
2. **MFA_VERIFIED** — a TOTP step-up (valid 15 min per browser session, tracked server-side) is required for the vault, integrations and security settings. Export/delete of the vault demands a *fresh* verification (≤ 2 min).
3. **VAULT_UNLOCKED** — vault items are decrypted only in the browser with a key derived from your master password (PBKDF2-SHA256, 600k iterations → AES-256-GCM). The master password never leaves your device and **cannot be recovered**.

Details, threat model and known MVP limitations: [docs/security.md](docs/security.md).

## Documentation

- [docs/local-development.md](docs/local-development.md) — local setup, migrations, Google OAuth
- [docs/database-options.md](docs/database-options.md) — Docker / Supabase / Neon / other Postgres
- [docs/security.md](docs/security.md) — progressive security, vault encryption, threat model
- [docs/deployment-cloudflare.md](docs/deployment-cloudflare.md) — Cloudflare deployment path and constraints

## MVP status & roadmap

**Done:** Google OAuth · progressive MFA (TOTP + backup codes) · E2E-encrypted vault with export · notes · scenarios · automations (manual trigger) · integrations foundation · audit log · i18n (pl/en) · docs · tests.

**Deliberately next:**

- [ ] Scheduler/worker for `SCHEDULE` and incoming `WEBHOOK` triggers (Cloudflare Cron / queue)
- [ ] Google / Microsoft Calendar integration flows (model + guards are ready)
- [ ] Argon2id KDF option (WASM) next to PBKDF2
- [ ] WebAuthn/passkeys as a second MFA method
- [ ] Markdown preview for notes (with sanitizer)
- [ ] Notes/scenarios full-text search (Postgres `tsvector`)
- [ ] Rate limiting at the platform layer + nonce-based CSP

## License

[MIT](LICENSE)
