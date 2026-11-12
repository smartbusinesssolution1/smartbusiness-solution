import type { Request, Response } from "express";
import { LeaveService } from "./leave.service.js";
import {
  CreateLeavePolicySchema,
  UpdateLeavePolicySchema,
  SubmitLeaveRequestSchema,
  ReviewLeaveRequestSchema,
  ListLeaveRequestsQuerySchema,
  RunPayPeriodAccrualSchema,
  RunRolloverSchema,
  ListWorkspaceBalancesQuerySchema,
  GetTeamCalendarQuerySchema,
  CheckConflictQuerySchema,
  CalculateTerminationPayoutSchema,
  PayrollExportQuerySchema,
  AssignLeaveBalanceSchema,
} from "./leave.schema.js";
import { ValidationError } from "../../shared/errors/index.js";
import { storageService } from "../../shared/services/storage.service.js";

export class LeaveController {
  constructor(private service: LeaveService) {}

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

  // ─── Policy Controllers ───────────────────────────────────────────────────

  createPolicy = async (req: Request, res: Response): Promise<void> => {
    const parsed = CreateLeavePolicySchema.safeParse(req.body);
    if (!parsed.success) {
      const details: Record<string, string[]> = {};
      parsed.error.issues.forEach((i) => {
        const k = i.path.join(".") || "body";
        details[k] = [...(details[k] || []), i.message];
      });
      throw new ValidationError("Invalid policy data", details);
    }

    const tenantId = req.tenant!.tenantId;
    const workspaceId = parsed.data.workspaceId || this.resolveWorkspaceId(req);

    const result = await this.service.createPolicy(tenantId, workspaceId, parsed.data);
    res.status(201).json({
      success: true,
      data: result,
      message: "Leave policy created successfully",
    });
  };

  listPolicies = async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!.tenantId;
    const workspaceId = this.resolveWorkspaceId(req);
    const isActive = req.query.isActive !== undefined ? req.query.isActive === "true" : undefined;

