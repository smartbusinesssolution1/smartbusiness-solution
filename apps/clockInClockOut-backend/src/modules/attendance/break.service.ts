import { BreakRepository } from "./break.repository.js";
import { BreakComplianceService } from "./break-compliance.service.js";
import { AppError, NotFoundError } from "../../shared/errors/index.js";
import type { StartBreakInput, EndBreakInput, WaiveMealInput } from "./break.schema.js";

export class BreakService {
  constructor(private breakRepo: BreakRepository) {}

  /**
   * Start a meal or rest break.
   */
  async startBreak(employeeId: string, input: StartBreakInput) {
    const shift = await this.breakRepo.findActiveShift(employeeId);
    if (!shift) {
      throw new AppError(
        "No active shift found. You must clock in before taking a break.",
        400,
        "NO_ACTIVE_SHIFT"
      );
    }

    const activeBreak = await this.breakRepo.findActiveBreak(shift.id);
    if (activeBreak) {
      throw new AppError(
        `You are already on an active ${activeBreak.breakType.toLowerCase()} break started at ${activeBreak.startTime.toISOString()}.`,
        409,
        "BREAK_ALREADY_ACTIVE"
      );
    }

    const workspaceId = shift.employee.workspaceMember.workspaceId;
    const settings = await this.breakRepo.getWorkspaceSettings(workspaceId);

    if (settings && !settings.enableBreakTracking) {
      throw new AppError(
        "Break tracking is currently disabled for this organization.",
        400,
        "BREAK_TRACKING_DISABLED"
      );
    }

    const now = new Date();
    // FLSA Standard: Rest breaks (5-20 min) are PAID. Meal breaks (30+ min) are UNPAID.
    const isPaid = input.breakType === "REST";

    const created = await this.breakRepo.createBreak({
      attendanceRecordId: shift.id,
      breakType: input.breakType,
      isPaid,
      startTime: now,
      startLatitude: input.latitude,
      startLongitude: input.longitude,
      notes: input.notes,
    });

    const shiftElapsedHours = BreakComplianceService.calculateGrossHours(shift.clockInTime, now);

    return {
      breakId: created.id,
      attendanceRecordId: shift.id,
      breakType: created.breakType,
      isPaid: created.isPaid,
      startTime: created.startTime,
      shiftElapsedHours,
      status: "ON_BREAK",
      message: `${input.breakType === "MEAL" ? "Meal (unpaid)" : "Rest (paid)"} break started successfully.`,
    };
  }

  /**
   * End an active break.
   */
  async endBreak(employeeId: string, input: EndBreakInput) {
    const shift = await this.breakRepo.findActiveShift(employeeId);
    if (!shift) {
      throw new AppError("No active shift found.", 400, "NO_ACTIVE_SHIFT");
    }

    const activeBreak = await this.breakRepo.findActiveBreak(shift.id);
    if (!activeBreak) {
      throw new AppError("No active break found to end.", 404, "NO_ACTIVE_BREAK");
    }

    const endTime = new Date();
    const durationMinutes = BreakComplianceService.calculateDurationMinutes(
      activeBreak.startTime,
      endTime
    );

    const workspaceId = shift.employee.workspaceMember.workspaceId;
    const settings = await this.breakRepo.getWorkspaceSettings(workspaceId);

    // Audit single break compliance
    const complianceAudit = BreakComplianceService.auditIndividualBreak(
      {
        ...activeBreak,
        endTime,
        durationMinutes,
      },
      shift.clockInTime,
      {
        compliancePolicy: settings?.compliancePolicy ?? "CALIFORNIA_STRICT",
        minMealBreakMinutes: settings?.minMealBreakMinutes ?? 30,
        maxMealStartShiftHour: Number(settings?.maxMealStartShiftHour ?? 5.0),
      }
    );

    const closed = await this.breakRepo.closeBreak(activeBreak.id, {
      endTime,
      durationMinutes,
      endLatitude: input.latitude,
      endLongitude: input.longitude,
      isCompliant: complianceAudit.isCompliant,
      violationType: complianceAudit.violationType,
      notes: input.notes,
    });

    // Recompute total shift break aggregates
    const allBreaks = await this.breakRepo.getBreaksForRecord(shift.id);
    const fullAudit = BreakComplianceService.auditShiftCompliance({
      clockInTime: shift.clockInTime,
      clockOutTime: null,
      breaks: allBreaks,
      mealWaiverSigned: shift.mealWaiverSigned,
      compliancePolicy: settings?.compliancePolicy ?? "CALIFORNIA_STRICT",
      autoAssessPenalties: settings?.autoAssessPenalties ?? true,
    });

    await this.breakRepo.updateShiftBreakAggregates(shift.id, {
      totalBreakMinutes: fullAudit.totalBreakMinutes,
      unpaidBreakMinutes: fullAudit.unpaidBreakMinutes,
      paidBreakMinutes: fullAudit.paidBreakMinutes,
      mealPenaltyHours: fullAudit.mealPenaltyHours,
      restPenaltyHours: fullAudit.restPenaltyHours,
    });

    return {
      breakId: closed.id,
      attendanceRecordId: shift.id,
      breakType: closed.breakType,
      isPaid: closed.isPaid,
      startTime: closed.startTime,
      endTime: closed.endTime,
      durationMinutes: closed.durationMinutes,
      isCompliant: closed.isCompliant,
      violationType: closed.violationType,
      complianceMessage: complianceAudit.reason || "Break concluded in full compliance.",
      totalUnpaidBreakMinutes: fullAudit.unpaidBreakMinutes,
      totalPaidBreakMinutes: fullAudit.paidBreakMinutes,
      status: "CLOCKED_IN",
    };
  }

