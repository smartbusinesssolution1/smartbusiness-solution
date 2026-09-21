import { Request, Response, NextFunction } from "express";
import { prisma } from "@smartbusiness/database";
import { ForbiddenError, NotFoundError } from "../shared/errors/index.js";

export async function workspaceMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const workspaceId = req.params.wid as string;
  const userId = req.user!.userId;
  const tenantId = req.user!.tenantId;

  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: { workspaceId, userId },
    },
  });

  if (!membership || membership.deletedAt !== null) {
    throw new NotFoundError("Workspace");
  }

  const workspace = await prisma.workspace.findFirst({
    where: { id: workspaceId, deletedAt: null },
    select: { id: true, tenantId: true, businessName: true },
  });

  if (!workspace) {
    throw new NotFoundError("Workspace");
  }

  if (workspace.tenantId !== tenantId) {
    throw new ForbiddenError("You do not have access to this workspace");
  }

  req.workspace = {
    id: workspace.id,
    tenantId: workspace.tenantId,
    businessName: workspace.businessName,
  };

  req.permissions = {
    isSuperUser: membership.isSuperUser,
    canCreate: membership.canCreate,
    canPrint: membership.canPrint,
    canApprove: membership.canApprove,
  };

  next();
}
