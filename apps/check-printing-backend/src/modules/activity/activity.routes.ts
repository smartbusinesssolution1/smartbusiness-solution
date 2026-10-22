import { Router } from "express";
import { validate } from "../../middleware/validate.js";
import { requirePermission } from "../../middleware/permission.guard.js";
import { PERMISSIONS as P } from "../../shared/constants/rbac.js";
import { requireCompanyOwner } from "../../middleware/company-owner.js";
import { AuditService } from "../../shared/services/audit.service.js";
import { exportFormat } from "../export/index.js";
import { ActivityController } from "./activity.controller.js";
import { ActivityRepository } from "./activity.repository.js";
import { activityQuerySchema, securityQuerySchema } from "./activity.schemas.js";
import { ActivityService } from "./activity.service.js";

const controller = new ActivityController(new ActivityService(new ActivityRepository(), new AuditService()));

// Mounted at /:wid/activity, after the workspace middleware.
const router: ReturnType<typeof Router> = Router({ mergeParams: true });

// ── The company's sign-ins and security events: they concern the whole company, so only its owner ──
router.get("/security", requireCompanyOwner, validate(securityQuerySchema, "query"), controller.security);
router.get("/security/people", requireCompanyOwner, controller.securityPeople);
router.get("/security/export", requireCompanyOwner, exportFormat(), validate(securityQuerySchema, "query"), controller.securityExport);

// ── This workspace's activity (admins) ──
router.get("/", requirePermission(P.WORKSPACE_MANAGE), validate(activityQuerySchema, "query"), controller.list);
router.get("/people", requirePermission(P.WORKSPACE_MANAGE), controller.people);
router.get("/export", requirePermission(P.WORKSPACE_MANAGE), exportFormat(), validate(activityQuerySchema, "query"), controller.export);

export { router as activityRouter };
