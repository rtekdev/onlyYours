import { describe, expect, it } from "vitest";

import { randomBytes } from "@/lib/crypto/encoding";
import {
  deriveHmacKey,
  hmacSha256Hex,
  importAesKey,
  openSecret,
  sealSecret,
} from "@/lib/server/encryption-core";

describe("server at-rest encryption", () => {
  it("round-trips a secret through seal/open", async () => {
    const key = await importAesKey(randomBytes(32));
    const sealed = await sealSecret(key, "JBSWY3DPEHPK3PXP");
    expect(sealed).toMatch(/^v1:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
    expect(sealed).not.toContain("JBSWY3DPEHPK3PXP");
    expect(await openSecret(key, sealed)).toBe("JBSWY3DPEHPK3PXP");
  });

  it("fails to open with a different key", async () => {
    const sealed = await sealSecret(await importAesKey(randomBytes(32)), "secret");
    await expect(openSecret(await importAesKey(randomBytes(32)), sealed)).rejects.toThrow();
  });

  it("rejects malformed sealed values", async () => {
    const key = await importAesKey(randomBytes(32));
    await expect(openSecret(key, "v2:AAAA:BBBB")).rejects.toThrow(/format/i);
    await expect(openSecret(key, "garbage")).rejects.toThrow(/format/i);
  });

  it("requires exactly 32 key bytes", async () => {
    await expect(importAesKey(randomBytes(16))).rejects.toThrow(/32 bytes/);
  });

  it("derives purpose-separated HMAC keys", async () => {
    const raw = randomBytes(32);
    const backupKey = await deriveHmacKey(raw, "backup-codes");
    const otherKey = await deriveHmacKey(raw, "other-purpose");

    const backupHash = await hmacSha256Hex(backupKey, "CODE-1234");
    expect(backupHash).toMatch(/^[0-9a-f]{64}$/);
    // Same input, same purpose → deterministic; different purpose → different.
    expect(await hmacSha256Hex(backupKey, "CODE-1234")).toBe(backupHash);
    expect(await hmacSha256Hex(otherKey, "CODE-1234")).not.toBe(backupHash);
  });
});
