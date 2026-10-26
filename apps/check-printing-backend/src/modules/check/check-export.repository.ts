import { prisma, type Prisma } from "@smartbusiness/database";

// Database access for exports. Every query is scoped to one workspace.

const NAME = { select: { fullName: true } } as const;

export const EXPORT_ROW_INCLUDE = {
  bankAccount: { select: { bankName: true, accountNumberLast4: true } },
  createdBy: NAME,
  printedBy: NAME,
  voidedBy: NAME,
} as const;

export type ExportRow = Prisma.CheckGetPayload<{ include: typeof EXPORT_ROW_INCLUDE }>;

export class CheckExportRepository {
  async workspaceName(workspaceId: string): Promise<string> {
    return (await prisma.workspace.findFirst({ where: { id: workspaceId }, select: { businessName: true } }))?.businessName ?? "";
  }

  async userName(userId: string): Promise<string> {
    return (await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true } }))?.fullName ?? "";
  }

  async count(where: Prisma.CheckWhereInput): Promise<number> {
    return prisma.check.count({ where });
  }

  async rows(where: Prisma.CheckWhereInput, orderBy: Prisma.CheckOrderByWithRelationInput[], take: number): Promise<ExportRow[]> {
    return prisma.check.findMany({ where, orderBy, take, include: EXPORT_ROW_INCLUDE });
  }

  // Printed and not cleared: what is still outstanding at the bank, oldest first.
  async outstanding(workspaceId: string, bankAccountId?: string): Promise<ExportRow[]> {
    return prisma.check.findMany({
      where: { workspaceId, deletedAt: null, status: "PRINTED", ...(bankAccountId && { bankAccountId }) },
      orderBy: [{ printedAt: "asc" }, { checkNumber: "asc" }],
      include: EXPORT_ROW_INCLUDE,
    });
  }

  // Names for the ids in a filter, so the file can say "Bank: Chase ****1012", not an id.
  async bankAccountLabels(workspaceId: string, ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const accounts = await prisma.bankAccount.findMany({
      where: { workspaceId, id: { in: ids } },
      select: { id: true, bankName: true, accountNumberLast4: true },
    });
    return new Map(accounts.map((a) => [a.id, `${a.bankName} ****${a.accountNumberLast4}`]));
  }

  async userLabels(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true } });
    return new Map(users.map((u) => [u.id, u.fullName]));
  }

  // ─── Positive Pay ─────────────────────────────────────────

  // Encrypted numbers: decrypted only for the Positive Pay file, which the bank needs in full.
  async bankAccountForPositivePay(bankAccountId: string, workspaceId: string) {
    return prisma.bankAccount.findFirst({
      where: { id: bankAccountId, workspaceId, deletedAt: null },
      select: { id: true, bankName: true, accountNumberLast4: true, accountNumberEncrypted: true, routingNumberEncrypted: true },
    });
  }

  // Every check that left the printer in the period: printed ones, cleared ones, and
  // printed ones voided since, which the bank must refuse. Having a print time is what
  // counts, not the void type: a voided check missing its type is still paper that exists,
  // and leaving it out would let the bank pay it. (Checks cancelled before printing have no
  // print time, so they are never listed.)
  async issuedChecks(bankAccountId: string, workspaceId: string, from: Date, toExclusive: Date) {
    return prisma.check.findMany({
      where: {
        workspaceId,
        bankAccountId,
        deletedAt: null,
        printedAt: { gte: from, lt: toExclusive },
        status: { in: ["PRINTED", "CLEARED", "VOID"] },
      },
      orderBy: { checkNumber: "asc" },
      select: { checkNumber: true, checkDate: true, amount: true, payeeName: true, status: true },
    });
  }
}
