import { NotFoundError, ValidationError } from "../../shared/errors/index.js";
import type { AuditService } from "../../shared/services/audit.service.js";
import type { EncryptionService } from "../../shared/services/encryption.service.js";
import {
  isoMinute,
  renderCsv,
  renderExport,
  usDay,
  usd,
  type ExportColumn,
  type ExportFormat,
  type ExportTable,
  type RenderedFile,
} from "../export/index.js";
import type { CheckFilter } from "./check-filter.js";
import type { CheckExportRepository, ExportRow } from "./check-export.repository.js";
import { STALE_AFTER_DAYS, type CheckRegisterService, type Viewer } from "./check-register.service.js";

// One file holds at most this many checks: larger exports should be narrowed (by date or
// bank account), which also keeps each request quick.
export const EXPORT_MAX_ROWS = 10_000;

const DAY_MS = 24 * 60 * 60 * 1000;

const STATUS: Record<string, string> = {
  NEW: "New",
  PENDING_APPROVAL: "Pending approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PRINTED: "Printed",
  CLEARED: "Cleared",
  VOID: "Void",
};
const VOID_TYPE: Record<string, string> = {
  CANCELLED: "Cancelled",
  SPOILED: "Spoiled",
  VOIDED_AFTER_PRINT: "Voided after printing",
};
const VIEW: Record<string, string> = {
  "awaiting-my-approval": "Awaiting my approval",
  "my-drafts": "My drafts and rejected checks",
  "ready-to-print": "Ready to print",
  "print-unconfirmed": "Printed, outcome not reported",
  outstanding: "Outstanding",
  stale: `Stale (over ${STALE_AFTER_DAYS} days)`,
  voided: "Voided",
};

const money = (v: { toFixed(n: number): string } | null | undefined) => (v ? v.toFixed(2) : null);
const bank = (r: ExportRow) => `${r.bankAccount.bankName} ****${r.bankAccount.accountNumberLast4}`;
const stamp = (d: Date) => isoMinute(d).replace(/[: ]/g, "-");

export interface ExportContext {
  tenantId: string;
  userId: string;
  ipAddress?: string;
  viewer: Viewer;
}

// Every file that leaves the server is recorded first: no audit row, no file.
interface ExportRecord {
  action: "REPORT_EXPORTED" | "POSITIVE_PAY_EXPORTED";
  report: string;
  entityType: string;
  entityId: string;
  details: Record<string, unknown>;
}

export class CheckExportService {
  constructor(
    private readonly repo: CheckExportRepository,
    private readonly register: CheckRegisterService,
    private readonly encryption: EncryptionService,
    private readonly audit: AuditService,
  ) {}

  // ═════════════════════════════════════════════════════════════
  // THE CHECK REGISTER, with the list's own filters and sort
  // ═════════════════════════════════════════════════════════════

