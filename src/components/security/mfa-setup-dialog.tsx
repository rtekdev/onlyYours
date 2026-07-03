"use client";

import { Check, Copy, Download } from "lucide-react";
import { useTranslations } from "next-intl";
import QRCode from "qrcode";
import { useEffect, useState, useTransition } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import type { ActionErrorCode } from "@/lib/action-result";
import { confirmMfaSetup, startMfaSetup, type MfaSetupData } from "@/server/actions/mfa";

interface MfaSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after the user confirms they saved their backup codes. */
  onCompleted?: () => void;
}

export function MfaSetupDialog({ open, onOpenChange, onCompleted }: MfaSetupDialogProps) {
  const [backupPhase, setBackupPhase] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // While backup codes are on screen, closing must be an explicit choice.
        if (!next && backupPhase) return;
        onOpenChange(next);
      }}
    >
      <DialogContent>
        {open ? (
          <MfaSetupFlow
            onPhaseChange={setBackupPhase}
            onCancel={() => onOpenChange(false)}
            onCompleted={() => {
              onOpenChange(false);
              onCompleted?.();
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function MfaSetupFlow({
  onPhaseChange,
  onCancel,
  onCompleted,
}: {
  onPhaseChange: (backupPhase: boolean) => void;
  onCancel: () => void;
  onCompleted: () => void;
}) {
  const t = useTranslations("mfa");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const [isPending, startTransition] = useTransition();

  const [setup, setSetup] = useState<(MfaSetupData & { qrDataUrl: string }) | null>(null);
  const [startError, setStartError] = useState<ActionErrorCode | null>(null);
  const [code, setCode] = useState("");
  const [verifyError, setVerifyError] = useState<ActionErrorCode | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);

  // Kick off setup once on mount (the component mounts when the dialog
  // opens). All state updates happen in the async callback.
  useEffect(() => {
    let cancelled = false;
    startMfaSetup().then(async (result) => {
      if (cancelled) return;
      if (!result.ok) {
        setStartError(result.error);
        return;
      }
      // QR rendered locally from the otpauth URL — it never leaves the page.
      const qrDataUrl = await QRCode.toDataURL(result.data.otpauthUrl, { margin: 1, width: 220 });
      if (!cancelled) {
        setSetup({ ...result.data, qrDataUrl });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleVerify(event: React.FormEvent) {
    event.preventDefault();
    setVerifyError(null);
    startTransition(async () => {
      const result = await confirmMfaSetup({ code });
      if (!result.ok) {
        setVerifyError(result.error);
        return;
      }
      setBackupCodes(result.data.backupCodes);
      onPhaseChange(true);
    });
  }

  async function copyBackupCodes() {
    if (!backupCodes) return;
    await navigator.clipboard.writeText(backupCodes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadBackupCodes() {
    if (!backupCodes) return;
    const blob = new Blob([`Only Yours — backup codes\n\n${backupCodes.join("\n")}\n`], {
      type: "text/plain",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "only-yours-backup-codes.txt";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("setup.title")}</DialogTitle>
        <DialogDescription>
          {backupCodes ? t("setup.backupCodes.description") : t("setup.intro")}
        </DialogDescription>
      </DialogHeader>

      {startError ? (
        <Alert variant="danger">
          <AlertDescription>{tErrors(startError)}</AlertDescription>
        </Alert>
      ) : backupCodes ? (
        <div className="flex flex-col gap-4">
          <Alert variant="warning">
            <AlertTitle>{t("setup.backupCodes.title")}</AlertTitle>
            <AlertDescription>{t("setup.backupCodes.description")}</AlertDescription>
          </Alert>
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-surface p-4 font-mono text-sm">
            {backupCodes.map((backupCode) => (
              <span key={backupCode} className="select-all">
                {backupCode}
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={copyBackupCodes}>
              {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
              {copied ? tCommon("copied") : tCommon("copy")}
            </Button>
            <Button variant="secondary" size="sm" onClick={downloadBackupCodes}>
              <Download aria-hidden />
              {tCommon("download")}
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={onCompleted}>{t("setup.backupCodes.confirm")}</Button>
          </DialogFooter>
        </div>
      ) : setup === null ? (
        <div className="flex flex-col items-center gap-4 py-4">
          <Skeleton className="size-[220px]" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : (
        <form onSubmit={handleVerify} className="flex flex-col gap-4">
          <div className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- locally generated data URL */}
            <img src={setup.qrDataUrl} alt="TOTP QR" className="rounded-lg border border-border bg-white p-2" />
          </div>
          <div className="text-center">
            <p className="text-xs text-muted">{t("setup.manualEntry")}</p>
            <code className="mt-1 inline-block select-all break-all rounded-md bg-surface px-2 py-1 font-mono text-xs">
              {setup.secret}
            </code>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mfa-code">{t("setup.codeLabel")}</Label>
            <Input
              id="mfa-code"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder={t("setup.codePlaceholder")}
              inputMode="numeric"
              autoComplete="one-time-code"
              className="text-center font-mono text-lg tracking-[0.4em]"
            />
          </div>
          {verifyError ? (
            <p className="text-sm text-danger">
              {verifyError === "INVALID_CODE"
                ? t("errors.invalidCode")
                : verifyError === "MFA_LOCKED"
                  ? t("errors.locked")
                  : tErrors(verifyError)}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onCancel}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" loading={isPending} disabled={code.length !== 6}>
              {t("setup.verify")}
            </Button>
          </DialogFooter>
        </form>
      )}
    </>
  );
}
