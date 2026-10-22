import { ruleLabel } from "../approval-rule/rule-satisfiability.js";
import { usd, usDay } from "../export/index.js";

// ═══════════════════════════════════════════════════════════════
// WHAT EACH AUDIT ENTRY MEANS, IN WORDS
//
// The log stores codes (CHECK_APPROVED, details JSON). People read sentences:
// "approved check #005009 · $9,000.00 to Lala Company". Every action gets a category (for
// the filter) and a sentence; the actor's name is shown separately, so sentences start
// with the verb. An action with no sentence here still shows, as its code in words.
// ═══════════════════════════════════════════════════════════════

export const ACTIVITY_CATEGORIES = {
  checks: "Checks",
  approvals: "Approvals",
  printing: "Printing",
  downloads: "Downloads and exports",
  "bank-accounts": "Bank accounts",
  payees: "Payees",
  rules: "Approval rules and limits",
  printers: "Printer setup",
  team: "Team",
  business: "Business details",
  access: "Access refused",
  security: "Sign-ins and security",
  other: "Other",
} as const;

export type ActivityCategory = keyof typeof ACTIVITY_CATEGORIES;
export const WORKSPACE_CATEGORIES = Object.keys(ACTIVITY_CATEGORIES).filter((c) => c !== "security" && c !== "other") as ActivityCategory[];

// Company-level events shown to the owner, wherever platform-api filed them.
export const SECURITY_ACTIONS = [
  "USER_LOGIN",
  "USER_LOGOUT",
  "LOGIN_FAILED",
  "LOGIN_FAILED_INACTIVE",
  "LOGIN_FAILED_NO_TENANT",
  "ALL_SESSIONS_REVOKED",
  "USER_REGISTERED",
  "REFRESH_FAILED",
  "ACCESS_DENIED",
];

// ─── What a describer can look up ───────────────────────────

export interface CheckLabel {
  number: string;
  amount: string;
  payee: string;
}

export interface Labels {
  check(id: string): CheckLabel | undefined;
  bankAccount(id: string): string | undefined;
  payee(id: string): string | undefined;
  rule(id: string): string | undefined;
  printer(id: string): string | undefined;
  user(id: string): string | undefined;
}

export interface EntryFacts {
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, unknown>;
}

type Describe = (e: EntryFacts, d: Record<string, unknown>, L: Labels) => string;

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const ROLES: Record<string, string> = {
  "check-admin": "Admin",
  "check-editor": "Editor",
  "check-printer": "Printer",
  "check-approver": "Approver",
  "check-viewer": "Viewer",
};
export const roleNames = (slugs: unknown) =>
  Array.isArray(slugs) && slugs.length > 0 ? slugs.map((s) => ROLES[String(s)] ?? String(s)).join(", ") : "no role";

const REPORTS: Record<string, string> = {
  "check-register": "check register",
  "outstanding-checks": "outstanding checks report",
  "check-number-audit": "check-number audit",
  "activity-log": "activity log",
  "security-log": "sign-in and security log",
};
const FORMATS: Record<string, string> = { csv: "CSV", xlsx: "Excel", pdf: "PDF" };

// "check #005009 · $9,000.00 to Lala Company", from the check itself or, if it can't be
// found, from what the entry recorded.
function check(e: EntryFacts, d: Record<string, unknown>, L: Labels): string {
  const c = e.entityType === "Check" ? L.check(e.entityId) : undefined;
  if (c) return `check #${c.number} · ${usd(c.amount)} to ${c.payee}`;
  return d.checkNumber !== undefined ? `check #${str(d.checkNumber)}` : "a check";
}
const bank = (e: EntryFacts, d: Record<string, unknown>, L: Labels) =>
  L.bankAccount(e.entityId) ?? (d.bankName ? str(d.bankName) : "a bank account");
const payee = (e: EntryFacts, d: Record<string, unknown>, L: Labels) => `"${str(d.name) || L.payee(e.entityId) || "a payee"}"`;
const rule = (id: unknown, d: Record<string, unknown>, L: Labels) =>
  L.rule(str(id)) ?? (d.minAmount !== undefined ? ruleLabel(d.minAmount, d.maxAmount ?? null) : "an approval rule");
