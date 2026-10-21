import { Request, Response } from 'express';
import { prisma } from "@smartbusiness/database";

export async function authtest(req: Request, res: Response) {
    res.json({
        "success": "true",
        "data": {
        "user": {
            "userId":   req.user.userId,
            "emailId":  req.user.email,
        },
        "tenant": {
            "tenantId": req.tenant.tenantId,
            "role":     req.tenant.role,
        },
        "product": {
            "productId":          req.product.productId,
            "slug":               req.product.slug,
            "subscriptionStatus": req.product.subscriptionStatus,
            "plan":               req.product.plan,
        },
        "workspace": {
            "workspaceId":  req.workspace.workspaceId,
            "tenantId":     req.workspace.tenantId,
            "businessName": req.workspace.businessName,
        },
        "permissions": req.permissions,
        },
    })
}