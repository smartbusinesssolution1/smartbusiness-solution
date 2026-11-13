import { prisma, AttendanceStatus, Prisma } from "@smartbusiness/database";
import { logger } from "../../shared/services/logger.js";

export interface AbsenceSweepResult {
  date: string;
  totalEmployeesChecked: number;
  absencesCreated: number;
  skippedAlreadyRecorded: number;
  skippedOnLeave: number;
  skippedNonWorkDay: number;
}

export class AbsenceSweeperService {
  /**
   * Determine if a given date is a scheduled working day for an employee
   */
  public isWorkDayForEmployee(weeklySchedule: any, date: Date): boolean {
    const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    const dayName = dayNames[date.getUTCDay()];

    if (Array.isArray(weeklySchedule) && weeklySchedule.length > 0) {
      const dayConf = weeklySchedule.find((s: any) => s && s.day === dayName);
      if (dayConf && typeof dayConf.isWorkDay === "boolean") {
        return dayConf.isWorkDay;
      }
    } else if (weeklySchedule && typeof weeklySchedule === "object") {
      const dayConf = weeklySchedule[dayName];
      if (dayConf && typeof dayConf.isWorkDay === "boolean") {
        return dayConf.isWorkDay;
      }
    }

    // Default business week: Mon-Fri are working days, Sat/Sun are off
    return dayName !== "SAT" && dayName !== "SUN";
  }

  /**
   * Normalize any Date or date string to UTC YYYY-MM-DD Date object at midnight
   */
  private normalizeDate(date: Date): { dateObj: Date; dateStr: string; startOfDay: Date; endOfDay: Date } {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    const dateStr = `${year}-${month}-${day}`;

    const dateObj = new Date(`${dateStr}T00:00:00.000Z`);
    const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
    const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);

    return { dateObj, dateStr, startOfDay, endOfDay };
  }

  /**
   * Sweeps and permanently creates ABSENT attendance records in PostgreSQL
   * for any scheduled employee who did not clock in and has no approved leave.
   *
   * @param targetDate Target date to sweep (defaults to yesterday)
   */
  async sweepAbsences(targetDate?: Date): Promise<AbsenceSweepResult> {
    const sweepDate = targetDate ? new Date(targetDate) : new Date();
    if (!targetDate) {
      // Default to yesterday
      sweepDate.setUTCDate(sweepDate.getUTCDate() - 1);
    }

    const { dateObj, dateStr, startOfDay, endOfDay } = this.normalizeDate(sweepDate);

    // 1. Fetch active employees created on or before target date
    const employees = await prisma.attendanceEmployeeDetails.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        createdAt: { lte: endOfDay },
      },
      select: {
        id: true,
        weeklySchedule: true,
        createdAt: true,
      },
    });

    if (employees.length === 0) {
      return {
        date: dateStr,
        totalEmployeesChecked: 0,
        absencesCreated: 0,
        skippedAlreadyRecorded: 0,
        skippedOnLeave: 0,
        skippedNonWorkDay: 0,
      };
    }

    const employeeIds = employees.map((e) => e.id);

    // 2. Fetch all existing attendance records for target date
    const existingRecords = await prisma.attendanceRecord.findMany({
      where: {
        clockInDate: dateObj,
        employeeId: { in: employeeIds },
      },
      select: { employeeId: true },
    });
    const recordedSet = new Set(existingRecords.map((r) => r.employeeId));

    // 3. Fetch approved leaves covering target date
    const approvedLeaves = await prisma.leaveRequest.findMany({
      where: {
        status: "APPROVED",
        startDate: { lte: endOfDay },
        endDate: { gte: startOfDay },
        employeeId: { in: employeeIds },
      },
      select: { employeeId: true },
    });
    const onLeaveSet = new Set(approvedLeaves.map((l) => l.employeeId));

    // 4. Identify employees who are absent
    let skippedAlreadyRecorded = 0;
    let skippedOnLeave = 0;
    let skippedNonWorkDay = 0;
    const absentRecords: Prisma.AttendanceRecordCreateManyInput[] = [];

    for (const emp of employees) {
      // If already has an attendance record (present, late, etc.), skip
      if (recordedSet.has(emp.id)) {
        skippedAlreadyRecorded++;
        continue;
      }

      // If on approved leave, skip
      if (onLeaveSet.has(emp.id)) {
        skippedOnLeave++;
        continue;
      }

      // If target date was not a scheduled working day for this employee, skip
      if (!this.isWorkDayForEmployee(emp.weeklySchedule, dateObj)) {
        skippedNonWorkDay++;
        continue;
      }

      // Ensure employee was actually created on or before target date
      const empCreatedDay = new Date(emp.createdAt);
      empCreatedDay.setUTCHours(0, 0, 0, 0);
      if (empCreatedDay.getTime() > startOfDay.getTime()) {
        continue;
      }

      absentRecords.push({
        employeeId: emp.id,
        status: AttendanceStatus.ABSENT,
        clockInDate: dateObj,
        clockInTime: dateObj, // Midnight timestamp to satisfy non-null constraint
        clockInLatitude: 0,
        clockInLongitude: 0,
        clockInFaceMatchConfidence: 0,
        workingHours: 0,
        notes: "Unexcused absence · No clock-in recorded",
      });
    }

    // 5. Persist permanent ABSENT records into PostgreSQL
    let absencesCreated = 0;
    if (absentRecords.length > 0) {
      const result = await prisma.attendanceRecord.createMany({
        data: absentRecords,
        skipDuplicates: true,
      });
      absencesCreated = result.count;
    }

    const summary: AbsenceSweepResult = {
      date: dateStr,
      totalEmployeesChecked: employees.length,
      absencesCreated,
      skippedAlreadyRecorded,
      skippedOnLeave,
      skippedNonWorkDay,
    };

    if (absencesCreated > 0) {
      logger.info(
        { date: dateStr, created: absencesCreated, totalEmployees: employees.length },
        "[ABSENCE-SWEEPER] Created permanent absent attendance records in database"
      );
    }

    return summary;
  }

  /**
   * Retroactively backfills missing past work days with permanent ABSENT records.
   * Runs idempotently (will not duplicate existing records).
   *
   * @param daysBack How many past days to backfill (default: 30)
   */
  async backfillMissingPastAbsences(daysBack = 30): Promise<{ daysProcessed: number; totalAbsencesCreated: number }> {
    let totalAbsencesCreated = 0;
    let daysProcessed = 0;

    const today = new Date();
    // Start from daysBack days ago up to yesterday
    for (let i = daysBack; i >= 1; i--) {
      const target = new Date();
      target.setUTCDate(today.getUTCDate() - i);

      try {
        const res = await this.sweepAbsences(target);
        totalAbsencesCreated += res.absencesCreated;
        daysProcessed++;
      } catch (err: any) {
        logger.error({ err: err?.message, date: target.toISOString().slice(0, 10) }, "[ABSENCE-SWEEPER] Error backfilling date");
      }
    }

    logger.info(
      { daysProcessed, totalAbsencesCreated },
      "[ABSENCE-SWEEPER] Historical absence backfill sweep complete"
    );

    return { daysProcessed, totalAbsencesCreated };
  }
}

export const absenceSweeperService = new AbsenceSweeperService();
