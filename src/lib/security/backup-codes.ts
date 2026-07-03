// Backup (recovery) codes for MFA. Pure generation/normalization logic —
// the keyed hashing for storage lives in src/lib/server/encryption.ts.

import { BACKUP_CODE_COUNT } from "./levels";

// Unambiguous 32-symbol alphabet (no 0/O, no 1/I; digits start at 2 so "L"
// stays unambiguous). Exactly 32 symbols keeps `byte % 32` bias-free:
// 5 bits per character, 12 characters = 60 bits of entropy per code.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const GROUPS = 3;
const GROUP_LENGTH = 4;

export function generateBackupCodes(count: number = BACKUP_CODE_COUNT): string[] {
  return Array.from({ length: count }, () => {
    const random = new Uint8Array(GROUPS * GROUP_LENGTH);
    crypto.getRandomValues(random);
    const chars = Array.from(random, (byte) => ALPHABET[byte % ALPHABET.length]);
    const groups: string[] = [];
    for (let i = 0; i < GROUPS; i++) {
      groups.push(chars.slice(i * GROUP_LENGTH, (i + 1) * GROUP_LENGTH).join(""));
    }
    return groups.join("-");
  });
}

/** Case/format tolerant normalization applied before hashing or comparing. */
export function normalizeBackupCode(code: string): string {
  return code.toUpperCase().replace(/[^2-9A-Z]/g, "");
}
