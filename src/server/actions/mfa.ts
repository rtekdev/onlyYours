"use server";

import { type ActionResult } from "@/lib/action-result";
import { prisma } from "@/lib/prisma";
import { recordSecurityEvent } from "@/lib/security/audit";
import { generateBackupCodes, normalizeBackupCode } from "@/lib/security/backup-codes";
import { requireMfa, requireUser } from "@/lib/security/guards";
import { FRESH_MFA_WINDOW_SECONDS, STEP_UP_WINDOW_SECONDS } from "@/lib/security/levels";
import { isLockedOut, nextStateAfterFailure, stateAfterSuccess } from "@/lib/security/lockout";
import { buildOtpauthUrl, generateTotpSecret, verifyTotpCode } from "@/lib/security/totp";
import { ActionError, runAction } from "@/lib/server/actions";
import { decryptServerSecret, encryptServerSecret, hashBackupCodeForStorage } from "@/lib/server/encryption";
import { backupCodeSchema, totpCodeSchema } from "@/lib/validation/mfa";

export interface MfaSetupData {
  otpauthUrl: string;
  /** Base32 secret for manual entry into an authenticator app. */
  secret: string;
}

/**
 * Phase 1 of enabling MFA: generate and store a TOTP secret (encrypted at
 * rest) without activating it. MFA becomes active only after the user proves
 * possession by confirming a valid code (confirmMfaSetup).
 */
export async function startMfaSetup(): Promise<ActionResult<MfaSetupData>> {
  return runAction("startMfaSetup", async () => {
    const { userId, email } = await requireUser();

    const existing = await prisma.userSecurity.findUnique({ where: { userId } });
    if (existing?.totpEnabledAt) {
      throw new ActionError("CONFLICT", "MFA is already enabled");
    }

    const secret = generateTotpSecret();
    const totpSecretEnc = await encryptServerSecret(secret);

    await prisma.userSecurity.upsert({
      where: { userId },
      create: { userId, totpSecretEnc },
      update: { totpSecretEnc, totpEnabledAt: null, totpLastUsedStep: null },
    });
    await recordSecurityEvent(userId, "MFA_SETUP_STARTED");

    return { otpauthUrl: buildOtpauthUrl(secret, email ?? "user"), secret };
  });
}

/**
 * Phase 2: user confirms a code from their authenticator. Activates MFA,
 * issues the one-time-visible backup codes and grants step-up for this
 * session (so the flow that demanded MFA can continue immediately).
 */
export async function confirmMfaSetup(input: { code: string }): Promise<ActionResult<{ backupCodes: string[] }>> {
  return runAction("confirmMfaSetup", async () => {
    const { userId, sid } = await requireUser();
    const { code } = totpCodeSchema.parse(input);

    const security = await prisma.userSecurity.findUnique({ where: { userId } });
    if (!security?.totpSecretEnc) {
      throw new ActionError("NOT_FOUND", "MFA setup has not been started");
    }
    if (security.totpEnabledAt) {
      throw new ActionError("CONFLICT", "MFA is already enabled");
    }
    await assertNotLockedOut(security);

    const secret = await decryptServerSecret(security.totpSecretEnc);
    const verification = verifyTotpCode(secret, code, security.totpLastUsedStep);
    if (!verification.ok) {
      await registerFailure(userId, security);
      throw new ActionError("INVALID_CODE");
    }

    const backupCodes = generateBackupCodes();
    const codeHashes = await Promise.all(
      backupCodes.map((c) => hashBackupCodeForStorage(normalizeBackupCode(c))),
    );

    await prisma.$transaction([
      prisma.userSecurity.update({
        where: { userId },
        data: {
          totpEnabledAt: new Date(),
          totpLastUsedStep: verification.usedStep,
          ...stateAfterSuccess(),
        },
      }),
      prisma.backupCode.deleteMany({ where: { userId } }),
      prisma.backupCode.createMany({ data: codeHashes.map((codeHash) => ({ userId, codeHash })) }),
      upsertStepUpGrant(userId, sid),
    ]);
    await recordSecurityEvent(userId, "MFA_ENABLED");

    // Plaintext codes exist only in this response — the DB stores keyed hashes.
    return { backupCodes };
  });
}

/**
 * Step-up verification for an already-enabled MFA: accepts a TOTP code or a
 * one-time backup code and elevates the current session to MFA_VERIFIED.
 */
