import { prisma, AttendanceStatus } from "@smartbusiness/database";
import { logger } from "../../shared/services/logger.js";
import { memoryCache } from "../../shared/services/cache.service.js";

export interface SweepResult {
  sweptAt: string;
  type: "day_shift_midnight" | "night_shift_midday" | "manual";
  candidatesFound: number;
  autoClosedCount: number;
  skippedCount: number;
  recordIds: string[];
}

/**
 * Service to identify and auto-close unclosed attendance records
 * for employees/admins who forgot to clock out.
 */
export class AutoClockOutService {
  /**
   * Determine if a session represents a day shift or night shift
   */
  public classifyShift(clockInTime: Date, weeklySchedule?: any, defaultStartTime = "09:00"): "day" | "night" {
    const clockIn = new Date(clockInTime);
    const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    const dayName = dayNames[clockIn.getDay()];

    // 1. Check employee's specific weekly schedule if configured
    if (Array.isArray(weeklySchedule) && weeklySchedule.length > 0) {
      const dayConf = weeklySchedule.find((s: any) => s && s.day === dayName);
      if (dayConf?.startTime) {
        const startH = parseInt(dayConf.startTime.split(":")[0], 10);
        if (startH >= 17 || startH < 4) {
          return "night";
        }
        return "day";
      }
    }

    // 2. Check actual punch time hour (local server time)
    const punchHour = clockIn.getHours();
    // Evening / late night clock-in (5:00 PM to 3:59 AM) -> Night Shift
    if (punchHour >= 17 || punchHour < 4) {
      return "night";
    }

    // Morning / daytime clock-in (4:00 AM to 4:59 PM) -> Day Shift
    return "day";
  }

