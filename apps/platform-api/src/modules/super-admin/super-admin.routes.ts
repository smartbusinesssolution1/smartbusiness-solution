import { Router } from "express";
import { authRateLimiter } from "../../middleware/rate-limiter.js";
import { validate } from "../../middleware/validate.js";
import {
  createOrganizationSchema,
  createPlanSchema,
  superAdminLoginSchema,
  telemetryQuerySchema,
  updatePlanSchema,
} from "./super-admin.schema.js";
import { requireDevSuperAdmin, requireSuperAdmin } from "./super-admin.guard.js";
import { superAdminController } from "./super-admin.module.js";

const router: Router = Router();

// Dedicated Super Admin Authentication
router.post(
  "/auth/login",
  authRateLimiter,
  validate(superAdminLoginSchema),
  superAdminController.login,
);
router.post("/auth/logout", superAdminController.logout);

// Protected routes (Both SUPER_ADMIN and DEV_SUPER_ADMIN)
router.use(requireSuperAdmin);

router.get("/auth/me", superAdminController.me);
router.get("/dashboard", superAdminController.getDashboard);
router.get("/users", superAdminController.getUsers);
router.post("/users/:userId/unlock", superAdminController.unlockUser);
router.post(
  "/organizations",
  validate(createOrganizationSchema),
  superAdminController.createOrganization,
);
router.get("/plans", superAdminController.getPlans);
router.post(
  "/plans",
  validate(createPlanSchema),
  superAdminController.createPlan,
);
router.put(
  "/plans/:id",
  validate(updatePlanSchema),
  superAdminController.updatePlan,
);
router.get("/subscriptions", superAdminController.getSubscriptions);

// Engineering & Dev Telemetry (Restricted strictly to DEV_SUPER_ADMIN)
router.get(
  "/telemetry/logs",
  requireDevSuperAdmin,
  validate(telemetryQuerySchema, "query"),
  superAdminController.getTelemetryLogs,
);
router.get(
  "/telemetry/stats",
  requireDevSuperAdmin,
  superAdminController.getTelemetryStats,
);

export default router;
