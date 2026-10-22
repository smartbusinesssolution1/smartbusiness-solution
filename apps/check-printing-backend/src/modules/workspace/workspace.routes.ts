import { Router } from "express";
import { validate } from "../../middleware/validate.js";
import { authMiddleware } from "../../middleware/auth.middleware.js";
import { tenantMiddleware, requireProduct } from "@smartbusiness/auth";
import { workspaceMiddleware } from "../../middleware/workspace.middleware.js";
import { requirePermission } from "../../middleware/permission.guard.js";
import { PERMISSIONS as P } from "../../shared/constants/rbac.js";
import { WorkspaceRepository } from "./workspace.repository.js";
import { WorkspaceService } from "./workspace.service.js";
import { WorkspaceController } from "./workspace.controller.js";
import { AuditService } from "../../shared/services/audit.service.js";
import { UserTokenService } from "@smartbusiness/auth";
import { emailQueue } from "../../jobs/queues.js";
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  addMemberSchema,
  updateMemberSchema,
} from "./workspace.schema.js";
import { bankAccountRouter } from "../bank-account/bank-account-route.js";
import { payeeRouter } from "../payee/payee.route.js";
import { checkRouter } from "../check/check.routes.js";
import { approvalRuleRouter } from "../approval-rule/approval-rule.routes.js";
import { activityRouter } from "../activity/activity.routes.js";
import { calibrationRouter } from "../calibration/calibration.routes.js";
import { checkPrintingSettingsRouter } from "../check-printing-settings/check-printing-settings.routes.js";

// ─── Composition Root ──────────────────────────────────────────

const workspaceRepository = new WorkspaceRepository();
const auditService = new AuditService();
const workspaceService = new WorkspaceService(
  workspaceRepository,
  auditService,
  emailQueue,
  new UserTokenService(),
);
const workspaceController = new WorkspaceController(workspaceService);

// ─── Router ────────────────────────────────────────────────────

const router: Router = Router();

// Pipeline: auth → tenant → product entitlement → routes
router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(requireProduct("check-printing"));

// Workspace CRUD
router.post(
  "/",
  validate(createWorkspaceSchema),
  workspaceController.create,
);

router.get("/", workspaceController.list);

router.get("/:wid", workspaceMiddleware, workspaceController.get);

router.put(
  "/:wid",
  workspaceMiddleware,
  requirePermission(P.WORKSPACE_MANAGE),
  validate(updateWorkspaceSchema),
  workspaceController.update,
);

router.delete(
  "/:wid",
  workspaceMiddleware,
  requirePermission(P.WORKSPACE_MANAGE),
  workspaceController.delete,
);

// Member management
router.get(
  "/:wid/members",
  workspaceMiddleware,
  requirePermission(P.MEMBER_VIEW),
  workspaceController.listMembers,
);

router.post(
  "/:wid/members",
  workspaceMiddleware,
  requirePermission(P.MEMBER_MANAGE),
  validate(addMemberSchema),
  workspaceController.addMember,
);

router.put(
  "/:wid/members/:mid",
  workspaceMiddleware,
  requirePermission(P.MEMBER_MANAGE),
  validate(updateMemberSchema),
  workspaceController.updateMember,
);

// Email a new invitation link to someone who has not set up their account yet.
router.post(
  "/:wid/members/:mid/invitation",
  workspaceMiddleware,
  requirePermission(P.MEMBER_MANAGE),
  workspaceController.resendInvitation,
);

// Removing someone who was invited but never accepted is how an invitation is cancelled:
// the access goes, and so does the link.
router.delete(
  "/:wid/members/:mid",
  workspaceMiddleware,
  requirePermission(P.MEMBER_MANAGE),
  workspaceController.removeMember,
);

// Permissions are checked per route inside bankAccountRouter: viewing and
// changing bank accounts need different permissions.
router.use("/:wid/bank-accounts", workspaceMiddleware, bankAccountRouter);

router.use("/:wid/payees", workspaceMiddleware, payeeRouter);

router.use("/:wid/checks", workspaceMiddleware, checkRouter);

router.use("/:wid/approval-rules", workspaceMiddleware, approvalRuleRouter);

router.use("/:wid/calibration", workspaceMiddleware, calibrationRouter);

router.use("/:wid/check-printing-settings", workspaceMiddleware, checkPrintingSettingsRouter);

// Admins read the workspace's activity; the company owner also reads sign-ins (checked inside).
router.use("/:wid/activity", workspaceMiddleware, activityRouter);

export default router;
