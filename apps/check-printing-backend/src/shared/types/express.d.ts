declare namespace Express {
  interface Request {
    requestId: string;

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

    workspace?: {
      workspaceId: string;
      tenantId: string;
      businessName: string;
    };

    permissions?: {
      isSuperUser: boolean;
      canCreate: boolean;
      canPrint: boolean;
      canApprove: boolean;
    };
  }
}
