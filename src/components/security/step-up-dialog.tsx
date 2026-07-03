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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ActionErrorCode } from "@/lib/action-result";
import { verifyMfaStepUp } from "@/server/actions/mfa";

interface StepUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: () => void;
  /** Set for destructive actions that demand a fresh verification. */
  fresh?: boolean;
}

/** MFA step-up challenge: TOTP code or a one-time backup code. */
export function StepUpDialog({ open, onOpenChange, onVerified, fresh }: StepUpDialogProps) {
  const t = useTranslations("mfa.stepUp");
  const tMfaErrors = useTranslations("mfa.errors");
  const tErrors = useTranslations("errors");
  const tCommon = useTranslations("common");
  const [isPending, startTransition] = useTransition();

  const [method, setMethod] = useState<"totp" | "backup">("totp");
  const [code, setCode] = useState("");
  const [error, setError] = useState<ActionErrorCode | null>(null);

  function handleVerify(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await verifyMfaStepUp({ code, method });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCode("");
      onOpenChange(false);
      onVerified();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{fresh ? t("freshDescription") : t("description")}</DialogDescription>
        </DialogHeader>

        <Tabs value={method} onValueChange={(value) => setMethod(value as "totp" | "backup")}>
          <TabsList className="w-full">
            <TabsTrigger value="totp" className="flex-1">
              {t("totpTab")}
            </TabsTrigger>
            <TabsTrigger value="backup" className="flex-1">
              {t("backupTab")}
            </TabsTrigger>
          </TabsList>

          <form onSubmit={handleVerify} className="flex flex-col gap-4">
            <TabsContent value="totp" className="m-0">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="stepup-totp">{t("codeLabel")}</Label>
                <Input
                  id="stepup-totp"
                  value={method === "totp" ? code : ""}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  className="text-center font-mono text-lg tracking-[0.4em]"
                />
              </div>
            </TabsContent>
            <TabsContent value="backup" className="m-0">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="stepup-backup">{t("backupCodeLabel")}</Label>
                <Input
                  id="stepup-backup"
                  value={method === "backup" ? code : ""}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  placeholder={t("backupCodePlaceholder")}
                  autoComplete="off"
                  className="text-center font-mono"
                />
              </div>
            </TabsContent>

            {error ? (
              <p className="text-sm text-danger">
                {error === "INVALID_CODE"
                  ? tMfaErrors("invalidCode")
                  : error === "MFA_LOCKED"
                    ? tMfaErrors("locked")
                    : tErrors(error)}
              </p>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                {tCommon("cancel")}
              </Button>
              <Button
                type="submit"
                loading={isPending}
                disabled={method === "totp" ? code.length !== 6 : code.trim().length < 10}
              >
                {t("verify")}
              </Button>
            </DialogFooter>
          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
