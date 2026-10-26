import type { NextFunction, Request, Response } from "express";
import { prisma } from "@smartbusiness/database";
import { AppError } from "../shared/errors/index.js";

// ═══════════════════════════════════════════════════════════════
// TWO-FACTOR AT CHECK PRINTING'S DOOR
//
// Two-factor sign-in is optional: anyone can turn it on from their account (the portal
// encourages admins to). Signing in is the same for every product (password only), so
// Clock-In is unaffected. Check Printing then holds a person who HAS turned it on to it:
// their session must have entered a code (the access token's amr contains "otp", which
// platform-api adds when a code is accepted). Otherwise a stolen password would still get
// into Check Printing for the very people who asked for more protection.
//
// Checked fresh on every request: turning it on, or a reset by the company owner, takes
// effect at once. The portal reads MFA_REQUIRED and asks for the code.
// ═══════════════════════════════════════════════════════════════

export async function requireTwoFactor(req: Request, _res: Response, next: NextFunction) {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { mfaEnabledAt: true } });

  // Not turned on: a password is enough.
  if (!user?.mfaEnabledAt) return next();

  if (!req.user!.amr.includes("otp")) {
    throw new AppError("Enter the 6-digit code from your authenticator app to continue.", 403, "MFA_REQUIRED");
  }
  next();
}
