import { Router } from "express";
import { WorkspaceRepository } from "./workspace.repository.js";
import { WorkspaceService } from "./workspace.service.js";
import { WorkspaceController } from "./workspace.controller.js";
import { validate } from "../../middlewares/validate.js";
import { createWorkspaceSchema, updateWorkspaceSchema } from "./workspace.schema.js";

const workspaceRepository = new WorkspaceRepository();
const workspaceService = new WorkspaceService(workspaceRepository);
const workspaceController = new WorkspaceController(workspaceService);

const router: Router = Router();

// GET /api/v1/workspaces - List all tenant workspaces
router.get("/", workspaceController.list);

// POST /api/v1/workspaces - Create a new workspace under the current tenant
router.post("/", validate(createWorkspaceSchema), workspaceController.create);

// GET /api/v1/workspaces/:wid - Get single workspace details
router.get("/:wid", workspaceController.get);

// PUT /api/v1/workspaces/:wid - Update workspace details
router.put("/:wid", validate(updateWorkspaceSchema), workspaceController.update);

export default router;
