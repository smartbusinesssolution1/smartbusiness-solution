import { z } from "zod";
import { ValidationError } from "../../shared/errors/index.js";
import { hasAtMostTwoDecimals, MAX_CHECK_AMOUNT } from "./check.helpers.js";

// ═══════════════════════════════════════════════════════════════
// THE CHECK REGISTER'S FILTER LANGUAGE (F06)
//
// One validated description of "which checks", shared by the list, its totals and facets,
// the views, and later exports and reports: what a user sees is exactly what they export.
// Values inside one filter are OR-ed ("PRINTED,CLEARED"); different filters are AND-ed.
// Unknown filters are refused: a typo ("staus") must not silently return every check.
// ═══════════════════════════════════════════════════════════════

const STATUSES = ["NEW", "PENDING_APPROVAL", "APPROVED", "REJECTED", "PRINTED", "CLEARED", "VOID"] as const;
const VOID_TYPES = ["CANCELLED", "SPOILED", "VOIDED_AFTER_PRINT"] as const;
export const SORT_FIELDS = ["createdAt", "checkDate", "amount", "checkNumber", "payeeName"] as const;
export const VIEWS = [
  "awaiting-my-approval",
  "my-drafts",
  "ready-to-print",
  "print-unconfirmed",
  "outstanding",
  "stale",
  "voided",
] as const;

export type SortField = (typeof SORT_FIELDS)[number];
export type SortOrder = "asc" | "desc";
export type RegisterView = (typeof VIEWS)[number];

// Each item is validated from a string, so the pipe input is string[].
const list = <T extends z.ZodType<unknown, string>>(item: T, max = 20) =>
  z
    .string()
    .transform((s) => s.split(",").map((part) => part.trim()).filter(Boolean))
    .pipe(z.array(item).min(1).max(max));

// Calendar day "YYYY-MM-DD" as UTC midnight (check and cleared dates are stored that way).
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-10-31")
  .transform((s) => new Date(`${s}T00:00:00.000Z`))
  .refine((d) => !Number.isNaN(d.getTime()), "Not a real date");

const money = z.coerce
  .number({ error: "Must be an amount" })
  .min(0)
  .max(MAX_CHECK_AMOUNT)
  .refine(hasAtMostTwoDecimals, "Use whole cents (at most 2 decimals)");

const checkNumber = z.coerce.number({ error: "Must be a check number" }).int().min(1).max(99_999_999);
const flag = z.enum(["true", "false"]).transform((v) => v === "true");
const text = z.string().trim().min(1).max(200);

export const checkFilterQuerySchema = z
  .strictObject({
    status: list(z.enum(STATUSES)).optional(),
    bankAccountId: list(z.uuid()).optional(),
    checkNumber: checkNumber.optional(),
    checkNumberFrom: checkNumber.optional(),
    checkNumberTo: checkNumber.optional(),
    amountMin: money.optional(),
    amountMax: money.optional(),
    payee: text.optional(),
    memo: text.optional(),
    q: text.optional(),
    checkDateFrom: day.optional(),
    checkDateTo: day.optional(),
    createdFrom: day.optional(),
    createdTo: day.optional(),
    printedFrom: day.optional(),
    printedTo: day.optional(),
    clearedFrom: day.optional(),
    clearedTo: day.optional(),
    voidedFrom: day.optional(),
    voidedTo: day.optional(),
    createdBy: list(z.uuid()).optional(),
    printedBy: list(z.uuid()).optional(),
    voidType: list(z.enum(VOID_TYPES)).optional(),
    printConfirmed: flag.optional(),
    // Older name for printConfirmed=false, kept for existing clients.
    printUnconfirmed: flag.optional(),
    hasAttachments: flag.optional(),
    reissued: z.enum(["from", "to", "none"]).optional(),
    possibleDuplicate: flag.optional(),
    view: z.enum(VIEWS).optional(),
    sortBy: z.enum(SORT_FIELDS).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().min(1).max(500).optional(),
    // Page numbers, for existing clients (cursor paging is preferred: stable while checks are added).
    page: z.coerce.number().int().min(1).optional(),
    include: list(z.enum(["totals", "facets"]), 2).optional(),
  })
  .superRefine((f, ctx) => {
    const ordered = (from: unknown, to: unknown, field: string, what: string) => {
      if (from !== undefined && to !== undefined && (from as number | Date) > (to as number | Date)) {
        ctx.addIssue({ code: "custom", path: [field], message: `${what}: the end is before the start` });
      }
    };
    ordered(f.amountMin, f.amountMax, "amountMax", "Amount range");
    ordered(f.checkNumberFrom, f.checkNumberTo, "checkNumberTo", "Check number range");
    ordered(f.checkDateFrom, f.checkDateTo, "checkDateTo", "Check date range");
    ordered(f.createdFrom, f.createdTo, "createdTo", "Created date range");
    ordered(f.printedFrom, f.printedTo, "printedTo", "Printed date range");
    ordered(f.clearedFrom, f.clearedTo, "clearedTo", "Cleared date range");
    ordered(f.voidedFrom, f.voidedTo, "voidedTo", "Voided date range");
    if (f.cursor !== undefined && f.page !== undefined) {
      ctx.addIssue({ code: "custom", path: ["page"], message: "Use either cursor or page, not both" });
    }
  });

