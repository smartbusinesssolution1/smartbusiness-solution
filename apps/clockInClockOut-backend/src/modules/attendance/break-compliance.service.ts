import { BreakType, BreakViolationType, CompliancePolicy } from "@smartbusiness/database";

export interface BreakRecordData {
  id?: string;
  breakType: BreakType;
  isPaid: boolean;
  startTime: Date;
  endTime?: Date | null;
  durationMinutes?: number | null;
  isCompliant?: boolean;
  violationType?: BreakViolationType;
  waiverSigned?: boolean;
  waiverReason?: string | null;
}

export interface ShiftComplianceInput {
  clockInTime: Date;
  clockOutTime?: Date | null;
  breaks: BreakRecordData[];
  mealWaiverSigned?: boolean;
  compliancePolicy?: CompliancePolicy;
  mealBreakThresholdHours?: number;
  minMealBreakMinutes?: number;
  maxMealStartShiftHour?: number;
  secondMealThresholdHours?: number;
  restBreakMinutes?: number;
  enforceBreakWaivers?: boolean;
  autoAssessPenalties?: boolean;
}

export interface ShiftComplianceResult {
  grossHours: number;
  totalBreakMinutes: number;
  unpaidBreakMinutes: number;
  paidBreakMinutes: number;
  netWorkingHours: number;
  isCompliant: boolean;
  mealPenaltyHours: number;
  restPenaltyHours: number;
  violations: {
    breakId?: string;
    type: BreakViolationType;
    message: string;
  }[];
}

export class BreakComplianceService {
  /**
   * Pure calculation of Gross Elapsed Shift Hours.
   */
  static calculateGrossHours(clockInTime: Date, clockOutTime: Date): number {
    const elapsedMs = Math.max(0, clockOutTime.getTime() - clockInTime.getTime());
    return Math.round((elapsedMs / (1000 * 60 * 60)) * 100) / 100;
  }

  /**
   * Calculate duration in minutes between two dates.
   */
  static calculateDurationMinutes(startTime: Date, endTime: Date): number {
    const elapsedMs = Math.max(0, endTime.getTime() - startTime.getTime());
    return Math.round(elapsedMs / (1000 * 60));
  }

  /**
   * Calculate Net Working Hours: Gross - (Unpaid Break Minutes / 60).
   * Invariant: Paid breaks (10-15m rest) are NEVER deducted.
   */
  static calculateNetWorkingHours(grossHours: number, unpaidBreakMinutes: number): number {
    const unpaidHours = Math.round((unpaidBreakMinutes / 60) * 100) / 100;
    const net = Math.max(0, grossHours - unpaidHours);
    return Math.round(net * 100) / 100;
  }

  /**
   * Evaluate compliance of a single break upon break completion.
   */
  static auditIndividualBreak(
    b: BreakRecordData,
    clockInTime: Date,
    config: {
      compliancePolicy?: CompliancePolicy;
      minMealBreakMinutes?: number;
      maxMealStartShiftHour?: number;
    }
  ): { isCompliant: boolean; violationType: BreakViolationType; reason?: string } {
    const policy = config.compliancePolicy ?? "CALIFORNIA_STRICT";
    const minMealMinutes = config.minMealBreakMinutes ?? 30;
    const maxStartHour = config.maxMealStartShiftHour ?? 5.0;

    if (!b.endTime) {
      return { isCompliant: true, violationType: "NONE" };
    }

    const duration = b.durationMinutes ?? this.calculateDurationMinutes(b.startTime, b.endTime);

    if (b.breakType === "MEAL") {
      if (policy === "CALIFORNIA_STRICT") {
        // Rule 1: Minimum duration must be at least 30 minutes
        if (duration < minMealMinutes) {
          return {
            isCompliant: false,
            violationType: "SHORT_MEAL",
            reason: `Meal duration ${duration} mins is below mandatory ${minMealMinutes} mins.`,
          };
        }

        // Rule 2: Meal must start before the end of the 5th hour of work
        const startDiffHours = (b.startTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);
        if (startDiffHours > maxStartHour) {
          return {
            isCompliant: false,
            violationType: "LATE_MEAL",
            reason: `Meal break started ${Math.round(startDiffHours * 10) / 10}h into shift (deadline: ${maxStartHour}h).`,
          };
        }
      }
    } else if (b.breakType === "REST") {
      if (policy === "CALIFORNIA_STRICT" && duration < 10) {
        return {
          isCompliant: false,
          violationType: "SHORT_REST",
          reason: `Rest duration ${duration} mins is below statutory 10 minutes.`,
        };
      }
    }

    return { isCompliant: true, violationType: "NONE" };
  }

