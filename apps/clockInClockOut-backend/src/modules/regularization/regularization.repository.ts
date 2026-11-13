import { prisma } from "@smartbusiness/database";
import type { Prisma, RegularizationStatus, RegularizationReason } from "@smartbusiness/database";
import type { ListRegularizationsQueryInput } from "./regularization.schema.js";

export class RegularizationRepository {
  async verifyWorkspaceTenant(workspaceId: string, tenantId: string): Promise<boolean> {
    const ws = await prisma.workspace.findFirst({
      where: { id: workspaceId, tenantId, deletedAt: null },
      select: { id: true },
    });
    return !!ws;
  }

  async findEmployeeByUserId(workspaceId: string, userId: string) {
    return prisma.attendanceEmployeeDetails.findFirst({
      where: {
        workspaceMember: {
          workspaceId,
          userId,
          deletedAt: null,
        },
        isActive: true,
        deletedAt: null,
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
          },
        },
      },
    });
  }

  async findEmployeeById(employeeId: string, workspaceId: string) {
    return prisma.attendanceEmployeeDetails.findFirst({
      where: {
        id: employeeId,
        workspaceMember: {
          workspaceId,
          deletedAt: null,
        },
        isActive: true,
        deletedAt: null,
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
          },
        },
      },
    });
  }

  async getAttendanceSettings(workspaceId: string) {
    return prisma.attendanceSettings.findUnique({
      where: { workspaceId },
    });
  }

  async findApprovedLeaveOnDate(employeeId: string, date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);

    return prisma.leaveRequest.findFirst({
      where: {
        employeeId,
        status: "APPROVED",
        startDate: { lte: startOfDay },
        endDate: { gte: startOfDay },
      },
      include: {
        policy: {
          select: { name: true, category: true, code: true },
        },
      },
    });
  }

  async findPendingRequestOnDate(employeeId: string, date: Date) {
    return prisma.attendanceRegularization.findFirst({
      where: {
        employeeId,
        date,
        status: "PENDING",
      },
    });
  }

  async countMonthlyRequests(employeeId: string, year: number, month: number): Promise<number> {
    const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
    const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    return prisma.attendanceRegularization.count({
      where: {
        employeeId,
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
        status: { in: ["PENDING", "APPROVED"] },
      },
    });
  }

  async findAttendanceRecordOnDate(employeeId: string, date: Date) {
    return prisma.attendanceRecord.findFirst({
      where: {
        employeeId,
        clockInDate: date,
      },
    });
  }

  async createRegularization(data: {
    workspaceId: string;
    employeeId: string;
    attendanceRecordId?: string | null;
    date: Date;
    reasonCategory: RegularizationReason;
    reasonText: string;
    requestedClockInTime?: Date | null;
    requestedClockOutTime?: Date | null;
  }) {
    return prisma.attendanceRegularization.create({
      data: {
        workspaceId: data.workspaceId,
        employeeId: data.employeeId,
        attendanceRecordId: data.attendanceRecordId ?? null,
        date: data.date,
        reasonCategory: data.reasonCategory,
        reasonText: data.reasonText,
        requestedClockInTime: data.requestedClockInTime ?? null,
        requestedClockOutTime: data.requestedClockOutTime ?? null,
        status: "PENDING",
      },
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
              },
            },
          },
        },
        attendanceRecord: true,
      },
    });
  }

  async findById(id: string, workspaceId: string) {
    return prisma.attendanceRegularization.findFirst({
      where: { id, workspaceId },
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
              },
            },
          },
        },
        attendanceRecord: true,
        reviewer: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });
  }

  async listRegularizations(
    workspaceId: string,
    filters: ListRegularizationsQueryInput & { employeeIdFilter?: string }
  ) {
    const where: Prisma.AttendanceRegularizationWhereInput = {
      workspaceId,
    };

    if (filters.employeeIdFilter) {
      where.employeeId = filters.employeeIdFilter;
    } else if (filters.employeeId) {
      where.employeeId = filters.employeeId;
    }

    if (filters.status && filters.status !== "ALL") {
      where.status = filters.status as RegularizationStatus;
    }

    if (filters.startDate || filters.endDate) {
      where.date = {};
      if (filters.startDate) {
        where.date.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.date.lte = new Date(filters.endDate);
      }
    }

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      prisma.attendanceRegularization.count({ where }),
      prisma.attendanceRegularization.findMany({
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
                },
              },
            },
          },
          attendanceRecord: true,
          reviewer: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
        orderBy: [{ createdAt: "desc" }],
        skip,
        take: limit,
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      items,
    };
  }

  async executeApprovalTransaction(params: {
    requestId: string;
    workspaceId: string;
    reviewerId: string;
    reviewerNotes?: string;
    employeeId: string;
    date: Date;
    requestedClockInTime?: Date | null;
    requestedClockOutTime?: Date | null;
    settings?: {
      latitude: Prisma.Decimal | number;
      longitude: Prisma.Decimal | number;
      defaultShiftStartTime: string;
      defaultShiftEndTime: string;
    } | null;
  }) {
    return prisma.$transaction(async (tx) => {
      // 1. Fetch or check attendance record
      let existingRecord = await tx.attendanceRecord.findFirst({
        where: {
          employeeId: params.employeeId,
          clockInDate: params.date,
        },
      });

      let updatedAttendanceRecordId: string;

      // Determine final in & out times
      const clockInTime =
        params.requestedClockInTime ||
        existingRecord?.clockInTime ||
        new Date(
          `${params.date.toISOString().split("T")[0]}T${params.settings?.defaultShiftStartTime || "09:00"}:00Z`
        );

      const clockOutTime =
        params.requestedClockOutTime ||
        existingRecord?.clockOutTime ||
        new Date(
          `${params.date.toISOString().split("T")[0]}T${params.settings?.defaultShiftEndTime || "18:00"}:00Z`
        );

      // Compute working hours
      const diffMs = clockOutTime.getTime() - clockInTime.getTime();
      const workingHours = diffMs > 0 ? parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2)) : 0;
      const status = workingHours >= 4 ? (workingHours >= 8 ? "PRESENT" : "HALF_DAY") : "PRESENT";

      const lat = params.settings?.latitude ?? 0;
      const lng = params.settings?.longitude ?? 0;

      if (existingRecord) {
        const updated = await tx.attendanceRecord.update({
          where: { id: existingRecord.id },
          data: {
            clockInTime,
            clockOutDate: params.date,
            clockOutTime,
            workingHours,
            status,
            isRegularized: true,
            notes: existingRecord.notes
              ? `${existingRecord.notes} | Regularized via request #${params.requestId.slice(0, 8)}`
              : `Regularized via request #${params.requestId.slice(0, 8)}`,
          },
        });
        updatedAttendanceRecordId = updated.id;
      } else {
        const created = await tx.attendanceRecord.create({
          data: {
            employeeId: params.employeeId,
            clockInDate: params.date,
            clockInTime,
            clockInLatitude: lat,
            clockInLongitude: lng,
            clockInFaceMatchConfidence: 100.0,
            clockOutDate: params.date,
            clockOutTime,
            clockOutLatitude: lat,
            clockOutLongitude: lng,
            clockOutFaceMatchConfidence: 100.0,
            workingHours,
            status,
            isRegularized: true,
            notes: `Regularized via request #${params.requestId.slice(0, 8)}`,
          },
        });
        updatedAttendanceRecordId = created.id;
      }

      // 2. Update Regularization request to APPROVED
      const approvedRequest = await tx.attendanceRegularization.update({
        where: { id: params.requestId },
        data: {
          status: "APPROVED",
          reviewerId: params.reviewerId,
          reviewerNotes: params.reviewerNotes || null,
          reviewedAt: new Date(),
          attendanceRecordId: updatedAttendanceRecordId,
        },
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
                },
              },
            },
          },
          attendanceRecord: true,
          reviewer: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      });

      return approvedRequest;
    });
  }

  async rejectRequest(requestId: string, reviewerId: string, reviewerNotes?: string) {
    return prisma.attendanceRegularization.update({
      where: { id: requestId },
      data: {
        status: "REJECTED",
        reviewerId,
        reviewerNotes: reviewerNotes || null,
        reviewedAt: new Date(),
      },
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
              },
            },
          },
        },
        attendanceRecord: true,
        reviewer: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });
  }

  async cancelRequest(requestId: string) {
    return prisma.attendanceRegularization.update({
      where: { id: requestId },
      data: {
        status: "CANCELLED",
      },
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
              },
            },
          },
        },
        attendanceRecord: true,
      },
    });
  }
}
