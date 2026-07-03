import "server-only";

import { headers } from "next/headers";

import { prisma } from "@/lib/prisma";
import type { SecurityEventType } from "@/generated/prisma/enums";

// Audit metadata must never contain secrets, tokens or vault plaintext —
// only identifiers and coarse context (counts, entry ids, providers).
type AuditMetadata = Record<string, string | number | boolean | null>;

/**
 * Records a security-relevant event. Deliberately non-throwing: an audit
 * write failure must not break the user action itself (but is logged).
 */
export async function recordSecurityEvent(
  userId: string,
  type: SecurityEventType,
  metadata?: AuditMetadata,
): Promise<void> {
  try {
    const requestHeaders = await headers();
    const forwardedFor = requestHeaders.get("x-forwarded-for");
    await prisma.securityEvent.create({
      data: {
        userId,
        type,
        ipAddress: forwardedFor?.split(",")[0]?.trim() ?? null,
        userAgent: requestHeaders.get("user-agent"),
        metadata,
      },
    });
  } catch (error) {
    console.error(`[audit] failed to record ${type}`, error);
  }
}
