import { Secret, TOTP } from "otpauth";
import { describe, expect, it } from "vitest";

import { buildOtpauthUrl, generateTotpSecret, verifyTotpCode } from "@/lib/security/totp";

function codeFor(secret: string, timestamp: number): string {
  return new TOTP({ secret: Secret.fromBase32(secret), digits: 6, period: 30 }).generate({ timestamp });
}

describe("TOTP", () => {
  it("generates a base32 secret and a valid otpauth URL", () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]+$/);

    const url = buildOtpauthUrl(secret, "user@example.com");
    expect(url).toContain("otpauth://totp/");
    expect(url).toContain(encodeURIComponent("Only Yours"));
    expect(url).toContain(secret);
  });

  it("accepts a currently valid code and reports the used step", () => {
    const secret = generateTotpSecret();
    const now = Date.now();
    const result = verifyTotpCode(secret, codeFor(secret, now), null, now);
    expect(result.ok).toBe(true);
    expect(result.usedStep).toBe(Math.floor(now / 1000 / 30));
  });

  it("accepts one step of clock drift", () => {
    const secret = generateTotpSecret();
    const now = Date.now();
    const previousStepCode = codeFor(secret, now - 30_000);
    expect(verifyTotpCode(secret, previousStepCode, null, now).ok).toBe(true);
  });

  it("rejects an invalid code", () => {
    const secret = generateTotpSecret();
    expect(verifyTotpCode(secret, "000000", null).ok).toBe(false);
  });

  it("rejects a replayed code even inside the validity window", () => {
    const secret = generateTotpSecret();
    const now = Date.now();
    const code = codeFor(secret, now);

    const first = verifyTotpCode(secret, code, null, now);
    expect(first.ok).toBe(true);

    // Same code again, lastUsedStep persisted from the first verification.
    const replay = verifyTotpCode(secret, code, BigInt(first.usedStep!), now);
    expect(replay.ok).toBe(false);
  });
});
