import type { Prisma } from "@smartbusiness/database";
import { ValidationError } from "../../shared/errors/index.js";
import type { AuditService } from "../../shared/services/audit.service.js";
import { isoMinute, renderExport, type ExportColumn, type ExportFormat, type RenderedFile } from "../export/index.js";
import {
  ACTIVITY_CATEGORIES,
  SECURITY_ACTIONS,
  actionsIn,
  categoryOf,
  changesOf,
  describe,
  reasonOf,
  type ActivityCategory,
  type ActivityChange,
  type CheckLabel,
  type Labels,
} from "./activity-catalog.js";
import type { ActivityRepository, EntryRow } from "./activity.repository.js";
import { encodeCursor, type ActivityQuery, type SecurityQuery } from "./activity.schemas.js";
import { ruleLabel } from "../approval-rule/rule-satisfiability.js";

// ═══════════════════════════════════════════════════════════════
// THE ACTIVITY LOG
//
// The workspace's log for its admins, and the company's sign-in and security events for
// the company owner. Entries come back newest first, as sentences with the before → after
// of edits; the names in them are looked up once per page, one query per kind of record.
// ═══════════════════════════════════════════════════════════════

export const ACTIVITY_EXPORT_MAX_ROWS = 10_000;
const DAY_MS = 24 * 60 * 60 * 1000;
const FAILED_ACTIONS = ["LOGIN_FAILED", "LOGIN_FAILED_INACTIVE", "LOGIN_FAILED_NO_TENANT", "REFRESH_FAILED", "ACCESS_DENIED"];

export interface ActivityItem {
  id: string;
  at: Date;
  action: string;
  category: ActivityCategory;
  categoryLabel: string;
  actor: { id: string; name: string; email: string };
  summary: string;
  changes: ActivityChange[];
  reason: string | null;
  // The record the entry is about, when the portal has a page for it.
  link: { kind: "check" | "bank-account" | "payee"; id: string } | null;
  ipAddress: string | null;
  details: Record<string, unknown>;
}

export interface ActivityContext {
  tenantId: string;
  userId: string;
  ipAddress?: string;
}

const LINKS: Record<string, "check" | "bank-account" | "payee"> = {
  Check: "check",
  BankAccount: "bank-account",
  Payee: "payee",
};

export class ActivityService {
  constructor(
    private readonly repo: ActivityRepository,
    private readonly audit: AuditService,
  ) {}

  // ─── The workspace's log ──────────────────────────────────

  async list(workspaceId: string, q: ActivityQuery) {
    return this.page(workspaceId, this.workspaceWhere(workspaceId, q), q.limit, q.cursor);
  }

  async people(workspaceId: string) {
    return this.repo.people({ workspaceId });
  }

  async export(workspaceId: string, q: ActivityQuery, format: ExportFormat, ctx: ActivityContext): Promise<RenderedFile> {
    const where = this.workspaceWhere(workspaceId, q);
    const subtitle = [await this.repo.workspaceName(workspaceId), await this.describeFilter(q)];
    return this.exportFile(workspaceId, where, format, ctx, {
      title: "Activity log",
      report: "activity-log",
      fileName: "activity-log",
      subtitle,
      details: { filter: plainFilter(q) },
    });
  }

  private workspaceWhere(workspaceId: string, q: ActivityQuery): Prisma.AuditLogWhereInput {
    return {
      workspaceId,
      ...(q.userId && { userId: q.userId }),
      ...(q.category && { action: { in: actionsIn(q.category as ActivityCategory[]) } }),
      ...(q.entityId && { entityId: q.entityId }),
      ...dayRange(q.from, q.to),
    };
  }

  // ─── The company's sign-ins and security events ───────────

  // Platform-api files a sign-in under the person's first company, so the events are found
  // by who they are about: the company's members (past ones too), wherever they were filed.
  async security(tenantId: string, workspaceId: string, q: SecurityQuery) {
    return this.page(workspaceId, await this.securityWhere(tenantId, q), q.limit, q.cursor);
  }

  async securityPeople(tenantId: string) {
    return this.repo.people(await this.securityWhere(tenantId, {} as SecurityQuery));
  }

