import { z } from "zod";

// The server never validates plaintext — it only ever sees these opaque
// base64 fields. Length limits are DoS protection, not security boundaries.
const base64Field = (maxLength: number) =>
  z
    .string()
    .min(1)
    .max(maxLength)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/, "Expected base64");

export const createVaultSchema = z.object({
  kdfAlgorithm: z.literal("PBKDF2-SHA256"),
  // Floor prevents a tampered client from registering a weak KDF.
  kdfIterations: z.number().int().min(100_000).max(5_000_000),
  kdfSalt: base64Field(64),
  keyWrapIv: base64Field(32),
  wrappedKey: base64Field(256),
});

export const vaultItemPayloadSchema = z.object({
  title: z.string().trim().min(1).max(200),
  ciphertext: base64Field(50_000),
  iv: base64Field(32),
});

export const createVaultItemSchema = vaultItemPayloadSchema;

export const updateVaultItemSchema = vaultItemPayloadSchema.extend({
  id: z.cuid(),
});

export const vaultItemIdSchema = z.object({ id: z.cuid() });

export type CreateVaultInput = z.infer<typeof createVaultSchema>;
export type CreateVaultItemInput = z.infer<typeof createVaultItemSchema>;