  async registerExport(workspaceId: string, filter: CheckFilter, format: ExportFormat, ctx: ExportContext) {
    const { where, orderBy } = await this.register.query(workspaceId, filter, ctx.viewer);
    const count = await this.repo.count(where);
    if (count > EXPORT_MAX_ROWS) {
      throw new ValidationError(
        `These filters match ${count.toLocaleString("en-US")} checks; one export holds at most ${EXPORT_MAX_ROWS.toLocaleString("en-US")}. Narrow the dates or choose one bank account.`,
        { filters: ["Too many checks for one export"] },
      );
    }
    const rows = await this.repo.rows(where, orderBy, EXPORT_MAX_ROWS);
    const now = new Date();

    // pdf: false columns are in the CSV and the spreadsheet only. The widths are measured so
    // a bank name with its last 4, a full date and time, and "Voided after printing" all fit
    // the printed page uncut; only free text (payee, memo, names) may end in "…".
    const columns: ExportColumn[] = [
      { key: "checkNumber", label: "Check #", type: "integer", width: 0.7 },
      { key: "bank", label: "Bank account", type: "text", width: 1.9 },
      { key: "checkDate", label: "Check date", type: "date", width: 0.9 },
      { key: "payee", label: "Payee", type: "text", width: 2.3 },
      { key: "amount", label: "Amount", type: "money", width: 1.15 },
      { key: "memo", label: "Memo", type: "text", width: 1.2 },
      { key: "status", label: "Status", type: "text", width: 1.3 },
      { key: "voidType", label: "Void type", type: "text", width: 1.45 },
      { key: "voidReason", label: "Void reason", type: "text", width: 1.4, pdf: false },
      { key: "writtenBy", label: "Written by", type: "text", width: 1.05 },
      { key: "writtenAt", label: "Written at (UTC)", type: "datetime", width: 1.3, pdf: false },
      { key: "printedBy", label: "Printed by", type: "text", width: 1.1, pdf: false },
      { key: "printedAt", label: "Printed at (UTC)", type: "datetime", width: 1.3 },
      { key: "printConfirmed", label: "Print confirmed", type: "text", width: 0.8, pdf: false },
      { key: "clearedDate", label: "Cleared date", type: "date", width: 0.9 },
      { key: "clearedAmount", label: "Cleared amount", type: "money", width: 1.2, pdf: false },
    ];

    let cents = 0;
    const tableRows = rows.map((r) => {
      cents += Math.round(Number(r.amount) * 100);
      return {
        checkNumber: r.checkNumber,
        bank: bank(r),
        checkDate: r.checkDate,
        payee: r.payeeName,
        amount: money(r.amount),
        memo: r.memo,
        status: STATUS[r.status] ?? r.status,
        voidType: r.voidType ? VOID_TYPE[r.voidType] : null,
        voidReason: r.voidReason,
        writtenBy: r.createdBy.fullName,
        writtenAt: r.createdAt,
        printedBy: r.printedBy?.fullName ?? null,
        printedAt: r.printedAt,
        printConfirmed: r.printedAt ? (r.printConfirmedAt ? "Yes" : "No") : null,
        clearedDate: r.clearedDate,
        clearedAmount: money(r.clearedAmount),
      };
    });

    const table: ExportTable = {
      title: "Check register",
      subtitle: await this.subtitle(workspaceId, ctx.userId, now, await this.describeFilter(workspaceId, filter)),
      columns,
      rows: tableRows,
      totals: { payee: `Total: ${rows.length} ${rows.length === 1 ? "check" : "checks"}`, amount: (cents / 100).toFixed(2) },
      fileName: `check-register-${stamp(now)}`,
    };
    const file = await renderExport(table, format, now);
    await this.record(workspaceId, ctx, file, {
      action: "REPORT_EXPORTED",
      report: "check-register",
      entityType: "Workspace",
      entityId: workspaceId,
      details: { format, rowCount: rows.length, filter: exportedFilter(filter) },
    });
    return file;
  }

  // ═════════════════════════════════════════════════════════════
  // OUTSTANDING CHECKS (printed, not cleared), oldest first, with their age
  // ═════════════════════════════════════════════════════════════

  async outstandingExport(workspaceId: string, bankAccountId: string | undefined, format: ExportFormat, ctx: ExportContext) {
    const rows = await this.repo.outstanding(workspaceId, bankAccountId);
    const now = new Date();
    let cents = 0;
    const band = (days: number) =>
      days <= 30 ? "0-30 days" : days <= 60 ? "31-60 days" : days <= STALE_AFTER_DAYS ? `61-${STALE_AFTER_DAYS} days` : `over ${STALE_AFTER_DAYS} days (stale)`;

    const table: ExportTable = {
      title: "Outstanding checks",
      subtitle: await this.subtitle(
        workspaceId,
        ctx.userId,
        now,
        bankAccountId ? `Bank account: ${(await this.repo.bankAccountLabels(workspaceId, [bankAccountId])).get(bankAccountId) ?? "unknown"}` : "All bank accounts",
      ),
      columns: [
        { key: "checkNumber", label: "Check #", type: "integer", width: 0.7 },
        { key: "bank", label: "Bank account", type: "text", width: 1.9 },
        { key: "checkDate", label: "Check date", type: "date", width: 0.9 },
        { key: "payee", label: "Payee", type: "text", width: 2.3 },
        { key: "amount", label: "Amount", type: "money", width: 1.15 },
        { key: "printedAt", label: "Printed at (UTC)", type: "datetime", width: 1.3 },
        { key: "ageDays", label: "Days outstanding", type: "integer", width: 0.9 },
        { key: "band", label: "Age", type: "text", width: 1.2 },
      ],
      rows: rows.map((r) => {
        cents += Math.round(Number(r.amount) * 100);
        const ageDays = r.printedAt ? Math.floor((now.getTime() - r.printedAt.getTime()) / DAY_MS) : 0;
        return {
          checkNumber: r.checkNumber,
          bank: bank(r),
          checkDate: r.checkDate,
          payee: r.payeeName,
          amount: money(r.amount),
          printedAt: r.printedAt,
          ageDays,
          band: band(ageDays),
        };
      }),
      fileName: `outstanding-checks-${stamp(now)}`,
    };
    table.totals = { payee: `Total: ${rows.length} outstanding`, amount: (cents / 100).toFixed(2) };
    const file = await renderExport(table, format, now);
    await this.record(workspaceId, ctx, file, {
      action: "REPORT_EXPORTED",
      report: "outstanding-checks",
      entityType: bankAccountId ? "BankAccount" : "Workspace",
      entityId: bankAccountId ?? workspaceId,
      details: { format, rowCount: rows.length },
    });
    return file;
  }

