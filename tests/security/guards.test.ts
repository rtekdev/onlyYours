import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  userSecurityFindUnique: vi.fn(),
  stepUpGrantFindUnique: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    userSecurity: { findUnique: mocks.userSecurityFindUnique },
    stepUpGrant: { findUnique: mocks.stepUpGrantFindUnique },
  },
}));

import { GuardError, requireMfa, requireUser } from "@/lib/security/guards";

const SESSION = { user: { id: "user-1", email: "u@example.com" }, sid: "sid-1" };

function grantAgedSeconds(seconds: number, userId = "user-1") {
  return { id: "grant-1", userId, tokenSid: "sid-1", mfaVerifiedAt: new Date(Date.now() - seconds * 1000) };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("requireUser", () => {
  it("returns the auth context for a signed-in user", async () => {
    mocks.auth.mockResolvedValue(SESSION);
    await expect(requireUser()).resolves.toEqual({ userId: "user-1", sid: "sid-1", email: "u@example.com" });
  });

  it.each([null, {}, { user: { id: "user-1" } }])("throws UNAUTHENTICATED for session %#", async (session) => {
    mocks.auth.mockResolvedValue(session);
    await expect(requireUser()).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });
});

describe("requireMfa", () => {
  beforeEach(() => {
    mocks.auth.mockResolvedValue(SESSION);
  });

  it("throws MFA_SETUP_REQUIRED when TOTP was never enabled", async () => {
    mocks.userSecurityFindUnique.mockResolvedValue(null);
    await expect(requireMfa()).rejects.toMatchObject({ code: "MFA_SETUP_REQUIRED" });
  });

  it("throws MFA_SETUP_REQUIRED when setup started but was never confirmed", async () => {
    mocks.userSecurityFindUnique.mockResolvedValue({ totpEnabledAt: null });
    const failure = await requireMfa().catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(GuardError);
    expect(failure).toMatchObject({ code: "MFA_SETUP_REQUIRED" });
  });

  it("throws MFA_REQUIRED when this session has no step-up grant", async () => {
    mocks.userSecurityFindUnique.mockResolvedValue({ totpEnabledAt: new Date() });
    mocks.stepUpGrantFindUnique.mockResolvedValue(null);
    await expect(requireMfa()).rejects.toMatchObject({ code: "MFA_REQUIRED" });
  });

  it("rejects a grant that belongs to a different user (no session fixation)", async () => {
    mocks.userSecurityFindUnique.mockResolvedValue({ totpEnabledAt: new Date() });
    mocks.stepUpGrantFindUnique.mockResolvedValue(grantAgedSeconds(10, "attacker"));
    await expect(requireMfa()).rejects.toMatchObject({ code: "MFA_REQUIRED" });
  });

  it("throws MFA_REQUIRED when the grant is older than the window", async () => {
    mocks.userSecurityFindUnique.mockResolvedValue({ totpEnabledAt: new Date() });
    mocks.stepUpGrantFindUnique.mockResolvedValue(grantAgedSeconds(16 * 60));
    await expect(requireMfa()).rejects.toMatchObject({ code: "MFA_REQUIRED" });
  });

  it("passes with a fresh grant and enforces tighter windows when asked", async () => {
    mocks.userSecurityFindUnique.mockResolvedValue({ totpEnabledAt: new Date() });
    mocks.stepUpGrantFindUnique.mockResolvedValue(grantAgedSeconds(5 * 60));

    // 5-minute-old grant: fine for the default 15-minute window…
    await expect(requireMfa()).resolves.toMatchObject({ userId: "user-1" });
    // …but not fresh enough for a 120-second window (export/delete vault).
    await expect(requireMfa(120)).rejects.toMatchObject({ code: "MFA_REQUIRED" });
  });
});