const printer = (e: EntryFacts, d: Record<string, unknown>, L: Labels) => `"${str(d.profileName) || L.printer(e.entityId) || "a printer"}"`;
const member = (d: Record<string, unknown>) => str(d.memberEmail ?? d.removedUserEmail) || "a member";
const numbers = (list: unknown) => {
  const n = Array.isArray(list) ? (list as number[]).slice().sort((a, b) => a - b) : [];
  return n.length === 0 ? "" : n.length === 1 ? `#${n[0]}` : `#${n[0]}–#${n[n.length - 1]}`;
};

const ACTIONS: Record<string, { category: ActivityCategory; describe: Describe }> = {
  // ── Checks ──
  CHECK_CREATED: {
    category: "checks",
    describe: (e, d, L) =>
      d.initialStatus === "PENDING_APPROVAL" ? `wrote ${check(e, d, L)} and sent it for approval` : `wrote ${check(e, d, L)}`,
  },
  CHECK_UPDATED: { category: "checks", describe: (e, d, L) => `edited ${check(e, d, L)}` },
  CHECK_DELETED: { category: "checks", describe: (e, d, L) => `deleted the draft ${check(e, d, L)}` },
  CHECK_VOIDED: {
    category: "checks",
    describe: (e, d, L) => `voided ${check(e, d, L)}${d.stopPaymentAdvised ? " after it was printed" : ""}`,
  },
  CHECK_CLEARED: {
    category: "checks",
    describe: (e, d, L) =>
      `marked ${check(e, d, L)} as cleared by the bank${
        d.clearedAmount !== undefined && Number(d.clearedAmount) !== Number(d.amount) ? `, for ${usd(Number(d.clearedAmount))}` : ""
      }`,
  },
  CHECK_REISSUED: {
    category: "checks",
    describe: (_e, d) => `reissued check #${str(d.originalCheckNumber)} as new check #${str(d.newCheckNumber)}`,
  },
  CHECK_ATTACHMENT_ADDED: { category: "checks", describe: (e, d, L) => `attached "${str(d.fileName)}" to ${check(e, d, L)}` },
  CHECK_ATTACHMENT_REMOVED: { category: "checks", describe: (e, d, L) => `removed "${str(d.fileName)}" from ${check(e, d, L)}` },

  // ── Approvals ──
  CHECK_SUBMITTED: { category: "approvals", describe: (e, d, L) => `sent ${check(e, d, L)} for approval` },
  CHECK_RESUBMITTED: { category: "approvals", describe: (e, d, L) => `sent ${check(e, d, L)} for approval again` },
  CHECK_APPROVAL_RECORDED: {
    category: "approvals",
    describe: (e, d, L) =>
      `approved ${check(e, d, L)}${d.requiredApprovals ? ` (${str(d.approvedCount)} of ${str(d.requiredApprovals)} approvals)` : ""}`,
  },
  CHECK_APPROVED: {
    category: "approvals",
    describe: (e, d, L) => `approved ${check(e, d, L)}${Number(d.requiredApprovals) > 1 ? " (final approval)" : ""}`,
  },
  CHECK_REJECTED: { category: "approvals", describe: (e, d, L) => `rejected ${check(e, d, L)}` },

  // ── Printing ──
  CHECK_PRINTED: {
    category: "printing",
    describe: (e, d, L) => `printed ${check(e, d, L)}${d.printBatchId ? " in a print job" : ""}`,
  },
  CHECK_PRINT_CONFIRMED: { category: "printing", describe: (e, d, L) => `confirmed ${check(e, d, L)} printed correctly` },
  CHECK_SPOILED: { category: "printing", describe: (e, d, L) => `reported ${check(e, d, L)} spoiled in the printer` },
  PRINT_BATCH_CREATED: {
    category: "printing",
    describe: (_e, d) => {
      const n = Array.isArray(d.checkNumbers) ? d.checkNumbers.length : 0;
      return `printed ${plural(n, "check")} in one job (${numbers(d.checkNumbers)})`;
    },
  },

  // ── Downloads and exports ──
  CHECK_PDF_DOWNLOADED: { category: "downloads", describe: (e, d, L) => `downloaded the PDF of ${check(e, d, L)}` },
  CHECK_ATTACHMENT_DOWNLOADED: { category: "downloads", describe: (e, d, L) => `downloaded "${str(d.fileName)}" from ${check(e, d, L)}` },
  PRINT_BATCH_PDF_DOWNLOADED: {
    category: "downloads",
    describe: (_e, d) => `downloaded the PDF of a print job (${numbers(d.checkNumbers)})`,
  },
  REPORT_EXPORTED: {
    category: "downloads",
    describe: (_e, d) =>
      `exported the ${REPORTS[str(d.report)] ?? "report"} as ${FORMATS[str(d.format)] ?? str(d.format)} (${plural(Number(d.rowCount ?? 0), "row")})`,
  },
  POSITIVE_PAY_EXPORTED: {
    category: "downloads",
    describe: (e, d, L) =>
      `downloaded the Positive Pay ${d.format === "xlsx" ? "review copy" : "file"} for ${bank(e, d, L)}: ${plural(Number(d.rowCount ?? 0), "check")} printed ${
        d.from ? usDay(new Date(`${str(d.from)}T00:00:00Z`)) : "?"
      } to ${d.to ? usDay(new Date(`${str(d.to)}T00:00:00Z`)) : "?"}`,
  },
  SIGNATURE_VIEWED: { category: "downloads", describe: (e, d, L) => `viewed the signature of ${bank(e, d, L)}` },

  // ── Bank accounts ──
  BANK_ACCOUNT_CREATED: { category: "bank-accounts", describe: (e, d, L) => `added bank account ${bank(e, d, L)}` },
  BANK_ACCOUNT_UPDATED: { category: "bank-accounts", describe: (e, d, L) => `changed bank account ${bank(e, d, L)}` },
  BANK_ACCOUNT_DELETED: { category: "bank-accounts", describe: (e, d, L) => `removed bank account ${bank(e, d, L)}` },
  BANK_ACCOUNT_RESTORED: { category: "bank-accounts", describe: (e, d, L) => `restored bank account ${bank(e, d, L)}` },
  SIGNATURE_UPLOADED: { category: "bank-accounts", describe: (e, d, L) => `uploaded the signature for ${bank(e, d, L)}` },
  SIGNATURE_REPLACED: { category: "bank-accounts", describe: (e, d, L) => `replaced the signature for ${bank(e, d, L)}` },
  SIGNATURE_REMOVED: { category: "bank-accounts", describe: (e, d, L) => `removed the signature from ${bank(e, d, L)}` },

  // ── Payees ──
  PAYEE_CREATED: { category: "payees", describe: (e, d, L) => `added payee ${payee(e, d, L)}` },
  PAYEE_UPDATED: { category: "payees", describe: (e, d, L) => `changed payee ${payee(e, d, L)}` },
  PAYEE_ARCHIVED: { category: "payees", describe: (e, d, L) => `archived payee ${payee(e, d, L)}` },
  PAYEE_RESTORED: { category: "payees", describe: (e, d, L) => `restored payee ${payee(e, d, L)}` },

  // ── Approval rules and limits ──
  APPROVAL_RULE_CREATED: {
    category: "rules",
    describe: (_e, d) =>
      `created an approval rule for ${ruleLabel(d.minAmount, d.maxAmount ?? null)}, needing ${plural(Number(d.requiredApprovals ?? 1), "approval")}`,
  },
  APPROVAL_RULE_UPDATED: { category: "rules", describe: (e, d, L) => `changed the approval rule for ${rule(e.entityId, d, L)}` },
  APPROVAL_RULE_ACTIVATED: { category: "rules", describe: (e, d, L) => `turned on the approval rule for ${rule(e.entityId, d, L)}` },
  APPROVAL_RULE_DEACTIVATED: { category: "rules", describe: (e, d, L) => `turned off the approval rule for ${rule(e.entityId, d, L)}` },
  APPROVAL_RULE_DELETED: { category: "rules", describe: (_e, d) => `deleted the approval rule for ${ruleLabel(d.minAmount, d.maxAmount ?? null)}` },
  APPROVER_ADDED: {
    category: "rules",
    describe: (_e, d, L) => `made ${L.user(str(d.approverUserId)) ?? "someone"} an approver for ${rule(d.ruleId, d, L)}`,
  },
  APPROVER_REMOVED: {
    category: "rules",
    describe: (_e, d, L) => `removed ${L.user(str(d.approverUserId)) ?? "someone"} as an approver for ${rule(d.ruleId, d, L)}`,
  },
  APPROVERS_SYNCED: {
    category: "rules",
    describe: (e, d, L) => {
      const ids = Array.isArray(d.approverUserIds) ? (d.approverUserIds as string[]) : [];
      const names = ids.map((id) => L.user(id) ?? "someone").join(", ");
      return ids.length === 0
        ? `removed all named approvers from ${rule(e.entityId, d, L)}`
        : `set the approvers for ${rule(e.entityId, d, L)}: ${names}`;
    },
  },
  APPROVAL_WORKFLOW_ENABLED: { category: "rules", describe: () => "turned check approvals on" },
  APPROVAL_WORKFLOW_DISABLED: { category: "rules", describe: () => "turned check approvals off" },
  CHECK_PRINTING_SETTINGS_UPDATED: { category: "rules", describe: () => "changed the check limits" },

  // ── Printer setup ──
  CALIBRATION_CREATED: { category: "printers", describe: (e, d, L) => `added printer ${printer(e, d, L)}` },
  CALIBRATION_COPIED: {
    category: "printers",
    describe: (e, d, L) => `copied printer "${str(d.sourceProfileName)}" as ${printer(e, d, L)}`,
  },
  CALIBRATION_UPDATED: { category: "printers", describe: (e, d, L) => `changed printer ${printer(e, d, L)}` },
  CALIBRATION_RECALIBRATED: { category: "printers", describe: (e, d, L) => `recalibrated printer ${printer(e, d, L)}` },
  CALIBRATION_VERIFIED: { category: "printers", describe: (e, d, L) => `verified printer ${printer(e, d, L)}` },
  CALIBRATION_VERIFICATION_FAILED: { category: "printers", describe: (e, d, L) => `tried to verify printer ${printer(e, d, L)}; it failed` },
  CALIBRATION_ADJUSTED: { category: "printers", describe: (e, d, L) => `adjusted the print position of ${printer(e, d, L)}` },
  CALIBRATION_DEFAULT_SET: { category: "printers", describe: (e, d, L) => `made ${printer(e, d, L)} the default printer` },
  CALIBRATION_DELETED: { category: "printers", describe: (e, d, L) => `removed printer ${printer(e, d, L)}` },

  // ── Team ──
  MEMBER_ADDED: { category: "team", describe: (_e, d) => `invited ${member(d)} as ${roleNames(d.roleSlugs)}` },
  MEMBER_UPDATED: { category: "team", describe: (_e, d) => `changed the role of ${member(d)}` },
  MEMBER_REMOVED: { category: "team", describe: (_e, d) => `removed ${member(d)} from the workspace` },
  INVITATION_RESENT: { category: "team", describe: (_e, d) => `sent a new invitation to ${member(d)}` },
  // Written by platform-api's email worker once the email has actually gone out.
  INVITATION_SENT: { category: "team", describe: (_e, d) => `invitation email delivered to ${str(d.email) || "the new member"}` },
  WORKSPACE_ACCESS_EMAIL_SENT: {
    category: "team",
    describe: (_e, d) => `email delivered to ${str(d.email) || "a member"}: they now have access to this workspace`,
  },
  INVITATION_ACCEPTED: { category: "team", describe: () => "accepted the invitation and joined" },

  // ── Business details ──
  WORKSPACE_CREATED: { category: "business", describe: (_e, d) => `created the workspace${d.businessName ? ` "${str(d.businessName)}"` : ""}` },
  WORKSPACE_UPDATED: { category: "business", describe: () => "changed the business details printed on checks" },
  WORKSPACE_DELETED: { category: "business", describe: () => "deleted the workspace" },

  // ── Access refused ──
  ACCESS_DENIED: {
    category: "access",
    describe: (_e, d) =>
      d.reason === "NO_PRODUCT_ROLE"
        ? "was refused: no role in Check Printing"
        : `was refused${d.required ? ` (needs ${str(d.required)})` : ""}: ${str(d.method)} ${str(d.url).replace(/\?.*$/, "")}`,
  },

  // ── Sign-ins and security ──
  USER_LOGIN: { category: "security", describe: () => "signed in" },
  USER_LOGOUT: { category: "security", describe: () => "signed out" },
  LOGIN_FAILED: { category: "security", describe: () => "failed to sign in (wrong password)" },
  LOGIN_FAILED_INACTIVE: { category: "security", describe: () => "tried to sign in to a deactivated account" },
  LOGIN_FAILED_NO_TENANT: { category: "security", describe: () => "tried to sign in without access to any company" },
  ALL_SESSIONS_REVOKED: { category: "security", describe: () => "signed out on every device" },
  USER_REGISTERED: { category: "security", describe: () => "created an account" },
  REFRESH_FAILED: { category: "security", describe: () => "had an expired or invalid session refused" },
};

