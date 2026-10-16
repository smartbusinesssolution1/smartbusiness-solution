import type { Prisma } from "@smartbusiness/database";
import { parseOmnibox, type CheckFilter } from "./check-filter.js";

// ═══════════════════════════════════════════════════════════════
// THE ONLY PLACE REGISTER FILTERS BECOME DATABASE CONDITIONS (F06)
//
// Every condition starts with { workspaceId, deletedAt: null }: tenant isolation and "deleted
// drafts are never listed" cannot be forgotten by any endpoint that uses this builder.
// ═══════════════════════════════════════════════════════════════

const DAY_MS = 24 * 60 * 60 * 1000;
const nextDay = (d: Date) => new Date(d.getTime() + DAY_MS);

// Timestamp columns: "to" includes the whole calendar day (UTC).
function timestampRange(from?: Date, to?: Date): Prisma.DateTimeFilter | undefined {
  if (!from && !to) return undefined;
  return { ...(from && { gte: from }), ...(to && { lt: nextDay(to) }) };
}

// Calendar-date columns (check date, cleared date) are stored as UTC midnight.
function dateRange(from?: Date, to?: Date): Prisma.DateTimeFilter | undefined {
  if (!from && !to) return undefined;
  return { ...(from && { gte: from }), ...(to && { lte: to }) };
}

export interface BuildOptions {
  // For a facet: leave out its own filter so the other choices keep their counts.
  omit?: "status" | "bankAccountId";
  // Conditions that are not plain filters (a view, a cursor, the possible-duplicate set).
  extra?: Prisma.CheckWhereInput[];
}

export function buildCheckWhere(workspaceId: string, f: CheckFilter, options: BuildOptions = {}): Prisma.CheckWhereInput {
  const and: Prisma.CheckWhereInput[] = [{ workspaceId, deletedAt: null }];
  // Accepts the result of `value && condition`, which is falsy ("" / undefined / false) when unset.
  const add = (condition: Prisma.CheckWhereInput | undefined | false | "") => {
    if (condition) and.push(condition);
  };

  if (options.omit !== "status") add(f.status && { status: { in: f.status } });
  if (options.omit !== "bankAccountId") add(f.bankAccountId && { bankAccountId: { in: f.bankAccountId } });

  add(f.checkNumber !== undefined && { checkNumber: f.checkNumber });
  add((f.checkNumberFrom !== undefined || f.checkNumberTo !== undefined) && {
    checkNumber: { ...(f.checkNumberFrom !== undefined && { gte: f.checkNumberFrom }), ...(f.checkNumberTo !== undefined && { lte: f.checkNumberTo }) },
  });
  add((f.amountMin !== undefined || f.amountMax !== undefined) && {
    amount: { ...(f.amountMin !== undefined && { gte: f.amountMin }), ...(f.amountMax !== undefined && { lte: f.amountMax }) },
  });
  add(f.payee && { payeeName: { contains: f.payee, mode: "insensitive" } });
  add(f.memo && { memo: { contains: f.memo, mode: "insensitive" } });
  add(f.q && omniboxCondition(f.q));

  const checkDate = dateRange(f.checkDateFrom, f.checkDateTo);
  add(checkDate && { checkDate });
  const createdAt = timestampRange(f.createdFrom, f.createdTo);
  add(createdAt && { createdAt });
  const printedAt = timestampRange(f.printedFrom, f.printedTo);
  add(printedAt && { printedAt });
  const clearedDate = dateRange(f.clearedFrom, f.clearedTo);
  add(clearedDate && { clearedDate });
  const voidedAt = timestampRange(f.voidedFrom, f.voidedTo);
  add(voidedAt && { voidedAt });

  add(f.createdBy && { createdById: { in: f.createdBy } });
  add(f.printedBy && { printedById: { in: f.printedBy } });
  add(f.voidType && { voidType: { in: f.voidType } });

  // "Not confirmed" means: printed, and nobody has reported the outcome yet.
  const unconfirmed = f.printConfirmed === false || f.printUnconfirmed === true;
  add(unconfirmed && { status: "PRINTED", printConfirmedAt: null });
  add(f.printConfirmed === true && { printConfirmedAt: { not: null } });

  add(f.hasAttachments === true && { attachments: { some: {} } });
  add(f.hasAttachments === false && { attachments: { none: {} } });

  add(f.reissued === "from" && { reissuedFromCheckId: { not: null } });
  add(f.reissued === "to" && { reissuedToCheck: { isNot: null } });
  add(f.reissued === "none" && { reissuedFromCheckId: null, reissuedToCheck: { is: null } });

  for (const extra of options.extra ?? []) add(extra);

  return { AND: and };
}

function omniboxCondition(q: string): Prisma.CheckWhereInput {
  const terms = parseOmnibox(q);
  const or: Prisma.CheckWhereInput[] = [];
  if (terms.checkNumber !== undefined) or.push({ checkNumber: terms.checkNumber });
  if (terms.amount !== undefined) or.push({ amount: terms.amount });
  if (terms.accountLast4) or.push({ bankAccount: { accountNumberLast4: terms.accountLast4 } });
  if (terms.text) {
    or.push({ payeeName: { contains: terms.text, mode: "insensitive" } });
    or.push({ memo: { contains: terms.text, mode: "insensitive" } });
  }
  return { OR: or };
}
