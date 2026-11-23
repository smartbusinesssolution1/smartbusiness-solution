import "express";

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        // How this session proved who it is: "pwd" (password), "otp" (also a two-factor code).
        amr: string[];
      };
      superAdmin?: {
        adminId: string;
        email: string;
        name: string;
        role: "SUPER_ADMIN" | "DEV_SUPER_ADMIN";
      };
    }
  }
}

export {};
