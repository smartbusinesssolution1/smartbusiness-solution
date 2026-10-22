import type { NextFunction, Request, Response } from "express";
import { prisma } from "@smartbusiness/database";
import { ROLES } from "../shared/constants/rbac.js";
import { AppError } from "../shared/errors/index.js";

// ═══════════════════════════════════════════════════════════════
// TWO-FACTOR AT CHECK PRINTING'S DOOR
//
// Signing in is the same for every product (password only), so Clock-In is unaffected.
// Check Printing adds its own rule: anyone who is an Admin in ANY Check Printing workspace
// of this company (and anyone who turned two-factor on by choice) must have entered a code
// in this session. The access token says so: amr contains "otp" (platform-api adds it
// when a code is accepted).
//
// Checked fresh on every request, like the role itself: being made an Admin takes effect
// at once, and so does a reset by the company owner.
//
// The portal reads the codes:
//   MFA_SETUP_REQUIRED → show setup (QR code)      MFA_REQUIRED → ask for the code
// ═══════════════════════════════════════════════════════════════

export async function requireTwoFactor(req: Request, _res: Response, next: NextFunction) {
  const userId = req.user!.userId;
  const tenantId = req.tenant!.tenantId;

  const [adminRole, user] = await Promise.all([
    prisma.workspaceMemberRole.findFirst({
      where: {
        role: { slug: ROLES.ADMIN, productId: req.product!.productId },
        workspaceMember: { userId, deletedAt: null, workspace: { tenantId, deletedAt: null } },
      },
      select: { id: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { mfaEnabledAt: true } }),
  ]);
  const enrolled = Boolean(user?.mfaEnabledAt);

  // Neither an Admin anywhere nor opted in: a password is enough.
  if (!adminRole && !enrolled) return next();

  if (!enrolled) {
    throw new AppError(
      "Your role needs two-factor sign-in. Set it up with an authenticator app to continue.",
      403,
      "MFA_SETUP_REQUIRED",
    );
  }
  if (!req.user!.amr.includes("otp")) {
    throw new AppError("Enter the 6-digit code from your authenticator app to continue.", 403, "MFA_REQUIRED");
  }
  next();
}