  /**
   * Calculate appropriate clock-out time and working hours for an auto-closed record
   */
  public calculateAutoCloseTimes(
    clockInTime: Date,
    clockInDate: Date,
    shiftType: "day" | "night",
    weeklySchedule?: any,
    workspaceSettings?: any
  ): { clockOutDate: Date; clockOutTime: Date; workingHours: number } {
    const clockIn = new Date(clockInTime);
    const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    const dayName = dayNames[clockIn.getDay()];

    let scheduledEndTimeStr = shiftType === "night" ? "06:00" : (workspaceSettings?.defaultShiftEndTime || "18:00");

    if (Array.isArray(weeklySchedule) && weeklySchedule.length > 0) {
      const dayConf = weeklySchedule.find((s: any) => s && s.day === dayName);
      if (dayConf?.endTime) {
        scheduledEndTimeStr = dayConf.endTime;
      }
    }

    const [endHStr, endMStr] = scheduledEndTimeStr.split(":");
    const endH = parseInt(endHStr || "18", 10);
    const endM = parseInt(endMStr || "0", 10);

    let targetClockOut: Date;
    let targetClockOutDate: Date;

    if (shiftType === "day") {
      // Day shift: ends on the same calendar day as clock-in
      targetClockOut = new Date(clockIn);
      targetClockOut.setHours(endH, endM, 0, 0);

      // If scheduled end time is somehow before or equal to clockIn, default to clockIn + 8 hours
      if (targetClockOut.getTime() <= clockIn.getTime()) {
        targetClockOut = new Date(clockIn.getTime() + 8 * 3600 * 1000);
      }
      targetClockOutDate = new Date(clockInDate);
    } else {
      // Night shift: spans into the next day morning
      targetClockOut = new Date(clockIn);
      if (endH < clockIn.getHours()) {
        // Next day morning
        targetClockOut.setDate(targetClockOut.getDate() + 1);
      }
      targetClockOut.setHours(endH, endM, 0, 0);

      if (targetClockOut.getTime() <= clockIn.getTime()) {
        targetClockOut = new Date(clockIn.getTime() + 8 * 3600 * 1000);
      }
      targetClockOutDate = new Date(targetClockOut.getFullYear(), targetClockOut.getMonth(), targetClockOut.getDate());
    }

    // Compute working hours, capped at standard 8.0 hours
    const rawElapsedHours = (targetClockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
    const workingHours = Math.min(8.0, Math.max(1.0, Math.round(rawElapsedHours * 100) / 100));

    return {
      clockOutDate: targetClockOutDate,
      clockOutTime: targetClockOut,
      workingHours,
    };
  }

  /**
   * Midnight Sweep (12:00 AM / 00:00:00)
   * Sweeps and auto-closes forgotten DAY SHIFT sessions.
   * Protects night shift workers who are currently working overnight.
   */
  async sweepDayShift(referenceDate = new Date()): Promise<SweepResult> {
    const sweepType = "day_shift_midnight";
    logger.info({ at: referenceDate.toISOString(), type: sweepType }, "Running Midnight Day-Shift Auto-Clock-Out Sweep");

    // Cutoff: sessions must have been open for at least 4 hours
    const minElapsedCutoff = new Date(referenceDate.getTime() - 4 * 3600 * 1000);

    const openSessions = await prisma.attendanceRecord.findMany({
      where: {
        clockOutTime: null,
        clockInTime: {
          lte: minElapsedCutoff,
        },
      },
      include: {
        employee: {
          include: {
            workspaceMember: {
              include: {
                workspace: {
                  include: {
                    attendanceSettings: true,
                  },
                },
                user: {
                  select: { id: true, fullName: true, email: true },
                },
              },
            },
          },
        },
      },
    });

    const closedIds: string[] = [];
    let skippedCount = 0;

    for (const session of openSessions) {
      const clockIn = new Date(session.clockInTime);
      const elapsedHours = (referenceDate.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
      const wsSettings = session.employee?.workspaceMember?.workspace?.attendanceSettings;
      const weeklySchedule = session.employee?.weeklySchedule;

      const shiftClassification = this.classifyShift(
        clockIn,
        weeklySchedule,
        wsSettings?.defaultShiftStartTime || "09:00"
      );

      // Guard: At midnight, do NOT close active night-shift sessions unless they have been open for > 20 hours
      if (shiftClassification === "night" && elapsedHours < 20) {
        skippedCount++;
        continue;
      }

      const { clockOutDate, clockOutTime, workingHours } = this.calculateAutoCloseTimes(
        clockIn,
        session.clockInDate,
        shiftClassification,
        weeklySchedule,
        wsSettings
      );

      await prisma.attendanceRecord.update({
        where: { id: session.id },
        data: {
          clockOutDate,
          clockOutTime,
          workingHours,
          status: AttendanceStatus.AUTO_CLOSED,
          notes: session.notes
            ? `${session.notes} · Auto-closed at midnight threshold (Day shift missed checkout)`
            : "Auto-closed at midnight threshold · Day shift checkout missed",
          updatedAt: new Date(),
        },
      });

      closedIds.push(session.id);

      // Invalidate relevant caches
      const tenantId = session.employee?.workspaceMember?.workspace?.tenantId;
      const userId = session.employee?.workspaceMember?.user?.id;
      if (tenantId) {
        memoryCache.delPattern(`cache:att:today:${tenantId}:*`);
        memoryCache.delPattern(`cache:att:history:${tenantId}:*`);
        if (userId) {
          memoryCache.delPattern(`cache:att:today:${tenantId}:${userId}:*`);
        }
      }
    }

    logger.info(
      {
        candidates: openSessions.length,
        autoClosed: closedIds.length,
        skippedNightShifts: skippedCount,
      },
      "Midnight Day-Shift Auto-Clock-Out Sweep completed"
    );

    return {
      sweptAt: referenceDate.toISOString(),
      type: sweepType,
      candidatesFound: openSessions.length,
      autoClosedCount: closedIds.length,
      skippedCount,
      recordIds: closedIds,
    };
  }

  /**
   * Midday Sweep (12:00 PM / 12:00:00)
   * Sweeps and auto-closes forgotten NIGHT SHIFT sessions.
   * Protects day shift workers who just clocked in earlier this morning.
   */
  async sweepNightShift(referenceDate = new Date()): Promise<SweepResult> {
    const sweepType = "night_shift_midday";
    logger.info({ at: referenceDate.toISOString(), type: sweepType }, "Running Midday Night-Shift Auto-Clock-Out Sweep");

    // Cutoff: sessions must have been open for at least 4 hours
    const minElapsedCutoff = new Date(referenceDate.getTime() - 4 * 3600 * 1000);

    const openSessions = await prisma.attendanceRecord.findMany({
      where: {
        clockOutTime: null,
        clockInTime: {
          lte: minElapsedCutoff,
        },
      },
      include: {
        employee: {
          include: {
            workspaceMember: {
              include: {
                workspace: {
                  include: {
                    attendanceSettings: true,
                  },
                },
                user: {
                  select: { id: true, fullName: true, email: true },
                },
              },
            },
          },
        },
      },
    });

    const closedIds: string[] = [];
    let skippedCount = 0;

    for (const session of openSessions) {
      const clockIn = new Date(session.clockInTime);
      const elapsedHours = (referenceDate.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
      const wsSettings = session.employee?.workspaceMember?.workspace?.attendanceSettings;
      const weeklySchedule = session.employee?.weeklySchedule;

      const shiftClassification = this.classifyShift(
        clockIn,
        weeklySchedule,
        wsSettings?.defaultShiftStartTime || "09:00"
      );

      // Guard: At midday, do NOT close morning day-shift workers (clocked in today) unless open for > 16 hours
      if (shiftClassification === "day" && elapsedHours < 16) {
        skippedCount++;
        continue;
      }

      const { clockOutDate, clockOutTime, workingHours } = this.calculateAutoCloseTimes(
        clockIn,
        session.clockInDate,
        shiftClassification,
        weeklySchedule,
        wsSettings
      );

      await prisma.attendanceRecord.update({
        where: { id: session.id },
        data: {
          clockOutDate,
          clockOutTime,
          workingHours,
          status: AttendanceStatus.AUTO_CLOSED,
          notes: session.notes
            ? `${session.notes} · Auto-closed at midday threshold (Night shift missed checkout)`
            : "Auto-closed at midday threshold · Night shift checkout missed",
          updatedAt: new Date(),
        },
      });

      closedIds.push(session.id);

      // Invalidate relevant caches
      const tenantId = session.employee?.workspaceMember?.workspace?.tenantId;
      const userId = session.employee?.workspaceMember?.user?.id;
      if (tenantId) {
        memoryCache.delPattern(`cache:att:today:${tenantId}:*`);
        memoryCache.delPattern(`cache:att:history:${tenantId}:*`);
        if (userId) {
          memoryCache.delPattern(`cache:att:today:${tenantId}:${userId}:*`);
        }
      }
    }

    logger.info(
      {
        candidates: openSessions.length,
        autoClosed: closedIds.length,
        skippedDayShifts: skippedCount,
      },
      "Midday Night-Shift Auto-Clock-Out Sweep completed"
    );

    return {
      sweptAt: referenceDate.toISOString(),
      type: sweepType,
      candidatesFound: openSessions.length,
      autoClosedCount: closedIds.length,
      skippedCount,
      recordIds: closedIds,
    };
  }

  /**
   * Self-Healing Helper:
   * Auto-closes an individual stale session when an employee attempts to punch in on a new day.
   */
  async autoCloseStaleSession(session: any, employee: any): Promise<void> {
    const clockIn = new Date(session.clockInTime);
    const wsSettings = employee?.workspaceMember?.workspace?.attendanceSettings;
    const weeklySchedule = employee?.weeklySchedule;

    const shiftClassification = this.classifyShift(
      clockIn,
      weeklySchedule,
      wsSettings?.defaultShiftStartTime || "09:00"
    );

    const { clockOutDate, clockOutTime, workingHours } = this.calculateAutoCloseTimes(
      clockIn,
      session.clockInDate,
      shiftClassification,
      weeklySchedule,
      wsSettings
    );

    await prisma.attendanceRecord.update({
      where: { id: session.id },
      data: {
        clockOutDate,
        clockOutTime,
        workingHours,
        status: AttendanceStatus.AUTO_CLOSED,
        notes: session.notes
          ? `${session.notes} · Auto-closed on next shift arrival`
          : "Auto-closed on next shift arrival (checkout missed)",
        updatedAt: new Date(),
      },
    });

    const tenantId = employee?.workspaceMember?.workspace?.tenantId;
    const userId = employee?.workspaceMember?.user?.id;
    if (tenantId) {
      memoryCache.delPattern(`cache:att:today:${tenantId}:*`);
      memoryCache.delPattern(`cache:att:history:${tenantId}:*`);
      if (userId) {
        memoryCache.delPattern(`cache:att:today:${tenantId}:${userId}:*`);
      }
    }

    logger.info(
      {
        sessionId: session.id,
        employeeId: employee.id,
        clockInTime: session.clockInTime,
        clockOutTime,
        workingHours,
      },
      "Stale session self-healed and auto-closed successfully"
    );
  }
}

export const autoClockOutService = new AutoClockOutService();
