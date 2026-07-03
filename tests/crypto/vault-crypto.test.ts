import { describe, expect, it } from "vitest";

import {
  createVaultKeyset,
  decryptVaultPayload,
  encryptVaultPayload,
  unlockVaultKey,
  VAULT_KDF_ALGORITHM,
  VAULT_KDF_ITERATIONS,
  VaultUnlockError,
  type VaultItemPayload,
} from "@/lib/crypto/vault";

const MASTER_PASSWORD = "correct horse battery staple 42";

describe("vault crypto (client-side)", () => {
  it("creates a keyset with declared KDF parameters and base64 material", async () => {
    const { wrapped } = await createVaultKeyset(MASTER_PASSWORD);

    expect(wrapped.kdfAlgorithm).toBe(VAULT_KDF_ALGORITHM);
    expect(wrapped.kdfIterations).toBe(VAULT_KDF_ITERATIONS);
    for (const field of [wrapped.kdfSalt, wrapped.keyWrapIv, wrapped.wrappedKey]) {
      expect(field).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    }
  });

  it("round-trips an item payload through encrypt/decrypt", async () => {
    const { dek } = await createVaultKeyset(MASTER_PASSWORD);
    const payload: VaultItemPayload = {
      username: "user@example.com",
      url: "https://example.com",
      secret: "s3cr3t-value",
      notes: "notatka",
    };

    const encrypted = await encryptVaultPayload(dek, payload);
    expect(encrypted.ciphertext).not.toContain("s3cr3t-value");

    const decrypted = await decryptVaultPayload(dek, encrypted);
    expect(decrypted).toEqual(payload);
  });

  it("unlocks with the right password and derives an equivalent key", async () => {
    const { dek, wrapped } = await createVaultKeyset(MASTER_PASSWORD);
    const encrypted = await encryptVaultPayload(dek, { secret: "top" });

    const unlockedDek = await unlockVaultKey(MASTER_PASSWORD, wrapped);
    const decrypted = await decryptVaultPayload(unlockedDek, encrypted);
    expect(decrypted.secret).toBe("top");
  });

  it("rejects a wrong master password with VaultUnlockError", async () => {
    const { wrapped } = await createVaultKeyset(MASTER_PASSWORD);
    await expect(unlockVaultKey("wrong password entirely", wrapped)).rejects.toBeInstanceOf(VaultUnlockError);
  });

  it("rejects tampered ciphertext (GCM authentication)", async () => {
    const { dek } = await createVaultKeyset(MASTER_PASSWORD);
    const encrypted = await encryptVaultPayload(dek, { secret: "x" });
    const bytes = Buffer.from(encrypted.ciphertext, "base64");
    bytes[0] ^= 0xff;
    const tampered = { ...encrypted, ciphertext: bytes.toString("base64") };
    await expect(decryptVaultPayload(dek, tampered)).rejects.toBeInstanceOf(VaultUnlockError);
  });

  it("uses a fresh IV for every encryption", async () => {
    const { dek } = await createVaultKeyset(MASTER_PASSWORD);
    const first = await encryptVaultPayload(dek, { secret: "same" });
    const second = await encryptVaultPayload(dek, { secret: "same" });
    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
  });
});
