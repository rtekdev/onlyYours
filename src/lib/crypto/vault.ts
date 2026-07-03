// Client-side vault cryptography. This module is the only place where vault
// plaintext and the master password are handled — it must run in the browser
// (or in tests). Nothing here may be imported by server-side persistence code.
//
// Model:
//   master password --PBKDF2-SHA256--> KEK (key-encryption key)
//   random 256-bit DEK (data-encryption key) --AES-256-GCM(KEK)--> wrappedKey
//   item payload (JSON) --AES-256-GCM(DEK)--> { ciphertext, iv }
//
// The server stores only: KDF parameters, wrappedKey + its IV, and per-item
// { ciphertext, iv }. A wrong master password surfaces as an AES-GCM
// authentication failure when unwrapping the DEK — no password hash is ever
// stored or transmitted.
//
// We intentionally use the built-in WebCrypto API instead of a userland
// crypto library: no supply-chain surface, constant-time primitives, and it
// works identically in browsers, Node >= 20 and edge runtimes. PBKDF2 (not
// Argon2id) is the trade-off this buys us — see docs/security.md.

import { fromBase64, randomBytes, toBase64, utf8Decode, utf8Encode } from "./encoding";

export const VAULT_KDF_ALGORITHM = "PBKDF2-SHA256";
export const VAULT_KDF_ITERATIONS = 600_000;

const AES_GCM = "AES-GCM";
const GCM_IV_LENGTH = 12; // 96-bit IV, the recommended size for GCM
const KDF_SALT_LENGTH = 16;

export interface VaultKdfParams {
  kdfAlgorithm: string;
  kdfIterations: number;
  kdfSalt: string; // base64
}

export interface WrappedVaultKey extends VaultKdfParams {
  keyWrapIv: string; // base64
  wrappedKey: string; // base64
}

export interface EncryptedPayload {
  ciphertext: string; // base64
  iv: string; // base64
}

/** Everything sensitive about a vault item lives inside this payload. */
export interface VaultItemPayload {
  username?: string;
  url?: string;
  secret: string;
  notes?: string;
}

export class VaultUnlockError extends Error {
  constructor() {
    super("Vault unlock failed: wrong master password or corrupted key data");
    this.name = "VaultUnlockError";
  }
}

async function deriveKek(masterPassword: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    utf8Encode(masterPassword) as BufferSource,
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    passwordKey,
    { name: AES_GCM, length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Creates a fresh vault keyset from a master password. Returns the unlocked
 * DEK (kept only in memory by the caller) plus the material the server is
 * allowed to persist.
 */
export async function createVaultKeyset(masterPassword: string): Promise<{
  dek: CryptoKey;
  wrapped: WrappedVaultKey;
}> {
  const salt = randomBytes(KDF_SALT_LENGTH);
  const kek = await deriveKek(masterPassword, salt, VAULT_KDF_ITERATIONS);

  const dekBytes = randomBytes(32);
  const keyWrapIv = randomBytes(GCM_IV_LENGTH);
  const wrappedKey = await crypto.subtle.encrypt(
    { name: AES_GCM, iv: keyWrapIv as BufferSource },
    kek,
    dekBytes as BufferSource,
  );

  const dek = await importDek(dekBytes);
  // Best effort: drop the raw key material reference as soon as possible.
  dekBytes.fill(0);

  return {
    dek,
    wrapped: {
      kdfAlgorithm: VAULT_KDF_ALGORITHM,
      kdfIterations: VAULT_KDF_ITERATIONS,
      kdfSalt: toBase64(salt),
      keyWrapIv: toBase64(keyWrapIv),
      wrappedKey: toBase64(new Uint8Array(wrappedKey)),
    },
  };
}

/**
 * Re-derives the KEK from the master password and unwraps the DEK.
 * Throws VaultUnlockError when the password is wrong (GCM auth failure).
 */
export async function unlockVaultKey(masterPassword: string, wrapped: WrappedVaultKey): Promise<CryptoKey> {
  if (wrapped.kdfAlgorithm !== VAULT_KDF_ALGORITHM) {
    throw new Error(`Unsupported KDF algorithm: ${wrapped.kdfAlgorithm}`);
  }
  const kek = await deriveKek(masterPassword, fromBase64(wrapped.kdfSalt), wrapped.kdfIterations);
  let dekBytes: ArrayBuffer;
  try {
    dekBytes = await crypto.subtle.decrypt(
      { name: AES_GCM, iv: fromBase64(wrapped.keyWrapIv) as BufferSource },
      kek,
      fromBase64(wrapped.wrappedKey) as BufferSource,
    );
  } catch {
    throw new VaultUnlockError();
  }
  const dek = await importDek(new Uint8Array(dekBytes));
  new Uint8Array(dekBytes).fill(0);
  return dek;
}

async function importDek(dekBytes: Uint8Array): Promise<CryptoKey> {
  // Non-extractable: the unlocked key cannot be exported from the CryptoKey
  // handle, which limits what a compromised dependency could exfiltrate.
  return crypto.subtle.importKey("raw", dekBytes as BufferSource, AES_GCM, false, ["encrypt", "decrypt"]);
}

export async function encryptVaultPayload(dek: CryptoKey, payload: VaultItemPayload): Promise<EncryptedPayload> {
  const iv = randomBytes(GCM_IV_LENGTH);
  const ciphertext = await crypto.subtle.encrypt(
    { name: AES_GCM, iv: iv as BufferSource },
    dek,
    utf8Encode(JSON.stringify(payload)) as BufferSource,
  );
  return { ciphertext: toBase64(new Uint8Array(ciphertext)), iv: toBase64(iv) };
}

export async function decryptVaultPayload(dek: CryptoKey, encrypted: EncryptedPayload): Promise<VaultItemPayload> {
  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: AES_GCM, iv: fromBase64(encrypted.iv) as BufferSource },
      dek,
      fromBase64(encrypted.ciphertext) as BufferSource,
    );
  } catch {
    throw new VaultUnlockError();
  }
  return JSON.parse(utf8Decode(new Uint8Array(plaintext))) as VaultItemPayload;
}
