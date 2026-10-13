import { z } from "zod";
import { payeeFitsOnCheck } from "../pdf/text-fit.js";

// The payee is a legal name on a negotiable instrument, so it is never truncated on the
// check. A name that does not fit even at the minimum font size is rejected here, early,
// so the user can abbreviate it consciously.
const payeeNameSchema = z
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
  amount: z.number().positive().max(999999.99),
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
  amount: z
    .number()
    .positive("Amount must be greater than zero")
    .max(999999.99, "Amount cannot exceed $999,999.99"),
  checkDate: z.coerce.date(),
  memo: z.string().trim().max(500).optional(),
  invoiceItems: z.array(invoiceItemSchema).max(50).optional(),
  idempotencyKey: z.string().uuid().optional(),
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
  amount: z.number().positive().max(999999.99).optional(),
  checkDate: z.coerce.date().optional(),
  memo: z.string().trim().max(500).nullable().optional(),
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
  })
  .default({});

export type PrintCheckInput = z.infer<typeof printCheckSchema>;

export const clearCheckSchema = z.object({
  clearedDate: z.coerce.date().optional(),
  clearedAmount: z.number().positive().max(999999.99).optional(),
});

export type ClearCheckInput = z.infer<typeof clearCheckSchema>;

// ═══════════════════════════════════════════════════════════════
// LIST CHECKS QUERY SCHEMA
//
// Validates GET /checks query parameters.
//
// Why z.coerce? Express delivers query params as strings.
// ?page=2 arrives as req.query.page === "2" (string).
// z.coerce.number() converts "2" → 2 at validation time,
// so the controller receives properly typed values.
//
// The .default() values ensure pagination works even if the
// client sends no query params at all.
// ═══════════════════════════════════════════════════════════════

export const listChecksQuerySchema = z.object({
  status: z
    .enum([
      "NEW",
      "PENDING_APPROVAL",
      "APPROVED",
      "REJECTED",
      "PRINTED",
      "CLEARED",
      "VOID",
    ])
    .optional(),
  search: z.string().trim().max(200).optional(),
  bankAccountId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z
    .enum(["checkDate", "amount", "createdAt", "checkNumber", "payeeName"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type ListChecksQuery = z.infer<typeof listChecksQuerySchema>;
