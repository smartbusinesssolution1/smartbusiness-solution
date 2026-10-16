import { Router } from "express";
import { ApprovalRuleRepository } from "./approval-rule.repository.js";
import { ApprovalRuleService } from "./approval-rule.service.js";
import { ApprovalRuleController } from "./approval-rule.controller.js";
import { AuditService } from "../../shared/services/audit.service.js";
import { validate } from "../../middleware/validate.js";
import { requirePermission } from "../../middleware/permission.guard.js";
import { PERMISSIONS as P } from "../../shared/constants/rbac.js";
import { checkPrintingSettingsService } from "../check-printing-settings/check-printing-settings.routes.js";
import {
  createApprovalRuleSchema,
  updateApprovalRuleSchema,
  listApprovalRulesQuerySchema,
  addApproverSchema,
  syncApproversSchema,
  approvalToggleSchema,
} from "./approval-rule.schemas.js";

// ─── Composition Root ──────────────────────────────────────

const repository = new ApprovalRuleRepository();
const auditService = new AuditService();
const service = new ApprovalRuleService(repository, auditService, checkPrintingSettingsService);
const controller = new ApprovalRuleController(service);

// ─── Router ────────────────────────────────────────────────

const router: ReturnType<typeof Router> = Router({ mergeParams: true });

// All approval rule operations require workspace admin permission
router.use(requirePermission(P.WORKSPACE_MANAGE));

// ── Master Switch ──
router.patch(
  "/settings/approval-toggle",
  validate(approvalToggleSchema),
  controller.toggleApproval,
);

// ── Eligible Approvers (before /:ruleId to avoid param capture) ──
router.get("/eligible-approvers", controller.listEligible);

// ── List Rules ──
router.get(
  "/",
  validate(listApprovalRulesQuerySchema, "query"),
  controller.list,
);

// ── Create Rule ──
router.post(
  "/",
  validate(createApprovalRuleSchema),
  controller.create,
);

// ── Get Single Rule ──
router.get("/:ruleId", controller.getOne);

// ── Update Rule ──
router.put(
  "/:ruleId",
  validate(updateApprovalRuleSchema),
  controller.update,
);

// ── Activate Rule ──
router.post("/:ruleId/activate", controller.activate);

// ── Deactivate Rule ──
router.post("/:ruleId/deactivate", controller.deactivate);

// ── Delete Rule ──
router.delete("/:ruleId", controller.remove);

// ═════════════════════════════════════════════════════════════
// APPROVER SUB-ROUTES (nested under /:ruleId/approvers)
// ═════════════════════════════════════════════════════════════

// ── List Approvers for a Rule ──
router.get("/:ruleId/approvers", controller.listApprovers);

// ── Sync (Replace All) Approvers ──
router.put(
  "/:ruleId/approvers",
  validate(syncApproversSchema),
  controller.syncApprovers,
);

// ── Add Single Approver ──
router.post(
  "/:ruleId/approvers",
  validate(addApproverSchema),
  controller.addApprover,
);

// ── Remove Single Approver ──
router.delete("/:ruleId/approvers/:userId", controller.removeApprover);

export { router as approvalRuleRouter };
