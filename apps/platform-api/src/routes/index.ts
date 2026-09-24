import { Router } from "express";
import authRouter from "../modules/auth/auth.routes.js";

const router: Router = Router();

router.use("/auth", authRouter);

export default router;
