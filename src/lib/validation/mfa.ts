import { z } from "zod";

export const totpCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Expected a 6-digit code"),
});

export const backupCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(10)
    .max(20)
    .regex(/^[2-9A-Za-z-]+$/, "Invalid backup code format"),
});

export type TotpCodeInput = z.infer<typeof totpCodeSchema>;
