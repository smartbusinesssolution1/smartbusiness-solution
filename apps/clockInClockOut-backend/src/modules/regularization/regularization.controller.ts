import type { Request, Response } from "express";
import { RegularizationService } from "./regularization.service.js";
import {
  SubmitRegularizationSchema,
  ReviewRegularizationSchema,
  ListRegularizationsQuerySchema,
} from "./regularization.schema.js";
import { ValidationError } from "../../shared/errors/index.js";

export class RegularizationController {
  constructor(private service: RegularizationService) {}

  private resolveWorkspaceId(req: Request): string {
    const headerWs = req.headers["x-workspace-id"] as string | undefined;
    const bodyWs = req.body?.workspaceId as string | undefined;
    const queryWs = req.query?.workspaceId as string | undefined;

    const candidate =
      bodyWs ||
      queryWs ||
      (headerWs && headerWs !== "null" && headerWs !== "undefined" ? headerWs : undefined);

    if (!candidate || !candidate.trim()) {
      throw new ValidationError(
        "Workspace ID is required via request body, query parameter, or 'x-workspace-id' header."
      );
    }

    return candidate.trim();
  }

  submitRequest = async (req: Request, res: Response): Promise<void> => {
    const parsed = SubmitRegularizationSchema.safeParse(req.body);
    if (!parsed.success) {
      const details: Record<string, string[]> = {};
      parsed.error.issues.forEach((i) => {
        const k = i.path.join(".") || "body";
        details[k] = [...(details[k] || []), i.message];
      });
      throw new ValidationError("Invalid regularization request data", details);
    }

    const tenantId = req.tenant!.tenantId;
    const workspaceId = parsed.data.workspaceId || this.resolveWorkspaceId(req);
    const userId = req.user!.userId;
    const role = req.tenant?.role || "EMPLOYEE";

    const result = await this.service.submitRequest(
      tenantId,
      workspaceId,
      userId,
      role,
      parsed.data
    );

    res.status(201).json({
      success: true,
      data: result,
      message: "Regularization request submitted successfully",
    });
  };

  listRequests = async (req: Request, res: Response): Promise<void> => {
    const parsed = ListRegularizationsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError("Invalid query parameters");
    }

    const tenantId = req.tenant!.tenantId;
    const workspaceId = parsed.data.workspaceId || this.resolveWorkspaceId(req);
    const userId = req.user!.userId;
    const role = req.tenant?.role || "EMPLOYEE";

    const result = await this.service.listRequests(
      tenantId,
      workspaceId,
      userId,
      role,
      parsed.data
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  getMyRequests = async (req: Request, res: Response): Promise<void> => {
    const parsed = ListRegularizationsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError("Invalid query parameters");
    }

    const tenantId = req.tenant!.tenantId;
    const workspaceId = parsed.data.workspaceId || this.resolveWorkspaceId(req);
    const userId = req.user!.userId;

    const result = await this.service.getMyRequests(
      tenantId,
      workspaceId,
      userId,
      parsed.data
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  getRequestById = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const tenantId = req.tenant!.tenantId;
    const workspaceId = this.resolveWorkspaceId(req);
    const userId = req.user!.userId;
    const role = req.tenant?.role || "EMPLOYEE";

    const result = await this.service.getRequestById(
      tenantId,
      workspaceId,
      userId,
      role,
      id
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  approveRequest = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const parsed = ReviewRegularizationSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError("Invalid approval review data");
    }

    const tenantId = req.tenant!.tenantId;
    const workspaceId = this.resolveWorkspaceId(req);
    const userId = req.user!.userId;

    const result = await this.service.approveRequest(
      tenantId,
      workspaceId,
      userId,
      id,
      parsed.data.reviewerNotes
    );

    res.status(200).json({
      success: true,
      data: result,
      message: "Regularization request approved and attendance record updated",
    });
  };

  rejectRequest = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const parsed = ReviewRegularizationSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError("Invalid rejection review data");
    }

    const tenantId = req.tenant!.tenantId;
    const workspaceId = this.resolveWorkspaceId(req);
    const userId = req.user!.userId;

    const result = await this.service.rejectRequest(
      tenantId,
      workspaceId,
      userId,
      id,
      parsed.data.reviewerNotes
    );

    res.status(200).json({
      success: true,
      data: result,
      message: "Regularization request rejected",
    });
  };

  cancelRequest = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const tenantId = req.tenant!.tenantId;
    const workspaceId = this.resolveWorkspaceId(req);
    const userId = req.user!.userId;
    const role = req.tenant?.role || "EMPLOYEE";

    const result = await this.service.cancelRequest(
      tenantId,
      workspaceId,
      userId,
      role,
      id
    );

    res.status(200).json({
      success: true,
      data: result,
      message: "Regularization request cancelled successfully",
    });
  };
}
