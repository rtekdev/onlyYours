"use client";

import { Archive, ArchiveRestore, MoreVertical, Plus, RotateCcw, Search, StickyNote, Trash2, X } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { NoteEditorDialog } from "@/components/notes/note-editor-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { ActionErrorCode } from "@/lib/action-result";
import {
  deleteNotePermanently,
  restoreNote,
  setNoteArchived,
  trashNote,
  type NoteListItem,
} from "@/server/actions/notes";

type NotesView = "active" | "archived" | "trash";

interface NotesClientProps {
  notes: NoteListItem[];
  tags: string[];
  view: NotesView;
  query: string;
  activeTag: string | null;
  openNoteId: string | null;
}

export function NotesClient({ notes, tags, view, query, activeTag, openNoteId }: NotesClientProps) {
  const t = useTranslations("notes");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const format = useFormatter();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const [editorNoteId, setEditorNoteId] = useState<string | null>(openNoteId);
  const [editorOpen, setEditorOpen] = useState(openNoteId !== null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<ActionErrorCode | null>(null);

  // Deep link support (dashboard "recent notes" → /notes?open=<id>) for
  // client-side navigations — the "adjust state during render" pattern.
  const [lastOpenNoteId, setLastOpenNoteId] = useState(openNoteId);
  if (openNoteId !== lastOpenNoteId) {
    setLastOpenNoteId(openNoteId);
    if (openNoteId) {
      setEditorNoteId(openNoteId);
      setEditorOpen(true);
    }
  }

  function updateParams(next: { q?: string; tag?: string | null; view?: NotesView }) {
    const params = new URLSearchParams();
    const nextQuery = next.q ?? query;
    const nextTag = next.tag === undefined ? activeTag : next.tag;
    const nextView = next.view ?? view;
    if (nextQuery) params.set("q", nextQuery);
    if (nextTag) params.set("tag", nextTag);
    if (nextView !== "active") params.set("view", nextView);
    router.replace(`${pathname}?${params.toString()}`);
  }

  function runMutation(fn: () => Promise<{ ok: boolean; error?: ActionErrorCode }>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok && result.error) {
        setError(result.error);
      }
      router.refresh();
    });
  }

  const views: NotesView[] = ["active", "archived", "trash"];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form
          className="relative w-full sm:max-w-xs"
          onSubmit={(event) => {
            event.preventDefault();
            const value = new FormData(event.currentTarget).get("q");
            updateParams({ q: typeof value === "string" ? value : "" });
          }}
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input
            name="q"
            defaultValue={query}
            placeholder={t("searchPlaceholder")}
            className="pl-9"
            aria-label={tCommon("search")}
          />
        </form>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border bg-surface p-0.5">
            {views.map((candidate) => (
              <button
                key={candidate}
                type="button"
                onClick={() => updateParams({ view: candidate })}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  view === candidate ? "bg-surface-hover text-foreground" : "text-muted hover:text-foreground"
                }`}
              >
                {t(`filters.${candidate}`)}
              </button>
            ))}
          </div>
          <Button
            size="sm"
            onClick={() => {
              setEditorNoteId(null);
              setEditorOpen(true);
            }}
          >
            <Plus aria-hidden />
            {t("newNote")}
          </Button>
        </div>
      </div>

      {tags.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {activeTag ? (
            <button type="button" onClick={() => updateParams({ tag: null })} aria-label={tCommon("close")}>
              <Badge variant="primary">
                {activeTag} <X className="size-3" aria-hidden />
              </Badge>
            </button>
          ) : null}
          {tags
            .filter((tag) => tag !== activeTag)
            .map((tag) => (
              <button key={tag} type="button" onClick={() => updateParams({ tag })}>
                <Badge className="cursor-pointer transition-colors hover:bg-surface-hover">{tag}</Badge>
              </button>
            ))}
        </div>
      ) : null}

      {error ? <p className="text-sm text-danger">{tErrors(error)}</p> : null}

      {notes.length === 0 ? (
        <EmptyState
          icon={StickyNote}
          title={query || activeTag ? t("emptyFiltered") : view === "trash" ? t("emptyTrash") : view === "archived" ? t("emptyArchived") : t("empty.title")}
          description={!query && !activeTag && view === "active" ? t("empty.description") : undefined}
          action={
            !query && !activeTag && view === "active" ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setEditorNoteId(null);
                  setEditorOpen(true);
                }}
              >
                {t("empty.cta")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((note) => (
            <Card
              key={note.id}
              className="animate-card-enter group relative cursor-pointer transition-colors hover:bg-surface-hover"
              onClick={() => {
                setEditorNoteId(note.id);
                setEditorOpen(true);
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="min-w-0 truncate font-medium">{note.title}</h3>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="-mr-1 -mt-1 size-7 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                        aria-label={tCommon("openMenu")}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <MoreVertical aria-hidden />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
                      {view === "active" ? (
                        <>
                          <DropdownMenuItem onSelect={() => runMutation(() => setNoteArchived({ id: note.id }, true))}>
                            <Archive aria-hidden /> {t("actions.archive")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => runMutation(() => trashNote({ id: note.id }))}>
                            <Trash2 aria-hidden /> {t("actions.trash")}
                          </DropdownMenuItem>
                        </>
                      ) : null}
                      {view === "archived" ? (
                        <>
                          <DropdownMenuItem onSelect={() => runMutation(() => setNoteArchived({ id: note.id }, false))}>
                            <ArchiveRestore aria-hidden /> {t("actions.unarchive")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => runMutation(() => trashNote({ id: note.id }))}>
                            <Trash2 aria-hidden /> {t("actions.trash")}
                          </DropdownMenuItem>
                        </>
                      ) : null}
                      {view === "trash" ? (
                        <>
                          <DropdownMenuItem onSelect={() => runMutation(() => restoreNote({ id: note.id }))}>
                            <RotateCcw aria-hidden /> {t("actions.restore")}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-danger data-[highlighted]:text-danger"
                            onSelect={() => setConfirmDeleteId(note.id)}
                          >
                            <Trash2 aria-hidden /> {t("actions.deletePermanently")}
                          </DropdownMenuItem>
                        </>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {note.excerpt ? (
                  <p className="mt-1.5 line-clamp-3 text-sm text-muted">{note.excerpt}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {note.tags.map((tag) => (
                    <Badge key={tag}>{tag}</Badge>
                  ))}
                  <span className="ml-auto text-xs text-muted">
                    {t("updated", { date: format.relativeTime(new Date(note.updatedAt)) })}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <NoteEditorDialog
        noteId={editorNoteId}
        open={editorOpen}
        onOpenChange={(open) => {
          setEditorOpen(open);
          if (!open) setEditorNoteId(null);
        }}
      />

      <Dialog open={confirmDeleteId !== null} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("confirmDelete.title")}</DialogTitle>
            <DialogDescription>{t("confirmDelete.description")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmDeleteId(null)}>
              {tCommon("cancel")}
            </Button>
            <Button
              variant="destructive"
              loading={isPending}
              onClick={() => {
                if (confirmDeleteId) {
                  runMutation(() => deleteNotePermanently({ id: confirmDeleteId }));
                  setConfirmDeleteId(null);
                }
              }}
            >
              {t("actions.deletePermanently")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
