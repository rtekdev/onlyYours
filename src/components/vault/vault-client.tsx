"use client";

// Vault orchestrator. All cryptography happens here (in the browser) via
// src/lib/crypto/vault.ts. The unlocked vault key (DEK) lives only in React
// state — it is never persisted, never sent anywhere, and is dropped on
// manual lock, auto-lock timeout or page unload.

import { Download, Lock, LockOpen, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";

import { MfaSetupDialog } from "@/components/security/mfa-setup-dialog";
import { StepUpDialog } from "@/components/security/step-up-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionErrorCode } from "@/lib/action-result";
import {
  createVaultKeyset,
  decryptVaultPayload,
  unlockVaultKey,
  VaultUnlockError,
  type VaultItemPayload,
} from "@/lib/crypto/vault";
import { VAULT_AUTOLOCK_SECONDS } from "@/lib/security/levels";
import {
  createVault,
  deleteVault,
  exportVault,
  getVaultData,
  type VaultData,
  type VaultStatus,
} from "@/server/actions/vault";
import { VaultItemDialog } from "./vault-item-dialog";
import { VaultItemRow } from "./vault-item-row";

const MIN_MASTER_PASSWORD_LENGTH = 12;

type Phase = "mfa-setup" | "step-up" | "create" | "unlock" | "unlocked";

function initialPhase(status: VaultStatus, data: VaultData | null): Phase {
  if (!status.mfaEnabled) return "mfa-setup";
  if (!status.mfaVerified || (status.hasVault && !data)) return "step-up";
  if (!status.hasVault) return "create";
  return "unlock";
}

export function VaultClient({
  initialStatus,
  initialData,
}: {
  initialStatus: VaultStatus;
  initialData: VaultData | null;
}) {
  const t = useTranslations("vault");
  const tErrors = useTranslations("errors");
  const tCommon = useTranslations("common");
  const [isPending, startTransition] = useTransition();

  const [phase, setPhase] = useState<Phase>(() => initialPhase(initialStatus, initialData));
  const [vaultData, setVaultData] = useState<VaultData | null>(initialData);
  const [dek, setDek] = useState<CryptoKey | null>(null);
  const [decrypted, setDecrypted] = useState<Map<string, VaultItemPayload>>(new Map());
  const [error, setError] = useState<ActionErrorCode | "WRONG_PASSWORD" | null>(null);

  const [mfaSetupOpen, setMfaSetupOpen] = useState(false);
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [freshStepUp, setFreshStepUp] = useState<null | "export" | "delete">(null);
  const [itemDialogItemId, setItemDialogItemId] = useState<string | null>(null);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [confirmDeleteVault, setConfirmDeleteVault] = useState(false);

  function lockVault() {
    // Dropping the CryptoKey reference is all we can do from JS; the key was
    // imported as non-extractable so no copy of the raw bytes exists here.
    setDek(null);
    setDecrypted(new Map());
    setPhase((current) => (current === "unlocked" ? "unlock" : current));
  }

  // Auto-lock after inactivity (resets on pointer/keyboard activity).
  useEffect(() => {
    if (phase !== "unlocked") return;
    let timer: ReturnType<typeof setTimeout>;
    const lock = () => {
      setDek(null);
      setDecrypted(new Map());
      setPhase("unlock");
    };
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(lock, VAULT_AUTOLOCK_SECONDS * 1000);
    };
    reset();
    window.addEventListener("pointerdown", reset);
    window.addEventListener("keydown", reset);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerdown", reset);
      window.removeEventListener("keydown", reset);
    };
  }, [phase]);

  /** Fetches encrypted vault data after MFA setup / step-up / creation. */
  function loadVaultData() {
    setError(null);
    startTransition(async () => {
      const result = await getVaultData();
      if (result.ok) {
        setVaultData(result.data);
        setPhase("unlock");
        return;
      }
      if (result.error === "NOT_FOUND") {
        setPhase("create");
      } else if (result.error === "MFA_SETUP_REQUIRED") {
        setPhase("mfa-setup");
      } else if (result.error === "MFA_REQUIRED") {
        setPhase("step-up");
      } else {
        setError(result.error);
      }
    });
  }

  async function decryptAll(key: CryptoKey, data: VaultData) {
    const entries = await Promise.all(
      data.items.map(async (item) => {
        const payload = await decryptVaultPayload(key, item);
        return [item.id, payload] as const;
      }),
    );
    setDecrypted(new Map(entries));
  }

  function handleCreateVault(masterPassword: string) {
    setError(null);
    startTransition(async () => {
      const { dek: newDek, wrapped } = await createVaultKeyset(masterPassword);
      const result = await createVault(wrapped);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const dataResult = await getVaultData();
      if (dataResult.ok) {
        setVaultData(dataResult.data);
        setDek(newDek);
        setDecrypted(new Map());
        setPhase("unlocked");
      }
    });
  }

  function handleUnlock(masterPassword: string) {
    if (!vaultData) return;
    setError(null);
    startTransition(async () => {
      try {
        const key = await unlockVaultKey(masterPassword, vaultData);
        await decryptAll(key, vaultData);
        setDek(key);
        setPhase("unlocked");
      } catch (unlockError) {
        setError(unlockError instanceof VaultUnlockError ? "WRONG_PASSWORD" : "INTERNAL");
      }
    });
  }

  function refreshItems() {
    startTransition(async () => {
      const result = await getVaultData();
      if (result.ok) {
        setVaultData(result.data);
        if (dek) {
          await decryptAll(dek, result.data);
        }
      }
    });
  }

  function handleExport() {
    setError(null);
    startTransition(async () => {
      const result = await exportVault();
      if (!result.ok) {
        if (result.error === "MFA_REQUIRED") {
          setFreshStepUp("export");
          setStepUpOpen(true);
        } else {
          setError(result.error);
        }
        return;
      }
      const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `only-yours-vault-${result.data.exportedAt.slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    });
  }

  function handleDeleteVault() {
    setError(null);
    startTransition(async () => {
      const result = await deleteVault();
      setConfirmDeleteVault(false);
      if (!result.ok) {
        if (result.error === "MFA_REQUIRED") {
          setFreshStepUp("delete");
          setStepUpOpen(true);
        } else {
          setError(result.error);
        }
        return;
      }
      lockVault();
      setVaultData(null);
      setPhase("create");
    });
  }

  // ---------------------------------------------------------------------

  if (phase === "mfa-setup") {
    return (
      <>
        <Card className="mx-auto max-w-lg animate-card-enter">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-warning" aria-hidden />
              {t("mfaSetupCard.title")}
            </CardTitle>
            <CardDescription>{t("mfaSetupCard.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setMfaSetupOpen(true)}>{t("mfaSetupCard.cta")}</Button>
          </CardContent>
        </Card>
        <MfaSetupDialog open={mfaSetupOpen} onOpenChange={setMfaSetupOpen} onCompleted={loadVaultData} />
      </>
    );
  }

  if (phase === "step-up") {
    return (
      <>
        <Card className="mx-auto max-w-lg animate-card-enter">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="size-5 text-primary" aria-hidden />
              {t("stepUpCard.title")}
            </CardTitle>
            <CardDescription>{t("stepUpCard.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setStepUpOpen(true)}>{t("stepUpCard.cta")}</Button>
          </CardContent>
        </Card>
        <StepUpDialog open={stepUpOpen} onOpenChange={setStepUpOpen} onVerified={loadVaultData} />
      </>
    );
  }

  if (phase === "create" || phase === "unlock") {
    return (
      <MasterPasswordForm
        mode={phase}
        pending={isPending}
        onSubmit={phase === "create" ? handleCreateVault : handleUnlock}
        errorText={error === "WRONG_PASSWORD" ? t("unlockCard.wrongPassword") : error ? tErrors(error) : null}
      />
    );
  }

  const items = vaultData?.items ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="success">
            <LockOpen className="size-3" aria-hidden />
            {t("unlocked")}
          </Badge>
          <span className="text-xs text-muted">{t("autoLockNote", { minutes: VAULT_AUTOLOCK_SECONDS / 60 })}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleExport} disabled={isPending}>
            <Download aria-hidden />
            {t("export.cta")}
          </Button>
          <Button variant="secondary" size="sm" onClick={lockVault}>
            <Lock aria-hidden />
            {t("lockNow")}
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setItemDialogItemId(null);
              setItemDialogOpen(true);
            }}
          >
            <Plus aria-hidden />
            {t("items.add")}
          </Button>
        </div>
      </div>

      {error && error !== "WRONG_PASSWORD" ? <p className="text-sm text-danger">{tErrors(error)}</p> : null}

      {items.length === 0 ? (
        <EmptyState icon={Lock} title={t("items.empty.title")} description={t("items.empty.description")} />
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <VaultItemRow
              key={item.id}
              item={item}
              payload={decrypted.get(item.id) ?? null}
              onEdit={() => {
                setItemDialogItemId(item.id);
                setItemDialogOpen(true);
              }}
              onDeleted={refreshItems}
            />
          ))}
        </div>
      )}

      <Alert variant="info" className="mt-2">
        <AlertTitle>{t("e2eNote.title")}</AlertTitle>
        <AlertDescription>{t("e2eNote.description")}</AlertDescription>
      </Alert>

      <Card className="border-danger/30">
        <CardHeader>
          <CardTitle className="text-sm text-danger">{t("danger.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" size="sm" onClick={() => setConfirmDeleteVault(true)}>
            <Trash2 aria-hidden />
            {t("danger.deleteCta")}
          </Button>
        </CardContent>
      </Card>

      {dek ? (
        <VaultItemDialog
          open={itemDialogOpen}
          onOpenChange={setItemDialogOpen}
          dek={dek}
          item={itemDialogItemId ? (items.find((i) => i.id === itemDialogItemId) ?? null) : null}
          payload={itemDialogItemId ? (decrypted.get(itemDialogItemId) ?? null) : null}
          onSaved={refreshItems}
        />
      ) : null}

      <StepUpDialog
        open={stepUpOpen}
        onOpenChange={setStepUpOpen}
        fresh
        onVerified={() => {
          if (freshStepUp === "export") handleExport();
          if (freshStepUp === "delete") handleDeleteVault();
          setFreshStepUp(null);
        }}
      />

      <Dialog open={confirmDeleteVault} onOpenChange={setConfirmDeleteVault}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("danger.confirmTitle")}</DialogTitle>
            <DialogDescription>{t("danger.confirmDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmDeleteVault(false)}>
              {tCommon("cancel")}
            </Button>
            <Button variant="destructive" loading={isPending} onClick={handleDeleteVault}>
              {t("danger.deleteCta")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- master password form (create / unlock) --------------------------------

function MasterPasswordForm({
  mode,
  pending,
  onSubmit,
  errorText,
}: {
  mode: "create" | "unlock";
  pending: boolean;
  onSubmit: (masterPassword: string) => void;
  errorText: string | null;
}) {
  const t = useTranslations("vault");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const card = mode === "create" ? "createCard" : "unlockCard";

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLocalError(null);
    if (mode === "create") {
      if (password.length < MIN_MASTER_PASSWORD_LENGTH) {
        setLocalError(t("createCard.tooShort"));
        return;
      }
      if (password !== confirm) {
        setLocalError(t("createCard.mismatch"));
        return;
      }
    }
    onSubmit(password);
  }

  return (
    <Card className="mx-auto max-w-lg animate-card-enter">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="size-5 text-primary" aria-hidden />
          {t(`${card}.title`)}
        </CardTitle>
        <CardDescription>{t(`${card}.description`)}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === "create" ? (
            <Alert variant="warning">
              <AlertDescription>{t("createCard.warning")}</AlertDescription>
            </Alert>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="master-password">{t(`${card}.passwordLabel`)}</Label>
            <Input
              id="master-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={mode === "create" ? t("createCard.passwordPlaceholder") : undefined}
              autoComplete={mode === "create" ? "new-password" : "current-password"}
              autoFocus
            />
          </div>
          {mode === "create" ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="master-password-confirm">{t("createCard.confirmLabel")}</Label>
              <Input
                id="master-password-confirm"
                type="password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                autoComplete="new-password"
              />
            </div>
          ) : null}
          {localError || errorText ? <p className="text-sm text-danger">{localError ?? errorText}</p> : null}
          <Button type="submit" loading={pending} disabled={password.length === 0}>
            {t(`${card}.cta`)}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
