import { Router } from "express";
import { BankAccountRepository } from "./bank-account.repository.js";
import { BankAccountService } from "./bank-account.service.js";
import { BankAccountController } from "./bank-account.controller.js";
import { validate } from "../../middleware/validate.js";
import { createBankAccountSchema, updateBankAccountSchema, validateRoutingNumberSchema } from "./bank-account.schema.js";
import { authMiddleware } from "../../middleware/auth.middleware.js";
import { requireAnyPermission, requirePermission } from "../../middleware/permission.guard.js";
import { PERMISSIONS as P } from "../../shared/constants/rbac.js";
import { AuditService } from "../../shared/services/audit.service.js";
import { fileStorage } from "../../shared/storage/instance.js";
import { signatureUpload } from "./signature-upload.js";

const router: Router = Router({ mergeParams: true });


// dependency injection 

const bankAccountRepository = new BankAccountRepository();
const auditService = new AuditService();
const bankAccountService = new BankAccountService(bankAccountRepository, auditService, fileStorage);
const bankAccountController = new BankAccountController(bankAccountService);

// Least privilege: anyone who writes checks must be able to SEE the accounts
// (masked) to choose one; only bank-account managers may CHANGE them.
const canView = requireAnyPermission(P.BANK_ACCOUNT_MANAGE, P.CHECK_CREATE);
const canManage = requirePermission(P.BANK_ACCOUNT_MANAGE);

// /api/v1/workspaces/:wid/bank-accounts
router.post("/", canManage, validate(createBankAccountSchema), bankAccountController.create);

// /api/v1/workspaces/:wid/bank-accounts
router.get("/", canView, bankAccountController.list);

// /api/v1/workspaces/:wid/bank-accounts/:bid
router.get("/:bid", canView, bankAccountController.get);

// /api/v1/workspaces/:wid/bank-accounts/:bid
router.put("/:bid", canManage, validate(updateBankAccountSchema), bankAccountController.update);

// /api/v1/workspaces/:wid/bank-accounts/:bid
router.delete("/:bid", canManage, bankAccountController.delete);

// Signature: admins only, including viewing (the image alone is enough to forge checks).
// Permission is checked BEFORE the upload is read, so nobody else can even send a file.
router.put("/:bid/signature", canManage, signatureUpload, bankAccountController.uploadSignature);
router.get("/:bid/signature", canManage, bankAccountController.getSignature);
router.delete("/:bid/signature", canManage, bankAccountController.removeSignature);

export { router as bankAccountRouter };

const validationRouter: Router = Router();

validationRouter.post("/", authMiddleware, validate(validateRoutingNumberSchema), bankAccountController.validateRouting);

export { validationRouter as routingValidationRouter };