  // ═════════════════════════════════════════════════════════════
  // CHECK-NUMBER AUDIT: every number in the range and what became of it
  // ═════════════════════════════════════════════════════════════

  async numberAuditExport(workspaceId: string, bankAccountId: string, from: number, to: number, format: ExportFormat, ctx: ExportContext) {
    const audit = await this.register.numberIntegrity(workspaceId, bankAccountId, from, to);
    const now = new Date();
    const state: Record<string, string> = {
      ...STATUS,
      DELETED_DRAFT: "Deleted draft",
      MISSING: "MISSING (no record)",
      NOT_ISSUED: "Not issued yet",
    };
    const summary = Object.entries(audit.summary)
      .map(([k, n]) => `${state[k] ?? k}: ${n}`)
      .join(" · ");

    const table: ExportTable = {
      title: "Check-number audit",
      subtitle: await this.subtitle(
        workspaceId,
        ctx.userId,
        now,
        `${audit.bankAccount.bankName} ${audit.bankAccount.accountNumber} · numbers ${from} to ${to} · next number to issue: ${audit.nextCheckNumber}`,
        summary,
      ),
      columns: [
        { key: "checkNumber", label: "Check #", type: "integer", width: 0.7 },
        { key: "state", label: "State", type: "text", width: 1.3 },
        { key: "payee", label: "Payee", type: "text", width: 2 },
        { key: "amount", label: "Amount", type: "money", width: 1 },
        { key: "voidType", label: "Void type", type: "text", width: 1.1 },
        { key: "voidReason", label: "Void reason", type: "text", width: 2 },
      ],
      rows: audit.rows.map((r) => {
        const row = r as Record<string, unknown>;
        return {
          checkNumber: row.checkNumber as number,
          state: state[row.state as string] ?? (row.state as string),
          payee: (row.payeeName as string | undefined) ?? null,
          amount: (row.amount as string | undefined) ?? null,
          voidType: row.voidType ? VOID_TYPE[row.voidType as string] : null,
          voidReason: (row.voidReason as string | null | undefined) ?? null,
        };
      }),
      fileName: `check-number-audit-${from}-${to}-${stamp(now)}`,
    };
    const file = await renderExport(table, format, now);
    await this.record(workspaceId, ctx, file, {
      action: "REPORT_EXPORTED",
      report: "check-number-audit",
      entityType: "BankAccount",
      entityId: bankAccountId,
      details: { format, from, to, rowCount: audit.rows.length, summary: audit.summary },
    });
    return file;
  }

  // ═════════════════════════════════════════════════════════════
  // POSITIVE PAY: the issued-checks file for the bank
  //
  // The bank compares every check presented for payment with this list and refuses one
  // that is not on it, or whose amount differs, or that is marked void. It holds the FULL
  // account and routing numbers (the bank needs them), so only people who manage bank
  // accounts may download it, and every download is audited.
  //
  // Generic layout every bank portal can map: Account, Routing, Check number, Issue date
  // (MM/DD/YYYY), Amount (1250.50), Payee, Void ("V"). No byte-order mark: some bank
  // uploaders reject it. Once the client's bank is known, its exact template goes here.
  // ═════════════════════════════════════════════════════════════

  async positivePay(workspaceId: string, bankAccountId: string, from: Date, to: Date, ctx: ExportContext): Promise<RenderedFile> {
    const account = await this.repo.bankAccountForPositivePay(bankAccountId, workspaceId);
    if (!account) throw new NotFoundError("Bank account");

    const accountNumber = this.encryption.decrypt(account.accountNumberEncrypted);
    const routingNumber = this.encryption.decrypt(account.routingNumberEncrypted);
    const checks = await this.repo.issuedChecks(account.id, workspaceId, from, new Date(to.getTime() + DAY_MS));

    const columns: ExportColumn[] = [
      { key: "account", label: "Account Number", type: "text" },
      { key: "routing", label: "Routing Number", type: "text" },
      { key: "checkNumber", label: "Check Number", type: "integer" },
      { key: "issueDate", label: "Issue Date", type: "text" },
      { key: "amount", label: "Amount", type: "money" },
      { key: "payee", label: "Payee", type: "text" },
      { key: "void", label: "Void", type: "text" },
    ];
    const rows = checks.map((c) => ({
      account: accountNumber,
      routing: routingNumber,
      checkNumber: c.checkNumber,
      issueDate: usDay(c.checkDate),
      amount: c.amount.toFixed(2),
      payee: c.payeeName,
      void: c.status === "VOID" ? "V" : "",
    }));

    const file: RenderedFile = {
      buffer: renderCsv({ columns, rows }, { byteOrderMark: false }),
      contentType: "text/csv; charset=utf-8",
      fileName: `positive-pay-${account.accountNumberLast4}-${usDay(from).replace(/\//g, "")}-${usDay(to).replace(/\//g, "")}.csv`,
    };
    await this.record(workspaceId, ctx, file, {
      action: "POSITIVE_PAY_EXPORTED",
      report: "positive-pay",
      entityType: "BankAccount",
      entityId: account.id,
      details: {
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
        rowCount: rows.length,
        voidCount: rows.filter((r) => r.void === "V").length,
        checkNumbers: checks.map((c) => c.checkNumber),
      },
    });
    return file;
  }

