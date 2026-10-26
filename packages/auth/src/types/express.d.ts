declare namespace Express {
  interface Request {
    user?: {
      userId: string;
      email: string;
      // "pwd" = signed in with a password; "otp" = also entered a two-factor code.
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
  }
}
