import { describe, expect, it } from "vitest";

import { isLockedOut, nextStateAfterFailure, stateAfterSuccess } from "@/lib/security/lockout";

describe("MFA lockout policy", () => {
  it("is not locked out with no lock timestamp", () => {
    expect(isLockedOut({ mfaFailedCount: 3, mfaLockedUntil: null })).toBe(false);
  });

  it("locks after the 5th consecutive failure", () => {
    let state = { mfaFailedCount: 0, mfaLockedUntil: null as Date | null };
    for (let attempt = 1; attempt <= 4; attempt++) {
      const next = nextStateAfterFailure(state);
      expect(next.justLocked).toBe(false);
      expect(next.mfaFailedCount).toBe(attempt);
      state = next;
    }
    const locked = nextStateAfterFailure(state);
    expect(locked.justLocked).toBe(true);
    expect(locked.mfaLockedUntil).toBeInstanceOf(Date);
    expect(isLockedOut(locked)).toBe(true);
  });

  it("applies a 15-minute lock window that expires", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const locked = nextStateAfterFailure({ mfaFailedCount: 4, mfaLockedUntil: null }, now);
    expect(locked.mfaLockedUntil?.getTime()).toBe(now.getTime() + 15 * 60 * 1000);

    expect(isLockedOut(locked, new Date("2026-01-01T12:14:59Z"))).toBe(true);
    expect(isLockedOut(locked, new Date("2026-01-01T12:15:01Z"))).toBe(false);
  });

  it("resets cleanly after success", () => {
    expect(stateAfterSuccess()).toEqual({ mfaFailedCount: 0, mfaLockedUntil: null });
  });
});
