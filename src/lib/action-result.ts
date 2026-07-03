// Shared result envelope for server actions. Errors travel as stable codes
// (never user-facing strings) — the client maps them to localized messages,
// which keeps i18n on one side and avoids leaking server internals.

export type ActionErrorCode =
  | "UNAUTHENTICATED"
  | "MFA_SETUP_REQUIRED"
  | "MFA_REQUIRED"
  | "MFA_LOCKED"
  | "INVALID_CODE"
  | "VALIDATION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "DISABLED"
  | "INTERNAL";

export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: ActionErrorCode; message?: string };

export function succeed<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail<T = null>(error: ActionErrorCode, message?: string): ActionResult<T> {
  return { ok: false, error, message };
}
