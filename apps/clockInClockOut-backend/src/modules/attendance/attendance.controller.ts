import type { Request, Response } from "express";
import { AttendanceService } from "./attendance.service.js";

export class AttendanceController {
  constructor(private attendanceService: AttendanceService) {}

  /**
   * POST /api/v1/attendance/verify-location
   * Step 1: Pre-flight GPS verification against active workspace perimeter
   */
  verifyLocation = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const tenantId = req.tenant!.tenantId;
    const headerWorkspaceId = req.headers["x-workspace-id"] as string | undefined;

    const result = await this.attendanceService.verifyLocation(
      userId,
      tenantId,
      req.body,
      headerWorkspaceId
    );

    res.status(200).json({
      success: true,
      data: result,
      message: result.message,
    });
  };

  /**
   * POST /api/v1/attendance/check-in
   * POST /api/v1/attendance/clock-in
   * Step 2: Biometric selfie punch + geofence confirmation
   */
  checkIn = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const tenantId = req.tenant!.tenantId;
    const headerWorkspaceId = req.headers["x-workspace-id"] as string | undefined;

    const result = await this.attendanceService.checkIn(
      userId,
      tenantId,
      req.body,
      req.file,
      headerWorkspaceId
    );

    res.status(201).json({
      success: true,
      data: result,
      message: result.message,
    });
  };

  /**
   * POST /api/v1/attendance/check-out
   * POST /api/v1/attendance/clock-out
   * Reconcile shift and compute total worked hours
   */
  checkOut = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const tenantId = req.tenant!.tenantId;

    const result = await this.attendanceService.checkOut(userId, tenantId, req.body);

    res.status(200).json({
      success: true,
      data: result,
      message: result.message,
    });
  };

  /**
   * GET /api/v1/attendance/today
   * Get current day's active shift status
   */
  today = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const tenantId = req.tenant!.tenantId;

    const result = await this.attendanceService.getTodayShift(userId, tenantId);

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  /**
   * GET /api/v1/attendance/history
   * Paginated personal attendance ledger
   */
  history = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const tenantId = req.tenant!.tenantId;

    const result = await this.attendanceService.getHistory(userId, tenantId, req.query as any);

    res.status(200).json({
      success: true,
      data: result.items,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    });
  };

  /**
   * GET /api/v1/attendance/records/:id
   * Fetch single punch audit breakdown
   */
  getRecord = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const tenantId = req.tenant!.tenantId;
    const recordId = req.params.id as string;

    const result = await this.attendanceService.getRecordDetails(userId, tenantId, recordId);

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  /**
   * GET /api/v1/attendance/metrics
   * Monthly punctuality and hours metrics
   */
  metrics = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const tenantId = req.tenant!.tenantId;
    const month = req.query.month as string | undefined;

    const result = await this.attendanceService.getMonthlyMetrics(userId, tenantId, month);

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  /**
   * POST /api/v1/attendance/ledger/export
   * Export monthly ledger to CSV / timesheet
   */
  exportLedger = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const tenantId = req.tenant!.tenantId;

    const result = await this.attendanceService.exportLedger(userId, tenantId, req.body);

    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    res.status(200).send(result.content);
  };

  /**
   * GET /api/v1/attendance/my/:employeeId/metrics
   * Comprehensive metrics & session breakdown for employee dashboard
   */
  employeeDashboardMetrics = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const tenantId = req.tenant!.tenantId;
    const employeeId = req.params.employeeId;

    const result = await this.attendanceService.getEmployeeDashboardMetrics(
      userId,
      tenantId,
      employeeId
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  /**
   * GET /api/v1/attendance/my/:employeeId
   * Attendance history for employee
   */
  employeeAttendanceHistory = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const tenantId = req.tenant!.tenantId;

    const result = await this.attendanceService.getHistory(userId, tenantId, req.query as any);

    res.status(200).json({
      success: true,
      data: result.items,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    });
  };
}
