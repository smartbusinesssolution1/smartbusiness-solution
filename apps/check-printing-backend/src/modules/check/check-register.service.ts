import type { Prisma } from "@smartbusiness/database";
import { ForbiddenError, NotFoundError } from "../../shared/errors/index.js";
import { PERMISSIONS, type PermissionAction } from "../../shared/constants/rbac.js";
import type { CheckPrintingSettingsService } from "../check-printing-settings/check-printing-settings.service.js";
import type { CheckRepository } from "./check.repository.js";
import type { CheckService } from "./check.service.js";
import {
  checkFilterQuerySchema,
  decodeCursor,
  encodeCursor,
  type CheckFilter,
  type RegisterView,
  type SortField,
  type SortOrder,
} from "./check-filter.js";
import { buildCheckWhere } from "./check-query.js";
import { CheckRegisterRepository, type PossibleDuplicate, type RegisterRow } from "./check-register.repository.js";

// ═══════════════════════════════════════════════════════════════
// THE CHECK REGISTER (F06)
//
// The list with every filter, totals and facets; the action-inbox views; check-number
// integrity; outstanding aging; possible-duplicate flags. Views and flags are computed from
// the data on each request (nothing stored, nothing to drift out of date).
// ═══════════════════════════════════════════════════════════════

const DAY_MS = 24 * 60 * 60 * 1000;
export const STALE_AFTER_DAYS = 90;
const INTEGRITY_MAX_RANGE = 1000;

export interface Viewer {
  userId: string;
  permissions: string[];
}

const VIEW_DEFINITIONS: Array<{ view: RegisterView; label: string; requires?: PermissionAction }> = [
  { view: "awaiting-my-approval", label: "Awaiting my approval", requires: PERMISSIONS.CHECK_APPROVE },
  { view: "my-drafts", label: "My drafts and rejected checks", requires: PERMISSIONS.CHECK_CREATE },
  { view: "ready-to-print", label: "Ready to print", requires: PERMISSIONS.CHECK_PRINT },
  { view: "print-unconfirmed", label: "Printed, outcome not reported", requires: PERMISSIONS.CHECK_PRINT },
  { view: "outstanding", label: "Outstanding (printed, not cleared)" },
  { view: "stale", label: `Stale (printed over ${STALE_AFTER_DAYS} days ago, not cleared)` },
  { view: "voided", label: "Voided" },
];

const EMPTY_FILTER: CheckFilter = checkFilterQuerySchema.parse({});

const money = (value: Prisma.Decimal | null | undefined) => (value ? value.toFixed(2) : "0.00");

export class CheckRegisterService {
  constructor(
    private readonly repository: CheckRegisterRepository,
    private readonly checkRepository: CheckRepository,
    private readonly checkService: CheckService,
    private readonly settingsService: CheckPrintingSettingsService,
  ) {}

  // ─── The list ─────────────────────────────────────────────

  async list(workspaceId: string, f: CheckFilter, viewer: Viewer) {
    const extra = await this.extraConditions(workspaceId, f, viewer);
    const where = buildCheckWhere(workspaceId, f, { extra });
    const orderBy: Prisma.CheckOrderByWithRelationInput[] = [{ [f.sortBy]: f.sortOrder }, { id: f.sortOrder }];

    let rows: RegisterRow[];
    let meta: Record<string, unknown>;
    if (f.page !== undefined) {
      // Page numbers, kept for existing clients.
      const [pageRows, total] = await Promise.all([
        this.repository.findPage(where, orderBy, f.limit, (f.page - 1) * f.limit),
        this.repository.count(where),
      ]);
      rows = pageRows;
      const totalPages = Math.ceil(total / f.limit);
      meta = { total, page: f.page, limit: f.limit, totalPages, hasMore: f.page < totalPages };
    } else {
      const after = f.cursor ? cursorCondition(f.sortBy, f.sortOrder, decodeCursor(f.cursor, f.sortBy, f.sortOrder)) : undefined;
      const fetched = await this.repository.findPage(after ? { AND: [where, after] } : where, orderBy, f.limit + 1);
      const hasMore = fetched.length > f.limit;
      rows = fetched.slice(0, f.limit);
      const last = rows[rows.length - 1];
      meta = {
        limit: f.limit,
        hasMore,
        nextCursor: hasMore && last ? encodeCursor({ sortBy: f.sortBy, sortOrder: f.sortOrder, value: sortValue(last, f.sortBy), id: last.id }) : null,
      };
    }

    const duplicates = firstDuplicateByCheck(await this.repository.findPossibleDuplicates(workspaceId, rows.map((r) => r.id)));

    if (f.include?.includes("totals")) {
      const totals = await this.repository.totals(where);
      meta.totals = { count: totals.count, amount: money(totals.amount) };
    }
    if (f.include?.includes("facets")) {
      const [status, bankAccount] = await Promise.all([
        this.repository.facet(buildCheckWhere(workspaceId, f, { extra, omit: "status" }), "status"),
        this.repository.facet(buildCheckWhere(workspaceId, f, { extra, omit: "bankAccountId" }), "bankAccountId"),
      ]);
      const toMap = (groups: typeof status) =>
        Object.fromEntries(groups.map((g) => [g.key, { count: g.count, amount: money(g.amount) }]));
      meta.facets = { status: toMap(status), bankAccount: toMap(bankAccount) };
    }

    return { items: rows.map((row) => formatRegisterItem(row, duplicates.get(row.id) ?? null)), meta };
  }

