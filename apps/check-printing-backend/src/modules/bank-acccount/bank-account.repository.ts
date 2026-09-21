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

    async findById(id: string) {
        return prisma.bankAccount.findUnique({
            where: {
                id: id,
                deletedAt: null
            }
        })
    }

    async update(id: string, data: BankAccountUpdateData) {
        return prisma.bankAccount.update({
            where: {
                id: id
            },
            data
        })
    }

    async softDelete(id: string) {
        return prisma.bankAccount.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
    }

    async countByWorkspace(workspaceId: string): Promise<number> {
        return prisma.bankAccount.count({
            where: { workspaceId, deletedAt: null },
        });
    }
}
