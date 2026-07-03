"use server";

import { revalidatePath } from "next/cache";

import { type ActionResult } from "@/lib/action-result";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/security/guards";
import { ActionError, runAction } from "@/lib/server/actions";
import {
  createNoteSchema,
  listNotesSchema,
  noteIdSchema,
  updateNoteSchema,
} from "@/lib/validation/notes";

export interface NoteListItem {
  id: string;
  title: string;
  excerpt: string;
  tags: string[];
  archivedAt: string | null;
  deletedAt: string | null;
  updatedAt: string;
}

export interface NoteDetail extends NoteListItem {
  content: string;
  createdAt: string;
}

function revalidateNotes() {
  revalidatePath("/[locale]/notes", "page");
}

export async function listNotes(input: unknown = {}): Promise<ActionResult<NoteListItem[]>> {
  return runAction("listNotes", async () => {
    const { userId } = await requireUser();
    const { query, tag, view } = listNotesSchema.parse(input);

    const notes = await prisma.note.findMany({
      where: {
        userId,
        deletedAt: view === "trash" ? { not: null } : null,
        archivedAt: view === "archived" ? { not: null } : view === "active" ? null : undefined,
        ...(query
          ? {
              OR: [
                { title: { contains: query, mode: "insensitive" } },
                { content: { contains: query, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(tag ? { tags: { some: { name: tag } } } : {}),
      },
      include: { tags: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });

    return notes.map((note) => ({
      id: note.id,
      title: note.title,
      excerpt: note.content.slice(0, 160),
      tags: note.tags.map((t) => t.name),
      archivedAt: note.archivedAt?.toISOString() ?? null,
      deletedAt: note.deletedAt?.toISOString() ?? null,
      updatedAt: note.updatedAt.toISOString(),
    }));
  });
}

export async function getNote(input: unknown): Promise<ActionResult<NoteDetail>> {
  return runAction("getNote", async () => {
    const { userId } = await requireUser();
    const { id } = noteIdSchema.parse(input);

    // Ownership filter in the query itself — unknown ids and foreign ids are
    // indistinguishable (both NOT_FOUND), so ids cannot be probed.
    const note = await prisma.note.findFirst({
      where: { id, userId },
      include: { tags: { select: { name: true } } },
    });
    if (!note) {
      throw new ActionError("NOT_FOUND");
    }
    return {
      id: note.id,
      title: note.title,
      content: note.content,
      excerpt: note.content.slice(0, 160),
      tags: note.tags.map((t) => t.name),
      archivedAt: note.archivedAt?.toISOString() ?? null,
      deletedAt: note.deletedAt?.toISOString() ?? null,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
    };
  });
}

export async function createNote(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction("createNote", async () => {
    const { userId } = await requireUser();
    const { title, content, tags } = createNoteSchema.parse(input);

    const note = await prisma.note.create({
      data: {
        userId,
        title,
        content,
        tags: {
          connectOrCreate: tags.map((name) => ({
            where: { userId_name: { userId, name } },
            create: { userId, name },
          })),
        },
      },
    });
    revalidateNotes();
    return { id: note.id };
  });
}

export async function updateNote(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction("updateNote", async () => {
    const { userId } = await requireUser();
    const { id, title, content, tags } = updateNoteSchema.parse(input);

    const existing = await prisma.note.findFirst({ where: { id, userId }, select: { id: true } });
    if (!existing) {
      throw new ActionError("NOT_FOUND");
    }

    await prisma.note.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(content !== undefined ? { content } : {}),
        ...(tags !== undefined
          ? {
              tags: {
                set: [],
                connectOrCreate: tags.map((name) => ({
                  where: { userId_name: { userId, name } },
                  create: { userId, name },
                })),
              },
            }
          : {}),
      },
    });
    revalidateNotes();
    return { id };
  });
}

export async function setNoteArchived(input: unknown, archived: boolean): Promise<ActionResult<null>> {
  return runAction("setNoteArchived", async () => {
    const { userId } = await requireUser();
    const { id } = noteIdSchema.parse(input);
    const updated = await prisma.note.updateMany({
      where: { id, userId, deletedAt: null },
      data: { archivedAt: archived ? new Date() : null },
    });
    if (updated.count === 0) {
      throw new ActionError("NOT_FOUND");
    }
    revalidateNotes();
    return null;
  });
}

/** Soft delete — the note moves to trash and can be restored. */
export async function trashNote(input: unknown): Promise<ActionResult<null>> {
  return runAction("trashNote", async () => {
    const { userId } = await requireUser();
    const { id } = noteIdSchema.parse(input);
    const updated = await prisma.note.updateMany({
      where: { id, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (updated.count === 0) {
      throw new ActionError("NOT_FOUND");
    }
    revalidateNotes();
    return null;
  });
}

export async function restoreNote(input: unknown): Promise<ActionResult<null>> {
  return runAction("restoreNote", async () => {
    const { userId } = await requireUser();
    const { id } = noteIdSchema.parse(input);
    const updated = await prisma.note.updateMany({
      where: { id, userId, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    if (updated.count === 0) {
      throw new ActionError("NOT_FOUND");
    }
    revalidateNotes();
    return null;
  });
}

export async function deleteNotePermanently(input: unknown): Promise<ActionResult<null>> {
  return runAction("deleteNotePermanently", async () => {
    const { userId } = await requireUser();
    const { id } = noteIdSchema.parse(input);
    // Only notes already in trash can be hard-deleted (two-step deletion).
    const deleted = await prisma.note.deleteMany({ where: { id, userId, deletedAt: { not: null } } });
    if (deleted.count === 0) {
      throw new ActionError("NOT_FOUND");
    }
    revalidateNotes();
    return null;
  });
}

export async function listNoteTags(): Promise<ActionResult<string[]>> {
  return runAction("listNoteTags", async () => {
    const { userId } = await requireUser();
    const tags = await prisma.noteTag.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      select: { name: true },
    });
    return tags.map((t) => t.name);
  });
}
