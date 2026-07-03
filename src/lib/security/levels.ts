// Progressive security model — see docs/security.md.
//
// SESSION        — signed in with Google; notes, scenarios, automations.
// MFA_VERIFIED   — TOTP verified recently in this browser session; required
//                  for vault access, security settings and integrations.
// VAULT_UNLOCKED — vault key derived locally from the master password;
//                  exists only in browser memory, never asserted server-side.
export type SecurityLevel = "SESSION" | "MFA_VERIFIED" | "VAULT_UNLOCKED";

/** How long a successful MFA verification elevates the session (step-up). */
export const STEP_UP_WINDOW_SECONDS = 15 * 60;

/** Destructive actions (vault export/delete) demand a much fresher MFA proof. */
export const FRESH_MFA_WINDOW_SECONDS = 120;

/** Failed MFA attempts allowed before a temporary lockout. */
export const MFA_MAX_FAILED_ATTEMPTS = 5;
export const MFA_LOCKOUT_MINUTES = 15;

/** Client-side vault auto-lock after inactivity. */
export const VAULT_AUTOLOCK_SECONDS = 5 * 60;

export const BACKUP_CODE_COUNT = 10;
