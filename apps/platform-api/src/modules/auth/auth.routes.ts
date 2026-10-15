import { Router } from "express";
import { authRateLimiter } from "../../middleware/rate-limiter.js";
import { validate } from "../../middleware/validate.js";
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from "./auth.schema.js";
import { AuthRepository } from "./auth.repository.js";
import { AuthService } from "./auth.service.js";
import { AuthController } from "./auth.controller.js";
import { createAuthMiddleware, TokenService, PasswordService, UserTokenService } from "@smartbusiness/auth";
import { AuditService } from "../../shared/services/audit.service.js";
import { accessToken, app, passwordReset } from "../../config/index.js";
import { emailSender } from "../../shared/services/email.js";

// ─── Composition Root ──────────────────────────────────────────

const tokenService = new TokenService(accessToken.secret, accessToken.expiresIn);
const passwordService = new PasswordService();
const authRepository = new AuthRepository();
const auditService = new AuditService();
const authService = new AuthService(
  authRepository,
  passwordService,
  tokenService,
  auditService,
  new UserTokenService(),
  emailSender,
  { appUrl: app.url, ttlMinutes: passwordReset.ttlMinutes },
);
const authController = new AuthController(authService);
const authMiddleware = createAuthMiddleware(tokenService);

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
router.post("/refresh", authRateLimiter, authController.refresh);
router.post("/forgot-password", authRateLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post("/reset-password", authRateLimiter, validate(resetPasswordSchema), authController.resetPassword);

// Protected — auth required
// Logout is identified by the refresh-token cookie alone: the access token lasts only
// 15 minutes, and a user who was idle longer must still be able to end the session.
router.post("/logout", authController.logout);
router.post("/logout-all", authMiddleware, authController.logoutAll);
router.get("/me", authMiddleware, authController.me);

export default router;