  // ─── The action inbox ─────────────────────────────────────

  async views(workspaceId: string, viewer: Viewer) {
    const allowed = VIEW_DEFINITIONS.filter((v) => !v.requires || viewer.permissions.includes(v.requires));
    return Promise.all(
      allowed.map(async ({ view, label }) => {
        const condition = await this.viewCondition(workspaceId, view, viewer);
        const totals = await this.repository.totals(buildCheckWhere(workspaceId, EMPTY_FILTER, { extra: [condition] }));
        return { view, label, count: totals.count, amount: money(totals.amount) };
      }),
    );
  }

  // ─── Check-number integrity ───────────────────────────────

  // Every number in the range with its fate. MISSING (a number between the first issued and
  // the next to issue, with no record at all) should never happen: it is an alarm.
  async numberIntegrity(workspaceId: string, bankAccountId: string, from: number, to: number) {
    const account = await this.repository.findAccountForAudit(bankAccountId, workspaceId);
    if (!account) throw new NotFoundError("Bank account");

    const [firstIssued, checks] = await Promise.all([
      this.repository.firstIssuedNumber(account.id),
      this.repository.numbersInRange(account.id, from, to),
    ]);
    const byNumber = new Map(checks.map((c) => [c.checkNumber, c]));
    const summary: Record<string, number> = {};
    const rows = [];

    for (let n = from; n <= to; n++) {
      const check = byNumber.get(n);
      let row: Record<string, unknown>;
      if (check) {
        row = {
          checkNumber: n,
          state: check.deletedAt ? "DELETED_DRAFT" : check.status,
          checkId: check.id,
          payeeName: check.payeeName,
          amount: check.amount.toFixed(2),
          voidType: check.voidType,
          voidReason: check.voidReason,
        };
      } else {
        const issuedRange = firstIssued !== null && n >= firstIssued && n < account.nextCheckNumber;
        row = { checkNumber: n, state: issuedRange ? "MISSING" : "NOT_ISSUED" };
      }
      summary[row.state as string] = (summary[row.state as string] ?? 0) + 1;
      rows.push(row);
    }

    return {
      bankAccount: { id: account.id, bankName: account.bankName, accountNumber: `****${account.accountNumberLast4}` },
      range: { from, to },
      nextCheckNumber: account.nextCheckNumber,
      summary,
      rows,
    };
  }

  // ─── Outstanding aging ────────────────────────────────────

  async aging(workspaceId: string, bankAccountId?: string) {
    const now = Date.now();
    const buckets = [
      { label: "0-30 days", minDays: 0, maxDays: 30, count: 0, cents: 0 },
      { label: "31-60 days", minDays: 31, maxDays: 60, count: 0, cents: 0 },
      { label: "61-90 days", minDays: 61, maxDays: STALE_AFTER_DAYS, count: 0, cents: 0 },
      { label: `over ${STALE_AFTER_DAYS} days (stale)`, minDays: STALE_AFTER_DAYS + 1, maxDays: null as number | null, count: 0, cents: 0 },
    ];
    for (const check of await this.repository.outstanding(workspaceId, bankAccountId)) {
      const age = check.printedAt ? Math.floor((now - check.printedAt.getTime()) / DAY_MS) : 0;
      const bucket = buckets.find((b) => age >= b.minDays && (b.maxDays === null || age <= b.maxDays)) ?? buckets[0]!;
      bucket.count += 1;
      // Integer cents: summing decimal amounts as floats drifts.
      bucket.cents += Math.round(Number(check.amount) * 100);
    }
    const cents = (c: number) => (c / 100).toFixed(2);
    const totalCents = buckets.reduce((sum, b) => sum + b.cents, 0);
    return {
      asOf: new Date(now).toISOString(),
      staleAfterDays: STALE_AFTER_DAYS,
      buckets: buckets.map((b) => ({ label: b.label, minDays: b.minDays, maxDays: b.maxDays, count: b.count, amount: cents(b.cents) })),
      total: { count: buckets.reduce((sum, b) => sum + b.count, 0), amount: cents(totalCents) },
    };
  }

  // ─── Conditions that are not plain filters ────────────────

