import { Router } from "express";
import { authRateLimiter } from "../../middleware/rate-limiter.js";
import { validate } from "../../middleware/validate.js";
import { loginSchema, registerSchema, updateProfileSchema } from "./auth.schema.js";
import { AuthRepository } from "./auth.repository.js";
import { AuthService } from "./auth.service.js";
import { AuthController } from "./auth.controller.js";
import { createAuthMiddleware, TokenService, PasswordService } from "@smartbusiness/auth";
import { AuditService } from "../../shared/services/audit.service.js";
import { accessToken } from "../../config/index.js";

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

// Protected — auth required
router.post("/logout", authMiddleware, authController.logout);
router.post("/logout-all", authMiddleware, authController.logoutAll);
router.get("/me", authMiddleware, authController.me);
router.patch("/profile", authMiddleware, validate(updateProfileSchema), authController.updateProfile);

export default router;
