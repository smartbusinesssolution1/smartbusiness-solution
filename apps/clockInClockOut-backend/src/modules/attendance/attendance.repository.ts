import { prisma, AttendanceStatus } from "@smartbusiness/database";
import { memoryCache } from "../../shared/services/cache.service.js";

export class AttendanceRepository {
  /**
   * Find employee profile with workspace and attendance settings by User ID and Tenant ID
   */
  async findEmployeeByUserId(userId: string, tenantId: string, workspaceId?: string) {
    const cacheKey = `emp:by-user:${tenantId}:${userId}:${workspaceId || "default"}`;
    const cached = memoryCache.get<any>(cacheKey);
    if (cached) {
      return cached;
    }

    let employee = null;
    if (workspaceId) {
      employee = await prisma.attendanceEmployeeDetails.findFirst({
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
        include: {
          workspaceMember: {
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                },
              },
              workspace: {
                include: {
                  attendanceSettings: true,
                },
              },
            },
          },
        },
      });
    }

    if (!employee) {
      employee = await prisma.attendanceEmployeeDetails.findFirst({
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
        include: {
          workspaceMember: {
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                },
              },
              workspace: {
                include: {
                  attendanceSettings: true,
                },
              },
            },
          },
        },
      });
    }

    if (employee) {
      memoryCache.set(cacheKey, employee, 60);
    }
    return employee;
  }

  /**
   * Find a specific workspace with its geofence settings
   */
  async findWorkspaceWithGeofence(workspaceId: string, tenantId: string) {
    return prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        tenantId,
        deletedAt: null,
      },
      include: {
        attendanceSettings: true,
      },
    });
  }

  /**
   * Check if employee is a member of the specified workspace
   */
  async isEmployeeMemberOfWorkspace(userId: string, workspaceId: string) {
    const member = await prisma.workspaceMember.findFirst({
      where: {
        userId,
        workspaceId,
        deletedAt: null,
      },
    });
    return Boolean(member);
  }

  /**
   * Find active open clock-in session for an employee (clockOutTime IS NULL)
   */
  async findActiveSession(employeeId: string) {
    return prisma.attendanceRecord.findFirst({
      where: {
        employeeId,
        clockOutTime: null,
      },
      orderBy: {
        clockInTime: "desc",
      },
      select: {
        id: true,
        employeeId: true,
        status: true,
        clockInDate: true,
        clockInTime: true,
        clockInLatitude: true,
        clockInLongitude: true,
        clockInFaceMatchConfidence: true,
        clockOutDate: true,
        clockOutTime: true,
        clockOutLatitude: true,
        clockOutLongitude: true,
        clockOutFaceMatchConfidence: true,
        workingHours: true,
        notes: true,
      },
    });
  }

  /**
   * Find all attendance records/sessions for an employee on a given date
   */
  async findTodaySessions(employeeId: string, todayDate: Date) {
    return prisma.attendanceRecord.findMany({
      where: {
        employeeId,
        clockInDate: todayDate,
      },
      orderBy: {
        clockInTime: "asc",
      },
      select: {
        id: true,
        employeeId: true,
        status: true,
        clockInDate: true,
        clockInTime: true,
        clockInLatitude: true,
        clockInLongitude: true,
        clockInFaceMatchConfidence: true,
        clockOutDate: true,
        clockOutTime: true,
        clockOutLatitude: true,
        clockOutLongitude: true,
        clockOutFaceMatchConfidence: true,
        workingHours: true,
        notes: true,
      },
    });
  }

  /**
   * Find today's attendance record for an employee (active open session takes priority, otherwise most recent)
   */
  async findTodayRecord(employeeId: string, todayDate: Date) {
    const active = await prisma.attendanceRecord.findFirst({
      where: {
        employeeId,
        clockInDate: todayDate,
        clockOutTime: null,
      },
      orderBy: {
        clockInTime: "desc",
      },
      select: {
        id: true,
        employeeId: true,
        status: true,
        clockInDate: true,
        clockInTime: true,
        clockInLatitude: true,
        clockInLongitude: true,
        clockInFaceMatchConfidence: true,
        clockOutDate: true,
        clockOutTime: true,
        clockOutLatitude: true,
        clockOutLongitude: true,
        clockOutFaceMatchConfidence: true,
        workingHours: true,
        notes: true,
      },
    });
    if (active) return active;

    return prisma.attendanceRecord.findFirst({
      where: {
        employeeId,
        clockInDate: todayDate,
      },
      orderBy: {
        clockInTime: "desc",
      },
      select: {
        id: true,
        employeeId: true,
        status: true,
        clockInDate: true,
        clockInTime: true,
        clockInLatitude: true,
        clockInLongitude: true,
        clockInFaceMatchConfidence: true,
        clockOutDate: true,
        clockOutTime: true,
        clockOutLatitude: true,
        clockOutLongitude: true,
        clockOutFaceMatchConfidence: true,
        workingHours: true,
        notes: true,
      },
    });
  }

  /**
   * Create clock-in punch attendance record
   */
  async createAttendanceRecord(params: {
    employeeId: string;
    status: AttendanceStatus;
    clockInDate: Date;
    clockInTime: Date;
    clockInLatitude: number;
    clockInLongitude: number;
    clockInFaceMatchConfidence: number;
    notes?: string;
  }) {
    const {
      employeeId,
      status,
      clockInDate,
      clockInTime,
      clockInLatitude,
      clockInLongitude,
      clockInFaceMatchConfidence,
      notes,
    } = params;

    return prisma.attendanceRecord.create({
      data: {
        employeeId,
        status,
        clockInDate,
        clockInTime,
        clockInLatitude,
        clockInLongitude,
        clockInFaceMatchConfidence,
        notes: notes || null,
      },
      include: {
        employee: {
          include: {
            workspaceMember: {
              include: {
                workspace: true,
                user: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Update attendance record with clock-out timestamp and calculated working hours
   */
  async updateClockOutRecord(
    recordId: string,
    params: {
      clockOutDate: Date;
      clockOutTime: Date;
      clockOutLatitude?: number;
      clockOutLongitude?: number;
      clockOutFaceMatchConfidence?: number;
      workingHours: number;
      notes?: string;
      status?: AttendanceStatus;
    }
  ) {
    const {
      clockOutDate,
      clockOutTime,
      clockOutLatitude,
      clockOutLongitude,
      clockOutFaceMatchConfidence,
      workingHours,
      notes,
      status,
    } = params;

    return prisma.attendanceRecord.update({
      where: { id: recordId },
      data: {
        clockOutDate,
        clockOutTime,
        clockOutLatitude: clockOutLatitude !== undefined ? clockOutLatitude : null,
        clockOutLongitude: clockOutLongitude !== undefined ? clockOutLongitude : null,
        clockOutFaceMatchConfidence:
          clockOutFaceMatchConfidence !== undefined ? clockOutFaceMatchConfidence : null,
        workingHours,
        notes: notes || undefined,
        status: status !== undefined ? status : undefined,
        updatedAt: new Date(),
      },
      include: {
        employee: {
          include: {
            workspaceMember: {
              include: {
                workspace: true,
                user: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Updates the attendance status across all records for a given employee and date
   * (used when multi-session cumulative hours change the day's resolved status)
   */
  async updateTodayRecordsStatus(
    employeeId: string,
    clockInDate: Date,
    status: AttendanceStatus
  ) {
    return prisma.attendanceRecord.updateMany({
      where: {
        employeeId,
        clockInDate,
      },
      data: {
        status,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Updates a single attendance record status
   */
  async updateAttendanceRecordStatus(
    recordId: string,
    status: AttendanceStatus
  ) {
    return prisma.attendanceRecord.update({
      where: { id: recordId },
      data: {
        status,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Finds all session punch times for an employee across given calendar dates
   */
  async findDateSessionPunches(employeeId: string, dates: Date[]) {
    if (dates.length === 0) return [];
    return prisma.attendanceRecord.findMany({
      where: {
        employeeId,
        clockInDate: { in: dates },
      },
      select: {
        id: true,
        clockInDate: true,
        clockInTime: true,
      },
      orderBy: {
        clockInTime: "asc",
      },
    });
  }

  /**
   * Fetch paginated attendance records for an employee
   */
  async findAttendanceHistory(
    employeeId: string,
    params: {
      startDate?: Date;
      endDate?: Date;
      skip?: number;
      take?: number;
    }
  ) {
    const { startDate, endDate, skip = 0, take = 31 } = params;

    const where: any = {
      employeeId,
    };

    if (startDate || endDate) {
      where.clockInDate = {
        ...(startDate ? { gte: startDate } : {}),
        ...(endDate ? { lte: endDate } : {}),
      };
    }

    const [records, total] = await Promise.all([
      prisma.attendanceRecord.findMany({
        where,
        orderBy: [
          { clockInDate: "desc" },
          { clockInTime: "desc" },
        ],
        skip,
        take,
        select: {
          id: true,
          employeeId: true,
          status: true,
          clockInDate: true,
          clockInTime: true,
          clockOutDate: true,
          clockOutTime: true,
          workingHours: true,
          notes: true,
        },
      }),
      prisma.attendanceRecord.count({ where }),
    ]);

    return { records, total };
  }

  /**
   * Fetch single record by ID scoped to employee
   */
  async findRecordById(recordId: string, employeeId: string) {
    return prisma.attendanceRecord.findFirst({
      where: {
        id: recordId,
        employeeId,
      },
      select: {
        id: true,
        employeeId: true,
        status: true,
        clockInDate: true,
        clockInTime: true,
        clockInLatitude: true,
        clockInLongitude: true,
        clockInFaceMatchConfidence: true,
        clockOutDate: true,
        clockOutTime: true,
        clockOutLatitude: true,
        clockOutLongitude: true,
        clockOutFaceMatchConfidence: true,
        workingHours: true,
        notes: true,
      },
    });
  }

  /**
   * Aggregate monthly metrics for employee, correctly grouping multiple sessions per calendar day
   */
  async findMonthlyMetrics(employeeId: string, startDate: Date, endDate: Date) {
    const records = await prisma.attendanceRecord.findMany({
      where: {
        employeeId,
        clockInDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        clockInDate: true,
        clockInTime: true,
        status: true,
        workingHours: true,
      },
      orderBy: {
        clockInTime: "asc",
      },
    });

    // Group records by calendar date YYYY-MM-DD
    const dateMap = new Map<string, typeof records>();
    for (const rec of records) {
      const dtStr = rec.clockInDate.toISOString().split("T")[0];
      const list = dateMap.get(dtStr) || [];
      list.push(rec);
      dateMap.set(dtStr, list);
    }

    const totalDays = dateMap.size;
    let presentDays = 0;
    let lateDays = 0;
    let onTimeDays = 0;
    let totalHours = 0;

    for (const [, dayRecords] of dateMap.entries()) {
      const isAnyPresent = dayRecords.some(
        (r) =>
          r.status === AttendanceStatus.PRESENT ||
          r.status === AttendanceStatus.LATE ||
          r.status === AttendanceStatus.HALF_DAY
      );
      if (isAnyPresent) presentDays++;

      // First session of the day determines punctuality
      const firstSession = dayRecords[0];
      if (firstSession && firstSession.status === AttendanceStatus.LATE) {
        lateDays++;
      } else if (isAnyPresent) {
        onTimeDays++;
      }

      for (const r of dayRecords) {
        totalHours += Number(r.workingHours || 0);
      }
    }

    return {
      totalDays,
      presentDays,
      onTimeDays,
      lateDays,
      totalHours: Math.round(totalHours * 100) / 100,
      punctualityRate: presentDays > 0 ? Math.round((onTimeDays / presentDays) * 100) : 100,
    };
  }
}