export type CheckFilter = z.infer<typeof checkFilterQuerySchema>;

// ─── Smart search ("omnibox") ─────────────────────────────────

export interface OmniboxTerms {
  checkNumber?: number;
  amount?: number;
  accountLast4?: string;
  text?: string;
}

// "#1042" → check number, "$1,250.50" / "1250.50" → amount, "****1012" → bank account,
// anything else → payee or memo text. A bare whole number could be any of number, amount
// or part of a name, so it searches all three.
export function parseOmnibox(input: string): OmniboxTerms {
  const q = input.trim();

  const number = /^#\s*(\d{1,8})$/.exec(q);
  if (number) return { checkNumber: Number(number[1]) };

  const last4 = /^\*{2,}\s*(\d{4})$/.exec(q);
  if (last4) return { accountLast4: last4[1]! };

  if (/^\d{1,8}$/.test(q)) return { checkNumber: Number(q), amount: Number(q), text: q };

  const amount = /^\$?\s*((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?)$/.exec(q);
  if (amount) {
    const value = Number(amount[1]!.replace(/,/g, ""));
    if (value <= MAX_CHECK_AMOUNT) return { amount: value };
  }

  return { text: q };
}

// ─── Cursor ───────────────────────────────────────────────────
// Opaque to clients: the sort it was made for, the last row's sort value and id. The next
// page continues strictly after that row, so checks added meanwhile never shift it.

interface CursorPosition {
  value: string;
  id: string;
}

export function encodeCursor(c: { sortBy: SortField; sortOrder: SortOrder; value: string; id: string }): string {
  return Buffer.from(JSON.stringify({ s: c.sortBy, o: c.sortOrder, v: c.value, i: c.id })).toString("base64url");
}

export function decodeCursor(cursor: string, sortBy: SortField, sortOrder: SortOrder): CursorPosition {
  let parsed: { s?: unknown; o?: unknown; v?: unknown; i?: unknown };
  try {
    parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch {
    throw invalidCursor("This cursor is not valid. Start again from the first page.");
  }
  if (typeof parsed.v !== "string" || typeof parsed.i !== "string") {
    throw invalidCursor("This cursor is not valid. Start again from the first page.");
  }
  if (parsed.s !== sortBy || parsed.o !== sortOrder) {
    throw invalidCursor("This cursor was made for a different sort. Start again from the first page.");
  }
  return { value: parsed.v, id: parsed.i };
}

function invalidCursor(message: string) {
  return new ValidationError(message, { cursor: [message] });
}

// ─── Other register endpoints ─────────────────────────────────

export const numberIntegrityQuerySchema = z
  .strictObject({
    bankAccountId: z.uuid(),
    from: checkNumber,
    to: checkNumber,
  })
  .superRefine((q, ctx) => {
    if (q.to < q.from) ctx.addIssue({ code: "custom", path: ["to"], message: "The end is before the start" });
    else if (q.to - q.from >= 1000) ctx.addIssue({ code: "custom", path: ["to"], message: "At most 1,000 numbers per request" });
  });

export const agingQuerySchema = z.strictObject({ bankAccountId: z.uuid().optional() });
export const viewsQuerySchema = z.strictObject({});
