// Server-side at-rest encryption primitives (AES-256-GCM via WebCrypto).
// Pure functions — the ENCRYPTION_KEY wiring lives in ./encryption.ts so
// these can be unit-tested with throwaway keys.
//
// Used for secrets the *server* must be able to read back (TOTP secrets,
// integration OAuth tokens). Vault items never go through this module —
// they are encrypted in the browser and the server cannot decrypt them.

import { fromBase64, randomBytes, toBase64, utf8Decode, utf8Encode } from "@/lib/crypto/encoding";

const AES_GCM = "AES-GCM";
const GCM_IV_LENGTH = 12;
const SEAL_VERSION = "v1";

export async function importAesKey(rawKey: Uint8Array): Promise<CryptoKey> {
  if (rawKey.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be exactly 32 bytes (base64-encoded)");
  }
  return crypto.subtle.importKey("raw", rawKey as BufferSource, AES_GCM, false, ["encrypt", "decrypt"]);
}

/**
 * Derives a purpose-specific HMAC key from the master server key via HKDF,
 * so the same ENCRYPTION_KEY is never reused across primitives.
 */
export async function deriveHmacKey(rawKey: Uint8Array, purpose: string): Promise<CryptoKey> {
  const hkdfKey = await crypto.subtle.importKey("raw", rawKey as BufferSource, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(32) as BufferSource,
      info: utf8Encode(`only-yours:${purpose}`) as BufferSource,
    },
    hkdfKey,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

/** Encrypts a UTF-8 string into the storage format `v1:<iv b64>:<ct b64>`. */
export async function sealSecret(key: CryptoKey, plaintext: string): Promise<string> {
  const iv = randomBytes(GCM_IV_LENGTH);
  const ciphertext = await crypto.subtle.encrypt(
    { name: AES_GCM, iv: iv as BufferSource },
    key,
    utf8Encode(plaintext) as BufferSource,
  );
  return `${SEAL_VERSION}:${toBase64(iv)}:${toBase64(new Uint8Array(ciphertext))}`;
}

export async function openSecret(key: CryptoKey, sealed: string): Promise<string> {
  const [version, ivB64, ctB64] = sealed.split(":");
  if (version !== SEAL_VERSION || !ivB64 || !ctB64) {
    throw new Error("Unrecognized sealed secret format");
  }
  const plaintext = await crypto.subtle.decrypt(
    { name: AES_GCM, iv: fromBase64(ivB64) as BufferSource },
    key,
    fromBase64(ctB64) as BufferSource,
  );
  return utf8Decode(new Uint8Array(plaintext));
}

export async function hmacSha256Hex(key: CryptoKey, message: string): Promise<string> {
  const signature = await crypto.subtle.sign("HMAC", key, utf8Encode(message) as BufferSource);
  return Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, "0")).join("");
}
