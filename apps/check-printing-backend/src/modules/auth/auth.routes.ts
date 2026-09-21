import { Router } from "express";
import { authRateLimiter } from "../../middleware/rate-limiter.js";
import { validate } from "../../middleware/validate.js";
import { loginSchema, registerSchema } from "./auth.schema.js";
import { AuthRepository } from "./auth.repository.js";
import { AuthService } from "./auth.service.js";
import { AuthController } from "./auth.controller.js";
import { authMiddleware } from "../../middleware/auth.middleware.js";
import { PasswordService } from "../../shared/services/password.service.js";
import { TokenService } from "../../shared/services/token.service.js";
import { AuditService } from "../../shared/services/audit.service.js";

// ─── Composition Root ──────────────────────────────────────────

const authRepository = new AuthRepository();
const passwordService = new PasswordService();
const tokenService = new TokenService();
const auditService = new AuditService();
const authService = new AuthService(authRepository, passwordService, tokenService, auditService);
const authController = new AuthController(authService);

// ─── Routes ────────────────────────────────────────────────────

const router: Router = Router();

// Public — no auth required
router.post("/register", authRateLimiter, validate(registerSchema), authController.register);
router.post("/login", authRateLimiter, validate(loginSchema), authController.login);
router.post("/refresh", authRateLimiter, authController.refresh);

// Protected — auth required
router.post("/logout", authMiddleware, authController.logout);
router.post("/logout-all", authMiddleware, authController.logoutAll);
router.get("/me", authMiddleware, authController.me);

export default router;
