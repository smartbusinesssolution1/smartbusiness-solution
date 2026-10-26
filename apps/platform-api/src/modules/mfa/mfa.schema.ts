import { z } from "zod";

// A 6-digit app code, or a backup code ("K7QPM-X3TNB", any case, with or without the dash).
const code = z.string({ error: "Enter the code" }).trim().min(6, "Enter the code").max(20, "That code is too long");

export const mfaCodeSchema = z.strictObject({ code });

export const mfaDisableSchema = z.strictObject({
  password: z.string({ error: "Enter your password" }).min(1, "Enter your password").max(200),
  code,
});

export type MfaCodeInput = z.infer<typeof mfaCodeSchema>;
export type MfaDisableInput = z.infer<typeof mfaDisableSchema>;