export function categoryOf(action: string): ActivityCategory {
  return ACTIONS[action]?.category ?? "other";
}

export function actionsIn(categories: readonly ActivityCategory[]): string[] {
  return Object.entries(ACTIONS)
    .filter(([, a]) => categories.includes(a.category))
    .map(([action]) => action);
}

export function describe(e: EntryFacts, labels: Labels): string {
  const known = ACTIONS[e.action];
  if (known) return known.describe(e, e.details, labels);
  return e.action.toLowerCase().replace(/_/g, " ");
}

// ─── Before → after, for people ─────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  payeeName: "Payee",
  amount: "Amount",
  checkDate: "Check date",
  memo: "Memo",
  invoiceTableJson: "Invoice lines",
  minAmount: "From amount",
  maxAmount: "Up to amount",
  priority: "Priority",
  requiredApprovals: "Approvals needed",
  allowSelfApproval: "Writer may approve own check",
  accountType: "Account type",
  checkNumberPadding: "Check number digits",
  isActive: "Active",
  maxCheckAmount: "Largest check allowed",
  maxPastDays: "Check date: days back allowed",
  maxFutureDays: "Check date: days ahead allowed",
  name: "Name",
  defaultMemo: "Default memo",
  businessName: "Business name",
  addressLine1: "Address",
  addressLine2: "Address line 2",
  city: "City",
  state: "State",
  zipCode: "ZIP code",
  zip: "ZIP code",
  phone: "Phone",
  email: "Email",
  roles: "Role",
};
const FIELD_ORDER = Object.keys(FIELD_LABELS);
const MONEY_FIELDS = new Set(["amount", "minAmount", "maxAmount", "maxCheckAmount", "clearedAmount"]);

