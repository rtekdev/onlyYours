import { describe, expect, it } from "vitest";

import { parseAutomationConfig, webhookConfigSchema } from "@/lib/validation/automations";
import { createNoteSchema } from "@/lib/validation/notes";
import { createVaultSchema, vaultItemPayloadSchema } from "@/lib/validation/vault";

describe("note validation", () => {
  it("accepts a normal note and applies defaults", () => {
    const parsed = createNoteSchema.parse({ title: "  Hello  " });
    expect(parsed.title).toBe("Hello");
    expect(parsed.content).toBe("");
    expect(parsed.tags).toEqual([]);
  });

  it("rejects empty titles and oversized tag lists", () => {
    expect(() => createNoteSchema.parse({ title: "   " })).toThrow();
    expect(() =>
      createNoteSchema.parse({ title: "x", tags: Array.from({ length: 11 }, (_, i) => `tag${i}`) }),
    ).toThrow();
  });
});

describe("vault validation", () => {
  const validVault = {
    kdfAlgorithm: "PBKDF2-SHA256",
    kdfIterations: 600_000,
    kdfSalt: "AAAAAAAAAAAAAAAAAAAAAA==",
    keyWrapIv: "AAAAAAAAAAAAAAAA",
    wrappedKey: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  };

  it("accepts well-formed key material", () => {
    expect(createVaultSchema.parse(validVault)).toBeTruthy();
  });

  it("rejects a weakened KDF (tampered client)", () => {
    expect(() => createVaultSchema.parse({ ...validVault, kdfIterations: 1_000 })).toThrow();
  });

  it("rejects unknown KDF algorithms", () => {
    expect(() => createVaultSchema.parse({ ...validVault, kdfAlgorithm: "MD5" })).toThrow();
  });

  it("rejects payloads that are not base64 (e.g. raw JSON plaintext)", () => {
    expect(() =>
      vaultItemPayloadSchema.parse({
        title: "GitHub",
        ciphertext: '{"secret":"plaintext-password"}',
        iv: "AAAAAAAAAAAAAAAA",
      }),
    ).toThrow();
  });
});

describe("automation config validation", () => {
  it("validates config against its action type", () => {
    const config = parseAutomationConfig("CREATE_NOTE", { titleTemplate: "Journal {{date}}" });
    expect(config).toMatchObject({ titleTemplate: "Journal {{date}}", tags: [] });

    expect(() => parseAutomationConfig("CREATE_SCENARIO", { titleTemplate: "x" })).toThrow();
  });

  it("requires https for webhooks", () => {
    expect(() => webhookConfigSchema.parse({ url: "http://example.com/hook" })).toThrow(/https/);
  });

  it.each([
    "https://localhost/hook",
    "https://127.0.0.1/hook",
    "https://10.0.0.5/hook",
    "https://192.168.1.10/hook",
    "https://172.16.0.1/hook",
    "https://169.254.169.254/latest/meta-data",
    "https://internal.local/hook",
  ])("rejects private/internal webhook target %s (SSRF guard)", (url) => {
    expect(() => webhookConfigSchema.parse({ url })).toThrow(/private/i);
  });

  it("accepts a public https webhook", () => {
    expect(webhookConfigSchema.parse({ url: "https://example.com/hook" })).toMatchObject({
      method: "POST",
    });
  });
});
