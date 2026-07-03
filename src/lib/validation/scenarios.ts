import { z } from "zod";

export const scenarioStatusSchema = z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]);

export const createScenarioSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5_000).default(""),
});

export const updateScenarioSchema = z.object({
  id: z.cuid(),
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(5_000).optional(),
  status: scenarioStatusSchema.optional(),
});

export const scenarioIdSchema = z.object({ id: z.cuid() });

export const addStepSchema = z.object({
  scenarioId: z.cuid(),
  title: z.string().trim().min(1).max(300),
  note: z.string().max(2_000).default(""),
});

export const updateStepSchema = z.object({
  stepId: z.cuid(),
  title: z.string().trim().min(1).max(300).optional(),
  note: z.string().max(2_000).optional(),
  completed: z.boolean().optional(),
});

export const stepIdSchema = z.object({ stepId: z.cuid() });

export type CreateScenarioInput = z.infer<typeof createScenarioSchema>;
export type UpdateScenarioInput = z.infer<typeof updateScenarioSchema>;
