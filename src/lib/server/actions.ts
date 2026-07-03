import "server-only";

import { ZodError } from "zod";

import { type ActionResult, fail, succeed } from "@/lib/action-result";
import { GuardError } from "@/lib/security/guards";

/** Thrown by feature code for expected, user-visible failures. */
export class ActionError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "CONFLICT" | "INVALID_CODE" | "MFA_LOCKED" | "DISABLED" | "VALIDATION",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "ActionError";
  }
}

/**
 * Uniform error boundary for server actions: guard failures and validation
 * errors become stable codes; anything unexpected is logged server-side and
 * returned as an opaque INTERNAL error (no stack traces or SQL to clients).
 */
export async function runAction<T>(name: string, fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return succeed(await fn());
  } catch (error) {
    if (error instanceof GuardError) {
      return fail(error.code);
    }
    if (error instanceof ActionError) {
      return fail(error.code, error.message !== error.code ? error.message : undefined);
    }
    if (error instanceof ZodError) {
      return fail("VALIDATION", error.issues[0]?.message);
    }
    // Next.js control-flow errors (redirect/notFound) must pass through.
    if (error instanceof Error && "digest" in error) {
      throw error;
    }
    console.error(`[action:${name}] unexpected failure`, error);
    return fail("INTERNAL");
  }
}
