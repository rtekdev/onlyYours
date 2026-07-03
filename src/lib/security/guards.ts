import "server-only";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { STEP_UP_WINDOW_SECONDS } from "./levels";

export type GuardErrorCode = "UNAUTHENTICATED" | "MFA_SETUP_REQUIRED" | "MFA_REQUIRED";

/** Thrown by guards; mapped to ActionResult codes in lib/server/actions.ts. */
export class GuardError extends Error {
  constructor(public readonly code: GuardErrorCode) {
    super(code);
    this.name = "GuardError";
  }
}

export interface AuthContext {
  userId: string;
  /** Session id (JWT `sid` claim) that step-up grants are keyed by. */
  sid: string;
  email: string | null;
}

/** SESSION level: any signed-in Google user. */
export async function requireUser(): Promise<AuthContext> {
  const session = await auth();
  if (!session?.user?.id || !session.sid) {
    throw new GuardError("UNAUTHENTICATED");
  }
  return { userId: session.user.id, sid: session.sid, email: session.user.email ?? null };
}

/**
 * MFA_VERIFIED level: the user completed a TOTP challenge in *this* browser
 * session within `maxAgeSeconds`. Grants are stored server-side (StepUpGrant)
 * so they can be revoked and are never trusted from client state.
 *
 * Pass FRESH_MFA_WINDOW_SECONDS for destructive actions (vault export/delete).
 */
export async function requireMfa(maxAgeSeconds: number = STEP_UP_WINDOW_SECONDS): Promise<AuthContext> {
  const ctx = await requireUser();

  const security = await prisma.userSecurity.findUnique({
    where: { userId: ctx.userId },
    select: { totpEnabledAt: true },
  });
  if (!security?.totpEnabledAt) {
    // No MFA configured yet — the client routes the user into MFA setup.
    throw new GuardError("MFA_SETUP_REQUIRED");
  }

  const grant = await prisma.stepUpGrant.findUnique({ where: { tokenSid: ctx.sid } });
  if (!grant || grant.userId !== ctx.userId) {
    throw new GuardError("MFA_REQUIRED");
  }
  const ageSeconds = (Date.now() - grant.mfaVerifiedAt.getTime()) / 1000;
  if (ageSeconds > maxAgeSeconds) {
    throw new GuardError("MFA_REQUIRED");
  }
  return ctx;
}
