import { prisma, BreakType, BreakViolationType, Prisma } from "@smartbusiness/database";

export class BreakRepository {
  /**
   * Find employee profile for user scoped to tenant & workspace
   */
  async findEmployeeByUserId(userId: string, tenantId: string, workspaceId?: string) {
    if (workspaceId) {
      const emp = await prisma.attendanceEmployeeDetails.findFirst({
        where: {
          deletedAt: null,
          workspaceMember: {
            userId,
            workspaceId,
            deletedAt: null,
            workspace: {
              tenantId,
              deletedAt: null,
            },
          },
        },
      });
      if (emp) return emp;
    }

    return prisma.attendanceEmployeeDetails.findFirst({
      where: {
        deletedAt: null,
        workspaceMember: {
          userId,
          deletedAt: null,
          workspace: {
            tenantId,
            deletedAt: null,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Find active open shift for employee (clocked in, not clocked out).
   */
  async findActiveShift(employeeId: string) {
    return prisma.attendanceRecord.findFirst({
      where: {
        employeeId,
        clockOutTime: null,
      },
      orderBy: {
        clockInTime: "desc",
      },
      include: {
        breaks: {
          orderBy: {
            startTime: "asc",
          },
        },
        employee: {
          select: {
            workspaceMemberId: true,
            workspaceMember: {
              select: {
                userId: true,
                workspaceId: true,
                workspace: {
                  select: {
                    id: true,
                    tenantId: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  /**
   * Find an active open break (startTime set, endTime null) for a shift.
   */
  async findActiveBreak(attendanceRecordId: string) {
    return prisma.attendanceBreakRecord.findFirst({
      where: {
        attendanceRecordId,
        endTime: null,
      },
      orderBy: {
        startTime: "desc",
      },
    });
  }

  /**
   * Get workspace attendance settings for statutory policy thresholds.
   */
  async getWorkspaceSettings(workspaceId: string) {
    return prisma.attendanceSettings.findUnique({
      where: { workspaceId },
    });
  }

  /**
   * Start a new break punch.
   */
  async createBreak(data: {
    attendanceRecordId: string;
    breakType: BreakType;
    isPaid: boolean;
    startTime: Date;
    startLatitude?: number | null;
    startLongitude?: number | null;
    notes?: string | null;
  }) {
    return prisma.attendanceBreakRecord.create({
      data: {
        attendanceRecordId: data.attendanceRecordId,
        breakType: data.breakType,
        isPaid: data.isPaid,
        startTime: data.startTime,
        startLatitude: data.startLatitude != null ? new Prisma.Decimal(data.startLatitude) : null,
        startLongitude: data.startLongitude != null ? new Prisma.Decimal(data.startLongitude) : null,
        notes: data.notes,
      },
    });
  }

  /**
   * Close an active break punch with duration and compliance evaluation.
   */
  async closeBreak(
    breakId: string,
    data: {
      endTime: Date;
      durationMinutes: number;
      endLatitude?: number | null;
      endLongitude?: number | null;
      isCompliant: boolean;
      violationType: BreakViolationType;
      notes?: string | null;
    }
  ) {
    return prisma.attendanceBreakRecord.update({
      where: { id: breakId },
      data: {
        endTime: data.endTime,
        durationMinutes: data.durationMinutes,
        endLatitude: data.endLatitude != null ? new Prisma.Decimal(data.endLatitude) : null,
        endLongitude: data.endLongitude != null ? new Prisma.Decimal(data.endLongitude) : null,
        isCompliant: data.isCompliant,
        violationType: data.violationType,
        notes: data.notes,
      },
    });
  }

  /**
   * Record meal waiver mutual agreement on attendance record.
   */
  async recordMealWaiver(attendanceRecordId: string, reason: string) {
    return prisma.attendanceRecord.update({
      where: { id: attendanceRecordId },
      data: {
        mealWaiverSigned: true,
        mealWaiverReason: reason,
      },
    });
  }

  /**
   * List all breaks for an attendance record.
   */
  async getBreaksForRecord(attendanceRecordId: string) {
    return prisma.attendanceBreakRecord.findMany({
      where: { attendanceRecordId },
      orderBy: { startTime: "asc" },
    });
  }

  /**
   * Update shift aggregates (total break minutes, unpaid minutes, penalty hours, net working hours).
   */
  async updateShiftBreakAggregates(
    attendanceRecordId: string,
    data: {
      totalBreakMinutes: number;
      unpaidBreakMinutes: number;
      paidBreakMinutes: number;
      mealPenaltyHours: number;
      restPenaltyHours: number;
      workingHours?: number;
    }
  ) {
    const updatePayload: Prisma.AttendanceRecordUpdateInput = {
      totalBreakMinutes: data.totalBreakMinutes,
      unpaidBreakMinutes: data.unpaidBreakMinutes,
      paidBreakMinutes: data.paidBreakMinutes,
      mealPenaltyHours: new Prisma.Decimal(data.mealPenaltyHours),
      restPenaltyHours: new Prisma.Decimal(data.restPenaltyHours),
    };

    if (data.workingHours != null) {
      updatePayload.workingHours = new Prisma.Decimal(data.workingHours);
    }

    return prisma.attendanceRecord.update({
      where: { id: attendanceRecordId },
      data: updatePayload,
    });
  }
}
