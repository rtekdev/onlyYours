import { describe, expect, it } from "vitest";

import { generateBackupCodes, normalizeBackupCode } from "@/lib/security/backup-codes";

describe("backup codes", () => {
  it("generates 10 codes in XXXX-XXXX-XXXX format by default", () => {
    const codes = generateBackupCodes();
    expect(codes).toHaveLength(10);
    for (const code of codes) {
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    }
  });

  it("generates unique codes", () => {
    const codes = generateBackupCodes(50);
    expect(new Set(codes).size).toBe(50);
  });

  it("normalizes user input tolerantly", () => {
    expect(normalizeBackupCode("abcd-2345-wxyz")).toBe("ABCD2345WXYZ");
    expect(normalizeBackupCode("  ABCD 2345 WXYZ ")).toBe("ABCD2345WXYZ");
    // Normalized generated code matches its own normalization (idempotent).
    const [code] = generateBackupCodes(1);
    expect(normalizeBackupCode(code)).toBe(code.replaceAll("-", ""));
  });
});