  private async extraConditions(workspaceId: string, f: CheckFilter, viewer: Viewer): Promise<Prisma.CheckWhereInput[]> {
    const extra: Prisma.CheckWhereInput[] = [];
    if (f.view) extra.push(await this.viewCondition(workspaceId, f.view, viewer));
    if (f.possibleDuplicate !== undefined) {
      const ids = [...new Set((await this.repository.findPossibleDuplicates(workspaceId)).map((d) => d.checkId))];
      extra.push(f.possibleDuplicate ? { id: { in: ids } } : { id: { notIn: ids } });
    }
    return extra;
  }

  private async viewCondition(workspaceId: string, view: RegisterView, viewer: Viewer): Promise<Prisma.CheckWhereInput> {
    const definition = VIEW_DEFINITIONS.find((v) => v.view === view)!;
    if (definition.requires && !viewer.permissions.includes(definition.requires)) {
      throw new ForbiddenError(`The "${definition.label}" view needs the ${definition.requires} permission.`);
    }

    switch (view) {
      case "awaiting-my-approval": {
        // The approval queue already applies designated approvers, self-approval and votes cast.
        const queue = await this.checkService.getApprovalQueue(workspaceId, viewer.userId);
        return { id: { in: queue.map((c) => c.id) } };
      }
      case "my-drafts":
        return { status: { in: ["NEW", "REJECTED"] }, createdById: viewer.userId };
      case "ready-to-print":
        return { OR: [{ status: "APPROVED" }, { status: "NEW", ...(await this.draftsNeedingNoApproval(workspaceId)) }] };
      case "print-unconfirmed":
        return { status: "PRINTED", printConfirmedAt: null };
      case "outstanding":
        return { status: "PRINTED" };
      case "stale":
        return { status: "PRINTED", printedAt: { lt: new Date(Date.now() - STALE_AFTER_DAYS * DAY_MS) } };
      case "voided":
        return { status: "VOID" };
    }
  }

  // Drafts print directly when the workflow is off or no active rule covers their amount (R-03).
  private async draftsNeedingNoApproval(workspaceId: string): Promise<Prisma.CheckWhereInput> {
    const settings = await this.settingsService.forWorkspace(workspaceId);
    if (!settings.approvalEnabled) return {};
    const rules = await this.checkRepository.findApprovalRules(workspaceId);
    if (rules.length === 0) return {};
    return {
      NOT: {
        OR: rules.map((rule) => ({
          amount: { gte: rule.minAmount ?? 0, ...(rule.maxAmount !== null && { lte: rule.maxAmount }) },
        })),
      },
    };
  }
}

// ─── Helpers ──────────────────────────────────────────────────

function sortValue(row: RegisterRow, sortBy: SortField): string {
  const value = row[sortBy];
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function parseSortValue(sortBy: SortField, value: string): unknown {
  if (sortBy === "checkNumber") return Number(value);
  if (sortBy === "createdAt" || sortBy === "checkDate") return new Date(value);
  return value; // amount (decimal string) and payee name
}

// Strictly after the last row of the previous page, with the id breaking ties.
function cursorCondition(sortBy: SortField, sortOrder: SortOrder, cursor: { value: string; id: string }): Prisma.CheckWhereInput {
  const op = sortOrder === "asc" ? "gt" : "lt";
  const value = parseSortValue(sortBy, cursor.value);
  return {
    OR: [
      { [sortBy]: { [op]: value } },
      { [sortBy]: value, id: { [op]: cursor.id } },
    ],
  };
}

function firstDuplicateByCheck(duplicates: PossibleDuplicate[]): Map<string, { id: string; checkNumber: number }> {
  const map = new Map<string, { id: string; checkNumber: number }>();
  for (const d of duplicates) {
    if (!map.has(d.checkId)) map.set(d.checkId, { id: d.duplicateId, checkNumber: d.duplicateNumber });
  }
  return map;
}

function formatRegisterItem(check: RegisterRow, possibleDuplicateOf: { id: string; checkNumber: number } | null) {
  return {
    id: check.id,
    checkNumber: check.checkNumber,
    status: check.status,
    payeeName: check.payeeName,
    amount: check.amount.toFixed(2),
    checkDate: check.checkDate,
    memo: check.memo,
    createdBy: { id: check.createdBy.id, fullName: check.createdBy.fullName },
    bankAccount: {
      id: check.bankAccount.id,
      bankName: check.bankAccount.bankName,
      accountNumber: `****${check.bankAccount.accountNumberLast4}`,
      accountType: check.bankAccount.accountType,
    },
    printedAt: check.printedAt,
    printConfirmedAt: check.printConfirmedAt,
    clearedDate: check.clearedDate,
    voidType: check.voidType,
    hasAttachments: check._count.attachments > 0,
    possibleDuplicateOf,
    createdAt: check.createdAt,
  };
}
