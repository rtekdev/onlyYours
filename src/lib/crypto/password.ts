// Client-side password generator for vault entries.

const LOWER = "abcdefghijkmnopqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%^&*-_=+?";
const ALL = LOWER + UPPER + DIGITS + SYMBOLS;

/** Rejection sampling keeps the distribution uniform (no modulo bias). */
function randomIndex(bound: number): number {
  const max = Math.floor(256 / bound) * bound;
  const byte = new Uint8Array(1);
  do {
    crypto.getRandomValues(byte);
  } while (byte[0] >= max);
  return byte[0] % bound;
}

export function generatePassword(length = 20): string {
  // Guarantee at least one character from each class, fill the rest randomly.
  const required = [LOWER, UPPER, DIGITS, SYMBOLS].map((set) => set[randomIndex(set.length)]);
  const rest = Array.from({ length: Math.max(length - required.length, 0) }, () => ALL[randomIndex(ALL.length)]);
  const chars = [...required, ...rest];
  // Fisher–Yates shuffle so required characters land at random positions.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
