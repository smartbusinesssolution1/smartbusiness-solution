import { Router } from "express";
import authRouter from "../modules/auth/auth.routes.js";
import workspaceRouter from "../modules/workspace/workspace.routes.js";

const router: Router = Router();

router.use("/auth", authRouter);
router.use("/workspaces", workspaceRouter);

export default router;
