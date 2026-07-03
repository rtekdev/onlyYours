// TOTP (RFC 6238) helpers built on `otpauth`. Pure functions over a base32
// secret — encryption of that secret at rest happens in the callers.

import { Secret, TOTP } from "otpauth";

const ISSUER = "Only Yours";
const TOTP_PERIOD_SECONDS = 30;
const TOTP_DIGITS = 6;
// Accept one step of clock drift in either direction (industry default).
const TOTP_WINDOW = 1;

export function generateTotpSecret(): string {
  return new Secret({ size: 20 }).base32;
}

export function buildOtpauthUrl(secretBase32: string, accountLabel: string): string {
  const totp = new TOTP({
    issuer: ISSUER,
    label: accountLabel,
    secret: Secret.fromBase32(secretBase32),
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD_SECONDS,
  });
  return totp.toString();
}

export interface TotpVerification {
  ok: boolean;
  /** Time-step that matched; persisted to reject replayed codes. */
  usedStep?: number;
}

/**
 * Verifies a 6-digit code. `lastUsedStep` implements replay protection: a
 * code is single-use even while it is still inside the validity window.
 */
export function verifyTotpCode(
  secretBase32: string,
  code: string,
  lastUsedStep?: bigint | null,
  now: number = Date.now(),
): TotpVerification {
  const totp = new TOTP({
    issuer: ISSUER,
    secret: Secret.fromBase32(secretBase32),
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD_SECONDS,
  });

  const delta = totp.validate({ token: code, window: TOTP_WINDOW, timestamp: now });
  if (delta === null) {
    return { ok: false };
  }

  const currentStep = Math.floor(now / 1000 / TOTP_PERIOD_SECONDS);
  const usedStep = currentStep + delta;
  if (lastUsedStep != null && BigInt(usedStep) <= lastUsedStep) {
    // Replayed or older code — reject even though the HMAC matched.
    return { ok: false };
  }
  return { ok: true, usedStep };
}
