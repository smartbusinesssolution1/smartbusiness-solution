import { z } from "zod";

export const createBankAccountSchema = z.object({
    routingNumber: z
        .string()
        .length(9, { error: "Routing number must be exactly 9 digits" })
        .regex(/^\d{9}$/, "Routing number must contain only digits"),

    accountNumber: z
        .string()
        .min(4, { error: "Account number must be at least 4 digits" })
        .max(17, { error: "Account number must be at most 17 digits" })
        .regex(/^\d+$/, { error: "Account number must contain only digits" }),

    accountType: z.enum(["CHECKING", "SAVINGS"], {
        error: "Account type must be CHECKING or SAVINGS"
    }),

    startingCheckNumber: z
        .number()
        .int({ error: "Check number must be a whole number" })
        .min(1, { error: "Check number must be at least 1" })
        .max(99999999, { error: "Check number cannot exceed 99,999,999" })
})

export const updateBankAccountSchema = z.object({
    accountType: z.enum(["CHECKING", "SAVINGS"]).optional(),
    checkNumberPadding: z.number().int().min(4).max(8).optional(),
    isActive: z.boolean().optional(),
});

export const validateRoutingNumberSchema = z.object({
    routingNumber: z
        .string()
        .length(9, "Routing number must be exactly 9 digits")
        .regex(/^\d{9}$/, "Routing number must contain only digits"),
});

export type CreateBankAccountInput = z.infer<typeof createBankAccountSchema>;
export type UpdateBankAccountInput = z.infer<typeof updateBankAccountSchema>;