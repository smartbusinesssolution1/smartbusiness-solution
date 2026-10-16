import { z } from "zod";
import { hasAtMostTwoDecimals, MAX_CHECK_AMOUNT } from "../check/check.helpers.js";

const dayCount = (label: string) =>
  z
    .number({ error: `${label} must be a number of days` })
    .int(`${label} must be a whole number of days`)
    .min(0, `${label} cannot be negative`)
    .max(365, `${label} cannot be more than 365`);

// Every field is optional: send only what changes. Unknown fields are dropped, as in
// every other schema, except approvalEnabled, which has its own audited endpoint and is
// refused with a pointer to it rather than silently ignored.
export const updateCheckPrintingSettingsSchema = z.object({
  // No check can exceed $999,999.99 (the amount the check can spell out), so neither can the limit.
  maxCheckAmount: z
    .number({ error: "Maximum check amount must be a number" })
    .positive("Maximum check amount must be greater than zero")
    .max(MAX_CHECK_AMOUNT, "Maximum check amount cannot exceed $999,999.99")
    .refine(hasAtMostTwoDecimals, { message: "Maximum check amount must be in whole cents" })
    .optional(),
  maxPastDays: dayCount("Days in the past").optional(),
  maxFutureDays: dayCount("Days in the future").optional(),
  approvalEnabled: z
    .never({ error: "Turn approval on or off with PATCH /approval-rules/settings/approval-toggle" })
    .optional(),
});

export type UpdateCheckPrintingSettingsInput = z.infer<typeof updateCheckPrintingSettingsSchema>;
