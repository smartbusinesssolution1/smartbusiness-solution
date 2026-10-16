import type { Request, Response, NextFunction } from "express";
import { prisma } from "@smartbusiness/database";
import { ForbiddenError, NotFoundError } from "../shared/errors/index.js";
import { AuditService } from "../shared/services/audit.service.js";

const auditService = new AuditService();

// Runs on every /workspaces/:wid/... route, after requireProduct has set req.product.
//
// A workspace is shared by every product on the platform, so membership alone is not
// enough: only this product's roles count. Roles from another product (Clock In/Out, ...)
// are not loaded at all. Permission names are unique only within a product, so two products
// may both define "member:manage"; mixed together, another product's admin would pass this
// product's guards. And someone who only uses another product has no business here.
export async function workspaceMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const workspaceId = req.params.wid as string;
  const userId = req.user!.userId;
  const tenantId = req.tenant!.tenantId;
  const product = req.product!;

  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: { workspaceId, userId },
    },
    include: {
      assignedRoles: {
        where: { role: { productId: product.productId } },
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

  // A member of the workspace, but not of this product. They know the workspace exists
  // (they use it through another product), so the answer is 403, not 404, and the
  // refusal is recorded like any other.
  if (membership.assignedRoles.length === 0) {
    await auditService.log({
      tenantId,
      userId,
      workspaceId,
      action: "ACCESS_DENIED",
      entityType: "Permission",
      entityId: userId,
      details: { reason: "NO_PRODUCT_ROLE", product: product.slug, url: req.originalUrl, method: req.method },
      ipAddress: req.ip,
    });
    throw new ForbiddenError("You don't have access to Check Printing in this workspace.");
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