export async function verifyMfaStepUp(input: {
  code: string;
  method: "totp" | "backup";
}): Promise<ActionResult<{ verifiedAt: string }>> {
  return runAction("verifyMfaStepUp", async () => {
    const { userId, sid } = await requireUser();

    const security = await prisma.userSecurity.findUnique({ where: { userId } });
    if (!security?.totpEnabledAt || !security.totpSecretEnc) {
      throw new ActionError("NOT_FOUND", "MFA is not enabled");
    }
    await assertNotLockedOut(security);

    if (input.method === "backup") {
      const { code } = backupCodeSchema.parse(input);
      const codeHash = await hashBackupCodeForStorage(normalizeBackupCode(code));
      // Single-use: the row is only matched while usedAt is still null.
      const match = await prisma.backupCode.updateMany({
        where: { userId, codeHash, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (match.count === 0) {
        await registerFailure(userId, security);
        throw new ActionError("INVALID_CODE");
      }
      await recordSecurityEvent(userId, "BACKUP_CODE_USED");
    } else {
      const { code } = totpCodeSchema.parse(input);
      const secret = await decryptServerSecret(security.totpSecretEnc);
      const verification = verifyTotpCode(secret, code, security.totpLastUsedStep);
      if (!verification.ok) {
        await registerFailure(userId, security);
        throw new ActionError("INVALID_CODE");
      }
      await prisma.userSecurity.update({
        where: { userId },
        data: { totpLastUsedStep: verification.usedStep, ...stateAfterSuccess() },
      });
    }

    const verifiedAt = new Date();
    await upsertStepUpGrant(userId, sid, verifiedAt);
    await recordSecurityEvent(userId, "MFA_VERIFIED");
    return { verifiedAt: verifiedAt.toISOString() };
  });
}

/** Requires fresh MFA — replacing codes invalidates all previous ones. */
export async function regenerateBackupCodes(): Promise<ActionResult<{ backupCodes: string[] }>> {
  return runAction("regenerateBackupCodes", async () => {
    const { userId } = await requireMfa(FRESH_MFA_WINDOW_SECONDS);

    const backupCodes = generateBackupCodes();
    const codeHashes = await Promise.all(
      backupCodes.map((c) => hashBackupCodeForStorage(normalizeBackupCode(c))),
    );
    await prisma.$transaction([
      prisma.backupCode.deleteMany({ where: { userId } }),
      prisma.backupCode.createMany({ data: codeHashes.map((codeHash) => ({ userId, codeHash })) }),
    ]);
    await recordSecurityEvent(userId, "BACKUP_CODES_REGENERATED");
    return { backupCodes };
  });
}

export interface SecurityOverview {
  mfaEnabled: boolean;
  mfaEnabledAt: string | null;
  backupCodesRemaining: number;
  /** Whether this session currently holds a step-up grant, and until when. */
  stepUpValidUntil: string | null;
  lockedUntil: string | null;
  recentEvents: Array<{ id: string; type: string; createdAt: string; ipAddress: string | null }>;
}

export async function getSecurityOverview(): Promise<ActionResult<SecurityOverview>> {
  return runAction("getSecurityOverview", async () => {
    const { userId, sid } = await requireUser();

    const [security, backupCodesRemaining, grant, recentEvents] = await Promise.all([
      prisma.userSecurity.findUnique({ where: { userId } }),
      prisma.backupCode.count({ where: { userId, usedAt: null } }),
      prisma.stepUpGrant.findUnique({ where: { tokenSid: sid } }),
      prisma.securityEvent.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 15,
        select: { id: true, type: true, createdAt: true, ipAddress: true },
      }),
    ]);

    const stepUpValidUntil =
      grant && grant.userId === userId
        ? new Date(grant.mfaVerifiedAt.getTime() + STEP_UP_WINDOW_SECONDS * 1000)
        : null;

    return {
      mfaEnabled: Boolean(security?.totpEnabledAt),
      mfaEnabledAt: security?.totpEnabledAt?.toISOString() ?? null,
      backupCodesRemaining,
      stepUpValidUntil:
        stepUpValidUntil && stepUpValidUntil.getTime() > Date.now() ? stepUpValidUntil.toISOString() : null,
      lockedUntil:
        security?.mfaLockedUntil && security.mfaLockedUntil.getTime() > Date.now()
          ? security.mfaLockedUntil.toISOString()
          : null,
      recentEvents: recentEvents.map((event) => ({
        id: event.id,
        type: event.type,
        createdAt: event.createdAt.toISOString(),
        ipAddress: event.ipAddress,
      })),
    };
  });
}

// --- internals -------------------------------------------------------------

function upsertStepUpGrant(userId: string, sid: string, verifiedAt: Date = new Date()) {
  return prisma.stepUpGrant.upsert({
    where: { tokenSid: sid },
    create: { userId, tokenSid: sid, mfaVerifiedAt: verifiedAt },
    update: { mfaVerifiedAt: verifiedAt },
  });
}

async function assertNotLockedOut(security: { mfaFailedCount: number; mfaLockedUntil: Date | null }) {
  if (isLockedOut(security)) {
    throw new ActionError("MFA_LOCKED");
  }
}

async function registerFailure(
  userId: string,
  security: { mfaFailedCount: number; mfaLockedUntil: Date | null },
) {
  const next = nextStateAfterFailure(security);
  await prisma.userSecurity.update({
    where: { userId },
    data: { mfaFailedCount: next.mfaFailedCount, mfaLockedUntil: next.mfaLockedUntil },
  });
  await recordSecurityEvent(userId, next.justLocked ? "MFA_LOCKED" : "MFA_FAILED");
}
