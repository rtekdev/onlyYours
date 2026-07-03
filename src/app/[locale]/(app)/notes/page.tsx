import { getTranslations, setRequestLocale } from "next-intl/server";

import { NotesClient } from "@/components/notes/notes-client";
import { PageHeader } from "@/components/layout/page-header";
import { listNotes, listNoteTags } from "@/server/actions/notes";

export default async function NotesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; tag?: string; view?: string; open?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { q, tag, view, open } = await searchParams;
  const t = await getTranslations("notes");

  const activeView = view === "archived" || view === "trash" ? view : "active";
  const [notesResult, tagsResult] = await Promise.all([
    listNotes({ query: q || undefined, tag: tag || undefined, view: activeView }),
    listNoteTags(),
  ]);

  return (
    <>
      <PageHeader title={t("title")} />
      <NotesClient
        notes={notesResult.ok ? notesResult.data : []}
        tags={tagsResult.ok ? tagsResult.data : []}
        view={activeView}
        query={q ?? ""}
        activeTag={tag ?? null}
        openNoteId={open ?? null}
      />
    </>
  );
}
