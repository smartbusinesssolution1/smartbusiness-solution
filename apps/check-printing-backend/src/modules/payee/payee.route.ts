import { Router } from "express";
import { PayeeRepository } from "./payee.repository.js";
import { PayeeService } from "./payee.service.js";
import { PayeeController } from "./payee.controller.js";
import { validate } from "../../middleware/validate.js";
import { createPayeeSchema, updatePayeeSchema } from "./payee.schema.js";


const router: Router = Router({ mergeParams: true });

const payeeRepository = new PayeeRepository();
const payeeService = new PayeeService(payeeRepository);
const payeeController = new PayeeController(payeeService);

// List/search payees (any member — used by check creation autocomplete)
router.get('/', payeeController.list);

// get a single payee 
router.get("/:pid", payeeController.get);

//create a payee
router.post("/", validate(createPayeeSchema), payeeController.create)

//update a payee
router.put("/:pid", validate(updatePayeeSchema), payeeController.update)

// archive payee
router.patch("/:pid/archive", payeeController.archive);

//restore payee
router.patch("/:pid/restore", payeeController.restore)

export { router as payeeRouter };