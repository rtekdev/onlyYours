"use client";

import { ArrowLeft, Check, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Link, useRouter } from "@/i18n/navigation";
import type { ActionErrorCode } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import {
  addScenarioStep,
  deleteScenarioStep,
  updateScenario,
  updateScenarioStep,
  type ScenarioDetail,
} from "@/server/actions/scenarios";

const statusVariant = { DRAFT: "default", ACTIVE: "primary", ARCHIVED: "warning" } as const;
const STATUS_ACTIONS = [
  { status: "ACTIVE", labelKey: "setActive" },
  { status: "ARCHIVED", labelKey: "setArchived" },
  { status: "DRAFT", labelKey: "setDraft" },
] as const;

export function ScenarioDetailClient({ scenario }: { scenario: ScenarioDetail }) {
  const t = useTranslations("scenarios");
  const tErrors = useTranslations("errors");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [newStepTitle, setNewStepTitle] = useState("");
  const [error, setError] = useState<ActionErrorCode | null>(null);

  const completed = scenario.steps.filter((step) => step.completedAt !== null).length;

  function mutate(fn: () => Promise<{ ok: boolean; error?: ActionErrorCode }>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok && result.error) {
        setError(result.error);
      }
      router.refresh();
    });
  }

  function handleAddStep(event: React.FormEvent) {
    event.preventDefault();
    const title = newStepTitle.trim();
    if (!title) return;
    setNewStepTitle("");
    mutate(() => addScenarioStep({ scenarioId: scenario.id, title, note: "" }));
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          href="/scenarios"
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t("title")}
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{scenario.title}</h1>
            {scenario.description ? <p className="mt-1 max-w-2xl text-sm text-muted">{scenario.description}</p> : null}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={statusVariant[scenario.status]}>{t(`status.${scenario.status}`)}</Badge>
            {STATUS_ACTIONS.filter(({ status }) => status !== scenario.status).map(({ status, labelKey }) => (
              <Button
                key={status}
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={() => mutate(() => updateScenario({ id: scenario.id, status }))}
              >
                {t(`actions.${labelKey}`)}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {error ? <p className="text-sm text-danger">{tErrors(error)}</p> : null}

      <Card className="animate-card-enter">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>{t("steps.title")}</CardTitle>
          <span className="text-sm text-muted">
            {t("steps.progress", { completed, total: scenario.steps.length })}
          </span>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          {scenario.steps.length === 0 ? (
            <p className="py-4 text-sm text-muted">{t("steps.empty")}</p>
          ) : (
            <ul className="flex flex-col">
              {scenario.steps.map((step) => {
                const done = step.completedAt !== null;
                return (
                  <li
                    key={step.id}
                    className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface-hover"
                  >
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => mutate(() => updateScenarioStep({ stepId: step.id, completed: !done }))}
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                        done
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border-strong hover:border-primary",
                      )}
                      aria-pressed={done}
                      aria-label={step.title}
                    >
                      {done ? <Check className="size-3.5" aria-hidden /> : null}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-sm", done && "text-muted line-through")}>{step.title}</p>
                      {step.note ? <p className="text-xs text-muted">{step.note}</p> : null}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                      disabled={isPending}
                      onClick={() => mutate(() => deleteScenarioStep({ stepId: step.id }))}
                      aria-label={t("actions.delete")}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}

          <form onSubmit={handleAddStep} className="mt-2 flex items-center gap-2">
            <Input
              value={newStepTitle}
              onChange={(event) => setNewStepTitle(event.target.value)}
              placeholder={t("steps.stepTitlePlaceholder")}
              maxLength={300}
            />
            <Button type="submit" size="sm" variant="secondary" disabled={newStepTitle.trim().length === 0}>
              <Plus aria-hidden />
              {t("steps.addStep")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
