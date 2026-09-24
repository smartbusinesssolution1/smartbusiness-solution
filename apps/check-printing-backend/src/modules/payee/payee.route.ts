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
import { requirePermission } from "../../middleware/permission.guard.js";
import { PERMISSIONS as P } from "../../shared/constants/rbac.js";

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

// archive payee (requires payee:manage permission)
router.patch("/:pid/archive", requirePermission(P.PAYEE_MANAGE), payeeController.archive);

// restore payee (requires payee:manage permission)
router.patch("/:pid/restore", requirePermission(P.PAYEE_MANAGE), payeeController.restore);

export { router as payeeRouter };
