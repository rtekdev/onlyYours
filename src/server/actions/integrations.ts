"use server";

import { type ActionResult } from "@/lib/action-result";
import { prisma } from "@/lib/prisma";
import { recordSecurityEvent } from "@/lib/security/audit";
import { requireMfa, requireUser } from "@/lib/security/guards";
import { ActionError, runAction } from "@/lib/server/actions";
import { z } from "zod";
import type { IntegrationProvider, IntegrationStatus } from "@/generated/prisma/enums";

// Integrations are a structural placeholder in the MVP: the data model,
// MFA guard and token-encryption path exist, but no provider OAuth flow is
// wired yet. See README roadmap. Token columns (accessTokenEnc/…) are never
// selected here — they stay server-side only even once flows land.

export interface IntegrationListItem {
  id: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  connectedAt: string;
}

export async function listIntegrations(): Promise<ActionResult<IntegrationListItem[]>> {
  return runAction("listIntegrations", async () => {
    const { userId } = await requireUser();
    const integrations = await prisma.integrationAccount.findMany({
      where: { userId },
      select: { id: true, provider: true, status: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    return integrations.map((integration) => ({
      id: integration.id,
      provider: integration.provider,
      status: integration.status,
      connectedAt: integration.createdAt.toISOString(),
    }));
  });
}

const integrationIdSchema = z.object({ id: z.cuid() });

/** Disconnecting is available already; connecting arrives with provider flows. */
export async function removeIntegration(input: unknown): Promise<ActionResult<null>> {
  return runAction("removeIntegration", async () => {
    // Managing integrations is a critical action — MFA required.
    const { userId } = await requireMfa();
    const { id } = integrationIdSchema.parse(input);
    const deleted = await prisma.integrationAccount.deleteMany({ where: { id, userId } });
    if (deleted.count === 0) {
      throw new ActionError("NOT_FOUND");
    }
    await recordSecurityEvent(userId, "INTEGRATION_REMOVED", { integrationId: id });
    return null;
  });
}
