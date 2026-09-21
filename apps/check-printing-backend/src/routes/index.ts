import { Router } from "express";
import authRouter from "../modules/auth/auth.routes.js";
import workspaceRouter from "../modules/workspace/workspace.routes.js";
import { routingValidationRouter } from "../modules/bank-account/bank-account-route.js";

const router: Router = Router();

router.use("/auth", authRouter);

router.use("/workspaces", workspaceRouter);

// /api/v1/validate-routing-number
router.use("/validate-routing-number", routingValidationRouter); //Global routing lookup


export default router;
