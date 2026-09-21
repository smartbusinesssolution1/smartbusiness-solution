import { Router } from "express";
import { BankAccountRepository } from "./bank-account.repository.js";
import { BanKAccountService } from "./bank-account.service.js";
import { BankAccountController } from "./bank-account.controller.js";
import { validate } from "../../middleware/validate.js";
import { createBankAccountSchema, updateBankAccountSchema, validateRoutingNumberSchema } from "./bank-account.schema.js";
import { authMiddleware } from "../../middleware/auth.middleware.js";

const router: Router = Router({ mergeParams: true });


// dependency injection 

const bankAccountRepository = new BankAccountRepository();
const bankAccountService = new BanKAccountService(bankAccountRepository);
const bankAccountController = new BankAccountController(bankAccountService);

// /api/v1/workspace/:wid/bank-accounts
router.post("/", validate(createBankAccountSchema), bankAccountController.create);

// /api/v1/workspace/:wid/bank-accounts
router.get("/", bankAccountController.list);

// /api/v1/workspace/:wid/bank-accounts/:bid
router.get("/:bid", bankAccountController.get);

// /api/v1/workspace/:wid/bank-accounts/:bid
router.put("/:bid", validate(updateBankAccountSchema), bankAccountController.update);

// /api/v1/workspace/:wid/bank-accounts/:bid
router.delete("/:bid", bankAccountController.delete);

export { router as bankAccountRouter };

const validationRouter: Router = Router();

validationRouter.post("/", authMiddleware, validate(validateRoutingNumberSchema), bankAccountController.validateRouting);

export { validationRouter as routingValidationRouter };

