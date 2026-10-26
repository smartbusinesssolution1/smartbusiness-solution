import { prisma } from "@smartbusiness/database";
import { PERMISSIONS } from "../../shared/constants/rbac.js";

export interface Recipient {
  id: string;
  email: string;
  fullName: string;
}

// Who may receive a check notice: an active account that still works in this workspace
// (an active member of the workspace and of its company). Everyone else gets nothing.
function stillWorksHere(workspaceId: string, tenantId: string) {
  return {
    isActive: true,
    deletedAt: null,
    workspaceMembers: { some: { workspaceId, deletedAt: null } },
    tenantMembers: { some: { tenantId, deletedAt: null } },
  };
}

export class CheckNotificationRepository {
  // The workspace and its company, or null if either is gone or the company is suspended
  // (a suspended company gets no emails).
  async findWorkspace(workspaceId: string) {
    return prisma.workspace.findFirst({
      where: { id: workspaceId, deletedAt: null, tenant: { status: "ACTIVE", deletedAt: null } },
      select: { id: true, businessName: true, tenantId: true },
    });
  }

  // Everyone who can approve this check now, by the same rules as the approval queue:
  // the approve permission in this workspace; the rule's named approvers when it has any;
  // never someone excluded (the writer, unless self-approval is allowed); never someone
  // who already decided in this round.
  async findApprovers(input: {
    workspaceId: string;
    tenantId: string;
    checkId: string;
    round: number;
    designatedUserIds: string[];
    excludeUserIds: string[];
  }): Promise<Recipient[]> {
    return prisma.user.findMany({
      where: {
        AND: [
          stillWorksHere(input.workspaceId, input.tenantId),
          {
            workspaceMembers: {
              some: {
                workspaceId: input.workspaceId,
                deletedAt: null,
                assignedRoles: {
                  some: { role: { rolePermissions: { some: { permission: { action: PERMISSIONS.CHECK_APPROVE } } } } },
                },
              },
            },
          },
          input.designatedUserIds.length > 0 ? { id: { in: input.designatedUserIds } } : {},
          { id: { notIn: input.excludeUserIds } },
          { approvalRecords: { none: { checkId: input.checkId, round: input.round } } },
        ],
      },
      select: { id: true, email: true, fullName: true },
      orderBy: { fullName: "asc" },
    });
  }

  // The check's writer, if they still work here.
  async findWriter(userId: string, workspaceId: string, tenantId: string): Promise<Recipient | null> {
    return prisma.user.findFirst({
      where: { id: userId, ...stillWorksHere(workspaceId, tenantId) },
      select: { id: true, email: true, fullName: true },
    });
  }

  async findUserName(userId: string): Promise<string | null> {
    return (await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true } }))?.fullName ?? null;
  }
}
