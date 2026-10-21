import { Router } from "express";
import { authRateLimiter, invitationRateLimiter, refreshRateLimiter } from "../../middleware/rate-limiter.js";
import { validate } from "../../middleware/validate.js";
import {
  acceptInvitationSchema,
  forgotPasswordSchema,
  invitationTokenSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from "./auth.schema.js";
import { authController, authMiddleware } from "./auth.module.js";

// ─── Routes ────────────────────────────────────────────────────

const router: Router = Router();

// Public — no auth required
router.post(
  "/register",
  authRateLimiter,
  validate(registerSchema),
  authController.register,
);
router.post(
  "/login",
  authRateLimiter,
  validate(loginSchema),
  authController.login,
);
router.post("/refresh", refreshRateLimiter, authController.refresh);
router.post("/forgot-password", authRateLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post("/reset-password", authRateLimiter, validate(resetPasswordSchema), authController.resetPassword);
// Invitation links (from the email): show who invited you to what, then accept by
// choosing a password. Their own rate-limit budget, separate from sign-in.
router.post("/invitations/inspect", invitationRateLimiter, validate(invitationTokenSchema), authController.inspectInvitation);
router.post("/invitations/accept", invitationRateLimiter, validate(acceptInvitationSchema), authController.acceptInvitation);

// Protected — auth required
// Logout is identified by the refresh-token cookie alone: the access token lasts only
// 15 minutes, and a user who was idle longer must still be able to end the session.
router.post("/logout", authController.logout);
router.post("/logout-all", authMiddleware, authController.logoutAll);
router.get("/me", authMiddleware, authController.me);
router.patch("/profile", authMiddleware, validate(updateProfileSchema), authController.updateProfile);

export default router;
