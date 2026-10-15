import { createAuthMiddleware, PasswordService, TokenService, UserTokenService } from "@smartbusiness/auth";
import { accessToken, app, passwordReset } from "../../config/index.js";
import { AuditService } from "../../shared/services/audit.service.js";
import { emailSender } from "../../shared/services/email.js";
import { emailQueue } from "../../jobs/queues.js";
import { AuthController } from "./auth.controller.js";
import { AuthRepository } from "./auth.repository.js";
import { AuthService } from "./auth.service.js";

// Composition root: the auth objects are built once, here, and shared by the HTTP
// routes and the job worker, so both run exactly the same code.

const tokenService = new TokenService(accessToken.secret, accessToken.expiresIn);

export const authService = new AuthService(
  new AuthRepository(),
  new PasswordService(),
  tokenService,
  new AuditService(),
  new UserTokenService(),
  emailSender,
  { appUrl: app.url, ttlMinutes: passwordReset.ttlMinutes },
);

export const authController = new AuthController(authService, emailQueue);
export const authMiddleware = createAuthMiddleware(tokenService);
