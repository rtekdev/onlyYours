"use client";

import { Check, Copy, Eye, EyeOff, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

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
import type { VaultItemPayload } from "@/lib/crypto/vault";
import { deleteVaultItem, type VaultItemData } from "@/server/actions/vault";

interface VaultItemRowProps {
  item: VaultItemData;
  /** Decrypted payload — null while (re)decrypting. */
  payload: VaultItemPayload | null;
  onEdit: () => void;
  onDeleted: () => void;
}

export function VaultItemRow({ item, payload, onEdit, onDeleted }: VaultItemRowProps) {
  const t = useTranslations("vault.items");
  const tCommon = useTranslations("common");
  const [isPending, startTransition] = useTransition();

  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState<"secret" | "username" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function copyValue(kind: "secret" | "username") {
    const value = kind === "secret" ? payload?.secret : payload?.username;
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1500);
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteVaultItem({ id: item.id });
      setConfirmDelete(false);
      onDeleted();
    });
  }

  return (
    <Card className="animate-card-enter">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{item.title}</p>
          <p className="truncate text-sm text-muted">
            {payload?.username ?? "—"}
            {payload?.url ? <span className="ml-2 text-xs">{payload.url}</span> : null}
          </p>
          {revealed && payload ? (
            <code className="mt-1 block select-all break-all rounded-md bg-surface px-2 py-1 font-mono text-sm">
              {payload.secret}
            </code>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? t("hide") : t("reveal")}
            disabled={!payload}
          >
            {revealed ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => copyValue("secret")}
            aria-label={t("copySecret")}
            disabled={!payload}
          >
            {copied === "secret" ? <Check className="text-success" aria-hidden /> : <Copy aria-hidden />}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={tCommon("openMenu")}>
                <MoreVertical aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onEdit}>
                <Pencil aria-hidden /> {tCommon("edit")}
              </DropdownMenuItem>
              {payload?.username ? (
                <DropdownMenuItem onSelect={() => copyValue("username")}>
                  <Copy aria-hidden /> {t("copyUsername")}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-danger data-[highlighted]:text-danger"
                onSelect={() => setConfirmDelete(true)}
              >
                <Trash2 aria-hidden /> {tCommon("delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("confirmDelete.title")}</DialogTitle>
            <DialogDescription>{t("confirmDelete.description")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              {tCommon("cancel")}
            </Button>
            <Button variant="destructive" loading={isPending} onClick={handleDelete}>
              {tCommon("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
