// Binary <-> string helpers shared by the client-side vault crypto and the
// server-side at-rest encryption. Pure functions, safe in any runtime that
// provides WebCrypto (browser, Node >= 20, edge workers).

export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  // btoa is available in browsers, Node >= 16 and edge runtimes.
  return btoa(binary);
}

export function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function utf8Encode(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

export function utf8Decode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