  async securityExport(tenantId: string, workspaceId: string, q: SecurityQuery, format: ExportFormat, ctx: ActivityContext) {
    const where = await this.securityWhere(tenantId, q);
    const subtitle = [await this.repo.tenantName(tenantId), q.outcome === "failed" ? "Failed sign-ins and refused access only" : "All sign-in and security events"];
    return this.exportFile(workspaceId, where, format, ctx, {
      title: "Sign-in and security log",
      report: "security-log",
      fileName: "security-log",
      subtitle,
      details: { filter: plainFilter(q) },
    });
  }

  private async securityWhere(tenantId: string, q: SecurityQuery): Promise<Prisma.AuditLogWhereInput> {
    const members = await this.repo.tenantMemberIds(tenantId);
    return {
      workspaceId: null,
      action: { in: q.outcome === "failed" ? FAILED_ACTIONS : SECURITY_ACTIONS },
      OR: [{ tenantId }, { userId: { in: members } }],
      ...(q.userId && { userId: q.userId }),
      ...dayRange(q.from, q.to),
    };
  }

  // ─── Shared ───────────────────────────────────────────────

  private async page(workspaceId: string, where: Prisma.AuditLogWhereInput, limit: number, cursor?: { at: Date; id: string }) {
    const after: Prisma.AuditLogWhereInput | undefined = cursor && {
      OR: [{ createdAt: { lt: cursor.at } }, { createdAt: cursor.at, id: { lt: cursor.id } }],
    };
    const rows = await this.repo.page(after ? { AND: [where, after] } : where, limit + 1);
    const hasMore = rows.length > limit;
    const pageRows = rows.slice(0, limit);
    const last = pageRows[pageRows.length - 1];
    return {
      items: await this.format(workspaceId, pageRows),
      meta: { limit, hasMore, nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : null },
    };
  }

  private async exportFile(
    workspaceId: string,
    where: Prisma.AuditLogWhereInput,
    format: ExportFormat,
    ctx: ActivityContext,
    o: { title: string; report: string; fileName: string; subtitle: string[]; details: Record<string, unknown> },
  ): Promise<RenderedFile> {
    const count = await this.repo.count(where);
    if (count > ACTIVITY_EXPORT_MAX_ROWS) {
      throw new ValidationError(
        `These filters match ${count.toLocaleString("en-US")} entries; one export holds at most ${ACTIVITY_EXPORT_MAX_ROWS.toLocaleString("en-US")}. Choose a shorter period.`,
        { filters: ["Too many entries for one export"] },
      );
    }
    const items = await this.format(workspaceId, await this.repo.page(where, ACTIVITY_EXPORT_MAX_ROWS));
    const now = new Date();
    const [user] = await this.repo.users([ctx.userId]);

    const columns: ExportColumn[] = [
      { key: "at", label: "When (UTC)", type: "datetime", width: 1.25 },
      { key: "who", label: "Who", type: "text", width: 1.2 },
      { key: "email", label: "Email", type: "text", width: 1.6, pdf: false },
      { key: "category", label: "Category", type: "text", width: 1.15 },
      { key: "what", label: "What happened", type: "text", width: 3.4 },
      { key: "changes", label: "Changes", type: "text", width: 2.4 },
      { key: "reason", label: "Reason", type: "text", width: 1.4 },
      { key: "ip", label: "IP address", type: "text", width: 1 },
    ];
    const rows = items.map((i) => ({
      at: i.at,
      who: i.actor.name,
      email: i.actor.email,
      category: i.categoryLabel,
      what: i.summary,
      changes: i.changes.map((c) => `${c.label}: ${c.from} → ${c.to}`).join("; "),
      reason: i.reason,
      ip: i.ipAddress,
    }));

    const file = await renderExport(
      {
        title: o.title,
        subtitle: [...o.subtitle.filter(Boolean), `Generated by ${user?.fullName ?? ""} on ${isoMinute(now)} UTC`],
        columns,
        rows,
        fileName: `${o.fileName}-${isoMinute(now).replace(/[: ]/g, "-")}`,
      },
      format,
      now,
    );

    // No audit row, no file.
    await this.audit.logOrRefuse({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      workspaceId,
      action: "REPORT_EXPORTED",
      entityType: "Workspace",
      entityId: workspaceId,
      details: { report: o.report, format, rowCount: rows.length, fileName: file.fileName, bytes: file.buffer.length, ...o.details },
      ipAddress: ctx.ipAddress,
    });
    return file;
  }

