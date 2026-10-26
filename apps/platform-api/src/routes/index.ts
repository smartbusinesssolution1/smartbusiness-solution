import { Router } from "express";
import authRouter from "../modules/auth/auth.routes.js";
import mfaRouter from "../modules/mfa/mfa.routes.js";

const router: Router = Router();

router.use("/auth/mfa", mfaRouter);
router.use("/auth", authRouter);

export default router;
