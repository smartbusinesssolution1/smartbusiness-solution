declare namespace Express {
  interface Request {
    user?: {
      userId: string;
      email: string;
    };

    tenant?: {
      tenantId: string;
      role: string;
    };

    product?: {
      productId: string;
      slug: string;
      subscriptionStatus: string;
      plan: string;
    };
  }
}
