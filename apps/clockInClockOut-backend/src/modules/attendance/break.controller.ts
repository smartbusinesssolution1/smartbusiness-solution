import { Request, Response } from "express";
import { BreakService } from "./break.service.js";
import { BreakRepository } from "./break.repository.js";
import { NotFoundError } from "../../shared/errors/index.js";

export class BreakController {
  constructor(
    private breakService: BreakService,
    private breakRepo: BreakRepository
  ) {}

  private async getEmployeeId(req: Request): Promise<string> {
    const userId = req.user!.userId;
    const tenantId = req.tenant!.tenantId;
    const headerWorkspaceId =
      (req.headers["x-workspace-id"] as string | undefined) ||
      (req.query.workspaceId as string | undefined) ||
      req.body?.workspaceId;

    const employee = await this.breakRepo.findEmployeeByUserId(
      userId,
      tenantId,
      headerWorkspaceId
    );

    if (!employee) {
      throw new NotFoundError(
        "Employee record not found for your account in this organization."
      );
    }

    return employee.id;
  }

  /**
   * POST /api/v1/attendance/break/start
   * Start a meal (unpaid) or rest (paid) break
   */
  startBreak = async (req: Request, res: Response): Promise<void> => {
    const employeeId = await this.getEmployeeId(req);
    const result = await this.breakService.startBreak(employeeId, req.body);
    res.status(201).json({
      success: true,
      data: result,
      message: result.message,
    });
  };

  /**
   * POST /api/v1/attendance/break/end
   * End the current active break
   */
  endBreak = async (req: Request, res: Response): Promise<void> => {
    const employeeId = await this.getEmployeeId(req);
    const result = await this.breakService.endBreak(employeeId, req.body);
    res.status(200).json({
      success: true,
      data: result,
      message: result.complianceMessage,
    });
  };

  /**
   * POST /api/v1/attendance/break/waive-meal
   * Sign meal waiver mutual agreement (shifts <= 6 hours under CA Lab. Code § 512)
   */
  waiveMeal = async (req: Request, res: Response): Promise<void> => {
    const employeeId = await this.getEmployeeId(req);
    const result = await this.breakService.waiveMeal(employeeId, req.body);
    res.status(200).json({
      success: true,
      data: result,
      message: result.message,
    });
  };

  /**
   * GET /api/v1/attendance/break/status
   * Live break status, elapsed timers, and California 5th-hour countdown
   */
  getStatus = async (req: Request, res: Response): Promise<void> => {
    const employeeId = await this.getEmployeeId(req);
    const result = await this.breakService.getBreakStatus(employeeId);
    res.status(200).json({
      success: true,
      data: result,
    });
  };

  /**
   * GET /api/v1/attendance/break/history
   * Break audit history for active shift or record
   */
  getHistory = async (req: Request, res: Response): Promise<void> => {
    const recordId = req.query.attendanceRecordId as string;
    if (!recordId) {
      const employeeId = await this.getEmployeeId(req);
      const activeShift = await this.breakRepo.findActiveShift(employeeId);
      if (!activeShift) {
        res.status(200).json({ success: true, data: [] });
        return;
      }
      const history = await this.breakService.getBreakHistory(activeShift.id);
      res.status(200).json({ success: true, data: history });
      return;
    }

    const history = await this.breakService.getBreakHistory(recordId);
    res.status(200).json({
      success: true,
      data: history,
    });
  };
}
