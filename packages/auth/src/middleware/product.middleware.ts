import type { NextFunction, Request, Response } from "express";
import { prisma } from "@smartbusiness/database";
import { ForbiddenError } from "../errors/index.js";

export function requireProduct(productSlug: string) {
  return async function productMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> {
    const tenantId = req.tenant!.tenantId;

    const subscription = await prisma.productSubscription.findFirst({
      where: {
        tenantId,
        product: { slug: productSlug },
        status: { in: ["ACTIVE", "TRIALING"] },
      },
      include: { product: true },
    });

    if (!subscription) {
      throw new ForbiddenError(
        "Your organization does not have an active subscription to this product.",
      );
    }

    req.product = {
      productId: subscription.product.id,
      slug: subscription.product.slug,
      subscriptionStatus: subscription.status,
      plan: subscription.plan,
    };

    next();
  };
}
