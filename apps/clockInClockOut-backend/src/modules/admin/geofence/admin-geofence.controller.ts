import type { Request, Response } from "express";
import { AdminGeofenceService } from "./admin-geofence.service.js";
import { UpdateGeofenceSchema, WorkspaceIdParamSchema } from "./admin-geofence.schema.js";
import { ValidationError } from "../../../shared/errors/index.js";

export class AdminGeofenceController {
  constructor(private geofenceService: AdminGeofenceService) {}

  /**
   * GET /api/v1/admin/attendance/geofences/:workspaceId
   * Retrieve geofence and shift settings for a specific workspace
   */
  get = async (req: Request, res: Response): Promise<void> => {
    const paramParsed = WorkspaceIdParamSchema.safeParse(req.params);
    if (!paramParsed.success) {
      throw new ValidationError("Invalid workspace ID", {
        workspaceId: paramParsed.error.issues.map((i) => i.message),
      });
    }

    const tenantId = req.tenant!.tenantId;
    const result = await this.geofenceService.getWorkspaceGeofence(paramParsed.data.workspaceId, tenantId);

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  /**
   * PUT /api/v1/admin/attendance/geofences/:workspaceId
   * Update or create geofence boundary and shift hours for a workspace
   */
  update = async (req: Request, res: Response): Promise<void> => {
    const paramParsed = WorkspaceIdParamSchema.safeParse(req.params);
    if (!paramParsed.success) {
      throw new ValidationError("Invalid workspace ID", {
        workspaceId: paramParsed.error.issues.map((i) => i.message),
      });
    }

    const bodyParsed = UpdateGeofenceSchema.safeParse(req.body);
    if (!bodyParsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      bodyParsed.error.issues.forEach((issue) => {
        const field = issue.path.join(".") || "body";
        if (!fieldErrors[field]) fieldErrors[field] = [];
        fieldErrors[field].push(issue.message);
      });
      throw new ValidationError("Invalid geofence settings input", fieldErrors);
    }

    const tenantId = req.tenant!.tenantId;
    const result = await this.geofenceService.updateWorkspaceGeofence(
      paramParsed.data.workspaceId,
      tenantId,
      bodyParsed.data,
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  /**
   * GET /api/v1/admin/attendance/geofences
   * List all workspaces in organization with geofence overview
   */
  listOverview = async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!.tenantId;
    const result = await this.geofenceService.listOverview(tenantId);

    res.status(200).json({
      success: true,
      data: result,
    });
  };
}
