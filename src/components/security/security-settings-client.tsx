"use client";

import { Check, Copy, Download, KeyRound, ShieldAlert, ShieldCheck } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { MfaSetupDialog } from "@/components/security/mfa-setup-dialog";
import { StepUpDialog } from "@/components/security/step-up-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "@/i18n/navigation";
import type { ActionErrorCode } from "@/lib/action-result";
import { regenerateBackupCodes, type SecurityOverview } from "@/server/actions/mfa";

export function SecuritySettingsClient({ overview }: { overview: SecurityOverview }) {
  const t = useTranslations("security");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const format = useFormatter();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [setupOpen, setSetupOpen] = useState(false);
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [newCodes, setNewCodes] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<ActionErrorCode | null>(null);

  function handleRegenerate() {
    setError(null);
    startTransition(async () => {
      const result = await regenerateBackupCodes();
      if (!result.ok) {
        // Regeneration demands fresh MFA — challenge, then retry.
        if (result.error === "MFA_REQUIRED") {
          setStepUpOpen(true);
        } else {
          setError(result.error);
        }
        return;
      }
      setNewCodes(result.data.backupCodes);
      router.refresh();
    });
  }

  async function copyCodes() {
    if (!newCodes) return;
    await navigator.clipboard.writeText(newCodes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadCodes() {
    if (!newCodes) return;
    const blob = new Blob([`Only Yours — backup codes\n\n${newCodes.join("\n")}\n`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "only-yours-backup-codes.txt";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="animate-card-enter">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {overview.mfaEnabled ? (
              <ShieldCheck className="size-5 text-success" aria-hidden />
            ) : (
              <ShieldAlert className="size-5 text-warning" aria-hidden />
            )}
            {t("mfa.title")}
          </CardTitle>
          <CardDescription>{t("mfa.description")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={overview.mfaEnabled ? "success" : "warning"}>
              {overview.mfaEnabled ? t("mfa.enabled") : t("mfa.disabled")}
            </Badge>
            {overview.mfaEnabledAt ? (
              <span className="text-xs text-muted">
                {t("mfa.enabledAt", { date: format.dateTime(new Date(overview.mfaEnabledAt), { dateStyle: "medium" }) })}
              </span>
            ) : null}
          </div>
          {overview.lockedUntil ? (
            <Alert variant="danger">
              <AlertDescription>{tErrors("MFA_LOCKED")}</AlertDescription>
            </Alert>
          ) : null}
          {!overview.mfaEnabled ? (
            <div>
              <Button onClick={() => setSetupOpen(true)}>{t("mfa.enableCta")}</Button>
            </div>
          ) : null}
          <div className="rounded-lg border border-border bg-surface p-3 text-sm text-muted">
            <p className="mb-1 font-medium text-muted-strong">{t("levels.title")}</p>
            <ul className="flex flex-col gap-0.5 text-xs">
              <li>1 · {t("levels.session")}</li>
              <li>2 · {t("levels.mfa")}</li>
              <li>3 · {t("levels.vault")}</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {overview.mfaEnabled ? (
        <Card className="animate-card-enter">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="size-5 text-primary" aria-hidden />
              {t("backupCodes.title")}
            </CardTitle>
            <CardDescription>{t("backupCodes.regenerateNote")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm">{t("backupCodes.remaining", { count: overview.backupCodesRemaining })}</p>
            {newCodes ? (
              <div className="flex flex-col gap-3">
                <Alert variant="warning">
                  <AlertTitle>{t("backupCodes.title")}</AlertTitle>
                  <AlertDescription>
                    <div className="mt-2 grid grid-cols-2 gap-1.5 font-mono text-sm text-foreground">
                      {newCodes.map((code) => (
                        <span key={code} className="select-all">
                          {code}
                        </span>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={copyCodes}>
                    {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
                    {copied ? tCommon("copied") : tCommon("copy")}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={downloadCodes}>
                    <Download aria-hidden />
                    {tCommon("download")}
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <Button variant="secondary" size="sm" onClick={handleRegenerate} loading={isPending}>
                  {t("backupCodes.regenerate")}
                </Button>
              </div>
            )}
            {error ? <p className="text-sm text-danger">{tErrors(error)}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      <Card className="animate-card-enter">
        <CardHeader>
          <CardTitle>{t("stepUp.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted">
            {overview.stepUpValidUntil
              ? t("stepUp.active", {
                  time: format.dateTime(new Date(overview.stepUpValidUntil), { timeStyle: "short" }),
                })
              : t("stepUp.none")}
          </p>
        </CardContent>
      </Card>

      <Card className="animate-card-enter">
        <CardHeader>
          <CardTitle>{t("events.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {overview.recentEvents.length === 0 ? (
            <p className="text-sm text-muted">{t("events.empty")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {overview.recentEvents.map((event) => (
                <li key={event.id} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 truncate">
                    {t.has(`events.types.${event.type}`) ? t(`events.types.${event.type}`) : event.type}
                  </span>
                  <span className="shrink-0 text-xs text-muted">
                    {format.dateTime(new Date(event.createdAt), { dateStyle: "short", timeStyle: "short" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <MfaSetupDialog open={setupOpen} onOpenChange={setSetupOpen} onCompleted={() => router.refresh()} />
      <StepUpDialog open={stepUpOpen} onOpenChange={setStepUpOpen} fresh onVerified={handleRegenerate} />
    </div>
  );
}