  // ─── Helpers ──────────────────────────────────────────────

  private async record(workspaceId: string, ctx: ExportContext, file: RenderedFile, r: ExportRecord) {
    await this.audit.logOrRefuse({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      workspaceId,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      details: { report: r.report, fileName: file.fileName, bytes: file.buffer.length, ...r.details },
      ipAddress: ctx.ipAddress,
    });
  }

  private async subtitle(workspaceId: string, userId: string, now: Date, ...lines: string[]) {
    const [workspace, user] = await Promise.all([this.repo.workspaceName(workspaceId), this.repo.userName(userId)]);
    return [workspace, ...lines.filter(Boolean), `Generated by ${user} on ${isoMinute(now)} UTC`];
  }

  // "Status: Printed, Cleared · Check date: 10/01/2026 to 10/31/2026 · …", or "All checks".
  private async describeFilter(workspaceId: string, f: CheckFilter): Promise<string> {
    const [banks, users] = await Promise.all([
      this.repo.bankAccountLabels(workspaceId, f.bankAccountId ?? []),
      this.repo.userLabels([...(f.createdBy ?? []), ...(f.printedBy ?? [])]),
    ]);
    const parts: string[] = [];
    const add = (label: string, value: string | undefined) => {
      if (value) parts.push(`${label}: ${value}`);
    };
    const range = (from?: Date | number, to?: Date | number, fmt: (v: Date | number) => string = String) =>
      from !== undefined || to !== undefined ? `${from !== undefined ? fmt(from) : "…"} to ${to !== undefined ? fmt(to) : "…"}` : undefined;
    const day = (v: Date | number) => usDay(v as Date);

    add("View", f.view ? VIEW[f.view] : undefined);
    add("Status", f.status?.map((s) => STATUS[s] ?? s).join(", "));
    add("Bank account", f.bankAccountId?.map((id) => banks.get(id) ?? "unknown").join(", "));
    add("Check #", f.checkNumber !== undefined ? String(f.checkNumber) : range(f.checkNumberFrom, f.checkNumberTo));
    add("Amount", range(f.amountMin, f.amountMax, (v) => usd(v as number)));
    add("Payee", f.payee);
    add("Memo", f.memo);
    add("Search", f.q);
    add("Check date", range(f.checkDateFrom, f.checkDateTo, day));
    add("Written", range(f.createdFrom, f.createdTo, day));
    add("Printed", range(f.printedFrom, f.printedTo, day));
    add("Cleared", range(f.clearedFrom, f.clearedTo, day));
    add("Voided", range(f.voidedFrom, f.voidedTo, day));
    add("Written by", f.createdBy?.map((id) => users.get(id) ?? "unknown").join(", "));
    add("Printed by", f.printedBy?.map((id) => users.get(id) ?? "unknown").join(", "));
    add("Void type", f.voidType?.map((v) => VOID_TYPE[v] ?? v).join(", "));
    if (f.printConfirmed !== undefined) add("Print confirmed", f.printConfirmed ? "yes" : "no");
    if (f.printUnconfirmed) add("Print confirmed", "no");
    if (f.hasAttachments !== undefined) add("Has attachments", f.hasAttachments ? "yes" : "no");
    if (f.reissued) add("Reissued", f.reissued);
    if (f.possibleDuplicate !== undefined) add("Possible duplicate", f.possibleDuplicate ? "yes" : "no");

    return parts.length > 0 ? `Filters: ${parts.join(" · ")}` : "All checks";
  }
}

// The filters as the user chose them, for the audit row (paging and sorting left out).
function exportedFilter(f: CheckFilter): Record<string, unknown> {
  const { limit: _limit, cursor: _cursor, page: _page, include: _include, sortBy: _sortBy, sortOrder: _sortOrder, ...chosen } = f;
  return Object.fromEntries(
    Object.entries(chosen)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, v instanceof Date ? v.toISOString().slice(0, 10) : v]),
  );
}
