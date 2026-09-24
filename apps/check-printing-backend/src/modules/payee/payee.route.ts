import { Router } from "express";
import { PayeeRepository } from "./payee.repository.js";
import { PayeeService } from "./payee.service.js";
import { PayeeController } from "./payee.controller.js";
import { validate } from "../../middleware/validate.js";
import {
  createPayeeSchema,
  listPayeesQuerySchema,
  updatePayeeSchema,
} from "./payee.schema.js";
import { AuditService } from "../../shared/services/audit.service.js";
import { requireSuperUser } from "../../middleware/permission.guard.js";

const router: Router = Router({ mergeParams: true });

const payeeRepository = new PayeeRepository();
const auditService = new AuditService();
const payeeService = new PayeeService(payeeRepository, auditService);
const payeeController = new PayeeController(payeeService);

// List/search payees (any member — used by check creation autocomplete)
router.get("/", validate(listPayeesQuerySchema, "query"), payeeController.list);

// get a single payee
router.get("/:pid", payeeController.get);

// create a payee
router.post("/", validate(createPayeeSchema), payeeController.create);

// update a payee
router.put("/:pid", validate(updatePayeeSchema), payeeController.update);

// archive payee (Super User only)
router.patch("/:pid/archive", requireSuperUser, payeeController.archive);

// restore payee (Super User only)
router.patch("/:pid/restore", requireSuperUser, payeeController.restore);

export { router as payeeRouter };
