import { prisma, Prisma, AttendanceStatus } from "@smartbusiness/database";
import type {
  AdminAttendanceQueryInput,
  AdminAttendanceExportInput,
  AdminSummaryMetrics,
} from "./admin-attendance.schema.js";

export class AdminAttendanceRepository {
  /**
   * Builds the scoped Prisma WhereInput enforcing multi-tenancy and workspace filtering
   */
  private buildWhereClause(
    tenantId: string,
    query: AdminAttendanceQueryInput
  ): Prisma.AttendanceRecordWhereInput {
    const where: Prisma.AttendanceRecordWhereInput = {
      employee: {
        deletedAt: null,
        workspaceMember: {
          deletedAt: null,
          workspace: {
            tenantId,
            deletedAt: null,
            ...(query.workspaceId ? { id: query.workspaceId } : {}),
          },
        },
      },
    };

    // Filter by Status
    if (query.status && query.status !== "all") {
      const enumStatus = query.status.toUpperCase() as AttendanceStatus;
      if (Object.values(AttendanceStatus).includes(enumStatus)) {
        where.status = enumStatus;
      }
    }

    // Filter by Specific Date (YYYY-MM-DD)
    if (query.date) {
      const targetDate = new Date(`${query.date}T00:00:00.000Z`);
      where.clockInDate = targetDate;
    } else if (query.startDate || query.endDate) {
      where.clockInDate = {
        ...(query.startDate ? { gte: new Date(`${query.startDate}T00:00:00.000Z`) } : {}),
        ...(query.endDate ? { lte: new Date(`${query.endDate}T23:59:59.999Z`) } : {}),
      };
    }

    // Filter by Substring Search (Employee Code, Full Name, Email)
    if (query.search && query.search.trim().length > 0) {
      const term = query.search.trim();
      where.OR = [
        {
          employee: {
            employeeCode: { contains: term, mode: "insensitive" },
          },
        },
        {
          employee: {
            workspaceMember: {
              user: {
                fullName: { contains: term, mode: "insensitive" },
              },
            },
          },
        },
        {
          employee: {
            workspaceMember: {
              user: {
                email: { contains: term, mode: "insensitive" },
              },
            },
          },
        },
      ];
    }

    return where;
  }

