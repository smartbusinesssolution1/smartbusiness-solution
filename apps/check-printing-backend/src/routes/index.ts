import { Router } from "express";
import workspaceRouter from "../modules/workspace/workspace.routes.js";
import { routingValidationRouter } from "../modules/bank-account/bank-account-route.js";

const router: Router = Router();

router.use("/workspaces", workspaceRouter);
router.use("/validate-routing-number", routingValidationRouter);

export default router;
