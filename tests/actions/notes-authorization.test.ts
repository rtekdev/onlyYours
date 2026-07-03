// Ownership/authorization behaviour of a representative server action module.
// Prisma and auth are mocked; what we assert is that every query carries the
// ownership filter and that foreign ids surface as NOT_FOUND (no IDOR).

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  noteFindFirst: vi.fn(),
  noteUpdateMany: vi.fn(),
  noteDeleteMany: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    note: {
      findFirst: mocks.noteFindFirst,
      updateMany: mocks.noteUpdateMany,
      deleteMany: mocks.noteDeleteMany,
    },
  },
}));

import { deleteNotePermanently, getNote, trashNote } from "@/server/actions/notes";

const NOTE_ID = "c123456789012345678901234";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "owner-1", email: "o@example.com" }, sid: "sid-1" });
});

describe("notes authorization", () => {
  it("returns UNAUTHENTICATED without a session instead of touching the DB", async () => {
    mocks.auth.mockResolvedValue(null);
    const result = await getNote({ id: NOTE_ID });
    expect(result).toEqual({ ok: false, error: "UNAUTHENTICATED", message: undefined });
    expect(mocks.noteFindFirst).not.toHaveBeenCalled();
  });

  it("scopes reads to the owner and maps misses to NOT_FOUND", async () => {
    mocks.noteFindFirst.mockResolvedValue(null); // foreign or unknown id
    const result = await getNote({ id: NOTE_ID });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("NOT_FOUND");
    expect(mocks.noteFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: NOTE_ID, userId: "owner-1" }) }),
    );
  });

  it("soft-deletes only rows matching id + owner", async () => {
    mocks.noteUpdateMany.mockResolvedValue({ count: 0 }); // someone else's note
    const result = await trashNote({ id: NOTE_ID });

    expect(result).toMatchObject({ ok: false, error: "NOT_FOUND" });
    expect(mocks.noteUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: NOTE_ID, userId: "owner-1", deletedAt: null }),
      }),
    );
  });

  it("hard-deletes only notes that are already in trash", async () => {
    mocks.noteDeleteMany.mockResolvedValue({ count: 1 });
    const result = await deleteNotePermanently({ id: NOTE_ID });

    expect(result.ok).toBe(true);
    expect(mocks.noteDeleteMany).toHaveBeenCalledWith({
      where: { id: NOTE_ID, userId: "owner-1", deletedAt: { not: null } },
    });
  });

  it("rejects malformed ids at the validation layer", async () => {
    const result = await getNote({ id: "not-a-cuid" });
    expect(result).toMatchObject({ ok: false, error: "VALIDATION" });
    expect(mocks.noteFindFirst).not.toHaveBeenCalled();
  });
});
