"use client";

import { Play, Plus, Trash2, Workflow } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { AutomationFormDialog } from "@/components/automations/automation-form-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { EmptyState } from "@/components/ui/empty-state";
import { Switch } from "@/components/ui/switch";
import { useRouter } from "@/i18n/navigation";
import type { ActionErrorCode } from "@/lib/action-result";
import {
  deleteAutomation,
  runAutomation,
  updateAutomation,
  type AutomationListItem,
} from "@/server/actions/automations";

const runStatusVariant = { SUCCESS: "success", FAILED: "danger", RUNNING: "warning" } as const;

export function AutomationsClient({ automations }: { automations: AutomationListItem[] }) {
  const t = useTranslations("automations");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const format = useFormatter();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [formOpen, setFormOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [error, setError] = useState<ActionErrorCode | null>(null);

  function handleRun(id: string) {
    setError(null);
    setRunningId(id);
    startTransition(async () => {
      const result = await runAutomation({ id });
      setRunningId(null);
      if (!result.ok) {
        setError(result.error);
      }
      router.refresh();
    });
  }

  function handleToggle(id: string, enabled: boolean) {
    startTransition(async () => {
      await updateAutomation({ id, enabled });
      router.refresh();
    });
  }

  function handleDelete() {
    if (!confirmDeleteId) return;
    startTransition(async () => {
      await deleteAutomation({ id: confirmDeleteId });
      setConfirmDeleteId(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Alert variant="info">
        <AlertDescription>{t("triggerNote")}</AlertDescription>
      </Alert>

      <div className="flex justify-end">
        <Button size="sm" onClick={() => setFormOpen(true)}>
          <Plus aria-hidden />
          {t("new")}
        </Button>
      </div>

      {error ? <p className="text-sm text-danger">{tErrors(error)}</p> : null}

      {automations.length === 0 ? (
        <EmptyState
          icon={Workflow}
          title={t("empty.title")}
          description={t("empty.description")}
          action={
            <Button size="sm" variant="secondary" onClick={() => setFormOpen(true)}>
              {t("empty.cta")}
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {automations.map((automation) => (
            <Card key={automation.id} className="animate-card-enter">
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-medium">{automation.name}</h3>
                    <Badge>{t(`triggers.${automation.triggerType}`)}</Badge>
                    <Badge variant="primary">{t(`actions.${automation.actionType}`)}</Badge>
                  </div>
                  {automation.description ? (
                    <p className="mt-1 line-clamp-1 text-sm text-muted">{automation.description}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-muted">
                    {automation.lastRun ? (
                      <>
                        {t("lastRun", { date: format.relativeTime(new Date(automation.lastRun.startedAt)) })}{" "}
                        <Badge variant={runStatusVariant[automation.lastRun.status]} className="ml-1">
                          {t(`runStatus.${automation.lastRun.status}`)}
                        </Badge>
                      </>
                    ) : (
                      t("neverRun")
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Switch
                    checked={automation.enabled}
                    onCheckedChange={(checked) => handleToggle(automation.id, checked)}
                    aria-label={automation.enabled ? tCommon("enabled") : tCommon("disabled")}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!automation.enabled || isPending}
                    loading={runningId === automation.id}
                    onClick={() => handleRun(automation.id)}
                  >
                    <Play aria-hidden />
                    {t("run")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setConfirmDeleteId(automation.id)}
                    aria-label={tCommon("delete")}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AutomationFormDialog open={formOpen} onOpenChange={setFormOpen} onSaved={() => router.refresh()} />

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
