import type { NextFunction, Request, Response } from "express";
import { prisma } from "@smartbusiness/database";
import { ForbiddenError } from "../errors/index.js";
import { SimpleCache } from "../utils/cache.js";

interface CachedProductSubscription {
  productId: string;
  slug: string;
  subscriptionStatus: any;
  plan: any;
}

export const productSubscriptionCache =
  new SimpleCache<CachedProductSubscription>(60);

export const PRODUCT_NOT_AVAILABLE = "PRODUCT_NOT_AVAILABLE";

export function requireProduct(productSlug: string) {
  return async function productMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> {
    const tenantId = req.tenant?.tenantId;
    if (!tenantId) {
      throw new ForbiddenError("Organization context is required.");
    }

    const cacheKey = `${tenantId}:${productSlug}`;
    const cached = productSubscriptionCache.get(cacheKey);

    if (cached) {
      req.product = {
        productId: cached.productId,
        slug: cached.slug,
        subscriptionStatus: cached.subscriptionStatus,
        plan: cached.plan,
      };
      return next();
    }

    const subscription = await prisma.productSubscription.findFirst({
      where: {
        tenantId,
        product: { slug: productSlug },
      },
      include: { product: true },
    });

    if (
      !subscription ||
      !["ACTIVE", "TRIALING"].includes(subscription.status)
    ) {
      const code =
        subscription?.status === "EXPIRED"
          ? "SUBSCRIPTION_EXPIRED"
          : "SUBSCRIPTION_INACTIVE";
      throw new ForbiddenError(
        "Your organization does not have an active subscription to this product.",
        code,
      );
    }

    productSubscriptionCache.set(cacheKey, {
      productId: subscription.product.id,
      slug: subscription.product.slug,
      subscriptionStatus: subscription.status,
      plan: subscription.plan,
    });

    req.product = {
      productId: subscription.product.id,
      slug: subscription.product.slug,
      subscriptionStatus: subscription.status,
      plan: subscription.plan,
    };

    next();
  };
}
