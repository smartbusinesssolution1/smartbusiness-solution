import type { Request, Response } from "express";
import { WorkspaceService } from "./workspace.service.js";
import {
  sendSuccess,
  sendCreated,
  sendNoContent,
} from "../../shared/utils/response.js";
import type {
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
  AddMemberInput,
  UpdateMemberInput,
} from "./workspace.schema.js";

export class WorkspaceController {
  constructor(private workspaceService: WorkspaceService) {}

  private auditCtx(req: Request) {
    return {
      userId: req.user!.userId,
      tenantId: req.tenant!.tenantId,
      ipAddress: req.ip,
    };
  }

  // ─── Workspace CRUD ─────────────────────────────────

  create = async (req: Request, res: Response): Promise<void> => {
    const workspace = await this.workspaceService.createWorkspace(
      req.tenant!.tenantId,
      req.user!.userId,
      req.body as CreateWorkspaceInput,
      req.product!.plan,
      this.auditCtx(req),
    );
    sendCreated(res, workspace);
  };

  list = async (req: Request, res: Response): Promise<void> => {
    const workspaces = await this.workspaceService.listWorkspaces(
      req.user!.userId,
      req.tenant!.tenantId,
    );
    sendSuccess(res, workspaces);
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const workspace = await this.workspaceService.getWorkspace(
      req.params.wid as string,
      req.tenant!.tenantId,
    );
    sendSuccess(res, workspace);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const workspace = await this.workspaceService.updateWorkspace(
      req.params.wid as string,
      req.tenant!.tenantId,
      req.body as UpdateWorkspaceInput,
      this.auditCtx(req),
    );
    sendSuccess(res, workspace);
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    await this.workspaceService.deleteWorkspace(
      req.params.wid as string,
      req.tenant!.tenantId,
      this.auditCtx(req),
    );
    sendNoContent(res);
  };

  // ─── Member Management ──────────────────────────────

  listMembers = async (req: Request, res: Response): Promise<void> => {
    const members = await this.workspaceService.listMembers(
      req.params.wid as string,
    );
    sendSuccess(res, members);
  };

  addMember = async (req: Request, res: Response): Promise<void> => {
    const member = await this.workspaceService.addMember(
      req.params.wid as string,
      req.tenant!.tenantId,
      req.body as AddMemberInput,
      this.auditCtx(req),
    );
    sendCreated(res, member);
  };

  updateMember = async (req: Request, res: Response): Promise<void> => {
    const member = await this.workspaceService.updateMember(
      req.params.wid as string,
      req.tenant!.tenantId,
      req.params.mid as string,
      req.body as UpdateMemberInput,
      this.auditCtx(req),
    );
    sendSuccess(res, member);
  };

  removeMember = async (req: Request, res: Response): Promise<void> => {
    await this.workspaceService.removeMember(
      req.params.wid as string,
      req.tenant!.tenantId,
      req.params.mid as string,
      this.auditCtx(req),
    );
    sendNoContent(res);
  };
}
