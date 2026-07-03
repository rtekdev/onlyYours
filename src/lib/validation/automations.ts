import { z } from "zod";

import { noteTagSchema } from "./notes";

export const automationTriggerSchema = z.enum(["MANUAL", "SCHEDULE", "WEBHOOK"]);
export const automationActionSchema = z.enum(["CREATE_NOTE", "CREATE_SCENARIO", "WEBHOOK"]);

// Per-action config schemas. Config is stored as JSON and re-validated
// before every run — a stale or hand-edited config can never reach the
// executor unchecked.

export const createNoteConfigSchema = z.object({
  // Templates support {{date}} and {{time}} placeholders (see executor).
  titleTemplate: z.string().trim().min(1).max(200),
  contentTemplate: z.string().max(20_000).default(""),
  tags: z.array(noteTagSchema).max(10).default([]),
});

export const createScenarioConfigSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5_000).default(""),
  steps: z.array(z.string().trim().min(1).max(300)).min(1).max(50),
});

function assertPublicHttpsUrl(value: string, ctx: z.RefinementCtx) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    ctx.addIssue({ code: "custom", message: "Invalid URL" });
    return;
  }
  // Outbound webhooks are SSRF-sensitive: require HTTPS and reject obvious
  // internal targets. This is a best-effort guard for a self-hosted,
  // single-user app — see docs/security.md for the full threat model.
  if (url.protocol !== "https:") {
    ctx.addIssue({ code: "custom", message: "Webhook URLs must use https" });
    return;
  }
  const host = url.hostname.toLowerCase();
  const isPrivate =
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^169\.254\./.test(host) ||
    host === "::1" ||
    host === "[::1]" ||
    host === "0.0.0.0";
  if (isPrivate) {
    ctx.addIssue({ code: "custom", message: "Webhook URLs must not target private networks" });
  }
}

export const webhookConfigSchema = z.object({
  url: z.string().max(2_000).superRefine(assertPublicHttpsUrl),
  method: z.enum(["POST", "GET"]).default("POST"),
  payload: z.record(z.string(), z.unknown()).optional(),
});

const configSchemaByAction = {
  CREATE_NOTE: createNoteConfigSchema,
  CREATE_SCENARIO: createScenarioConfigSchema,
  WEBHOOK: webhookConfigSchema,
} as const;

export type AutomationActionType = z.infer<typeof automationActionSchema>;

export function parseAutomationConfig(actionType: AutomationActionType, config: unknown) {
  return configSchemaByAction[actionType].parse(config);
}

export const createAutomationSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(2_000).default(""),
  triggerType: automationTriggerSchema.default("MANUAL"),
  actionType: automationActionSchema,
  config: z.unknown(),
});

export const updateAutomationSchema = z.object({
  id: z.cuid(),
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(2_000).optional(),
  enabled: z.boolean().optional(),
});

export const automationIdSchema = z.object({ id: z.cuid() });
