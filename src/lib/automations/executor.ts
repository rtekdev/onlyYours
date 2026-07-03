import "server-only";

import { prisma } from "@/lib/prisma";
import {
  createNoteConfigSchema,
  createScenarioConfigSchema,
  webhookConfigSchema,
  type AutomationActionType,
} from "@/lib/validation/automations";
import { renderTemplate } from "./template";

const WEBHOOK_TIMEOUT_MS = 10_000;

export type ExecutionOutput = Record<string, string | number | boolean>;

/**
 * Executes one automation action. Config is re-validated on every run, so a
 * config edited outside the app (or by an older app version) can never reach
 * an executor unchecked. Ownership was already asserted by the caller.
 */
export async function executeAutomationAction(
  userId: string,
  actionType: AutomationActionType,
  rawConfig: unknown,
): Promise<ExecutionOutput> {
  switch (actionType) {
    case "CREATE_NOTE": {
      const { titleTemplate, contentTemplate, tags } = createNoteConfigSchema.parse(rawConfig);
      const note = await prisma.note.create({
        data: {
          userId,
          title: renderTemplate(titleTemplate),
          content: renderTemplate(contentTemplate),
          tags: {
            connectOrCreate: tags.map((name) => ({
              where: { userId_name: { userId, name } },
              create: { userId, name },
            })),
          },
        },
      });
      return { noteId: note.id };
    }

    case "CREATE_SCENARIO": {
      const { title, description, steps } = createScenarioConfigSchema.parse(rawConfig);
      const scenario = await prisma.scenario.create({
        data: {
          userId,
          title: renderTemplate(title),
          description,
          status: "ACTIVE",
          steps: { create: steps.map((stepTitle, index) => ({ title: stepTitle, position: index + 1 })) },
        },
      });
      return { scenarioId: scenario.id, steps: steps.length };
    }

    case "WEBHOOK": {
      const { url, method, payload } = webhookConfigSchema.parse(rawConfig);
      const response = await fetch(url, {
        method,
        headers: method === "POST" ? { "content-type": "application/json" } : undefined,
        body: method === "POST" ? JSON.stringify(payload ?? {}) : undefined,
        signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
        redirect: "error", // don't follow redirects into places the URL check never saw
      });
      return { status: response.status, ok: response.ok };
    }
  }
}
