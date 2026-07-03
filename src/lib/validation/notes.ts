import { z } from "zod";

export const noteTagSchema = z
  .string()
  .trim()
  .min(1)
  .max(30)
  .regex(/^[\p{L}\p{N}][\p{L}\p{N}\s_-]*$/u, "Invalid tag format");

export const createNoteSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().max(100_000).default(""),
  tags: z.array(noteTagSchema).max(10).default([]),
});

export const updateNoteSchema = createNoteSchema.partial().extend({
  id: z.cuid(),
});

export const noteIdSchema = z.object({ id: z.cuid() });

export const listNotesSchema = z.object({
  query: z.string().trim().max(200).optional(),
  tag: noteTagSchema.optional(),
  view: z.enum(["active", "archived", "trash"]).default("active"),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
export type ListNotesInput = z.infer<typeof listNotesSchema>;
