import { prisma, Prisma } from "@smartbusiness/database";

// Database access for the check register (F06). Every query receives a where-condition built
// by check-query.ts (which always scopes it to one workspace) or filters by workspace itself.

const USER = { select: { id: true, fullName: true } } as const;

export const REGISTER_ITEM_INCLUDE = {
  createdBy: USER,
  bankAccount: { select: { id: true, bankName: true, accountNumberLast4: true, accountType: true } },
  _count: { select: { attachments: true } },
} as const;

export type RegisterRow = Prisma.CheckGetPayload<{ include: typeof REGISTER_ITEM_INCLUDE }>;

export interface PossibleDuplicate {
  checkId: string;
  duplicateId: string;
  duplicateNumber: number;
}

export class CheckRegisterRepository {
  async findPage(
    where: Prisma.CheckWhereInput,
    orderBy: Prisma.CheckOrderByWithRelationInput[],
    take: number,
    skip = 0,
  ): Promise<RegisterRow[]> {
    return prisma.check.findMany({ where, orderBy, take, skip, include: REGISTER_ITEM_INCLUDE });
  }

  async count(where: Prisma.CheckWhereInput): Promise<number> {
    return prisma.check.count({ where });
  }

  async totals(where: Prisma.CheckWhereInput) {
    const result = await prisma.check.aggregate({ where, _count: { _all: true }, _sum: { amount: true } });
    return { count: result._count._all, amount: result._sum.amount };
  }

  async facet(where: Prisma.CheckWhereInput, by: "status" | "bankAccountId") {
    const groups = await prisma.check.groupBy({ by: [by], where, _count: { _all: true }, _sum: { amount: true } });
    return groups.map((g) => ({ key: String(g[by]), count: g._count._all, amount: g._sum.amount }));
  }

  // Another live check (not void, not deleted) with the same payee (case and spacing ignored)
  // and the same amount, dated within 30 days. Limited to `checkIds` when given.
  async findPossibleDuplicates(workspaceId: string, checkIds?: string[]): Promise<PossibleDuplicate[]> {
    if (checkIds && checkIds.length === 0) return [];
    const onlyThese = checkIds ? Prisma.sql`AND c.id = ANY(${checkIds}::text[])` : Prisma.empty;
    return prisma.$queryRaw<PossibleDuplicate[]>`
      SELECT c.id AS "checkId", d.id AS "duplicateId", d.check_number AS "duplicateNumber"
      FROM checks c
      JOIN checks d
        ON d.workspace_id = c.workspace_id
       AND d.id <> c.id
       AND d.deleted_at IS NULL
       AND d.status <> 'VOID'
       AND d.amount = c.amount
       AND lower(regexp_replace(btrim(d.payee_name), '\\s+', ' ', 'g'))
         = lower(regexp_replace(btrim(c.payee_name), '\\s+', ' ', 'g'))
       AND abs(d.check_date - c.check_date) <= 30
      WHERE c.workspace_id = ${workspaceId}
        AND c.deleted_at IS NULL
        AND c.status <> 'VOID'
        ${onlyThese}
      ORDER BY d.check_number`;
  }

  // ─── Check-number integrity ───────────────────────────────

  // Deleted accounts included: auditing an account that was removed is still legitimate.
  async findAccountForAudit(bankAccountId: string, workspaceId: string) {
    return prisma.bankAccount.findFirst({
      where: { id: bankAccountId, workspaceId },
      select: { id: true, bankName: true, accountNumberLast4: true, nextCheckNumber: true },
    });
  }

  async firstIssuedNumber(bankAccountId: string): Promise<number | null> {
    const result = await prisma.check.aggregate({ where: { bankAccountId }, _min: { checkNumber: true } });
    return result._min.checkNumber;
  }

  // Deleted drafts included: their numbers were issued and must be accounted for.
  async numbersInRange(bankAccountId: string, from: number, to: number) {
    return prisma.check.findMany({
      where: { bankAccountId, checkNumber: { gte: from, lte: to } },
      select: {
        id: true, checkNumber: true, status: true, deletedAt: true, payeeName: true, amount: true,
        voidType: true, voidReason: true,
      },
    });
  }

  // ─── Outstanding aging ────────────────────────────────────

  async outstanding(workspaceId: string, bankAccountId?: string) {
    return prisma.check.findMany({
      where: { workspaceId, deletedAt: null, status: "PRINTED", ...(bankAccountId && { bankAccountId }) },
      select: { printedAt: true, amount: true },
    });
  }
}