  /**
   * Waive meal period (Mutual agreement under California Labor Code § 512 for shifts <= 6.0 hours).
   */
  async waiveMeal(employeeId: string, input: WaiveMealInput) {
    const shift = await this.breakRepo.findActiveShift(employeeId);
    if (!shift) {
      throw new AppError("No active shift found.", 400, "NO_ACTIVE_SHIFT");
    }

    const elapsedHours = BreakComplianceService.calculateGrossHours(shift.clockInTime, new Date());
    if (elapsedHours > 6.0) {
      throw new AppError(
        `Meal waivers cannot legally be executed for shifts exceeding 6.0 hours under California Labor Code § 512 (Current shift: ${elapsedHours}h).`,
        422,
        "WAIVER_NOT_PERMITTED"
      );
    }

    const updated = await this.breakRepo.recordMealWaiver(shift.id, input.reason);

    return {
      attendanceRecordId: updated.id,
      mealWaiverSigned: true,
      mealWaiverReason: input.reason,
      message: "Meal waiver recorded successfully. Statutory meal requirement exempt for this shift.",
    };
  }

  /**
   * Get live break status and compliance countdown for current shift.
   */
  async getBreakStatus(employeeId: string) {
    const shift = await this.breakRepo.findActiveShift(employeeId);
    if (!shift) {
      return {
        isClockedIn: false,
        isOnBreak: false,
        activeBreak: null,
        compliance: null,
        shiftSummary: null,
      };
    }

    const workspaceId = shift.employee.workspaceMember.workspaceId;
    const settings = await this.breakRepo.getWorkspaceSettings(workspaceId);
    const activeBreak = await this.breakRepo.findActiveBreak(shift.id);

    const now = new Date();
    const grossElapsedHours = BreakComplianceService.calculateGrossHours(shift.clockInTime, now);

    // Calculate California 5th Hour Deadline
    const maxStartHours = Number(settings?.maxMealStartShiftHour ?? 5.0);
    const firstMealDueBy = new Date(shift.clockInTime.getTime() + maxStartHours * 60 * 60 * 1000);
    const minutesUntilMealDue = Math.round((firstMealDueBy.getTime() - now.getTime()) / (1000 * 60));

    let activeBreakData = null;
    if (activeBreak) {
      const elapsedBreakMinutes = BreakComplianceService.calculateDurationMinutes(
        activeBreak.startTime,
        now
      );
      const minDuration =
        activeBreak.breakType === "MEAL" ? (settings?.minMealBreakMinutes ?? 30) : (settings?.restBreakMinutes ?? 10);
      const remainingMinutes = Math.max(0, minDuration - elapsedBreakMinutes);

      activeBreakData = {
        id: activeBreak.id,
        breakType: activeBreak.breakType,
        isPaid: activeBreak.isPaid,
        startTime: activeBreak.startTime,
        elapsedMinutes: elapsedBreakMinutes,
        minimumRemainingMinutes: remainingMinutes,
      };
    }

    const breaks = await this.breakRepo.getBreaksForRecord(shift.id);
    const mealBreaks = breaks.filter((b) => b.breakType === "MEAL");
    const restBreaks = breaks.filter((b) => b.breakType === "REST");

    return {
      isClockedIn: true,
      isOnBreak: Boolean(activeBreak),
      activeBreak: activeBreakData,
      compliance: {
        policy: settings?.compliancePolicy ?? "CALIFORNIA_STRICT",
        shiftStartTime: shift.clockInTime,
        grossElapsedHours,
        firstMealDueBy,
        minutesUntilMealDue,
        isMealLate: minutesUntilMealDue < 0 && mealBreaks.length === 0 && !shift.mealWaiverSigned,
        mealWaiverSigned: shift.mealWaiverSigned,
        canWaiveMeal: grossElapsedHours <= 6.0 && mealBreaks.length === 0,
      },
      shiftSummary: {
        totalBreaksCount: breaks.length,
        mealBreaksCount: mealBreaks.length,
        restBreaksCount: restBreaks.length,
        totalBreakMinutes: shift.totalBreakMinutes,
        unpaidBreakMinutes: shift.unpaidBreakMinutes,
        paidBreakMinutes: shift.paidBreakMinutes,
        mealPenaltyHours: Number(shift.mealPenaltyHours),
        restPenaltyHours: Number(shift.restPenaltyHours),
      },
    };
  }

  /**
   * Get break audit history for an attendance record or date range.
   */
  async getBreakHistory(attendanceRecordId: string) {
    const breaks = await this.breakRepo.getBreaksForRecord(attendanceRecordId);
    return breaks.map((b) => ({
      id: b.id,
      breakType: b.breakType,
      isPaid: b.isPaid,
      startTime: b.startTime,
      endTime: b.endTime,
      durationMinutes: b.durationMinutes,
      isCompliant: b.isCompliant,
      violationType: b.violationType,
      notes: b.notes,
    }));
  }
}
