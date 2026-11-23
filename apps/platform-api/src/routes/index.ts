import { Router } from "express";
import authRouter from "../modules/auth/auth.routes.js";
import mfaRouter from "../modules/mfa/mfa.routes.js";
import superAdminRouter from "../modules/super-admin/super-admin.routes.js";

const router: Router = Router();

router.use("/auth/mfa", mfaRouter);
router.use("/auth", authRouter);
router.use("/super-admin", superAdminRouter);

export default router;