  // Entries as people read them, with every name looked up once per page.
  private async format(workspaceId: string, rows: EntryRow[]): Promise<ActivityItem[]> {
    const ids = (type: string) => [...new Set(rows.filter((r) => r.entityType === type).map((r) => r.entityId))];
    const detailIds = (key: string) =>
      [...new Set(rows.flatMap((r) => {
        const v = (r.detailsJson as Record<string, unknown> | null)?.[key];
        return Array.isArray(v) ? v.map(String) : v ? [String(v)] : [];
      }))];

    const [checks, banks, payees, rules, printers, users] = await Promise.all([
      this.repo.checks(workspaceId, ids("Check")),
      this.repo.bankAccounts(workspaceId, ids("BankAccount")),
      this.repo.payees(workspaceId, ids("Payee")),
      this.repo.rules(workspaceId, [...ids("ApprovalRule"), ...ids("ApprovalWorkflowRule"), ...detailIds("ruleId")]),
      this.repo.printers(workspaceId, ids("CalibrationProfile")),
      this.repo.users([...detailIds("approverUserId"), ...detailIds("approverUserIds")]),
    ]);

    const checkLabels = new Map<string, CheckLabel>(
      checks.map((c) => [
        c.id,
        { number: String(c.checkNumber).padStart(c.bankAccount.checkNumberPadding, "0"), amount: c.amount.toFixed(2), payee: c.payeeName },
      ]),
    );
    const bankLabels = new Map(banks.map((b) => [b.id, `${b.bankName} ****${b.accountNumberLast4}`]));
    const payeeLabels = new Map(payees.map((p) => [p.id, p.name]));
    const ruleLabels = new Map(rules.map((r) => [r.id, ruleLabel(r.minAmount, r.maxAmount)]));
    const printerLabels = new Map(printers.map((p) => [p.id, p.profileName]));
    const userLabels = new Map(users.map((u) => [u.id, u.fullName]));
    const labels: Labels = {
      check: (id) => checkLabels.get(id),
      bankAccount: (id) => bankLabels.get(id),
      payee: (id) => payeeLabels.get(id),
      rule: (id) => ruleLabels.get(id),
      printer: (id) => printerLabels.get(id),
      user: (id) => userLabels.get(id),
    };

    return rows.map((r) => {
      const details = (r.detailsJson as Record<string, unknown> | null) ?? {};
      const facts = { action: r.action, entityType: r.entityType, entityId: r.entityId, details };
      const category = categoryOf(r.action);
      const kind = LINKS[r.entityType];
      return {
        id: r.id,
        at: r.createdAt,
        action: r.action,
        category,
        categoryLabel: ACTIVITY_CATEGORIES[category],
        actor: { id: r.userId, name: r.user.fullName, email: r.user.email },
        summary: describe(facts, labels),
        changes: changesOf(r.action, details),
        reason: reasonOf(details),
        link: kind ? { kind, id: r.entityId } : null,
        ipAddress: r.ipAddress,
        details,
      };
    });
  }

  private async describeFilter(q: ActivityQuery): Promise<string> {
    const parts: string[] = [];
    if (q.userId) parts.push(`Person: ${(await this.repo.users([q.userId]))[0]?.fullName ?? "unknown"}`);
    if (q.category) parts.push(`Category: ${q.category.map((c) => ACTIVITY_CATEGORIES[c as ActivityCategory]).join(", ")}`);
    if (q.entityId) parts.push("One record only");
    if (q.from || q.to) parts.push(`Dates: ${q.from ? isoMinute(q.from).slice(0, 10) : "…"} to ${q.to ? isoMinute(q.to).slice(0, 10) : "…"}`);
    return parts.length > 0 ? `Filters: ${parts.join(" · ")}` : "All activity";
  }
}

// From the start of `from` to the end of `to` (UTC days, both included).
function dayRange(from?: Date, to?: Date): Prisma.AuditLogWhereInput {
  if (!from && !to) return {};
  return { createdAt: { ...(from && { gte: from }), ...(to && { lt: new Date(to.getTime() + DAY_MS) }) } };
}

// The filters for the audit row (no paging).
function plainFilter(q: ActivityQuery | SecurityQuery): Record<string, unknown> {
  const { cursor: _cursor, limit: _limit, ...chosen } = q;
  return Object.fromEntries(
    Object.entries(chosen)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, v instanceof Date ? v.toISOString().slice(0, 10) : v]),
  );
}
