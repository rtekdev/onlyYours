"use server";

import { revalidatePath } from "next/cache";

import { type ActionResult } from "@/lib/action-result";
import { executeAutomationAction } from "@/lib/automations/executor";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/security/guards";
import { ActionError, runAction } from "@/lib/server/actions";
import {
  automationIdSchema,
  createAutomationSchema,
  parseAutomationConfig,
  updateAutomationSchema,
} from "@/lib/validation/automations";
import type {
  AutomationAction,
  AutomationRunStatus,
  AutomationTrigger,
} from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

export interface AutomationListItem {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  triggerType: AutomationTrigger;
  actionType: AutomationAction;
  lastRun: { status: AutomationRunStatus; startedAt: string } | null;
  updatedAt: string;
}

export interface AutomationRunData {
  id: string;
  status: AutomationRunStatus;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

function revalidateAutomations() {
  revalidatePath("/[locale]/automations", "page");
}

export async function listAutomations(): Promise<ActionResult<AutomationListItem[]>> {
  return runAction("listAutomations", async () => {
    const { userId } = await requireUser();
    const automations = await prisma.automation.findMany({
      where: { userId },
      include: { runs: { orderBy: { startedAt: "desc" }, take: 1 } },
      orderBy: { updatedAt: "desc" },
    });
    return automations.map((automation) => ({
      id: automation.id,
      name: automation.name,
      description: automation.description,
      enabled: automation.enabled,
      triggerType: automation.triggerType,
      actionType: automation.actionType,
      lastRun: automation.runs[0]
        ? { status: automation.runs[0].status, startedAt: automation.runs[0].startedAt.toISOString() }
        : null,
      updatedAt: automation.updatedAt.toISOString(),
    }));
  });
}

export async function createAutomation(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction("createAutomation", async () => {
    const { userId } = await requireUser();
    const { name, description, triggerType, actionType, config } = createAutomationSchema.parse(input);
    // Config must match its action type at creation time, not just at run time.
    const parsedConfig = parseAutomationConfig(actionType, config);

    const automation = await prisma.automation.create({
      data: {
        userId,
        name,
        description,
        triggerType,
        actionType,
        config: parsedConfig as Prisma.InputJsonValue,
      },
    });
    revalidateAutomations();
    return { id: automation.id };
  });
}

export async function updateAutomation(input: unknown): Promise<ActionResult<null>> {
  return runAction("updateAutomation", async () => {
    const { userId } = await requireUser();
    const { id, ...data } = updateAutomationSchema.parse(input);
    const updated = await prisma.automation.updateMany({ where: { id, userId }, data });
    if (updated.count === 0) {
      throw new ActionError("NOT_FOUND");
    }
    revalidateAutomations();
    return null;
  });
}

export async function deleteAutomation(input: unknown): Promise<ActionResult<null>> {
  return runAction("deleteAutomation", async () => {
    const { userId } = await requireUser();
    const { id } = automationIdSchema.parse(input);
    const deleted = await prisma.automation.deleteMany({ where: { id, userId } });
    if (deleted.count === 0) {
      throw new ActionError("NOT_FOUND");
    }
    revalidateAutomations();
    return null;
  });
}

/**
 * Manual trigger — the only trigger executed in the MVP. Every run is
 * recorded as an AutomationRun regardless of outcome.
 */
export async function runAutomation(input: unknown): Promise<ActionResult<AutomationRunData>> {
  return runAction("runAutomation", async () => {
    const { userId } = await requireUser();
    const { id } = automationIdSchema.parse(input);

    const automation = await prisma.automation.findFirst({ where: { id, userId } });
    if (!automation) {
      throw new ActionError("NOT_FOUND");
    }
    if (!automation.enabled) {
      throw new ActionError("DISABLED");
    }

    const run = await prisma.automationRun.create({ data: { automationId: automation.id } });
    try {
      const output = await executeAutomationAction(userId, automation.actionType, automation.config);
      const finished = await prisma.automationRun.update({
        where: { id: run.id },
        data: { status: "SUCCESS", output, finishedAt: new Date() },
      });
      revalidateAutomations();
      return toRunData(finished);
    } catch (error) {
      // Persist a sanitized failure reason; never raw stack traces.
      const message = error instanceof Error ? error.message.slice(0, 500) : "Unknown error";
      const finished = await prisma.automationRun.update({
        where: { id: run.id },
        data: { status: "FAILED", error: message, finishedAt: new Date() },
      });
      revalidateAutomations();
      return toRunData(finished);
    }
  });
}

export async function listAutomationRuns(input: unknown): Promise<ActionResult<AutomationRunData[]>> {
  return runAction("listAutomationRuns", async () => {
    const { userId } = await requireUser();
    const { id } = automationIdSchema.parse(input);
    const runs = await prisma.automationRun.findMany({
      where: { automationId: id, automation: { userId } },
      orderBy: { startedAt: "desc" },
      take: 20,
    });
    return runs.map(toRunData);
  });
}

function toRunData(run: {
  id: string;
  status: AutomationRunStatus;
  error: string | null;
  startedAt: Date;
  finishedAt: Date | null;
}): AutomationRunData {
  return {
    id: run.id,
    status: run.status,
    error: run.error,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
  };
}