    const result = await this.service.listPolicies(tenantId, workspaceId, isActive);
    res.status(200).json({
      success: true,
      data: result,
      total: result.length,
    });
  };

  getPolicyById = async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!.tenantId;
    const workspaceId = this.resolveWorkspaceId(req);
    const id = req.params.id;

    const result = await this.service.getPolicyById(tenantId, workspaceId, id);
    res.status(200).json({
      success: true,
      data: result,
    });
  };

  updatePolicy = async (req: Request, res: Response): Promise<void> => {
    const parsed = UpdateLeavePolicySchema.safeParse(req.body);
    if (!parsed.success) {
      const details: Record<string, string[]> = {};
      parsed.error.issues.forEach((i) => {
        const k = i.path.join(".") || "body";
        details[k] = [...(details[k] || []), i.message];
      });
      throw new ValidationError("Invalid update data", details);
    }

    const tenantId = req.tenant!.tenantId;
    const workspaceId = this.resolveWorkspaceId(req);
    const id = req.params.id;

    const result = await this.service.updatePolicy(tenantId, workspaceId, id, parsed.data);
    res.status(200).json({
      success: true,
      data: result,
      message: "Leave policy updated successfully",
    });
  };

  deletePolicy = async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!.tenantId;
    const workspaceId = this.resolveWorkspaceId(req);
    const id = req.params.id;

    await this.service.deletePolicy(tenantId, workspaceId, id);
    res.status(200).json({
      success: true,
      message: "Leave policy deleted successfully",
    });
  };

  seedUsPresets = async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!.tenantId;
    const workspaceId = this.resolveWorkspaceId(req);
    const presetType = (req.body?.presetType as string) || "ALL";

    const result = await this.service.seedUsStatePresets(tenantId, workspaceId, presetType);
    res.status(201).json({
      success: true,
      data: result,
      message: `Seeded ${result.length} standard US statutory leave policies.`,
    });
  };

  // ─── Balances ─────────────────────────────────────────────────────────────

  getMyBalances = async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!.tenantId;
    const workspaceId = this.resolveWorkspaceId(req);
    const userId = req.user!.userId;
    const year = req.query.year ? parseInt(req.query.year as string, 10) : new Date().getFullYear();

    const emp = await this.service["repo"].findEmployeeByUserId(workspaceId, userId);
    if (!emp) {
      res.status(200).json({ success: true, data: [] });
      return;
    }

    const result = await this.service.getEmployeeBalances(tenantId, workspaceId, emp.id, year);
    res.status(200).json({
      success: true,
      data: result,
    });
  };

  getEmployeeBalances = async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!.tenantId;
    const workspaceId = this.resolveWorkspaceId(req);
    const employeeId = req.params.employeeId;
    const year = req.query.year ? parseInt(req.query.year as string, 10) : new Date().getFullYear();

    const result = await this.service.getEmployeeBalances(tenantId, workspaceId, employeeId, year);
    res.status(200).json({
      success: true,
      data: result,
    });
  };

  // ─── Requests ─────────────────────────────────────────────────────────────

  submitRequest = async (req: Request, res: Response): Promise<void> => {
    const parsed = SubmitLeaveRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      const details: Record<string, string[]> = {};
      parsed.error.issues.forEach((i) => {
        const k = i.path.join(".") || "body";
        details[k] = [...(details[k] || []), i.message];
      });
      throw new ValidationError("Invalid leave request data", details);
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
      message: "Leave request submitted successfully",
    });
  };

  listRequests = async (req: Request, res: Response): Promise<void> => {
    const parsed = ListLeaveRequestsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError("Invalid query parameters");
    }

    const tenantId = req.tenant!.tenantId;
    const workspaceId = parsed.data.workspaceId || this.resolveWorkspaceId(req);

    const result = await this.service.listRequests(tenantId, workspaceId, parsed.data);
    res.status(200).json({
      success: true,
      data: result,
      total: result.length,
    });
  };

  getMyRequests = async (req: Request, res: Response): Promise<void> => {
    const parsed = ListLeaveRequestsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError("Invalid query parameters");
    }

    const tenantId = req.tenant!.tenantId;
    const workspaceId = parsed.data.workspaceId || this.resolveWorkspaceId(req);
    const userId = req.user!.userId;

    const result = await this.service.getMyRequests(tenantId, workspaceId, userId, parsed.data);
    res.status(200).json({
      success: true,
      data: result,
      total: result.length,
    });
  };

  reviewRequest = async (req: Request, res: Response): Promise<void> => {
    const parsed = ReviewLeaveRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError("Invalid review decision");
    }

    const tenantId = req.tenant!.tenantId;
    const workspaceId = this.resolveWorkspaceId(req);
    const requestId = req.params.id;
    const reviewerUserId = req.user!.userId;

    const result = await this.service.reviewRequest(
      tenantId,
      workspaceId,
      requestId,
      reviewerUserId,
      parsed.data
    );

    res.status(200).json({
      success: true,
      data: result,
      message: `Leave request ${parsed.data.status.toLowerCase()} successfully`,
    });
  };

  cancelRequest = async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!.tenantId;
    const workspaceId = this.resolveWorkspaceId(req);
    const requestId = req.params.id;
    const userId = req.user!.userId;
    const role = req.tenant?.role || "EMPLOYEE";

    const result = await this.service.cancelRequest(
      tenantId,
      workspaceId,
      requestId,
      userId,
      role
    );

    res.status(200).json({
      success: true,
      data: result,
      message: "Leave request cancelled successfully",
    });
  };

  // ─── Accrual Engine Controllers ───────────────────────────────────────────

  listWorkspaceBalances = async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!.tenantId;
    const workspaceId = this.resolveWorkspaceId(req);
    const parsed = ListWorkspaceBalancesQuerySchema.safeParse(req.query);

    const year = parsed.success && parsed.data.year ? parsed.data.year : undefined;
    const employeeId = parsed.success ? parsed.data.employeeId : undefined;
    const policyId = parsed.success ? parsed.data.policyId : undefined;

    const result = await this.service.listWorkspaceBalances(
      tenantId,
      workspaceId,
      year,
      employeeId,
      policyId
    );

    res.status(200).json({
      success: true,
      data: result,
      total: result.length,
    });
  };

  assignLeaveBalance = async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!.tenantId;
    const workspaceId = this.resolveWorkspaceId(req);
    const parsed = AssignLeaveBalanceSchema.safeParse({
      ...req.body,
      workspaceId: req.body?.workspaceId || workspaceId,
    });
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((e) => e.message).join(", "));
    }

    const result = await this.service.assignOrAdjustBalance(
      tenantId,
      workspaceId,
      parsed.data
    );

    res.status(200).json({
      success: true,
      message: "Leave balance assigned / adjusted successfully",
      data: result,
    });
  };

  runPayPeriodAccruals = async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!.tenantId;
    const workspaceId = this.resolveWorkspaceId(req);
    const parsed = RunPayPeriodAccrualSchema.safeParse(req.body);

    const year = parsed.success ? parsed.data.year : undefined;
    const result = await this.service.runPayPeriodAccruals(tenantId, workspaceId, year);

    res.status(200).json(result);
  };

  runRollover = async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!.tenantId;
    const workspaceId = this.resolveWorkspaceId(req);
    const parsed = RunRolloverSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new ValidationError("Both 'fromYear' and 'toYear' are required for annual rollover.");
    }

    const result = await this.service.runRollover(
      tenantId,
      workspaceId,
      parsed.data.fromYear,
      parsed.data.toYear
    );

    res.status(200).json(result);
  };

  // ─── Team Calendar & Staffing Conflict Controllers ────────────────────────

  getTeamCalendar = async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!.tenantId;
    const workspaceId = this.resolveWorkspaceId(req);
    const parsed = GetTeamCalendarQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError("Invalid calendar query parameters");
    }

    const result = await this.service.getTeamCalendarLeaves(tenantId, workspaceId, parsed.data);
    res.status(200).json({
      success: true,
      data: result,
      total: result.length,
    });
  };

  checkStaffingConflict = async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!.tenantId;
    const workspaceId = this.resolveWorkspaceId(req);

    const employeeId = (req.query.employeeId || req.body?.employeeId) as string | undefined;
    const startDate = (req.query.startDate || req.body?.startDate) as string | undefined;
    const endDate = (req.query.endDate || req.body?.endDate) as string | undefined;
    const excludeRequestId = (req.query.excludeRequestId || req.body?.excludeRequestId || req.params?.id) as string | undefined;

    if (!employeeId || !startDate || !endDate) {
      throw new ValidationError("employeeId, startDate (YYYY-MM-DD), and endDate (YYYY-MM-DD) are required.");
    }

    const result = await this.service.checkStaffingConflict(
      tenantId,
      workspaceId,
      employeeId,
      startDate,
      endDate,
      excludeRequestId
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  listDepartments = async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!.tenantId;
    const workspaceId = this.resolveWorkspaceId(req);

    const result = await this.service.listDepartments(tenantId, workspaceId);
    res.status(200).json({
      success: true,
      data: result,
    });
  };

  calculateTerminationPayout = async (req: Request, res: Response): Promise<void> => {
    const parsed = CalculateTerminationPayoutSchema.safeParse(req.query);
    if (!parsed.success) {
      const details: Record<string, string[]> = {};
      parsed.error.issues.forEach((i) => {
        const k = i.path.join(".") || "query";
        details[k] = [...(details[k] || []), i.message];
      });
      throw new ValidationError("Invalid termination payout query", details);
    }

    const tenantId = req.tenant!.tenantId;
    const workspaceId = parsed.data.workspaceId || this.resolveWorkspaceId(req);

    const result = await this.service.calculateTerminationPayout(
      tenantId,
      workspaceId,
      parsed.data
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  getPayrollExport = async (req: Request, res: Response): Promise<void> => {
    const parsed = PayrollExportQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      const details: Record<string, string[]> = {};
      parsed.error.issues.forEach((i) => {
        const k = i.path.join(".") || "query";
        details[k] = [...(details[k] || []), i.message];
      });
      throw new ValidationError("Invalid payroll export query", details);
    }

    const tenantId = req.tenant!.tenantId;
    const workspaceId = parsed.data.workspaceId || this.resolveWorkspaceId(req);

    const result = await this.service.getPayrollExport(
      tenantId,
      workspaceId,
      parsed.data
    );

    if (result.format === "csv" && result.csv) {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${result.filename}"`
      );
      res.status(200).send(result.csv);
      return;
    }

    res.status(200).json({
      success: true,
      data: result.data,
    });
  };

  uploadAttachment = async (req: Request, res: Response): Promise<void> => {
    if (!req.file) {
      throw new ValidationError("No file uploaded. Please provide a document file.");
    }

    const tenantId = req.tenant!.tenantId;
    const result = await storageService.uploadDocument({
      tenantId,
      file: req.file,
      folder: "leave-documents",
    });

    res.status(200).json({
      success: true,
      data: {
        url: result.url,
        key: result.key,
      },
      message: "Leave document uploaded successfully",
    });
  };
}
