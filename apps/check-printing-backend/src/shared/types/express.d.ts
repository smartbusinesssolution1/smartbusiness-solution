declare namespace Express {
  interface Request {
    requestId: string;

    user?: {
      userId: string;
      email: string;
      // How this session proved who it is: "pwd" (password), "otp" (also a two-factor code).
      amr: string[];
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

    // This product's roles and permissions in the workspace (set by workspaceMiddleware)
    roles?: string[];
    permissions?: string[];
  }
}
