"use server";

import { type ActionResult } from "@/lib/action-result";
import { prisma } from "@/lib/prisma";
import { recordSecurityEvent } from "@/lib/security/audit";
import { requireMfa, requireUser } from "@/lib/security/guards";
import { FRESH_MFA_WINDOW_SECONDS } from "@/lib/security/levels";
import { ActionError, runAction } from "@/lib/server/actions";
import {
  createVaultItemSchema,
  createVaultSchema,
  updateVaultItemSchema,
  vaultItemIdSchema,
} from "@/lib/validation/vault";

// Every function here handles ciphertext only. Plaintext secrets exist
// exclusively in the browser (src/lib/crypto/vault.ts) — nothing in this
// file may log, return or persist decrypted vault content, and the server
// has no key material to decrypt it with.

export interface VaultStatus {
  hasVault: boolean;
  mfaEnabled: boolean;
  /** True when this session holds a valid step-up grant. */
  mfaVerified: boolean;
}

export interface VaultData {
  kdfAlgorithm: string;
  kdfIterations: number;
  kdfSalt: string;
  keyWrapIv: string;
  wrappedKey: string;
  items: VaultItemData[];
}

export interface VaultItemData {
  id: string;
  title: string;
  ciphertext: string;
  iv: string;
  createdAt: string;
  updatedAt: string;
}

/** SESSION-level status probe used by the vault page to route the user. */
export async function getVaultStatus(): Promise<ActionResult<VaultStatus>> {
  return runAction("getVaultStatus", async () => {
    const { userId, sid } = await requireUser();
    const [vault, security, grant] = await Promise.all([
      prisma.vault.findUnique({ where: { userId }, select: { id: true } }),
      prisma.userSecurity.findUnique({ where: { userId }, select: { totpEnabledAt: true } }),
      prisma.stepUpGrant.findUnique({ where: { tokenSid: sid } }),
    ]);
    const mfaVerified =
      grant !== null && grant.userId === userId && Date.now() - grant.mfaVerifiedAt.getTime() < 15 * 60 * 1000;
    return { hasVault: vault !== null, mfaEnabled: Boolean(security?.totpEnabledAt), mfaVerified };
  });
}

/** Creating a vault is a critical action: MFA must already be configured. */
export async function createVault(input: unknown): Promise<ActionResult<{ vaultId: string }>> {
  return runAction("createVault", async () => {
    const { userId } = await requireMfa();
    const data = createVaultSchema.parse(input);

    const existing = await prisma.vault.findUnique({ where: { userId }, select: { id: true } });
    if (existing) {
      throw new ActionError("CONFLICT", "Vault already exists");
    }

    const vault = await prisma.vault.create({ data: { userId, ...data } });
    await recordSecurityEvent(userId, "VAULT_CREATED");
    return { vaultId: vault.id };
  });
}

/**
 * Returns the encrypted vault (KDF params, wrapped key, item ciphertexts).
 * Requires MFA step-up — this is the payload a client needs to attempt
 * unlocking, so handing it out is treated as reading secrets.
 */
export async function getVaultData(): Promise<ActionResult<VaultData>> {
  return runAction("getVaultData", async () => {
    const { userId } = await requireMfa();
    const vault = await prisma.vault.findUnique({
      where: { userId },
      include: { items: { orderBy: { title: "asc" } } },
    });
    if (!vault) {
      throw new ActionError("NOT_FOUND");
    }
    await recordSecurityEvent(userId, "VAULT_DATA_ACCESSED");
    return {
      kdfAlgorithm: vault.kdfAlgorithm,
      kdfIterations: vault.kdfIterations,
      kdfSalt: vault.kdfSalt,
      keyWrapIv: vault.keyWrapIv,
      wrappedKey: vault.wrappedKey,
      items: vault.items.map(toItemData),
    };
  });
}

export async function createVaultItem(input: unknown): Promise<ActionResult<VaultItemData>> {
  return runAction("createVaultItem", async () => {
    const { userId } = await requireMfa();
    const data = createVaultItemSchema.parse(input);

    const vault = await prisma.vault.findUnique({ where: { userId }, select: { id: true } });
    if (!vault) {
      throw new ActionError("NOT_FOUND", "Vault does not exist");
    }

    const item = await prisma.vaultItem.create({ data: { vaultId: vault.id, ...data } });
    await recordSecurityEvent(userId, "VAULT_ITEM_CREATED", { itemId: item.id });
    return toItemData(item);
  });
}

export async function updateVaultItem(input: unknown): Promise<ActionResult<VaultItemData>> {
  return runAction("updateVaultItem", async () => {
    const { userId } = await requireMfa();
    const { id, ...data } = updateVaultItemSchema.parse(input);

    // Ownership is enforced through the vault relation — an item id from
    // another user's vault can never match this filter (no IDOR).
    const updated = await prisma.vaultItem.updateMany({
      where: { id, vault: { userId } },
      data,
    });
    if (updated.count === 0) {
      throw new ActionError("NOT_FOUND");
    }
    const item = await prisma.vaultItem.findUniqueOrThrow({ where: { id } });
    await recordSecurityEvent(userId, "VAULT_ITEM_UPDATED", { itemId: id });
    return toItemData(item);
  });
}

export async function deleteVaultItem(input: unknown): Promise<ActionResult<null>> {
  return runAction("deleteVaultItem", async () => {
    const { userId } = await requireMfa();
    const { id } = vaultItemIdSchema.parse(input);

    const deleted = await prisma.vaultItem.deleteMany({ where: { id, vault: { userId } } });
    if (deleted.count === 0) {
      throw new ActionError("NOT_FOUND");
    }
    await recordSecurityEvent(userId, "VAULT_ITEM_DELETED", { itemId: id });
    return null;
  });
}

/**
 * Export of the encrypted vault. Demands *fresh* MFA (tight window) because
 * the exported blob leaves the app's control. The export stays encrypted —
 * it is only useful together with the master password.
 */
export async function exportVault(): Promise<ActionResult<VaultData & { exportedAt: string }>> {
  return runAction("exportVault", async () => {
    const { userId } = await requireMfa(FRESH_MFA_WINDOW_SECONDS);
    const vault = await prisma.vault.findUnique({
      where: { userId },
      include: { items: { orderBy: { createdAt: "asc" } } },
    });
    if (!vault) {
      throw new ActionError("NOT_FOUND");
    }
    await recordSecurityEvent(userId, "VAULT_EXPORTED", { itemCount: vault.items.length });
    return {
      kdfAlgorithm: vault.kdfAlgorithm,
      kdfIterations: vault.kdfIterations,
      kdfSalt: vault.kdfSalt,
      keyWrapIv: vault.keyWrapIv,
      wrappedKey: vault.wrappedKey,
      items: vault.items.map(toItemData),
      exportedAt: new Date().toISOString(),
    };
  });
}

/** Irreversible. Fresh MFA required. */
export async function deleteVault(): Promise<ActionResult<null>> {
  return runAction("deleteVault", async () => {
    const { userId } = await requireMfa(FRESH_MFA_WINDOW_SECONDS);
    const deleted = await prisma.vault.deleteMany({ where: { userId } });
    if (deleted.count === 0) {
      throw new ActionError("NOT_FOUND");
    }
    await recordSecurityEvent(userId, "VAULT_DELETED");
    return null;
  });
}

function toItemData(item: {
  id: string;
  title: string;
  ciphertext: string;
  iv: string;
  createdAt: Date;
  updatedAt: Date;
}): VaultItemData {
  return {
    id: item.id,
    title: item.title,
    ciphertext: item.ciphertext,
    iv: item.iv,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}
