import { Router } from "express";
import { AdminGeofenceRepository } from "./admin-geofence.repository.js";
import { AdminGeofenceService } from "./admin-geofence.service.js";
import { AdminGeofenceController } from "./admin-geofence.controller.js";
import { requireAdmin } from "../../../middlewares/requireAdmin.js";

// Composition Root
const repo = new AdminGeofenceRepository();
const service = new AdminGeofenceService(repo);
const controller = new AdminGeofenceController(service);

const router: Router = Router();

// Apply requireAdmin guard to all admin geofence routes
router.use(requireAdmin);

// GET /api/v1/admin/attendance/geofences - List all tenant workspaces with geofence overview
router.get("/", controller.listOverview);

// GET /api/v1/admin/attendance/geofences/:workspaceId - Get single workspace geofence
router.get("/:workspaceId", controller.get);

// PUT /api/v1/admin/attendance/geofences/:workspaceId - Update single workspace geofence
router.put("/:workspaceId", controller.update);

export default router;
