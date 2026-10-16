import { z } from "zod";
import { payeeFitsOnCheck } from "../pdf/text-fit.js";
import { hasAtMostTwoDecimals, MAX_CHECK_AMOUNT } from "./check.helpers.js";

// A dollar amount as printed on a check: positive, whole cents, within the
// largest amount the check can spell out. A third decimal would be rounded by
// the database while the words were computed from the unrounded value.
const moneySchema = (label: string) =>
  z
    .number()
    .positive(`${label} must be greater than zero`)
    .max(MAX_CHECK_AMOUNT, `${label} cannot exceed $999,999.99`)
    .refine(hasAtMostTwoDecimals, { message: `${label} must be in whole cents (at most 2 decimal places)` });

// R-12: the memo is at most 255 characters. One constant, so create and edit can't drift apart.
export const MEMO_MAX_LENGTH = 255;
const memoSchema = z
  .string()
  .trim()
  .max(MEMO_MAX_LENGTH, `Memo cannot be longer than ${MEMO_MAX_LENGTH} characters`);

// The payee is a legal name on a negotiable instrument, so it is never truncated on the
// check. A name that does not fit even at the minimum font size is rejected here, early,
// so the user can abbreviate it consciously.
// Also used by the payee directory, so every vendor in it can be written on a check.
export const payeeNameSchema = z
  .string()
  .trim()
  .min(1, "Payee name is required")
  .max(200)
  .refine(payeeFitsOnCheck, {
    message: "Payee name is too long to fit on one line of the check. Shorten or abbreviate it (for example \"Co.\" for \"Company\").",
  });

// ═══════════════════════════════════════════════════════════════
// INVOICE ITEM SCHEMA
//
// Invoice items are stored as JSON in the database (invoiceTableJson).
// They provide line-item detail on what the check is paying for.
// This is optional — many checks are simple single-purpose payments.
// ═══════════════════════════════════════════════════════════════

const invoiceItemSchema = z.object({
  description: z.string().trim().min(1).max(200),
  amount: moneySchema("Invoice line amount"),
});

// ═══════════════════════════════════════════════════════════════
// CREATE CHECK SCHEMA
//
// Validates the request body for POST /checks.
//
// Design notes:
// - bankAccountId: Must be a valid UUID. The service layer verifies
//   the account belongs to the same workspace (IDOR prevention).
// - payeeName: Free-text string, denormalized on the check. Even if
//   we have a Payee table, the name is captured at creation time
//   because payee names can change, but a printed check is permanent.
// - amount: Positive, max 999999.99 to match DB precision.
//   The service layer also validates against workspace maxCheckAmount.
// - checkDate: ISO date string coerced to Date object. The service
//   validates it against maxPastDays/maxFutureDays from settings.
// - idempotencyKey: Optional UUID to prevent duplicate check creation
//   from network retries or double-clicks.
// ═══════════════════════════════════════════════════════════════

export const createCheckSchema = z.object({
  bankAccountId: z.string().uuid(),
  payeeName: payeeNameSchema,
  amount: moneySchema("Amount"),
  checkDate: z.coerce.date(),
  memo: memoSchema.optional(),
  invoiceItems: z.array(invoiceItemSchema).max(50).optional(),
  idempotencyKey: z.string().uuid().optional(),
  // Keep the check as a draft (NEW) even when it needs approval, so its creator can
  // attach invoices before submitting it. Attachments freeze on submission.
  saveAsDraft: z.boolean().optional(),
});

export type CreateCheckInput = z.infer<typeof createCheckSchema>;

// ═══════════════════════════════════════════════════════════════
// UPDATE CHECK SCHEMA
//
// Only draft checks (status NEW or REJECTED) can be edited.
// The service layer enforces the status constraint — the schema
// only validates the shape. All fields are optional because the
// user might update only the memo, or only the amount.
// ═══════════════════════════════════════════════════════════════

export const updateCheckSchema = z.object({
  payeeName: payeeNameSchema.optional(),
  amount: moneySchema("Amount").optional(),
  checkDate: z.coerce.date().optional(),
  memo: memoSchema.nullable().optional(),
  invoiceItems: z.array(invoiceItemSchema).max(50).nullable().optional(),
});

export type UpdateCheckInput = z.infer<typeof updateCheckSchema>;

// ═══════════════════════════════════════════════════════════════
// ACTION SCHEMAS
//
// Reject: Requires a reason (accountability for the approver).
// Void: Requires a reason (audit trail for why a printed check
//   was cancelled — auditors will ask).
// Clear: Optional clearedDate and clearedAmount for bank
//   reconciliation. The clearedAmount may differ from the check
//   amount if the bank processed a partial payment.
// ═══════════════════════════════════════════════════════════════

export const rejectCheckSchema = z.object({
  reason: z.string().trim().min(1, "Rejection reason is required").max(1000),
});

export type RejectCheckInput = z.infer<typeof rejectCheckSchema>;

export const voidCheckSchema = z.object({
  reason: z.string().trim().min(1, "Void reason is required").max(1000),
});

export type VoidCheckInput = z.infer<typeof voidCheckSchema>;

// Body is optional: without a profile id the workspace's default printer is used.
export const printCheckSchema = z
  .object({
    calibrationProfileId: z.uuid().optional(),
    // Slot on three-per-page paper (1 = top). Only for printers with that layout.
    position: z.number().int().min(1, "Slot must be 1, 2 or 3").max(3, "Slot must be 1, 2 or 3").optional(),
  })
  .default({});

export type PrintCheckInput = z.infer<typeof printCheckSchema>;

// What came out of the printer. SPOILED needs a reason: auditors will ask what
// happened to check #1005, and "Paper jam" answers it.
export const printOutcomeSchema = z.discriminatedUnion("outcome", [
  z.object({ outcome: z.literal("OK") }),
  z.object({
    outcome: z.literal("SPOILED"),
    reason: z
      .string({ error: "Describe what went wrong, for example \"Paper jam\"" })
      .trim()
      .min(1, "Describe what went wrong, for example \"Paper jam\"")
      .max(500),
  }),
]);

export type PrintOutcomeInput = z.infer<typeof printOutcomeSchema>;

export const clearCheckSchema = z.object({
  clearedDate: z.coerce.date().optional(),
  clearedAmount: moneySchema("Cleared amount").optional(),
});

export type ClearCheckInput = z.infer<typeof clearCheckSchema>;