  /**
   * Synthesizes absent records for active employees who have no attendance record on a specific date
   */
  private async getSyntheticAbsentRecords(
    tenantId: string,
    targetDateStr: string,
    workspaceId?: string,
    search?: string,
    status?: string
  ) {
    if (status && status !== "all" && status !== "absent") {
      return [];
    }

    const targetDateObj = new Date(`${targetDateStr}T00:00:00.000Z`);

    const activeEmployees = await prisma.attendanceEmployeeDetails.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        workspaceMember: {
          deletedAt: null,
          workspace: {
            tenantId,
            deletedAt: null,
            ...(workspaceId ? { id: workspaceId } : {}),
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
              select: {
                id: true,
                businessName: true,
              },
            },
          },
        },
      },
    });

    const activeEmpIds = activeEmployees.map((e) => e.id);

    const existingRecords =
      activeEmpIds.length > 0
        ? await prisma.attendanceRecord.findMany({
            where: {
              employeeId: { in: activeEmpIds },
              clockInDate: targetDateObj,
            },
            select: { employeeId: true },
          })
        : [];


    const recordedEmpIds = new Set(existingRecords.map((r) => r.employeeId));
    let missingEmployees = activeEmployees.filter((emp) => !recordedEmpIds.has(emp.id));

    if (search && search.trim().length > 0) {
      const term = search.trim().toLowerCase();
      missingEmployees = missingEmployees.filter((emp) => {
        const code = (emp.employeeCode || "").toLowerCase();
        const name = (emp.workspaceMember?.user?.fullName || "").toLowerCase();
        const email = (emp.workspaceMember?.user?.email || "").toLowerCase();
        return code.includes(term) || name.includes(term) || email.includes(term);
      });
    }

    return missingEmployees.map((emp) => ({
      id: `absent-${emp.id}-${targetDateStr}`,
      clockInDate: targetDateObj,
      clockInTime: null,
      clockOutTime: null,
      status: AttendanceStatus.ABSENT,
      workingHours: null,
      notes: "No clock-in recorded · Absent",
      employeeId: emp.id,
      employee: emp,
      createdAt: targetDateObj,
      updatedAt: targetDateObj,
      deletedAt: null,
      confidenceIn: null,
      confidenceOut: null,
      shiftScheduleId: null,
      isAutoClosed: false,
    }));
  }

  /**
   * Retrieves paginated attendance records with employee, user, and workspace details
   */
  async findAttendanceRecords(tenantId: string, query: AdminAttendanceQueryInput) {
    const where = this.buildWhereClause(tenantId, query);
    const skip = (query.page - 1) * query.limit;
    const take = query.limit;

    let syntheticAbsents: any[] = [];
    if (query.date) {
      syntheticAbsents = await this.getSyntheticAbsentRecords(
        tenantId,
        query.date,
        query.workspaceId,
        query.search,
        query.status
      );
    }

    if (query.date && syntheticAbsents.length > 0) {
      const dbItems = await prisma.attendanceRecord.findMany({
        where,
        include: {
          employee: {
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
                    select: {
                      id: true,
                      businessName: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: [{ clockInDate: "desc" }, { clockInTime: "desc" }],
      });

      const allItems = [...dbItems, ...syntheticAbsents];
      const total = allItems.length;
      const paginatedItems = allItems.slice(skip, skip + take);
      const allSummaryRecords = [
        ...dbItems.map((r) => ({
          status: r.status,
          workingHours: r.workingHours,
          clockInTime: r.clockInTime,
          clockOutTime: r.clockOutTime,
        })),
        ...syntheticAbsents.map((s) => ({
          status: s.status,
          workingHours: s.workingHours,
          clockInTime: s.clockInTime,
          clockOutTime: s.clockOutTime,
        })),
      ];

      return {
        items: paginatedItems,
        total,
        allSummaryRecords,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit) || 1,
      };
    }

    const [items, total, allSummaryRecords] = await Promise.all([
      prisma.attendanceRecord.findMany({
        where,
        include: {
          employee: {
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
                    select: {
                      id: true,
                      businessName: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: [{ clockInDate: "desc" }, { clockInTime: "desc" }],
        skip,
        take,
      }),
      prisma.attendanceRecord.count({ where }),
      // Fetch status, workingHours and clock times of all matching records for report KPIs
      prisma.attendanceRecord.findMany({
        where,
        select: {
          status: true,
          workingHours: true,
          clockInTime: true,
          clockOutTime: true,
        },
      }),
    ]);

    return {
      items,
      total,
      allSummaryRecords,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit) || 1,
    };
  }

  /**
   * Retrieves all matching attendance records without pagination for export (up to 5000 records)
   */
  async findAllAttendanceRecordsForExport(tenantId: string, query: AdminAttendanceExportInput) {
    const where = this.buildWhereClause(tenantId, {
      ...query,
      page: 1,
      limit: 5000,
    });

    let syntheticAbsents: any[] = [];
    if (query.date) {
      syntheticAbsents = await this.getSyntheticAbsentRecords(
        tenantId,
        query.date,
        query.workspaceId,
        query.search,
        query.status
      );
    }

    const rawRecords = await prisma.attendanceRecord.findMany({
      where,
      include: {
        employee: {
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
                  select: {
                    id: true,
                    businessName: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ clockInDate: "desc" }, { clockInTime: "desc" }],
      take: 5000,
    });

    return [...rawRecords, ...syntheticAbsents];
  }

  /**
   * Quick summary KPIs and dynamic analytics for the active organization
   */
  async getSummaryMetrics(tenantId: string, workspaceId?: string): Promise<AdminSummaryMetrics> {
    const now = new Date();

    // 1. Build the last 5 business days (Mon-Fri) chronologically up to today
    const weekdays: { dateStr: string; label: string }[] = [];
    const dayCursor = new Date(now);

    while (weekdays.length < 5) {
      const dayOfWeek = dayCursor.getDay(); // 0 is Sun, 6 is Sat
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        const year = dayCursor.getFullYear();
        const month = String(dayCursor.getMonth() + 1).padStart(2, "0");
        const day = String(dayCursor.getDate()).padStart(2, "0");
        const dateStr = `${year}-${month}-${day}`;
        const label = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dayOfWeek];
        weekdays.unshift({ dateStr, label });
      }
      dayCursor.setDate(dayCursor.getDate() - 1);
    }

    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    // Date range covers all 5 weekdays and today (even if today is a weekend)
    const minDateStr = weekdays[0].dateStr;
    const maxDateStr = todayStr > weekdays[weekdays.length - 1].dateStr ? todayStr : weekdays[weekdays.length - 1].dateStr;

    const minDate = new Date(`${minDateStr}T00:00:00.000Z`);
    const maxDate = new Date(`${maxDateStr}T23:59:59.999Z`);

    // 2. Query active employees and attendance records using direct composite index lookups
    const activeEmployees = await prisma.attendanceEmployeeDetails.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        workspaceMember: {
          deletedAt: null,
          workspace: {
            tenantId,
            deletedAt: null,
            ...(workspaceId ? { id: workspaceId } : {}),
          },
        },
      },
      select: {
        id: true,
        department: true,
      },
    });

    const activeEmpIds = activeEmployees.map((e) => e.id);

    const weeklyRecords =
      activeEmpIds.length > 0
        ? await prisma.attendanceRecord.findMany({
            where: {
              employeeId: { in: activeEmpIds },
              clockInDate: {
                gte: minDate,
                lte: maxDate,
              },
            },
            select: {
              id: true,
              clockInDate: true,
              status: true,
              employeeId: true,
            },
          })
        : [];


    const totalEmployees = activeEmployees.length;

    // Helper to format Prisma Date into YYYY-MM-DD
    const formatRecDate = (d: Date | string) => {
      const dt = new Date(d);
      const y = dt.getUTCFullYear();
      const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
      const day = String(dt.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    // Filter today's records
    const todayRecords = weeklyRecords.filter((r) => formatRecDate(r.clockInDate) === todayStr);

    // Use distinct employeeId Sets so employees with multiple sessions in a day are not double-counted
    const presentEmpIds = new Set(
      todayRecords
        .filter((r) => r.status === "PRESENT" || r.status === "LATE" || r.status === "HALF_DAY")
        .map((r) => r.employeeId)
    );
    const presentToday = presentEmpIds.size;

    const lateEmpIds = new Set(
      todayRecords
        .filter((r) => r.status === "LATE")
        .map((r) => r.employeeId)
    );
    const lateToday = lateEmpIds.size;

    const autoClosedToday = new Set(
      todayRecords
        .filter((r) => r.status === "AUTO_CLOSED")
        .map((r) => r.employeeId)
    ).size;

    const attendanceRate = totalEmployees > 0 ? Math.round((presentToday / totalEmployees) * 100) : 100;

    // 3. Compute Weekly Trend (last 5 business days, distinct employees per day)
    const weeklyStats = weekdays.map((w) => {
      const dayRecords = weeklyRecords.filter((r) => formatRecDate(r.clockInDate) === w.dateStr);
      const present = new Set(
        dayRecords.filter((r) => r.status === "PRESENT" || r.status === "HALF_DAY").map((r) => r.employeeId)
      ).size;
      const late = new Set(
        dayRecords.filter((r) => r.status === "LATE").map((r) => r.employeeId)
      ).size;
      const explicitAbsent = new Set(
        dayRecords.filter((r) => r.status === "ABSENT").map((r) => r.employeeId)
      ).size;
      const absent = explicitAbsent > 0 ? explicitAbsent : Math.max(0, totalEmployees - (present + late));

      return {
        day: w.label,
        present,
        late,
        absent,
      };
    });

    // 4. Compute Department Performance
    const deptMap = new Map<string, { total: number; employeeIds: Set<string> }>();
    for (const emp of activeEmployees) {
      const deptName = emp.department && emp.department.trim() ? emp.department.trim() : "General";
      let deptData = deptMap.get(deptName);
      if (!deptData) {
        deptData = { total: 0, employeeIds: new Set<string>() };
        deptMap.set(deptName, deptData);
      }
      deptData.total += 1;
      deptData.employeeIds.add(emp.id);
    }

    // Determine target records for department stats (today's records, or fallback to most recent date with records)
    let deptTargetRecords = todayRecords;
    if (deptTargetRecords.length === 0 && weeklyRecords.length > 0) {
      const datesWithRecords = Array.from(new Set(weeklyRecords.map((r) => formatRecDate(r.clockInDate)))).sort();
      if (datesWithRecords.length > 0) {
        const latestDate = datesWithRecords[datesWithRecords.length - 1];
        deptTargetRecords = weeklyRecords.filter((r) => formatRecDate(r.clockInDate) === latestDate);
      }
    }

    const todayStatusMap = new Map<string, string>();
    for (const rec of deptTargetRecords) {
      todayStatusMap.set(rec.employeeId, rec.status);
    }

    const departmentStats = Array.from(deptMap.entries()).map(([name, data]) => {
      let present = 0;
      let late = 0;
      for (const empId of data.employeeIds) {
        const status = todayStatusMap.get(empId);
        if (status === "PRESENT" || status === "HALF_DAY") {
          present++;
        } else if (status === "LATE") {
          late++;
        }
      }
      const absent = Math.max(0, data.total - (present + late));
      const rate = data.total > 0 ? Math.round(((present + late) / data.total) * 100) : 0;
      return {
        name,
        rate,
        present,
        late,
        absent,
        total: data.total,
      };
    });

    return {
      totalEmployees,
      presentToday,
      lateToday,
      autoClosedToday,
      attendanceRate,
      weeklyStats,
      departmentStats,
    };
  }
}
