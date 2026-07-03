"use client";

import { Eye, EyeOff, RefreshCw } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import type { ActionErrorCode } from "@/lib/action-result";
import { generatePassword } from "@/lib/crypto/password";
import { encryptVaultPayload, type VaultItemPayload } from "@/lib/crypto/vault";
import { createVaultItem, updateVaultItem, type VaultItemData } from "@/server/actions/vault";

interface VaultItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dek: CryptoKey;
  /** null → create mode */
  item: VaultItemData | null;
  payload: VaultItemPayload | null;
  onSaved: () => void;
}

export function VaultItemDialog({ open, onOpenChange, dek, item, payload, onSaved }: VaultItemDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open ? (
          // Keyed mount resets the form for each item/open cycle — no
          // state-sync effects needed.
          <VaultItemForm
            key={item?.id ?? "new"}
            dek={dek}
            item={item}
            payload={payload}
            onClose={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function VaultItemForm({
  dek,
  item,
  payload,
  onClose,
  onSaved,
}: {
  dek: CryptoKey;
  item: VaultItemData | null;
  payload: VaultItemPayload | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("vault.items");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState(item?.title ?? "");
  const [username, setUsername] = useState(payload?.username ?? "");
  const [url, setUrl] = useState(payload?.url ?? "");
  const [secret, setSecret] = useState(payload?.secret ?? "");
  const [notes, setNotes] = useState(payload?.notes ?? "");
  const [showSecret, setShowSecret] = useState(false);
  const [error, setError] = useState<ActionErrorCode | null>(null);

  function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      // Encrypt before anything leaves the component — the action receives
      // only { title, ciphertext, iv }.
      const encrypted = await encryptVaultPayload(dek, {
        username: username || undefined,
        url: url || undefined,
        secret,
        notes: notes || undefined,
      });
      const result = item
        ? await updateVaultItem({ id: item.id, title, ...encrypted })
        : await createVaultItem({ title, ...encrypted });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
      onSaved();
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{item ? t("editTitle") : t("addTitle")}</DialogTitle>
        <DialogDescription className="sr-only">{item ? t("editTitle") : t("addTitle")}</DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="vault-item-title">{t("titleLabel")}</Label>
          <Input
            id="vault-item-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t("titlePlaceholder")}
            maxLength={200}
            required
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="vault-item-username">{t("usernameLabel")}</Label>
            <Input
              id="vault-item-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="vault-item-url">{t("urlLabel")}</Label>
            <Input
              id="vault-item-url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://"
              autoComplete="off"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="vault-item-secret">{t("secretLabel")}</Label>
          <div className="flex items-center gap-2">
            <Input
              id="vault-item-secret"
              type={showSecret ? "text" : "password"}
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
              autoComplete="new-password"
              className="font-mono"
              required
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setShowSecret((v) => !v)}
              aria-label={showSecret ? t("hide") : t("reveal")}
            >
              {showSecret ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setSecret(generatePassword());
                setShowSecret(true);
              }}
            >
              <RefreshCw aria-hidden />
              {t("generate")}
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="vault-item-notes">
            {t("notesLabel")} <span className="text-muted">({tCommon("optional")})</span>
          </Label>
          <Textarea
            id="vault-item-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="min-h-16"
          />
        </div>

        {error ? <p className="text-sm text-danger">{tErrors(error)}</p> : null}

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            {tCommon("cancel")}
          </Button>
          <Button type="submit" loading={isPending} disabled={title.trim().length === 0 || secret.length === 0}>
            {tCommon("save")}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
