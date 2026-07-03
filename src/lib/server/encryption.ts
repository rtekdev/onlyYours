import "server-only";

import { fromBase64 } from "@/lib/crypto/encoding";
import { deriveHmacKey, hmacSha256Hex, importAesKey, openSecret, sealSecret } from "./encryption-core";

// Lazily imported and cached so that builds without env vars still succeed;
// the key is only required once a secret actually needs (de)ciphering.
let aesKeyPromise: Promise<CryptoKey> | undefined;
let backupCodeHmacKeyPromise: Promise<CryptoKey> | undefined;

function rawServerKey(): Uint8Array {
  const encoded = process.env.ENCRYPTION_KEY;
  if (!encoded) {
    throw new Error("ENCRYPTION_KEY is not set — see .env.example");
  }
  return fromBase64(encoded);
}

function getAesKey(): Promise<CryptoKey> {
  aesKeyPromise ??= importAesKey(rawServerKey());
  return aesKeyPromise;
}

/** Encrypts a server-readable secret (TOTP secret, integration token) at rest. */
export async function encryptServerSecret(plaintext: string): Promise<string> {
  return sealSecret(await getAesKey(), plaintext);
}

export async function decryptServerSecret(sealed: string): Promise<string> {
  return openSecret(await getAesKey(), sealed);
}

/**
 * Keyed hash for backup codes: a database leak alone is not enough to forge
 * or brute-force codes without the server's ENCRYPTION_KEY.
 */
export async function hashBackupCodeForStorage(normalizedCode: string): Promise<string> {
  backupCodeHmacKeyPromise ??= deriveHmacKey(rawServerKey(), "backup-codes");
  return hmacSha256Hex(await backupCodeHmacKeyPromise, normalizedCode);
}
