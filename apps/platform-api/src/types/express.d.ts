declare namespace Express {
  interface Request {
    user?: {
      userId: string;
      email: string;
      // How this session proved who it is: "pwd" (password), "otp" (also a two-factor code).
      amr: string[];
    };
  }
}
