import { prisma } from "@smartbusiness/database";

interface CreateBankAccountData {
    workspaceId: string;
    bankName: string;
    routingNumberEncrypted: string;
    routingNumberLast4: string;
    accountNumberEncrypted: string;
    accountNumberLast4: string;
    accountType: "CHECKING" | "SAVINGS";
    nextCheckNumber: number;
}

interface BankAccountUpdateData {
    accountType?: "CHECKING" | "SAVINGS";
    checkNumberPadding?: number;
    isActive?: boolean;
    signatureUrl?: string | null;
}

export class BankAccountRepository {

    async create(data: CreateBankAccountData) {
        return prisma.bankAccount.create({ data });
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

    async countByWorkspace(workspaceId: string): Promise<number> {
        return prisma.bankAccount.count({
            where: { workspaceId, deletedAt: null },
        });
    }
}
