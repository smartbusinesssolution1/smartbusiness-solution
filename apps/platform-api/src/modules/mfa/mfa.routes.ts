import { Router } from "express";
import { PasswordService } from "@smartbusiness/auth";
import { mfa } from "../../config/index.js";
import { mfaRateLimiter } from "../../middleware/rate-limiter.js";
import { validate } from "../../middleware/validate.js";
import { AuditService } from "../../shared/services/audit.service.js";
import { SecretBox } from "../../shared/services/secret-box.js";
import { authMiddleware, tokenService } from "../auth/auth.module.js";
import { MfaController } from "./mfa.controller.js";
import { MfaRepository } from "./mfa.repository.js";
import { mfaCodeSchema, mfaDisableSchema } from "./mfa.schema.js";
import { MfaService } from "./mfa.service.js";

const controller = new MfaController(
  new MfaService(new MfaRepository(), new SecretBox(mfa.encryptionKey), new PasswordService(), tokenService, new AuditService()),
  tokenService,
);

// Mounted at /api/v1/auth/mfa: every route needs a signed-in session (any product).
// Code guessing is limited per account (see attempts.ts); this per-IP budget only stops floods.
const router: Router = Router();
router.use(authMiddleware);

router.get("/", controller.status);
router.post("/setup", mfaRateLimiter, controller.startSetup);
router.post("/setup/confirm", mfaRateLimiter, validate(mfaCodeSchema), controller.confirmSetup);
router.post("/verify", mfaRateLimiter, validate(mfaCodeSchema), controller.verify);
router.post("/backup-codes", mfaRateLimiter, validate(mfaCodeSchema), controller.regenerateBackupCodes);
router.post("/disable", mfaRateLimiter, validate(mfaDisableSchema), controller.disable);

export default router;
