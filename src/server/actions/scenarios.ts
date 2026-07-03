"use server";

import { revalidatePath } from "next/cache";

import { type ActionResult } from "@/lib/action-result";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/security/guards";
import { ActionError, runAction } from "@/lib/server/actions";
import {
  addStepSchema,
  createScenarioSchema,
  scenarioIdSchema,
  stepIdSchema,
  updateScenarioSchema,
  updateStepSchema,
} from "@/lib/validation/scenarios";
import type { ScenarioStatus } from "@/generated/prisma/enums";

export interface ScenarioListItem {
  id: string;
  title: string;
  description: string;
  status: ScenarioStatus;
  stepCount: number;
  completedCount: number;
  updatedAt: string;
}

export interface ScenarioStepData {
  id: string;
  title: string;
  note: string;
  position: number;
  completedAt: string | null;
}

export interface ScenarioDetail extends Omit<ScenarioListItem, "stepCount" | "completedCount"> {
  steps: ScenarioStepData[];
  createdAt: string;
}

function revalidateScenarios() {
  revalidatePath("/[locale]/scenarios", "page");
}

export async function listScenarios(): Promise<ActionResult<ScenarioListItem[]>> {
  return runAction("listScenarios", async () => {
    const { userId } = await requireUser();
    const scenarios = await prisma.scenario.findMany({
      where: { userId },
      include: { steps: { select: { completedAt: true } } },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });
    return scenarios.map((scenario) => ({
      id: scenario.id,
      title: scenario.title,
      description: scenario.description,
      status: scenario.status,
      stepCount: scenario.steps.length,
      completedCount: scenario.steps.filter((s) => s.completedAt !== null).length,
      updatedAt: scenario.updatedAt.toISOString(),
    }));
  });
}

export async function getScenario(input: unknown): Promise<ActionResult<ScenarioDetail>> {
  return runAction("getScenario", async () => {
    const { userId } = await requireUser();
    const { id } = scenarioIdSchema.parse(input);
    const scenario = await prisma.scenario.findFirst({
      where: { id, userId },
      include: { steps: { orderBy: { position: "asc" } } },
    });
    if (!scenario) {
      throw new ActionError("NOT_FOUND");
    }
    return {
      id: scenario.id,
      title: scenario.title,
      description: scenario.description,
      status: scenario.status,
      createdAt: scenario.createdAt.toISOString(),
      updatedAt: scenario.updatedAt.toISOString(),
      steps: scenario.steps.map(toStepData),
    };
  });
}

export async function createScenario(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction("createScenario", async () => {
    const { userId } = await requireUser();
    const data = createScenarioSchema.parse(input);
    const scenario = await prisma.scenario.create({ data: { userId, ...data } });
    revalidateScenarios();
    return { id: scenario.id };
  });
}

export async function updateScenario(input: unknown): Promise<ActionResult<null>> {
  return runAction("updateScenario", async () => {
    const { userId } = await requireUser();
    const { id, ...data } = updateScenarioSchema.parse(input);
    const updated = await prisma.scenario.updateMany({ where: { id, userId }, data });
    if (updated.count === 0) {
      throw new ActionError("NOT_FOUND");
    }
    revalidateScenarios();
    return null;
  });
}

export async function deleteScenario(input: unknown): Promise<ActionResult<null>> {
  return runAction("deleteScenario", async () => {
    const { userId } = await requireUser();
    const { id } = scenarioIdSchema.parse(input);
    const deleted = await prisma.scenario.deleteMany({ where: { id, userId } });
    if (deleted.count === 0) {
      throw new ActionError("NOT_FOUND");
    }
    revalidateScenarios();
    return null;
  });
}

/** Copies a scenario (steps included, progress reset) as a new DRAFT. */
export async function duplicateScenario(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction("duplicateScenario", async () => {
    const { userId } = await requireUser();
    const { id } = scenarioIdSchema.parse(input);
    const source = await prisma.scenario.findFirst({
      where: { id, userId },
      include: { steps: { orderBy: { position: "asc" } } },
    });
    if (!source) {
      throw new ActionError("NOT_FOUND");
    }
    const copy = await prisma.scenario.create({
      data: {
        userId,
        title: source.title,
        description: source.description,
        status: "DRAFT",
        steps: {
          create: source.steps.map((step) => ({
            title: step.title,
            note: step.note,
            position: step.position,
          })),
        },
      },
    });
    revalidateScenarios();
    return { id: copy.id };
  });
}

export async function addScenarioStep(input: unknown): Promise<ActionResult<ScenarioStepData>> {
  return runAction("addScenarioStep", async () => {
    const { userId } = await requireUser();
    const { scenarioId, title, note } = addStepSchema.parse(input);

    const scenario = await prisma.scenario.findFirst({ where: { id: scenarioId, userId }, select: { id: true } });
    if (!scenario) {
      throw new ActionError("NOT_FOUND");
    }
    const last = await prisma.scenarioStep.findFirst({
      where: { scenarioId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const step = await prisma.scenarioStep.create({
      data: { scenarioId, title, note, position: (last?.position ?? 0) + 1 },
    });
    revalidateScenarios();
    return toStepData(step);
  });
}

export async function updateScenarioStep(input: unknown): Promise<ActionResult<null>> {
  return runAction("updateScenarioStep", async () => {
    const { userId } = await requireUser();
    const { stepId, title, note, completed } = updateStepSchema.parse(input);

    // Ownership travels through the scenario relation.
    const updated = await prisma.scenarioStep.updateMany({
      where: { id: stepId, scenario: { userId } },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(note !== undefined ? { note } : {}),
        ...(completed !== undefined ? { completedAt: completed ? new Date() : null } : {}),
      },
    });
    if (updated.count === 0) {
      throw new ActionError("NOT_FOUND");
    }
    revalidateScenarios();
    return null;
  });
}

export async function deleteScenarioStep(input: unknown): Promise<ActionResult<null>> {
  return runAction("deleteScenarioStep", async () => {
    const { userId } = await requireUser();
    const { stepId } = stepIdSchema.parse(input);
    const deleted = await prisma.scenarioStep.deleteMany({ where: { id: stepId, scenario: { userId } } });
    if (deleted.count === 0) {
      throw new ActionError("NOT_FOUND");
    }
    revalidateScenarios();
    return null;
  });
}

function toStepData(step: {
  id: string;
  title: string;
  note: string;
  position: number;
  completedAt: Date | null;
}): ScenarioStepData {
  return {
    id: step.id,
    title: step.title,
    note: step.note,
    position: step.position,
    completedAt: step.completedAt?.toISOString() ?? null,
  };
}