export function formatValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "(empty)";
  if (MONEY_FIELDS.has(field) && !Number.isNaN(Number(value))) return usd(Number(value));
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return field === "invoiceTableJson" ? plural(value.length, "line") : value.map(String).join(", ");
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return usDay(new Date(`${value}T00:00:00Z`));
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export interface ActivityChange {
  field: string;
  label: string;
  from: string;
  to: string;
}

// Entries store changes as { field: { from, to } }. Member role changes store the old and
// new role lists; approval-rule edits from before 2026-10-22 stored only the new values.
export function changesOf(action: string, d: Record<string, unknown>): ActivityChange[] {
  if (action === "MEMBER_UPDATED" && Array.isArray(d.roleSlugs)) {
    return [{ field: "roles", label: "Role", from: roleNames(d.previousRoleSlugs), to: roleNames(d.roleSlugs) }];
  }
  const raw = d.changes;
  if (!raw || typeof raw !== "object") return [];
  // Postgres (jsonb) does not keep key order, so fields are shown in a fixed order: the
  // order of FIELD_LABELS (payee, amount, date, memo…), unknown fields last.
  const rank = (field: string) => {
    const i = FIELD_ORDER.indexOf(field);
    return i === -1 ? FIELD_ORDER.length : i;
  };
  const entries = Object.entries(raw as Record<string, unknown>).sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b));
  return entries.map(([field, v]) => {
    const pair = v && typeof v === "object" && "to" in (v as object) ? (v as { from?: unknown; to: unknown }) : null;
    return {
      field,
      label: FIELD_LABELS[field] ?? field,
      from: pair ? formatValue(field, pair.from) : "(not recorded)",
      to: formatValue(field, pair ? pair.to : v),
    };
  });
}

// The free-text reason someone gave (rejecting, voiding, spoiling), shown on its own line.
export function reasonOf(d: Record<string, unknown>): string | null {
  return typeof d.reason === "string" && d.reason.trim() && d.reason !== "INVALID_PASSWORD" && d.reason !== "NO_PRODUCT_ROLE"
    ? d.reason
    : null;
}