  /**
   * Comprehensive statutory shift audit performed on shift checkout or auto-checkout.
   */
  static auditShiftCompliance(input: ShiftComplianceInput): ShiftComplianceResult {
    const policy = input.compliancePolicy ?? "CALIFORNIA_STRICT";
    const autoAssessPenalties = input.autoAssessPenalties ?? true;
    const mealThreshold = input.mealBreakThresholdHours ?? 5.0;
    const minMealMinutes = input.minMealBreakMinutes ?? 30;
    const maxMealStartHour = input.maxMealStartShiftHour ?? 5.0;
    const secondMealThreshold = input.secondMealThresholdHours ?? 10.0;

    const clockOut = input.clockOutTime ?? new Date();
    const grossHours = this.calculateGrossHours(input.clockInTime, clockOut);

    let unpaidMinutes = 0;
    let paidMinutes = 0;
    const violations: { breakId?: string; type: BreakViolationType; message: string }[] = [];

    const mealBreaks: BreakRecordData[] = [];
    const restBreaks: BreakRecordData[] = [];

    for (const b of input.breaks) {
      const dur = b.durationMinutes ?? (b.endTime ? this.calculateDurationMinutes(b.startTime, b.endTime) : 0);
      if (b.isPaid) {
        paidMinutes += dur;
        restBreaks.push(b);
      } else {
        unpaidMinutes += dur;
        mealBreaks.push(b);
      }

      // Check individual break
      if (b.endTime) {
        const audit = this.auditIndividualBreak(b, input.clockInTime, {
          compliancePolicy: policy,
          minMealBreakMinutes: minMealMinutes,
          maxMealStartShiftHour: maxMealStartHour,
        });
        if (!audit.isCompliant) {
          violations.push({
            breakId: b.id,
            type: audit.violationType,
            message: audit.reason || "Non-compliant break",
          });
        }
      }
    }

    const totalBreakMinutes = unpaidMinutes + paidMinutes;
    const netWorkingHours = this.calculateNetWorkingHours(grossHours, unpaidMinutes);

    let mealPenaltyHours = 0.0;
    let restPenaltyHours = 0.0;

    if (policy === "CALIFORNIA_STRICT") {
      // 1. Shift > 5.0 Hours Meal Requirement Check
      if (grossHours > mealThreshold) {
        if (mealBreaks.length === 0) {
          // If no meal taken: can only be excused if shift <= 6.0 hours AND waiver signed
          const canWaive = grossHours <= 6.0;
          if (canWaive && input.mealWaiverSigned) {
            // Compliant under CA Lab Code § 512(a) waiver exception
          } else {
            violations.push({
              type: "MISSED_MEAL",
              message: `Shift was ${grossHours}h (> 5.0h) with no compliant 30-min meal break and no valid waiver.`,
            });
            if (autoAssessPenalties) {
              mealPenaltyHours = 1.0;
            }
          }
        } else {
          // Check if any meal had a violation
          const hasLateOrShort = violations.some(
            (v) => v.type === "LATE_MEAL" || v.type === "SHORT_MEAL"
          );
          if (hasLateOrShort && autoAssessPenalties) {
            mealPenaltyHours = 1.0;
          }
        }
      }

      // 2. Second Meal Requirement for shifts > 10.0 Hours
      if (grossHours > secondMealThreshold && mealBreaks.length < 2) {
        // Can be waived if shift <= 12 hours AND first meal was taken
        const canWaiveSecond = grossHours <= 12.0 && mealBreaks.length === 1 && input.mealWaiverSigned;
        if (!canWaiveSecond) {
          violations.push({
            type: "MISSED_MEAL",
            message: `Shift exceeded ${secondMealThreshold}h without a second 30-minute meal break.`,
          });
          // California daily cap: 1 meal penalty hour per workday
          if (autoAssessPenalties && mealPenaltyHours === 0.0) {
            mealPenaltyHours = 1.0;
          }
        }
      }
    }

    return {
      grossHours,
      totalBreakMinutes,
      unpaidBreakMinutes: unpaidMinutes,
      paidBreakMinutes: paidMinutes,
      netWorkingHours,
      isCompliant: violations.length === 0,
      mealPenaltyHours,
      restPenaltyHours,
      violations,
    };
  }
}
