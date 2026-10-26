import { prisma, type Prisma } from "@smartbusiness/database";

// Reads the audit log (it is only ever written elsewhere: the database refuses changes).

export const ENTRY_SELECT = {
  id: true,
  createdAt: true,
  action: true,
  entityType: true,
  entityId: true,
  detailsJson: true,
  ipAddress: true,
  userId: true,
  user: { select: { fullName: true, email: true } },
} as const;

export type EntryRow = Prisma.AuditLogGetPayload<{ select: typeof ENTRY_SELECT }>;

const NEWEST_FIRST: Prisma.AuditLogOrderByWithRelationInput[] = [{ createdAt: "desc" }, { id: "desc" }];

export class ActivityRepository {
  async page(where: Prisma.AuditLogWhereInput, take: number): Promise<EntryRow[]> {
    return prisma.auditLog.findMany({ where, orderBy: NEWEST_FIRST, take, select: ENTRY_SELECT });
  }

  async count(where: Prisma.AuditLogWhereInput): Promise<number> {
    return prisma.auditLog.count({ where });
  }

  // Everyone who appears in this log (former members too), for the "who" filter.
  async people(where: Prisma.AuditLogWhereInput) {
    const groups = await prisma.auditLog.groupBy({ by: ["userId"], where, _count: { _all: true } });
    const users = await prisma.user.findMany({
      where: { id: { in: groups.map((g) => g.userId) } },
      select: { id: true, fullName: true, email: true },
      orderBy: { fullName: "asc" },
    });
    return users;
  }

  // Everyone who is or was a member of the company.
  async tenantMemberIds(tenantId: string): Promise<string[]> {
    const rows = await prisma.tenantMember.findMany({ where: { tenantId }, select: { userId: true } });
    return rows.map((r) => r.userId);
  }

  async workspaceName(workspaceId: string): Promise<string> {
    return (await prisma.workspace.findFirst({ where: { id: workspaceId }, select: { businessName: true } }))?.businessName ?? "";
  }

  async tenantName(tenantId: string): Promise<string> {
    return (await prisma.tenant.findFirst({ where: { id: tenantId }, select: { name: true } }))?.name ?? "";
  }

  // ─── Labels for a page of entries, one query per kind ─────

  async checks(workspaceId: string, ids: string[]) {
    if (ids.length === 0) return [];
    return prisma.check.findMany({
      where: { workspaceId, id: { in: ids } },
      select: { id: true, checkNumber: true, amount: true, payeeName: true, bankAccount: { select: { checkNumberPadding: true } } },
    });
  }

  async bankAccounts(workspaceId: string, ids: string[]) {
    if (ids.length === 0) return [];
    return prisma.bankAccount.findMany({
      where: { workspaceId, id: { in: ids } },
      select: { id: true, bankName: true, accountNumberLast4: true },
    });
  }

  async payees(workspaceId: string, ids: string[]) {
    if (ids.length === 0) return [];
    return prisma.payee.findMany({ where: { workspaceId, id: { in: ids } }, select: { id: true, name: true } });
  }

  async rules(workspaceId: string, ids: string[]) {
    if (ids.length === 0) return [];
    return prisma.approvalWorkflowRule.findMany({
      where: { workspaceId, id: { in: ids } },
      select: { id: true, minAmount: true, maxAmount: true },
    });
  }

  async printers(workspaceId: string, ids: string[]) {
    if (ids.length === 0) return [];
    return prisma.calibrationProfile.findMany({ where: { workspaceId, id: { in: ids } }, select: { id: true, profileName: true } });
  }

  async users(ids: string[]) {
    if (ids.length === 0) return [];
    return prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true } });
  }
}
