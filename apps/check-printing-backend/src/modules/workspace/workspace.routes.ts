import { Router } from "express";
import { validate } from "../../middleware/validate.js";
import { authMiddleware } from "../../middleware/auth.middleware.js";
import { workspaceMiddleware } from "../../middleware/workspace.middleware.js";
import { requireSuperUser } from "../../middleware/permission.guard.js";
import { WorkspaceRepository } from "./workspace.repository.js";
import { WorkspaceService } from "./workspace.service.js";
import { WorkspaceController } from "./workspace.controller.js";
import { AuditService } from "../../shared/services/audit.service.js";
import { PasswordService } from "../../shared/services/password.service.js";
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  addMemberSchema,
  updateMemberSchema,
} from "./workspace.schema.js";

// ─── Composition Root ──────────────────────────────────────────

const workspaceRepository = new WorkspaceRepository();
const auditService = new AuditService();
const passwordService = new PasswordService();
const workspaceService = new WorkspaceService(workspaceRepository, auditService, passwordService);
const workspaceController = new WorkspaceController(workspaceService);

// ─── Router ────────────────────────────────────────────────────

const router: Router = Router();

router.use(authMiddleware);

// Workspace CRUD
router.post(
  "/",
  validate(createWorkspaceSchema),
  workspaceController.create,
);

router.get("/", workspaceController.list);

router.get(
  "/:wid",
  workspaceMiddleware,
  workspaceController.get,
);

router.put(
  "/:wid",
  workspaceMiddleware,
  requireSuperUser,
  validate(updateWorkspaceSchema),
  workspaceController.update,
);

router.delete(
  "/:wid",
  workspaceMiddleware,
  requireSuperUser,
  workspaceController.delete,
);

// Member management — all require Super User
router.get(
  "/:wid/members",
  workspaceMiddleware,
  requireSuperUser,
  workspaceController.listMembers,
);

router.post(
  "/:wid/members",
  workspaceMiddleware,
  requireSuperUser,
  validate(addMemberSchema),
  workspaceController.addMember,
);

router.put(
  "/:wid/members/:mid",
  workspaceMiddleware,
  requireSuperUser,
  validate(updateMemberSchema),
  workspaceController.updateMember,
);

router.delete(
  "/:wid/members/:mid",
  workspaceMiddleware,
  requireSuperUser,
  workspaceController.removeMember,
);

export default router;
