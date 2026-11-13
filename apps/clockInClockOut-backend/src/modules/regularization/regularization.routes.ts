import { Router } from "express";
import { RegularizationRepository } from "./regularization.repository.js";
import { RegularizationService } from "./regularization.service.js";
import { RegularizationController } from "./regularization.controller.js";
import { requireAdmin } from "../../middlewares/requireAdmin.js";

const repo = new RegularizationRepository();
const service = new RegularizationService(repo);
const controller = new RegularizationController(service);

const router: Router = Router();

router.get("/my", controller.getMyRequests);
router.get("/", controller.listRequests);
router.post("/", controller.submitRequest);
router.get("/:id", controller.getRequestById);
router.post("/:id/approve", requireAdmin, controller.approveRequest);
router.post("/:id/reject", requireAdmin, controller.rejectRequest);
router.post("/:id/cancel", controller.cancelRequest);

export default router;
