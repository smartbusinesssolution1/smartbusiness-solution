import { prisma, Prisma } from "@smartbusiness/database";

interface CreateBankAccountData {
    workspaceId: string;
    bankName: string;
    routingNumberEncrypted: string;
    routingNumberLast4: string;
    accountNumberEncrypted: string;
    accountNumberLast4: string;
    accountFingerprint: string;
    accountType: "CHECKING" | "SAVINGS";
    nextCheckNumber: number;
}

// Another record of the same real account somewhere in the company (any workspace, deleted included).
export interface SameAccountRecord {
    id: string;
    workspaceId: string;
    workspaceName: string;
    bankName: string;
    accountNumberLast4: string;
    isActive: boolean;
    deletedAt: Date | null;
    nextCheckNumber: number;
}

// Decides whether a record created before fingerprints existed holds the same numbers
// (the caller decrypts; this module never sees plaintext account numbers).
export type LegacyMatcher = (encrypted: { routingNumberEncrypted: string; accountNumberEncrypted: string }) => boolean;

type Tx = Prisma.TransactionClient;
const TX_OPTIONS = { maxWait: 10_000, timeout: 15_000 } as const;

interface BankAccountUpdateData {
    accountType?: "CHECKING" | "SAVINGS";
    checkNumberPadding?: number;
    isActive?: boolean;
    signatureUrl?: string | null;
}

export class BankAccountRepository {

    // Creates the account unless the same real account already has a record in this company.
    // The company's row is locked first, so two admins adding the same account at the same
    // moment (even in different workspaces) take turns and the second one finds the first.
    // The unique (workspace, fingerprint) index is the final guarantee within a workspace.
    async createUnlessDuplicate(
        data: CreateBankAccountData,
        tenantId: string,
        legacyMatches: LegacyMatcher,
    ) {
        return prisma.$transaction(async (tx) => {
            await lockTenant(tx, tenantId);
            const existing = await findSameAccount(tx, tenantId, data, legacyMatches);
            if (existing) return { kind: "duplicate", duplicate: existing } as const;
            return { kind: "created", created: await tx.bankAccount.create({ data }) } as const;
        }, TX_OPTIONS);
    }

    // A deleted account of this workspace (only those can be restored).
    async findDeletedById(id: string, workspaceId: string) {
        return prisma.bankAccount.findFirst({
            where: { id, workspaceId, deletedAt: { not: null } },
        });
    }

    // Brings a deleted account back with its check counter where it was, so no check number
    // is ever issued twice. Refused if the same real account has another live record.
    async restoreUnlessDuplicate(
        id: string,
        workspaceId: string,
        tenantId: string,
        numbers: { accountFingerprint: string; routingNumberLast4: string; accountNumberLast4: string },
        legacyMatches: LegacyMatcher,
    ) {
        return prisma.$transaction(async (tx) => {
            await lockTenant(tx, tenantId);
            const other = await findSameAccount(tx, tenantId, numbers, legacyMatches, id);
            if (other && other.deletedAt === null) return { kind: "duplicate", duplicate: other } as const;

            const { count } = await tx.bankAccount.updateMany({
                where: { id, workspaceId, deletedAt: { not: null } },
                data: { deletedAt: null, accountFingerprint: numbers.accountFingerprint },
            });
            if (count !== 1) return { kind: "notFound" } as const;
            return { kind: "restored", restored: await tx.bankAccount.findUniqueOrThrow({ where: { id } }) } as const;
        }, TX_OPTIONS);
    }

    async findByWorkspaceId(workspaceId: string) {
        return prisma.bankAccount.findMany({
            where: {
                workspaceId: workspaceId,
                deletedAt: null
            },
            orderBy: { createdAt: "asc" }
        })
    }

    async findById(id: string, workspaceId: string) {
        return prisma.bankAccount.findFirst({
            where: {
                id: id,
                workspaceId: workspaceId,
                deletedAt: null
            }
        })
    }

    async update(id: string, workspaceId: string, data: BankAccountUpdateData) {
        return prisma.bankAccount.update({
            where: {
                id: id,
                workspaceId: workspaceId,
            },
            data
        })
    }

    async softDelete(id: string, workspaceId: string) {
        return prisma.bankAccount.update({
            where: { id, workspaceId },
            data: { deletedAt: new Date() },
        });
    }

    // Points the account at a new signature (or none) and records who and when.
    // Returns the previous key, which the caller keeps on record (old files are not deleted).
    async setSignature(id: string, workspaceId: string, storageKey: string | null, userId: string) {
        return prisma.$transaction(async (tx) => {
            const current = await tx.bankAccount.findFirst({
                where: { id, workspaceId, deletedAt: null },
                select: { signatureStorageKey: true },
            });
            if (!current) return null;
            const updated = await tx.bankAccount.update({
                where: { id },
                data: { signatureStorageKey: storageKey, signatureUpdatedAt: new Date(), signatureUpdatedById: userId },
            });
            return { previousKey: current.signatureStorageKey, account: updated };
        });
    }

    async countByWorkspace(workspaceId: string): Promise<number> {
        return prisma.bankAccount.count({
            where: { workspaceId, deletedAt: null },
        });
    }
}

// FOR NO KEY UPDATE: two of these take turns (what the duplicate check needs), but unlike
// FOR UPDATE it does not block other transactions inserting rows that reference the tenant
// (audit entries, members...), so the rest of the company keeps working meanwhile.
async function lockTenant(tx: Tx, tenantId: string): Promise<void> {
    await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${tenantId} FOR NO KEY UPDATE`;
}

// Every record of this real account in the company: matched by fingerprint, or, for records
// created before fingerprints existed, by the same last four digits and then the decrypted
// numbers. A record in the same workspace is reported first.
async function findSameAccount(
    tx: Tx,
    tenantId: string,
    numbers: { workspaceId?: string; accountFingerprint: string; routingNumberLast4: string; accountNumberLast4: string },
    legacyMatches: LegacyMatcher,
    excludeId?: string,
): Promise<SameAccountRecord | null> {
    const candidates = await tx.bankAccount.findMany({
        where: {
            workspace: { tenantId },
            ...(excludeId && { id: { not: excludeId } }),
            OR: [
                { accountFingerprint: numbers.accountFingerprint },
                {
                    accountFingerprint: null,
                    routingNumberLast4: numbers.routingNumberLast4,
                    accountNumberLast4: numbers.accountNumberLast4,
                },
            ],
        },
        include: { workspace: { select: { businessName: true } } },
    });

    const matches = candidates.filter(
        (c) => c.accountFingerprint === numbers.accountFingerprint || (c.accountFingerprint === null && legacyMatches(c)),
    );
    matches.sort((a, b) => Number(b.workspaceId === numbers.workspaceId) - Number(a.workspaceId === numbers.workspaceId));
    const match = matches[0];
    if (!match) return null;

    return {
        id: match.id,
        workspaceId: match.workspaceId,
        workspaceName: match.workspace.businessName,
        bankName: match.bankName,
        accountNumberLast4: match.accountNumberLast4,
        isActive: match.isActive,
        deletedAt: match.deletedAt,
        nextCheckNumber: match.nextCheckNumber,
    };
}
