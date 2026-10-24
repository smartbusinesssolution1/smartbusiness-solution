import type { Request, Response, NextFunction } from "express";
import { WorkspaceService } from "./workspace.service.js";

export class WorkspaceController {
  constructor(private workspaceService: WorkspaceService) { }

  /**
   * GET /api/v1/workspaces
   * List all workspaces belonging to current tenant
   */
  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { tenantId } = req.tenant!;
      const { userId } = req.user!; // from the decoded access token

      const workspaces = await this.workspaceService.listAccessibleWorkspaces(
        tenantId,
        userId,
      );

      console.log(
        "workspaces", workspaces
      )

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

  /**
   * POST /api/v1/workspaces
   * Create a new workspace under the current tenant
   */
  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenant!.tenantId;
      const userId = req.user!.userId;
      const workspace = await this.workspaceService.createWorkspace(tenantId, userId, req.body);

      res.status(201).json({
        success: true,
        data: workspace,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * PUT /api/v1/workspaces/:wid
   * Update existing workspace details
   */
  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenant!.tenantId;
      const wid = req.params.wid as string;
      const updated = await this.workspaceService.updateWorkspace(wid, tenantId, req.body);

      res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  };
}

