import { Request, Response, NextFunction } from "express";
import { AdminAttendanceService } from "./admin-attendance.service.js";
import { AdminAttendanceQuerySchema, AdminAttendanceExportSchema } from "./admin-attendance.schema.js";

export class AdminAttendanceController {
  constructor(private readonly service: AdminAttendanceService) {}

  /**
   * GET /api/v1/admin/attendance
   * List paginated attendance records with search, status, and date filters
   */
  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenant?.tenantId;
      if (!tenantId) {
        return res.status(401).json({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Missing tenant identification." },
        });
      }

      // Read workspaceId from query or fallback to X-Workspace-Id header
      const headerWorkspaceId = req.headers["x-workspace-id"] as string | undefined;
      const rawQuery = {
        ...req.query,
        workspaceId: req.query.workspaceId || (headerWorkspaceId && headerWorkspaceId !== "null" && headerWorkspaceId !== "undefined" ? headerWorkspaceId : undefined),
      };

      const parseResult = AdminAttendanceQuerySchema.safeParse(rawQuery);
      if (!parseResult.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid query parameters.",
            details: parseResult.error.format(),
          },
        });
      }

      const result = await this.service.getAttendanceReport(tenantId, parseResult.data);
      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/admin/attendance/summary
   * Organization/workspace-level attendance KPIs
   */
  summary = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenant?.tenantId;
      if (!tenantId) {
        return res.status(401).json({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Missing tenant identification." },
        });
      }

      const headerWorkspaceId = req.headers["x-workspace-id"] as string | undefined;
      const rawWsId =
        (req.query.workspaceId as string) ||
        (headerWorkspaceId && headerWorkspaceId !== "null" && headerWorkspaceId !== "undefined" ? headerWorkspaceId : undefined);
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const workspaceId = rawWsId && uuidRegex.test(rawWsId.trim()) ? rawWsId.trim() : undefined;

      const metrics = await this.service.getSummary(tenantId, workspaceId);
      return res.status(200).json({
        success: true,
        data: metrics,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST or GET /api/v1/admin/attendance/export
   * Generates audit report in XLSX, CSV, or PDF format and returns the public download URL
   */
  exportReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenant?.tenantId;
      if (!tenantId) {
        return res.status(401).json({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Missing tenant identification." },
        });
      }

      const headerWorkspaceId = req.headers["x-workspace-id"] as string | undefined;
      const rawPayload = {
        ...req.query,
        ...(req.body || {}),
        workspaceId:
          req.body?.workspaceId ||
          req.query?.workspaceId ||
          (headerWorkspaceId && headerWorkspaceId !== "null" && headerWorkspaceId !== "undefined"
            ? headerWorkspaceId
            : undefined),
      };

      const parseResult = AdminAttendanceExportSchema.safeParse(rawPayload);
      if (!parseResult.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid export parameters.",
            details: parseResult.error.format(),
          },
        });
      }

      const result = await this.service.generateExportReport(tenantId, parseResult.data);
      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };
}
