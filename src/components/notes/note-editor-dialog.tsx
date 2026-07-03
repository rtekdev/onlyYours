"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import type { ActionErrorCode } from "@/lib/action-result";
import { createNote, getNote, updateNote, type NoteDetail } from "@/server/actions/notes";

interface NoteEditorDialogProps {
  /** null → create mode */
  noteId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NoteEditorDialog({ noteId, open, onOpenChange }: NoteEditorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {open ? (
          // Keyed mount per note/open cycle: state resets by construction.
          <NoteEditorLoader key={noteId ?? "new"} noteId={noteId} onClose={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function NoteEditorLoader({ noteId, onClose }: { noteId: string | null; onClose: () => void }) {
  const t = useTranslations("notes.editor");
  const tErrors = useTranslations("errors");

  const [note, setNote] = useState<NoteDetail | null>(null);
  const [loadError, setLoadError] = useState<ActionErrorCode | null>(null);
  const loading = noteId !== null && note === null && loadError === null;

  useEffect(() => {
    if (!noteId) return;
    let cancelled = false;
    // setState happens in the async callback (external system sync), which
    // keeps this effect free of synchronous state updates.
    getNote({ id: noteId }).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setNote(result.data);
      } else {
        setLoadError(result.error);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [noteId]);

  return (
    <>
      <DialogHeader>
        <DialogTitle>{noteId ? t("editTitle") : t("createTitle")}</DialogTitle>
        <DialogDescription className="sr-only">{noteId ? t("editTitle") : t("createTitle")}</DialogDescription>
      </DialogHeader>

      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-9 w-2/3" />
        </div>
      ) : loadError ? (
        <p className="text-sm text-danger">{tErrors(loadError)}</p>
      ) : (
        <NoteEditorForm noteId={noteId} initial={note} onClose={onClose} />
      )}
    </>
  );
}

function NoteEditorForm({
  noteId,
  initial,
  onClose,
}: {
  noteId: string | null;
  initial: NoteDetail | null;
  onClose: () => void;
}) {
  const t = useTranslations("notes.editor");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [tagsInput, setTagsInput] = useState(initial?.tags.join(", ") ?? "");
  const [error, setError] = useState<ActionErrorCode | null>(null);

  function parseTags(raw: string): string[] {
    return [...new Set(raw.split(",").map((tag) => tag.trim()).filter(Boolean))].slice(0, 10);
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const payload = { title, content, tags: parseTags(tagsInput) };
      const result = noteId ? await updateNote({ id: noteId, ...payload }) : await createNote(payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="note-title">{t("titleLabel")}</Label>
        <Input
          id="note-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={t("titlePlaceholder")}
          maxLength={200}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="note-content">{t("contentLabel")}</Label>
        <Textarea
          id="note-content"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder={t("contentPlaceholder")}
          className="min-h-48 font-mono text-sm"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="note-tags">{t("tagsLabel")}</Label>
        <Input
          id="note-tags"
          value={tagsInput}
          onChange={(event) => setTagsInput(event.target.value)}
          placeholder={t("tagsPlaceholder")}
        />
        <p className="text-xs text-muted">{t("tagsHint")}</p>
      </div>

      {error ? <p className="text-sm text-danger">{tErrors(error)}</p> : null}

      <DialogFooter>
        <Button variant="secondary" onClick={onClose}>
          {tCommon("cancel")}
        </Button>
        <Button onClick={handleSave} loading={isPending} disabled={title.trim().length === 0}>
          {tCommon("save")}
        </Button>
      </DialogFooter>
    </div>
  );
}
