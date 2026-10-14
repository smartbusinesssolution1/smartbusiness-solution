import type { Request, Response, NextFunction } from "express";
import { WorkspaceService } from "./workspace.service.js";

export class WorkspaceController {
  constructor(private workspaceService: WorkspaceService) {}

  /**
   * GET /api/v1/workspaces
   * List all workspaces belonging to current tenant
   */
  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenant!.tenantId;
      const workspaces = await this.workspaceService.listWorkspaces(tenantId);

      res.status(200).json({
        success: true,
        data: workspaces,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/workspaces/:wid
   * Get single workspace details by ID
   */
  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenant!.tenantId;
      const wid = req.params.wid as string;
      const workspace = await this.workspaceService.getWorkspace(wid, tenantId);

      res.status(200).json({
        success: true,
        data: workspace,
      });
    } catch (err) {
      next(err);
    }
  };
}
