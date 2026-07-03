"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { ActionErrorCode } from "@/lib/action-result";
import { createAutomation } from "@/server/actions/automations";

type ActionType = "CREATE_NOTE" | "CREATE_SCENARIO" | "WEBHOOK";

interface AutomationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function AutomationFormDialog({ open, onOpenChange, onSaved }: AutomationFormDialogProps) {
  const t = useTranslations("automations");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [actionType, setActionType] = useState<ActionType>("CREATE_NOTE");
  // CREATE_NOTE
  const [titleTemplate, setTitleTemplate] = useState("");
  const [contentTemplate, setContentTemplate] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  // CREATE_SCENARIO
  const [scenarioTitle, setScenarioTitle] = useState("");
  const [stepsInput, setStepsInput] = useState("");
  // WEBHOOK
  const [webhookUrl, setWebhookUrl] = useState("");
  const [payloadInput, setPayloadInput] = useState("");

  const [error, setError] = useState<string | null>(null);

  function buildConfig(): unknown | { invalidJson: true } {
    switch (actionType) {
      case "CREATE_NOTE":
        return {
          titleTemplate,
          contentTemplate,
          tags: tagsInput.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 10),
        };
      case "CREATE_SCENARIO":
        return {
          title: scenarioTitle,
          description: "",
          steps: stepsInput.split("\n").map((step) => step.trim()).filter(Boolean),
        };
      case "WEBHOOK": {
        let payload: Record<string, unknown> | undefined;
        if (payloadInput.trim()) {
          try {
            payload = JSON.parse(payloadInput) as Record<string, unknown>;
          } catch {
            return { invalidJson: true };
          }
        }
        return { url: webhookUrl, method: "POST", payload };
      }
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const config = buildConfig();
    if (config && typeof config === "object" && "invalidJson" in config) {
      setError(t("invalidJson"));
      return;
    }
    startTransition(async () => {
      const result = await createAutomation({
        name,
        description,
        triggerType: "MANUAL",
        actionType,
        config,
      });
      if (!result.ok) {
        setError(result.message ?? tErrors(result.error as ActionErrorCode));
        return;
      }
      onOpenChange(false);
      resetForm();
      onSaved();
    });
  }

  function resetForm() {
    setName("");
    setDescription("");
    setTitleTemplate("");
    setContentTemplate("");
    setTagsInput("");
    setScenarioTitle("");
    setStepsInput("");
    setWebhookUrl("");
    setPayloadInput("");
    setError(null);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("form.createTitle")}</DialogTitle>
          <DialogDescription>{t("form.templateHint")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="automation-name">{t("form.nameLabel")}</Label>
              <Input
                id="automation-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t("form.namePlaceholder")}
                maxLength={120}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="automation-description">{t("form.descriptionLabel")}</Label>
              <Input
                id="automation-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={2000}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{t("form.actionLabel")}</Label>
            <Tabs value={actionType} onValueChange={(value) => setActionType(value as ActionType)}>
              <TabsList className="w-full">
                {(["CREATE_NOTE", "CREATE_SCENARIO", "WEBHOOK"] as const).map((action) => (
                  <TabsTrigger key={action} value={action} className="flex-1 text-xs">
                    {t(`actions.${action}`)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {actionType === "CREATE_NOTE" ? (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="config-title-template">{t("config.titleTemplate")}</Label>
                <Input
                  id="config-title-template"
                  value={titleTemplate}
                  onChange={(event) => setTitleTemplate(event.target.value)}
                  placeholder="Journal {{date}}"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="config-content-template">{t("config.contentTemplate")}</Label>
                <Textarea
                  id="config-content-template"
                  value={contentTemplate}
                  onChange={(event) => setContentTemplate(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="config-tags">{t("config.tags")}</Label>
                <Input id="config-tags" value={tagsInput} onChange={(event) => setTagsInput(event.target.value)} />
              </div>
            </>
          ) : null}

          {actionType === "CREATE_SCENARIO" ? (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="config-scenario-title">{t("config.scenarioTitle")}</Label>
                <Input
                  id="config-scenario-title"
                  value={scenarioTitle}
                  onChange={(event) => setScenarioTitle(event.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="config-steps">{t("config.steps")}</Label>
                <Textarea
                  id="config-steps"
                  value={stepsInput}
                  onChange={(event) => setStepsInput(event.target.value)}
                  className="min-h-28"
                  required
                />
              </div>
            </>
          ) : null}

          {actionType === "WEBHOOK" ? (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="config-url">{t("config.url")}</Label>
                <Input
                  id="config-url"
                  type="url"
                  value={webhookUrl}
                  onChange={(event) => setWebhookUrl(event.target.value)}
                  placeholder="https://example.com/hook"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="config-payload">{t("config.payload")}</Label>
                <Textarea
                  id="config-payload"
                  value={payloadInput}
                  onChange={(event) => setPayloadInput(event.target.value)}
                  placeholder='{"message": "hello"}'
                  className="font-mono text-xs"
                />
              </div>
            </>
          ) : null}

          {error ? <p className="text-sm text-danger">{error}</p> : null}

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" loading={isPending} disabled={name.trim().length === 0}>
              {tCommon("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
