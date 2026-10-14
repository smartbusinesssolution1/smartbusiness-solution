import { Router } from "express";
import { WorkspaceRepository } from "./workspace.repository.js";
import { WorkspaceService } from "./workspace.service.js";
import { WorkspaceController } from "./workspace.controller.js";

const workspaceRepository = new WorkspaceRepository();
const workspaceService = new WorkspaceService(workspaceRepository);
const workspaceController = new WorkspaceController(workspaceService);

const router: Router = Router();

// GET /api/v1/workspaces - List all tenant workspaces
router.get("/", workspaceController.list);

// GET /api/v1/workspaces/:wid - Get single workspace details
router.get("/:wid", workspaceController.get);

export default router;
