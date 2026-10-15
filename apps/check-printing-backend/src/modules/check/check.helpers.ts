import { ValidationError } from "../../shared/errors/index.js";

// ═══════════════════════════════════════════════════════════════
// CHECK STATUS STATE MACHINE
//
// This map is the SINGLE SOURCE OF TRUTH for all legal state
// transitions. Every status change in the entire system must
// pass through assertTransition() which reads this map.
//
// The state machine for checks as negotiable instruments:
//
//   NEW ──────────────────────┬──→ PENDING_APPROVAL ──→ APPROVED ──→ PRINTED ──→ CLEARED
//                             │         │                                │
//                             │         ↓                                ↓
//                             │      REJECTED ──→ (back to PENDING)    VOID ──→ (reissue creates new check)
//                             │
//                             └──→ PRINTED (if no approval required)
//
// Terminal states: CLEARED and VOID. Once a check reaches these,
// no further transitions are possible.
//
// Why VOID is not the same as DELETE:
// A voided check number is PERMANENTLY consumed. You can never
// reuse check #1001. This is a legal requirement — auditors must
// account for every check number, including voided ones.
// ═══════════════════════════════════════════════════════════════

type CheckStatus =
  | "NEW"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "PRINTED"
  | "CLEARED"
  | "VOID";

// Any check that has a number but is not finished can be voided, so none gets stuck.
// NEW drafts are deleted instead; CLEARED and VOID are final.
const ALLOWED_TRANSITIONS: Record<CheckStatus, CheckStatus[]> = {
  NEW: ["PENDING_APPROVAL", "APPROVED"],
  PENDING_APPROVAL: ["APPROVED", "REJECTED", "VOID"],
  APPROVED: ["PRINTED", "VOID"],
  REJECTED: ["PENDING_APPROVAL", "VOID"],
  PRINTED: ["CLEARED", "VOID"],
  CLEARED: [],
  VOID: [],
};

const TERMINAL_STATUSES: ReadonlySet<CheckStatus> = new Set(["CLEARED", "VOID"]);

export function assertTransition(from: CheckStatus, to: CheckStatus): void {
  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    throw new ValidationError(
      `Invalid status transition: cannot move from ${from} to ${to}`,
      { status: [`Allowed transitions from ${from}: ${allowed?.join(", ") || "none"}`] },
    );
  }
}

export function isTerminalStatus(status: CheckStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

// ═══════════════════════════════════════════════════════════════
// AMOUNT TO WORDS CONVERTER
//
// Converts a numeric dollar amount to its English word equivalent.
// Example: 3500.75 → "Three Thousand Five Hundred and 75/100"
//
// Why this exists:
// Under UCC Article 3-114, when the words on a check conflict
// with the numbers, the WORDS take legal precedence. This means
// a bug in this function could make a check legally worth a
// different amount than intended. This is why it's a pure function
// with exhaustive testing expectations.
//
// The "and XX/100" format for cents is the standard US banking
// convention. "75/100" means 75 cents out of 100, which is
// unambiguous and legally precise.
// ═══════════════════════════════════════════════════════════════

const ONES = [
  "", "One", "Two", "Three", "Four", "Five",
  "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen",
  "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];

const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty",
  "Sixty", "Seventy", "Eighty", "Ninety",
];

function convertGroup(n: number): string {
  if (n === 0) return "";
  if (n < 20) return ONES[n]!;
  if (n < 100) {
    const remainder = n % 10;
    return (TENS[Math.floor(n / 10)] ?? "") + (remainder ? `-${ONES[remainder] ?? ""}` : "");
  }
  const remainder = n % 100;
  return (ONES[Math.floor(n / 100)] ?? "") + " Hundred" + (remainder ? ` ${convertGroup(remainder)}` : "");
}

/** The largest amount a check can carry: Decimal(12,2) and the words converter both stop here. */
export const MAX_CHECK_AMOUNT = 999999.99;

/** True when `amount` is a whole number of cents (allowing for binary floating point). */
export function hasAtMostTwoDecimals(amount: number): boolean {
  const cents = amount * 100;
  return Number.isFinite(cents) && Math.abs(cents - Math.round(cents)) < 1e-6;
}

export function amountToWords(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0 || amount > MAX_CHECK_AMOUNT) {
    throw new ValidationError("Amount must be between 0 and 999,999.99", {
      amount: ["Amount out of range for check printing"],
    });
  }
  if (!hasAtMostTwoDecimals(amount)) {
    throw new ValidationError("Amount must be in whole cents", {
      amount: ["Amount must have at most 2 decimal places"],
    });
  }

  // Work in integer cents: splitting the float itself (amount % 1) is exposed to
  // binary rounding, and the words are the legally binding amount (UCC 3-114).
  const totalCents = Math.round(amount * 100);
  const dollars = Math.floor(totalCents / 100);
  const centsStr = String(totalCents % 100).padStart(2, "0");

  if (dollars === 0) {
    return `Zero and ${centsStr}/100`;
  }

  const thousands = Math.floor(dollars / 1000);
  const remainder = dollars % 1000;

  let words = "";
  if (thousands > 0) {
    words += convertGroup(thousands) + " Thousand";
    if (remainder > 0) words += " ";
  }
  if (remainder > 0) {
    words += convertGroup(remainder);
  }

  return `${words} and ${centsStr}/100`;
}

// ═══════════════════════════════════════════════════════════════
// CHECK DATE RANGE VALIDATION
//
// Business rule: Checks cannot be dated too far in the past or
// future. The thresholds come from CheckPrintingSettings:
//   - maxPastDays (default: 30) — prevents backdated checks
//   - maxFutureDays (default: 90) — prevents post-dated checks
//     beyond a reasonable window
//
// Why this matters in banking:
// - Past-dated checks: Banks may refuse to honor checks older
//   than 6 months (UCC 4-404), but businesses want tighter control
// - Future-dated checks: While legal, they create accounting
//   complexity and fraud risk
// ═══════════════════════════════════════════════════════════════

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Calendar day number in UTC. Check dates arrive as "YYYY-MM-DD" (UTC midnight) and are
// stored as @db.Date, so comparing in UTC gives the same answer on any server timezone.
function utcDayNumber(date: Date): number {
  return Math.floor(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / MS_PER_DAY,
  );
}

export function validateCheckDateRange(
  checkDate: Date,
  maxPastDays: number,
  maxFutureDays: number,
  now: Date = new Date(),
): { valid: boolean; error?: string } {
  const diffDays = utcDayNumber(new Date(checkDate)) - utcDayNumber(now);

  if (diffDays < -maxPastDays) {
    return {
      valid: false,
      error: `Check date cannot be more than ${maxPastDays} days in the past`,
    };
  }

  if (diffDays > maxFutureDays) {
    return {
      valid: false,
      error: `Check date cannot be more than ${maxFutureDays} days in the future`,
    };
  }

  return { valid: true };
}

// ═══════════════════════════════════════════════════════════════
// FORMATTING UTILITIES
// ═══════════════════════════════════════════════════════════════

export function formatAmount(amount: number | string): string {
  return Number(amount).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export function maskAccountNumber(last4: string): string {
  return `****${last4}`;
}
