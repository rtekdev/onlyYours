# Security model

This document describes what Only Yours protects, how, and — just as importantly — what it does **not** protect against in the MVP.

## Progressive security levels

```ts
type SecurityLevel = "SESSION" | "MFA_VERIFIED" | "VAULT_UNLOCKED";
```

| Level | How it is reached | What it unlocks |
| --- | --- | --- |
| `SESSION` | Google OAuth sign-in (Auth.js v5, JWT session cookie) | notes, scenarios, automations, dashboard |
| `MFA_VERIFIED` | TOTP (or backup code) verified **in this browser session**, within the last 15 minutes | vault access, integrations, security settings, backup-code regeneration* |
| `VAULT_UNLOCKED` | master password entered locally; key derived in the browser | reading/decrypting vault secrets |

\* destructive actions (vault export, vault delete, backup-code regeneration) require a **fresh** verification — max 120 s old.

Step-up state is *server-side*: a successful TOTP check writes a `StepUpGrant` row keyed by the session's `sid` claim (a UUID minted into the JWT at sign-in). Guards (`requireMfa(maxAgeSeconds)`) compare `mfaVerifiedAt` against the action's freshness window. Because the grant lives in the database:

- it cannot be forged client-side,
- it can be revoked centrally,
- a new sign-in gets a new `sid`, so elevation never outlives the session that earned it.

Enforcement happens in server actions and layouts (`requireUser` / `requireMfa` in `src/lib/security/guards.ts`). The proxy (`src/proxy.ts`) only handles UX redirects — it is not a security boundary.

## MFA (TOTP)

- Enrollment is two-phase: the secret is stored (encrypted) but MFA activates only after the user proves possession with a valid code.
- TOTP: 6 digits, 30 s period, ±1 step drift window (`otpauth`).
- **Replay protection**: the last accepted time-step is persisted; a code can never be accepted twice, even inside the drift window.
- **Backup codes**: 10 codes, 60 bits of entropy each, shown exactly once. Storage holds only an HMAC-SHA-256 (key derived from `ENCRYPTION_KEY` via HKDF) — a database leak alone is not enough to brute-force or forge codes. Each code is single-use; regeneration invalidates all previous codes and requires fresh MFA.
- **Lockout**: 5 consecutive failures lock verification for 15 minutes (`MFA_LOCKED` audit event). State is DB-backed, so it works across instances.
- SMS is deliberately not supported.

## Vault encryption (end-to-end)

All vault cryptography lives in `src/lib/crypto/vault.ts` and runs **only in the browser** (WebCrypto):

```txt
master password ──PBKDF2-SHA256 (600 000 iter., 16 B salt)──▶ KEK (AES-256-GCM)
random 256-bit DEK ──encrypted with KEK (AES-GCM, 96-bit IV)──▶ wrappedKey
item payload {username, url, secret, notes} ──AES-256-GCM(DEK), fresh IV──▶ {ciphertext, iv}
```

The server persists per vault: KDF parameters (algorithm, iterations, salt), `keyWrapIv`, `wrappedKey`; per item: `title` (the only plaintext metadata, needed for the locked list), `ciphertext`, `iv`.

What the backend **never** sees or stores: the master password, the KEK, the DEK, any plaintext payload. A wrong master password manifests purely as an AES-GCM authentication failure in the browser — there is no password hash to leak or brute-force server-side. Zod validation on the server additionally rejects a tampered client trying to register a weakened KDF (< 100 000 iterations) and enforces base64-only payloads.

Operational properties:

- DEK is imported as a **non-extractable** `CryptoKey`; the unlocked key exists only in React state.
- Auto-lock after 5 minutes of inactivity; manual lock; lock on page unload (memory is gone with the tab).
- Export produces the same encrypted material (never plaintext) and demands fresh MFA.
- Vault creation requires MFA to be configured first; reading vault data requires an active step-up.

**If the master password is lost, the data is unrecoverable by design.** The UI says this loudly before vault creation.

## Server-side secrets at rest

Secrets the server itself must read back — TOTP secrets today, integration OAuth tokens tomorrow — are encrypted with AES-256-GCM using `ENCRYPTION_KEY` (32 bytes, base64; see `src/lib/server/encryption.ts`). Purpose-specific keys are derived via HKDF so the master key is never reused across primitives. These values are decrypted only transiently in memory during verification and are never logged or returned to clients.

This is *not* the vault mechanism: TOTP verification inherently requires the server to read the secret. Vault items never pass through this path.

## Audit log

`SecurityEvent` records (with IP and user-agent): MFA setup/enable/verify/fail/lock, backup-code use/regeneration, vault create/read/export/delete, item add/update/delete, integration changes. Metadata never contains secrets. Recent events are visible under *Settings → Security*.

## Other measures

- **Input validation**: every server action parses input with Zod before touching the database.
- **Ownership**: every query filters by `userId` (directly or through the owning relation). Foreign and unknown ids are indistinguishable (`NOT_FOUND`) — no IDOR, no id probing.
- **Error hygiene**: actions return stable error codes; unexpected failures are logged server-side and surfaced as an opaque `INTERNAL`.
- **Open-redirect protection**: the login `callbackUrl` accepts only same-origin relative paths.
- **SSRF guard**: outbound automation webhooks must be HTTPS, must not target private/loopback/link-local ranges, and redirects are not followed.
- **Headers**: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` (see `next.config.ts`).
- **Cookies/CSRF**: handled by Auth.js (HttpOnly, SameSite=Lax, `__Secure-` prefixes in production; OAuth `state`/PKCE).

## Threat model (MVP)

**Protected against:**

- Database leak → vault items and TOTP secrets remain encrypted; backup codes are keyed hashes; no password material exists.
- Stolen session cookie → attacker gets `SESSION` scope only; vault and critical actions still demand a TOTP code they don't have, and the vault additionally needs the master password.
- Malicious/compromised *other user* → strict per-user ownership on every query.
- TOTP replay & brute force → single-use steps, lockout, audit trail.

**Explicitly NOT protected against (document honestly):**

- A **compromised server or hosting provider** serving malicious JavaScript: client-side encryption protects data *at rest*, but code delivered by a hostile server could capture the master password on entry. Mitigations like SRI/signed builds are out of MVP scope. Self-hosting is the point of this project.
- **Compromised end device** (malware, keylogger, browser extension with page access).
- **Weak master passwords**: PBKDF2 slows offline guessing but cannot save `hunter22`. Minimum length is enforced (12 chars); a strength meter and Argon2id are on the roadmap.
- **Denial of service** — rate limiting beyond the MFA lockout is left to the platform (Cloudflare/reverse proxy).

## Known MVP limitations

- PBKDF2 instead of Argon2id (WebCrypto-native; Argon2id needs WASM — planned; the `kdfAlgorithm` field is versioned so vaults can migrate).
- No nonce-based CSP yet (needs per-request nonce plumbing; tracked in the roadmap).
- Vault item titles are plaintext by design (locked-list UX). Treat titles as metadata, not secrets.
- Clipboard copies of secrets are not auto-cleared (browser APIs are unreliable here) — the UI copies on explicit action only.
- `Session` DB table is unused with JWT strategy (kept for adapter compatibility); sign-out does not invalidate previously issued JWTs before their natural expiry.
