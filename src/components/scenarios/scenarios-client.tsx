"use client";

import { Copy, ListChecks, MoreVertical, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Link, useRouter } from "@/i18n/navigation";
import type { ActionErrorCode } from "@/lib/action-result";
import {
  createScenario,
  deleteScenario,
  duplicateScenario,
  type ScenarioListItem,
} from "@/server/actions/scenarios";

const statusVariant = { DRAFT: "default", ACTIVE: "primary", ARCHIVED: "warning" } as const;

export function ScenariosClient({ scenarios }: { scenarios: ScenarioListItem[] }) {
  const t = useTranslations("scenarios");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<ActionErrorCode | null>(null);

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const result = await createScenario({ title, description });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCreateOpen(false);
      setTitle("");
      setDescription("");
      router.push(`/scenarios/${result.data.id}`);
    });
  }

  function handleDuplicate(id: string) {
    startTransition(async () => {
      const result = await duplicateScenario({ id });
      if (result.ok) {
        router.push(`/scenarios/${result.data.id}`);
      } else {
        setError(result.error);
      }
    });
  }

  function handleDelete() {
    if (!confirmDeleteId) return;
    startTransition(async () => {
      const result = await deleteScenario({ id: confirmDeleteId });
      setConfirmDeleteId(null);
      if (!result.ok) {
        setError(result.error);
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus aria-hidden />
          {t("newScenario")}
        </Button>
      </div>

      {error ? <p className="text-sm text-danger">{tErrors(error)}</p> : null}

      {scenarios.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title={t("empty.title")}
          description={t("empty.description")}
          action={
            <Button size="sm" variant="secondary" onClick={() => setCreateOpen(true)}>
              {t("empty.cta")}
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {scenarios.map((scenario) => (
            <Card key={scenario.id} className="animate-card-enter group transition-colors hover:bg-surface-hover">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/scenarios/${scenario.id}`} className="min-w-0 flex-1">
                    <h3 className="truncate font-medium">{scenario.title}</h3>
                    {scenario.description ? (
                      <p className="mt-1 line-clamp-2 text-sm text-muted">{scenario.description}</p>
                    ) : null}
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="-mr-1 -mt-1 size-7 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                        aria-label={tCommon("openMenu")}
                      >
                        <MoreVertical aria-hidden />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => handleDuplicate(scenario.id)}>
                        <Copy aria-hidden /> {t("actions.duplicate")}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-danger data-[highlighted]:text-danger"
                        onSelect={() => setConfirmDeleteId(scenario.id)}
                      >
                        <Trash2 aria-hidden /> {t("actions.delete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <Badge variant={statusVariant[scenario.status]}>{t(`status.${scenario.status}`)}</Badge>
                  <span className="text-xs text-muted">
                    {t("steps.progress", { completed: scenario.completedCount, total: scenario.stepCount })}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("form.createTitle")}</DialogTitle>
            <DialogDescription className="sr-only">{t("form.createTitle")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="scenario-title">{t("form.titleLabel")}</Label>
              <Input
                id="scenario-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t("form.titlePlaceholder")}
                maxLength={200}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="scenario-description">{t("form.descriptionLabel")}</Label>
              <Textarea
                id="scenario-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={t("form.descriptionPlaceholder")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button onClick={handleCreate} loading={isPending} disabled={title.trim().length === 0}>
              {tCommon("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <Button variant="destructive" loading={isPending} onClick={handleDelete}>
              {tCommon("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
