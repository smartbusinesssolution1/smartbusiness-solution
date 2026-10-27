import { prisma, Prisma, AttendanceStatus } from "@smartbusiness/database";
import { memoryCache } from "../../../shared/services/cache.service.js";
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
   * Helper to format a Date into YYYY-MM-DD in UTC
   */
  public formatRecDate(d: Date | string): string {
    const dt = new Date(d);
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const day = String(dt.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  /**
   * Helper to check if a specific day is a scheduled work day for an employee
   */
  private isWorkDayForEmployee(weeklySchedule: any, date: Date): boolean {
    const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    const dayName = dayNames[date.getUTCDay()];
    if (Array.isArray(weeklySchedule) && weeklySchedule.length > 0) {
      const conf = weeklySchedule.find((s: any) => s && s.day === dayName);
      if (conf && typeof conf.isWorkDay === "boolean") return conf.isWorkDay;
    } else if (weeklySchedule && typeof weeklySchedule === "object") {
      const conf = weeklySchedule[dayName];
      if (conf && typeof conf.isWorkDay === "boolean") return conf.isWorkDay;
    }
    return dayName !== "SAT" && dayName !== "SUN";
  }

  /**
   * Retrieves active employees for the workspace/tenant, cached in memory for 2 minutes
   * to eliminate duplicate database joins and maximize API throughput.
   */
  public async getCachedActiveEmployees(tenantId: string, workspaceId?: string) {
    const cacheKey = `active_employees:${tenantId}:${workspaceId || "all"}`;
    return memoryCache.getOrSet(
      cacheKey,
      async () => {
        return prisma.attendanceEmployeeDetails.findMany({
          where: {
            deletedAt: null,
            isActive: true,
            workspaceMember: {
              deletedAt: null,
              ...(workspaceId
                ? { workspaceId }
                : {
                  workspace: {
                    tenantId,
                    deletedAt: null,
                  },
                }),
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
                    attendanceSettings: {
                      select: {
                        latitude: true,
                        longitude: true,
                        radiusMeters: true,
                      },
                    },
                  },
                },
              },
            },
          },
        });
      },
      300
    );
  }

  /**
   * Fast in-memory synthetic absence calculation across target dates.
   * Completely avoids redundant database roundtrips.
   */
  private getSyntheticAbsentRecords(
    targetEmployees: any[],
    targetDates: string[],
    status?: string,
    preloadedDbItems?: any[]
  ) {
    if (status && status !== "all" && status !== "absent") {
      return [];
    }

    if (targetDates.length === 0 || targetEmployees.length === 0) return [];

    const recordedByDate = new Map<string, Set<string>>();
    if (preloadedDbItems && preloadedDbItems.length > 0) {
      for (const rec of preloadedDbItems) {
        const dStr = this.formatRecDate(rec.clockInDate);
        const set = recordedByDate.get(dStr) || new Set<string>();
        set.add(rec.employeeId);
        recordedByDate.set(dStr, set);
      }
    }

    const syntheticList: any[] = [];
    for (const targetDateStr of targetDates) {
      const targetDateObj = new Date(`${targetDateStr}T00:00:00.000Z`);
      const recordedSet = recordedByDate.get(targetDateStr) || new Set<string>();

      for (const emp of targetEmployees) {
        if (recordedSet.has(emp.id)) continue;
        if (!this.isWorkDayForEmployee(emp.weeklySchedule, targetDateObj)) continue;

        syntheticList.push({
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
        });
      }
    }

    return syntheticList;
  }

  /**
   * Groups individual attendance punch records by Employee and Date
   * Ensures exactly one entry per employee per day, with:
   * - clockInTime = first clock-in
   * - clockOutTime = last clock-out (or null if currently active)
   * - workingHours = accumulated sum across all sessions
   * - sessions = all individual punch logs
   */
  public groupRecordsByEmployeeAndDate(records: any[]): any[] {
    const groupMap = new Map<string, any[]>();

    for (const rec of records) {
      const dateStr =
        rec.clockInDate instanceof Date
          ? rec.clockInDate.toISOString().slice(0, 10)
          : String(rec.clockInDate).slice(0, 10);
      const empId = rec.employeeId || rec.employee?.id;
      const key = `${empId}_${dateStr}`;
      const list = groupMap.get(key) || [];
      list.push(rec);
      groupMap.set(key, list);
    }

    const grouped: any[] = [];

    for (const [, sessionList] of groupMap.entries()) {
      // Sort sessions chronologically by clockInTime ascending
      sessionList.sort((a, b) => {
        const timeA = a.clockInTime ? new Date(a.clockInTime).getTime() : 0;
        const timeB = b.clockInTime ? new Date(b.clockInTime).getTime() : 0;
        return timeA - timeB;
      });

      const firstSession = sessionList[0];
      const lastSession = sessionList[sessionList.length - 1];

      let totalWorkingHours = 0;
      let anyLate = false;
      let allAutoClosed = sessionList.length > 0;

      for (const s of sessionList) {
        if (s.status === "LATE") anyLate = true;
        if (s.status !== "AUTO_CLOSED") allAutoClosed = false;

        if (s.workingHours !== null && s.workingHours !== undefined) {
          totalWorkingHours += Number(s.workingHours);
        } else if (s.clockInTime && s.clockOutTime) {
          const diffMs = new Date(s.clockOutTime).getTime() - new Date(s.clockInTime).getTime();
          if (diffMs > 0) {
            totalWorkingHours += diffMs / (1000 * 60 * 60);
          }
        }
      }

      const isSyntheticAbsent = !firstSession.clockInTime;
      const hasActiveSession = sessionList.some((s) => Boolean(s.clockInTime) && !s.clockOutTime);
      let status = firstSession.status;

      if (isSyntheticAbsent || firstSession.status === "ABSENT" || firstSession.status === AttendanceStatus.ABSENT) {
        status = AttendanceStatus.ABSENT;
      } else if (hasActiveSession) {
        status = anyLate ? AttendanceStatus.LATE : AttendanceStatus.PRESENT;
      } else if (totalWorkingHours < 1.0) {
        status = AttendanceStatus.ABSENT;
      } else if (firstSession.status === "HALF_DAY" || totalWorkingHours < 4.0) {
        status = AttendanceStatus.HALF_DAY;
      } else if (anyLate) {
        status = AttendanceStatus.LATE;
      } else if (allAutoClosed) {
        status = AttendanceStatus.AUTO_CLOSED;
      } else {
        status = AttendanceStatus.PRESENT;
      }

      const isAbsent = status === AttendanceStatus.ABSENT;

      grouped.push({
        id: firstSession.id,
        employeeId: firstSession.employeeId,
        employee: firstSession.employee,
        clockInDate: firstSession.clockInDate,
        clockInTime: isSyntheticAbsent ? null : firstSession.clockInTime,
        clockOutTime: isSyntheticAbsent ? null : lastSession.clockOutTime,
        status,
        workingHours: isSyntheticAbsent ? 0 : parseFloat(totalWorkingHours.toFixed(2)),
        notes: isSyntheticAbsent
          ? firstSession.notes || "No clock-in recorded · Absent"
          : totalWorkingHours < 1.0
            ? "Shift under 1 hr threshold · Absent"
            : totalWorkingHours < 4.0
              ? "Half-day shift completed"
              : sessionList.length > 1
                ? `${sessionList.length} shift sessions recorded today`
                : firstSession.notes || null,
        totalSessions: isSyntheticAbsent ? 0 : sessionList.length,
        sessions: isSyntheticAbsent ? [] : sessionList,
      });
    }

    // Sort descending by date, then TIME-WISE by clockInTime (most recent punch first)
    grouped.sort((a, b) => {
      const dateA = a.clockInDate ? new Date(a.clockInDate).getTime() : 0;
      const dateB = b.clockInDate ? new Date(b.clockInDate).getTime() : 0;
      if (dateB !== dateA) return dateB - dateA;

      // Active / punched-in employees COME FIRST before absent personnel
      const isAbsentA = a.status === AttendanceStatus.ABSENT;
      const isAbsentB = b.status === AttendanceStatus.ABSENT;
      if (!isAbsentA && isAbsentB) return -1;
      if (isAbsentA && !isAbsentB) return 1;

      // If both are absent, sort alphabetically by name
      if (isAbsentA && isAbsentB) {
        const nameA = a.employee?.workspaceMember?.user?.fullName || "";
        const nameB = b.employee?.workspaceMember?.user?.fullName || "";
        return nameA.localeCompare(nameB);
      }

      // Time-wise: most recent clock-in time first (descending)
      const timeA = a.clockInTime ? new Date(a.clockInTime).getTime() : 0;
      const timeB = b.clockInTime ? new Date(b.clockInTime).getTime() : 0;
      if (timeB !== timeA) return timeB - timeA;

      const nameA = a.employee?.workspaceMember?.user?.fullName || "";
      const nameB = b.employee?.workspaceMember?.user?.fullName || "";
      return nameA.localeCompare(nameB);
    });

    return grouped;
  }

  /**
   * Retrieves the full grouped attendance dataset and summary statistics for the given filters.
   * Cached in memory for 60 seconds so pagination page turns and report exports respond in <0.1ms.
   */
  async getAttendanceDataset(tenantId: string, query: {
    search?: string;
    status?: string;
    date?: string;
    startDate?: string;
    endDate?: string;
    workspaceId?: string;
  }) {
    const datasetKey = `admin:dataset:${tenantId}:${query.workspaceId || "all"}:${query.date || ""}:${query.startDate || ""}:${query.endDate || ""}:${query.status || ""}:${(query.search || "").trim().toLowerCase()}`;
    const cached = memoryCache.get<{ filtered: any[]; allSummaryRecords: any[] }>(datasetKey);
    if (cached) {
      return cached;
    }

    // 1. Fetch active employees (cached in memory for 5 minutes)
    const activeEmployees = await this.getCachedActiveEmployees(tenantId, query.workspaceId);
    if (activeEmployees.length === 0) {
      const emptyResult = { filtered: [], allSummaryRecords: [] };
      memoryCache.set(datasetKey, emptyResult, 60);
      return emptyResult;
    }

    // 2. Filter employees by search substring if provided
    let targetEmployees = activeEmployees;
    if (query.search && query.search.trim().length > 0) {
      const term = query.search.trim().toLowerCase();
      targetEmployees = activeEmployees.filter((emp) => {
        const code = (emp.employeeCode || "").toLowerCase();
        const name = (emp.workspaceMember?.user?.fullName || "").toLowerCase();
        const email = (emp.workspaceMember?.user?.email || "").toLowerCase();
        return code.includes(term) || name.includes(term) || email.includes(term);
      });
    }

    if (targetEmployees.length === 0) {
      const emptyResult = { filtered: [], allSummaryRecords: [] };
      memoryCache.set(datasetKey, emptyResult, 60);
      return emptyResult;
    }

    const activeEmpMap = new Map<string, any>(targetEmployees.map((e) => [e.id, e]));
    const targetEmpIds = Array.from(activeEmpMap.keys());

    // 3. Build optimized, directly-indexed query on attendance_records (no 4-table join in SQL!)
    const where: Prisma.AttendanceRecordWhereInput = {
      employeeId: { in: targetEmpIds },
    };

    if (query.status && query.status !== "all") {
      const enumStatus = query.status.toUpperCase() as AttendanceStatus;
      if (Object.values(AttendanceStatus).includes(enumStatus)) {
        where.status = enumStatus;
      }
    }

    if (query.date) {
      where.clockInDate = new Date(`${query.date}T00:00:00.000Z`);
    } else if (query.startDate || query.endDate) {
      where.clockInDate = {
        ...(query.startDate ? { gte: new Date(`${query.startDate}T00:00:00.000Z`) } : {}),
        ...(query.endDate ? { lte: new Date(`${query.endDate}T23:59:59.999Z`) } : {}),
      };
    }

    // Direct indexed query on attendance_records selecting only needed fields with index-aligned order
    const rawItems = await prisma.attendanceRecord.findMany({
      where,
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
      orderBy: [{ clockInDate: "desc" }, { clockInTime: "desc" }],
      take: 2000,
    });

    // In-memory mapping of employee relations (<0.1ms)
    const dbItems = rawItems.map((r) => ({
      ...r,
      employee: activeEmpMap.get(r.employeeId),
    }));

    // 4. Identify dates to synthesize
    let targetDates: string[] = [];
    if (query.date) {
      targetDates = [query.date];
    } else {
      const datesSet = new Set<string>();
      datesSet.add(this.formatRecDate(new Date()));
      for (const r of dbItems) {
        datesSet.add(this.formatRecDate(r.clockInDate));
      }
      targetDates = Array.from(datesSet);
    }

    // 5. In-memory synthetic absences (instant)
    const syntheticAbsents = this.getSyntheticAbsentRecords(
      targetEmployees,
      targetDates,
      query.status,
      dbItems
    );

    const allGrouped = this.groupRecordsByEmployeeAndDate([...dbItems, ...syntheticAbsents]);

    // Apply status filter on grouped records if requested
    let filtered = allGrouped;
    if (query.status && query.status !== "all") {
      const targetStatus = query.status.toUpperCase();
      filtered = allGrouped.filter((r) => r.status === targetStatus);
    }

    const allSummaryRecords = filtered.map((r) => ({
      status: r.status,
      workingHours: r.workingHours,
      clockInTime: r.clockInTime,
      clockOutTime: r.clockOutTime,
    }));

    const result = { filtered, allSummaryRecords };
    memoryCache.set(datasetKey, result, 60);
    return result;
  }

  /**
   * Retrieves paginated attendance records with employee, user, and workspace details
   */
  async findAttendanceRecords(tenantId: string, query: AdminAttendanceQueryInput) {
    const skip = (query.page - 1) * query.limit;
    const take = query.limit;

    const { filtered, allSummaryRecords } = await this.getAttendanceDataset(tenantId, query);

    const total = filtered.length;
    const paginatedItems = filtered.slice(skip, skip + take);

    return {
      items: paginatedItems,
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
    const { filtered } = await this.getAttendanceDataset(tenantId, query);
    return filtered;
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

    // 2. Query active employees (cached) and attendance records using direct composite index lookups
    const activeEmployees = await this.getCachedActiveEmployees(tenantId, workspaceId);
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
