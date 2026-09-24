import type { Request, Response, NextFunction } from "express";
import { prisma } from "@smartbusiness/database";
import { NotFoundError } from "../shared/errors/index.js";

export async function workspaceMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const workspaceId = req.params.wid as string;
  const userId = req.user!.userId;
  const tenantId = req.tenant!.tenantId;

  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: { workspaceId, userId },
    },
    include: {
      assignedRoles: {
        include: {
          role: {
            include: {
              rolePermissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!membership || membership.deletedAt !== null) {
    throw new NotFoundError("Workspace");
  }

  const workspace = await prisma.workspace.findFirst({
    where: { id: workspaceId, tenantId, deletedAt: null },
    select: { id: true, tenantId: true, businessName: true },
  });

  if (!workspace) {
    throw new NotFoundError("Workspace");
  }

  req.workspace = {
    workspaceId: workspace.id,
    tenantId: workspace.tenantId,
    businessName: workspace.businessName,
  };

  const permissionSet = new Set<string>();
  for (const assignedRole of membership.assignedRoles) {
    for (const rp of assignedRole.role.rolePermissions) {
      permissionSet.add(rp.permission.action);
    }
  }
  req.permissions = [...permissionSet];

  next();
}
