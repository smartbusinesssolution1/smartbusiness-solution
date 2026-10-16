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

// List/search payees (any Check Printing member: check creation autocomplete, and approvers
// and printers need to see who is being paid)
router.get("/", validate(listPayeesQuerySchema, "query"), payeeController.list);

// get a single payee
router.get("/:pid", payeeController.get);

// The payee directory is the vendor master file: adding a look-alike vendor or switching a
// real vendor's address is how fake-vendor fraud starts. Only those who maintain vendors
// (payee:write: Admin, Editor) may change it; approvers in particular must not.

// create a payee (requires payee:write permission)
router.post("/", requirePermission(P.PAYEE_WRITE), validate(createPayeeSchema), payeeController.create);

// update a payee (requires payee:write permission)
router.put("/:pid", requirePermission(P.PAYEE_WRITE), validate(updatePayeeSchema), payeeController.update);

// archive payee (requires payee:manage permission)
router.patch("/:pid/archive", requirePermission(P.PAYEE_MANAGE), payeeController.archive);

// restore payee (requires payee:manage permission)
router.patch("/:pid/restore", requirePermission(P.PAYEE_MANAGE), payeeController.restore);

export { router as payeeRouter };
