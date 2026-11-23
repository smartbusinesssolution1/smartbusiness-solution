import { Router } from "express";
import { BreakRepository } from "./break.repository.js";
import { BreakService } from "./break.service.js";
import { BreakController } from "./break.controller.js";
import { validate } from "../../middlewares/validate.js";
import {
  StartBreakSchema,
  EndBreakSchema,
  WaiveMealSchema,
  BreakHistoryQuerySchema,
} from "./break.schema.js";

const repo = new BreakRepository();
const service = new BreakService(repo);
const controller = new BreakController(service, repo);

const breakRouter: Router = Router();

// POST /start - Start a meal or rest break
breakRouter.post("/start", validate(StartBreakSchema), controller.startBreak);

// POST /end - End the current active break
breakRouter.post("/end", validate(EndBreakSchema), controller.endBreak);

// POST /waive-meal - Sign meal break waiver (shifts <= 6 hours)
breakRouter.post("/waive-meal", validate(WaiveMealSchema), controller.waiveMeal);

// GET /status - Live break status & compliance countdown
breakRouter.get("/status", controller.getStatus);

// GET /history - Break audit history
breakRouter.get("/history", validate(BreakHistoryQuerySchema, "query"), controller.getHistory);

export { breakRouter };
export default breakRouter;
