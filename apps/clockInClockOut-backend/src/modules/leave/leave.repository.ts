import { prisma, Prisma } from "@smartbusiness/database";
import type {
  CreateLeavePolicyInput,
  UpdateLeavePolicyInput,
  SubmitLeaveRequestInput,
  ReviewLeaveRequestInput,
  ListLeaveRequestsQueryInput,
} from "./leave.schema.js";

export class LeaveRepository {
  /**
   * Verify workspace exists, belongs to tenant, and is active.
   */
  async verifyWorkspaceTenant(workspaceId: string, tenantId: string): Promise<boolean> {
    const ws = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        tenantId,
        deletedAt: null,
      },
      select: { id: true },
    });
    return Boolean(ws);
  }

  /**
   * Resolve employee record for a given workspace and user ID.
   */
  async findEmployeeByUserId(workspaceId: string, userId: string) {
    const member = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId,
        deletedAt: null,
      },
      include: {
        employeeProfiles: {
          where: { deletedAt: null },
          take: 1,
        },
      },
    });

    return member?.employeeProfiles[0] || null;
  }

  async findEmployeeById(workspaceId: string, employeeId: string) {
    return prisma.attendanceEmployeeDetails.findFirst({
      where: {
        id: employeeId,
        deletedAt: null,
        workspaceMember: {
          workspaceId,
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
          },
        },
      },
    });
  }

  async assignOrAdjustBalance(
    employeeId: string,
    policyId: string,
    year: number,
    allocatedHours: number,
    carriedOverHours?: number
  ) {
    return prisma.employeeLeaveBalance.upsert({
      where: {
        employeeId_policyId_year: {
          employeeId,
          policyId,
          year,
        },
      },
      create: {
        employeeId,
        policyId,
        year,
        allocatedHours: new Prisma.Decimal(allocatedHours),
        accruedHours: new Prisma.Decimal(0),
        usedHours: new Prisma.Decimal(0),
        pendingHours: new Prisma.Decimal(0),
        carriedOverHours: new Prisma.Decimal(carriedOverHours ?? 0),
      },
      update: {
        allocatedHours: new Prisma.Decimal(allocatedHours),
        ...(carriedOverHours !== undefined
          ? { carriedOverHours: new Prisma.Decimal(carriedOverHours) }
          : {}),
      },
      include: {
        policy: true,
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
      },
    });
  }

  // ─── Policy Repository Methods ─────────────────────────────────────────────

  async findPolicyByCode(workspaceId: string, code: string, excludeId?: string) {
    return prisma.leavePolicy.findFirst({
      where: {
        workspaceId,
        code,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  async findPolicyById(id: string, workspaceId: string) {
    return prisma.leavePolicy.findFirst({
      where: {
        id,
        workspaceId,
        deletedAt: null,
      },
    });
  }

  async createPolicy(workspaceId: string, data: CreateLeavePolicyInput) {
    return prisma.leavePolicy.create({
      data: {
        workspaceId,
        name: data.name,
        code: data.code,
        description: data.description,
        category: data.category,
        accrualType: data.accrualType,
        rate: new Prisma.Decimal(data.rate ?? 0),
        hoursPerYear: new Prisma.Decimal(data.hoursPerYear ?? 40),
        maxCarryoverHours: new Prisma.Decimal(data.maxCarryoverHours ?? 0),
        accrualCapHours: data.accrualCapHours !== undefined && data.accrualCapHours !== null
          ? new Prisma.Decimal(data.accrualCapHours)
          : null,
        waitingPeriodDays: data.waitingPeriodDays ?? 0,
        minNoticeDays: data.minNoticeDays ?? 0,
        isPaid: data.isPaid ?? true,
        payoutOnTermination: data.payoutOnTermination ?? false,
        requiresApproval: data.requiresApproval ?? true,
        requiresDocDays: data.requiresDocDays ?? null,
        isActive: data.isActive ?? true,
      },
    });
  }

  async listPolicies(workspaceId: string, isActive?: boolean) {
    return prisma.leavePolicy.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        ...(isActive !== undefined ? { isActive } : {}),
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });
  }

  async updatePolicy(id: string, workspaceId: string, data: UpdateLeavePolicyInput) {
    const updateData: Prisma.LeavePolicyUpdateInput = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.code !== undefined) updateData.code = data.code;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.accrualType !== undefined) updateData.accrualType = data.accrualType;
    if (data.rate !== undefined) updateData.rate = new Prisma.Decimal(data.rate);
    if (data.hoursPerYear !== undefined) updateData.hoursPerYear = new Prisma.Decimal(data.hoursPerYear);
    if (data.maxCarryoverHours !== undefined) updateData.maxCarryoverHours = new Prisma.Decimal(data.maxCarryoverHours);
    if (data.accrualCapHours !== undefined) {
      updateData.accrualCapHours = data.accrualCapHours !== null ? new Prisma.Decimal(data.accrualCapHours) : null;
    }
    if (data.waitingPeriodDays !== undefined) updateData.waitingPeriodDays = data.waitingPeriodDays;
    if (data.minNoticeDays !== undefined) updateData.minNoticeDays = data.minNoticeDays;
    if (data.isPaid !== undefined) updateData.isPaid = data.isPaid;
    if (data.payoutOnTermination !== undefined) updateData.payoutOnTermination = data.payoutOnTermination;
    if (data.requiresApproval !== undefined) updateData.requiresApproval = data.requiresApproval;
    if (data.requiresDocDays !== undefined) updateData.requiresDocDays = data.requiresDocDays;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    return prisma.leavePolicy.update({
      where: { id },
      data: updateData,
    });
  }

  async softDeletePolicy(id: string, workspaceId: string) {
    return prisma.leavePolicy.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });
  }

  // ─── Employee Balance Ledger Methods ────────────────────────────────────────

  async getOrCreateBalance(employeeId: string, policyId: string, year: number, initialAllocation: number = 0) {
    return prisma.employeeLeaveBalance.upsert({
      where: {
        employeeId_policyId_year: {
          employeeId,
          policyId,
          year,
        },
      },
      create: {
        employeeId,
        policyId,
        year,
        allocatedHours: new Prisma.Decimal(initialAllocation),
      },
      update: {},
      include: {
        policy: true,
      },
    });
  }

  async listEmployeeBalances(employeeId: string, year: number) {
    return prisma.employeeLeaveBalance.findMany({
      where: {
        employeeId,
        year,
      },
      include: {
        policy: true,
      },
    });
  }

  // ─── Leave Request Lifecycle Methods ────────────────────────────────────────

  async createRequestWithBalanceHold(
    workspaceId: string,
    employeeId: string,
    policy: any,
    data: SubmitLeaveRequestInput,
    year: number
  ) {
    const hours = new Prisma.Decimal(data.totalHours);

    return prisma.$transaction(async (tx) => {
      // Ensure balance record exists
      const initialAlloc = policy.accrualType === "FRONTLOAD" ? Number(policy.hoursPerYear) : 0;
      const balance = await tx.employeeLeaveBalance.upsert({
        where: {
          employeeId_policyId_year: {
            employeeId,
            policyId: policy.id,
            year,
          },
        },
        create: {
          employeeId,
          policyId: policy.id,
          year,
          allocatedHours: new Prisma.Decimal(initialAlloc),
          pendingHours: hours,
        },
        update: {
          pendingHours: {
            increment: hours,
          },
        },
      });

      // Create the pending request record
      const request = await tx.leaveRequest.create({
        data: {
          workspaceId,
          employeeId,
          policyId: policy.id,
          startDate: new Date(data.startDate),
          endDate: new Date(data.endDate),
          totalHours: hours,
          isIntermittent: data.isIntermittent ?? false,
          reason: data.reason,
          attachmentUrl: data.attachmentUrl,
          status: "PENDING",
        },
        include: {
          policy: true,
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
        },
      });

      return { request, balance };
    });
  }

  async findRequestById(id: string, workspaceId: string) {
    return prisma.leaveRequest.findFirst({
      where: {
        id,
        workspaceId,
      },
      include: {
        policy: true,
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

  async listRequests(workspaceId: string, query: ListLeaveRequestsQueryInput) {
    const where: Prisma.LeaveRequestWhereInput = {
      workspaceId,
    };

    if (query.employeeId) {
      where.employeeId = query.employeeId;
    }

    if (query.policyId) {
      where.policyId = query.policyId;
    }

    if (query.status && query.status !== "ALL") {
      where.status = query.status as any;
    }

    if (query.startDate) {
      where.startDate = { gte: new Date(query.startDate) };
    }

    if (query.endDate) {
      where.endDate = { lte: new Date(query.endDate) };
    }

    return prisma.leaveRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        policy: true,
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

  async reviewRequest(
    request: any,
    review: ReviewLeaveRequestInput,
    reviewerId: string
  ) {
    const hours = request.totalHours;
    const year = new Date(request.startDate).getFullYear();

    return prisma.$transaction(async (tx) => {
      if (review.status === "APPROVED") {
        // Move from pending to used
        await tx.employeeLeaveBalance.update({
          where: {
            employeeId_policyId_year: {
              employeeId: request.employeeId,
              policyId: request.policyId,
              year,
            },
          },
          data: {
            pendingHours: { decrement: hours },
            usedHours: { increment: hours },
          },
        });
      } else {
        // If request was previously APPROVED, decrement usedHours; if was PENDING, decrement pendingHours
        await tx.employeeLeaveBalance.update({
          where: {
            employeeId_policyId_year: {
              employeeId: request.employeeId,
              policyId: request.policyId,
              year,
            },
          },
          data: {
            ...(request.status === "APPROVED"
              ? { usedHours: { decrement: hours } }
              : { pendingHours: { decrement: hours } }),
          },
        });
      }

      return tx.leaveRequest.update({
        where: { id: request.id },
        data: {
          status: review.status,
          reviewerId,
          reviewerNotes: review.reviewerNotes,
          reviewedAt: new Date(),
        },
        include: {
          policy: true,
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
        },
      });
    });
  }

  async cancelRequest(request: any) {
    const hours = request.totalHours;
    const year = new Date(request.startDate).getFullYear();

    return prisma.$transaction(async (tx) => {
      // If was pending, release pending reservation
      if (request.status === "PENDING") {
        await tx.employeeLeaveBalance.update({
          where: {
            employeeId_policyId_year: {
              employeeId: request.employeeId,
              policyId: request.policyId,
              year,
            },
          },
          data: {
            pendingHours: { decrement: hours },
          },
        });
      } else if (request.status === "APPROVED") {
        // If was approved, restore used hours
        await tx.employeeLeaveBalance.update({
          where: {
            employeeId_policyId_year: {
              employeeId: request.employeeId,
              policyId: request.policyId,
              year,
            },
          },
          data: {
            usedHours: { decrement: hours },
          },
        });
      }

      return tx.leaveRequest.update({
        where: { id: request.id },
        data: {
          status: "CANCELLED",
        },
      });
    });
  }

  // ─── Accrual Engine Repository Methods ─────────────────────────────────────

  /**
   * Find active hourly accrual policies for a workspace.
   */
  async findActiveHourlyPolicies(workspaceId: string) {
    return prisma.leavePolicy.findMany({
      where: {
        workspaceId,
        isActive: true,
        accrualType: "HOURLY_ACCRUAL",
        deletedAt: null,
      },
    });
  }

  /**
   * Find active per-pay-period accrual policies for a workspace.
   */
  async findActivePayPeriodPolicies(workspaceId: string) {
    return prisma.leavePolicy.findMany({
      where: {
        workspaceId,
        isActive: true,
        accrualType: "PER_PAY_PERIOD",
        deletedAt: null,
      },
    });
  }

  /**
   * Find all active employees belonging to a workspace.
   */
  async listActiveWorkspaceEmployees(workspaceId: string) {
    return prisma.attendanceEmployeeDetails.findMany({
      where: {
        deletedAt: null,
        workspaceMember: {
          workspaceId,
          deletedAt: null,
        },
      },
      select: {
        id: true,
        employeeCode: true,
        workspaceMember: {
          select: {
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

  /**
   * List all active workspaces.
   */
  async listActiveWorkspaces() {
    return prisma.workspace.findMany({
      where: {
        deletedAt: null,
      },
      select: {
        id: true,
        businessName: true,
      },
    });
  }

  /**
   * Allocate annual frontloaded hours for policies configured with FRONTLOAD.
   */
  async allocateNewYearFrontloads(workspaceId: string, toYear: number): Promise<void> {
    const frontloadPolicies = await prisma.leavePolicy.findMany({
      where: {
        workspaceId,
        isActive: true,
        deletedAt: null,
        accrualType: "FRONTLOAD",
        hoursPerYear: { gt: new Prisma.Decimal(0) },
      },
    });

    if (frontloadPolicies.length === 0) return;

    const employees = await this.listActiveWorkspaceEmployees(workspaceId);

    for (const policy of frontloadPolicies) {
      const annualAllocation = Number(policy.hoursPerYear);

      for (const emp of employees) {
        await prisma.employeeLeaveBalance.upsert({
          where: {
            employeeId_policyId_year: {
              employeeId: emp.id,
              policyId: policy.id,
              year: toYear,
            },
          },
          update: {
            allocatedHours: new Prisma.Decimal(annualAllocation),
          },
          create: {
            employeeId: emp.id,
            policyId: policy.id,
            year: toYear,
            allocatedHours: new Prisma.Decimal(annualAllocation),
            accruedHours: new Prisma.Decimal(0),
            usedHours: new Prisma.Decimal(0),
            pendingHours: new Prisma.Decimal(0),
            carriedOverHours: new Prisma.Decimal(0),
          },
        });
      }
    }
  }

  /**
   * Credit accrual hours into an employee's leave balance, adhering to statutory/policy caps.
   */
  async creditAccrualToBalance(
    employeeId: string,
    policyId: string,
    year: number,
    hoursToCredit: number,
    accrualCapHours?: number | null
  ) {
    return prisma.$transaction(async (tx) => {
      // 1. Get or create current balance record
      let balance = await tx.employeeLeaveBalance.findUnique({
        where: {
          employeeId_policyId_year: {
            employeeId,
            policyId,
            year,
          },
        },
      });

      if (!balance) {
        balance = await tx.employeeLeaveBalance.create({
          data: {
            employeeId,
            policyId,
            year,
            allocatedHours: new Prisma.Decimal(0),
            accruedHours: new Prisma.Decimal(0),
            usedHours: new Prisma.Decimal(0),
            pendingHours: new Prisma.Decimal(0),
            carriedOverHours: new Prisma.Decimal(0),
          },
        });
      }

      const currentAccrued = Number(balance.accruedHours);

      // 2. Check accrual cap
      let actualCredit = hoursToCredit;
      if (accrualCapHours !== undefined && accrualCapHours !== null && accrualCapHours > 0) {
        const remainingCapacity = Math.max(0, accrualCapHours - currentAccrued);
        actualCredit = Math.min(hoursToCredit, remainingCapacity);
      }

      if (actualCredit <= 0) {
        return {
          balance,
          creditedHours: 0,
          currentAccrued,
          capReached: accrualCapHours ? currentAccrued >= accrualCapHours : false,
        };
      }

      // Round to 2 decimal places to fit Decimal(6, 2)
      const roundedCredit = Math.round(actualCredit * 100) / 100;

      const updated = await tx.employeeLeaveBalance.update({
        where: { id: balance.id },
        data: {
          accruedHours: { increment: new Prisma.Decimal(roundedCredit) },
        },
      });

      const newTotal = Number(updated.accruedHours);

      return {
        balance: updated,
        creditedHours: roundedCredit,
        currentAccrued: newTotal,
        capReached: accrualCapHours ? newTotal >= accrualCapHours : false,
      };
    });
  }

  /**
   * List all employee leave balances in a workspace with optional filters.
   */
  async listWorkspaceBalances(workspaceId: string, year?: number, employeeId?: string, policyId?: string) {
    const targetYear = year || new Date().getFullYear();

    return prisma.employeeLeaveBalance.findMany({
      where: {
        year: targetYear,
        policy: {
          workspaceId,
          deletedAt: null,
          ...(policyId ? { id: policyId } : {}),
        },
        ...(employeeId ? { employeeId } : {}),
      },
      include: {
        policy: true,
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
      },
      orderBy: [
        { employeeId: "asc" },
        { policy: { name: "asc" } },
      ],
    });
  }

  /**
   * Run annual carryover / rollover for employees from fromYear into toYear.
   */
  async runYearEndRollover(workspaceId: string, fromYear: number, toYear: number) {
    const policies = await prisma.leavePolicy.findMany({
      where: {
        workspaceId,
        isActive: true,
        deletedAt: null,
        maxCarryoverHours: { gt: new Prisma.Decimal(0) },
      },
    });

    if (policies.length === 0) return { rolledOverCount: 0, totalHoursRolledOver: 0 };

    let rolledOverCount = 0;
    let totalHoursRolledOver = 0;

    for (const policy of policies) {
      const maxCarryover = Number(policy.maxCarryoverHours);

      const fromBalances = await prisma.employeeLeaveBalance.findMany({
        where: {
          policyId: policy.id,
          year: fromYear,
        },
      });

      for (const b of fromBalances) {
        const allocated = Number(b.allocatedHours);
        const accrued = Number(b.accruedHours);
        const carriedOver = Number(b.carriedOverHours);
        const used = Number(b.usedHours);
        const unused = Math.max(0, allocated + accrued + carriedOver - used);

        if (unused <= 0) continue;

        const hoursToRoll = Math.min(unused, maxCarryover);
        const roundedHours = Math.round(hoursToRoll * 100) / 100;

        if (roundedHours <= 0) continue;

        await prisma.employeeLeaveBalance.upsert({
          where: {
            employeeId_policyId_year: {
              employeeId: b.employeeId,
              policyId: policy.id,
              year: toYear,
            },
          },
          update: {
            carriedOverHours: new Prisma.Decimal(roundedHours),
          },
          create: {
            employeeId: b.employeeId,
            policyId: policy.id,
            year: toYear,
            allocatedHours: new Prisma.Decimal(0),
            accruedHours: new Prisma.Decimal(0),
            usedHours: new Prisma.Decimal(0),
            pendingHours: new Prisma.Decimal(0),
            carriedOverHours: new Prisma.Decimal(roundedHours),
          },
        });

        rolledOverCount++;
        totalHoursRolledOver += roundedHours;
      }
    }

    return { rolledOverCount, totalHoursRolledOver };
  }

  // ─── Team Calendar & Staffing Conflict Detection ───────────────────────────

  /**
   * List distinct departments configured in workspace.
   */
  async listDepartments(workspaceId: string) {
    const employees = await prisma.attendanceEmployeeDetails.findMany({
      where: {
        deletedAt: null,
        workspaceMember: {
          workspaceId,
          deletedAt: null,
        },
        department: { not: null },
      },
      select: { department: true },
      distinct: ["department"],
    });

    return employees
      .map((e) => e.department?.trim())
      .filter((d): d is string => Boolean(d && d.length > 0));
  }

  /**
   * Fetch leaves for visual team calendar within a date range.
   */
  async getTeamCalendarLeaves(
    workspaceId: string,
    startDate: Date,
    endDate: Date,
    department?: string,
    status?: string
  ) {
    const statusFilter =
      status === "APPROVED" || status === "PENDING"
        ? [status]
        : ["APPROVED", "PENDING"];

    return prisma.leaveRequest.findMany({
      where: {
        workspaceId,
        status: { in: statusFilter as any },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
        ...(department && department !== "ALL"
          ? {
              employee: {
                department: {
                  equals: department,
                  mode: "insensitive",
                },
              },
            }
          : {}),
      },
      include: {
        policy: true,
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
      },
      orderBy: { startDate: "asc" },
    });
  }

  /**
   * Check if approving or requesting leave creates a departmental staffing shortage.
   */
  async checkStaffingConflict(
    workspaceId: string,
    employeeId: string,
    startDate: Date,
    endDate: Date,
    excludeRequestId?: string
  ) {
    const emp = await prisma.attendanceEmployeeDetails.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        department: true,
        workspaceMember: {
          select: {
            user: { select: { fullName: true } },
          },
        },
      },
    });

    const dept = emp?.department || "General";

    // Count total active staff in department
    const totalStaffInDept = await prisma.attendanceEmployeeDetails.count({
      where: {
        deletedAt: null,
        workspaceMember: {
          workspaceId,
          deletedAt: null,
        },
        ...(emp?.department
          ? { department: { equals: emp.department, mode: "insensitive" } }
          : {}),
      },
    });

    // Find overlapping approved leaves in department
    const overlappingLeaves = await prisma.leaveRequest.findMany({
      where: {
        workspaceId,
        status: "APPROVED",
        employeeId: { not: employeeId },
        ...(excludeRequestId ? { id: { not: excludeRequestId } } : {}),
        ...(emp?.department
          ? {
              employee: {
                department: { equals: emp.department, mode: "insensitive" },
                deletedAt: null,
              },
            }
          : {}),
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      include: {
        employee: {
          include: {
            workspaceMember: {
              include: {
                user: { select: { fullName: true } },
              },
            },
          },
        },
        policy: true,
      },
    });

    const peerNames = Array.from(
      new Set(
        overlappingLeaves.map(
          (l) => l.employee.workspaceMember?.user?.fullName || "Colleague"
        )
      )
    );

    let maxAbsentOnAnyDay = 0;
    const conflictingDates: string[] = [];

    const cur = new Date(startDate);
    cur.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    while (cur <= end) {
      const dStr = cur.toISOString().split("T")[0];
      const absentsCount = overlappingLeaves.filter((l) => {
        const lStart = new Date(l.startDate);
        lStart.setHours(0, 0, 0, 0);
        const lEnd = new Date(l.endDate);
        lEnd.setHours(0, 0, 0, 0);
        return cur >= lStart && cur <= lEnd;
      }).length;

      if (absentsCount > 0) {
        conflictingDates.push(dStr);
      }
      if (absentsCount > maxAbsentOnAnyDay) {
        maxAbsentOnAnyDay = absentsCount;
      }

      cur.setDate(cur.getDate() + 1);
    }

    const totalSimultaneousAbsent = maxAbsentOnAnyDay + 1;
    const remainingStaff = Math.max(0, totalStaffInDept - totalSimultaneousAbsent);
    const coveragePercentage =
      totalStaffInDept > 0
        ? Math.round((remainingStaff / totalStaffInDept) * 100)
        : 100;

    let severity: "HIGH" | "MEDIUM" | "NONE" = "NONE";
    let hasConflict = false;
    let warningMessage: string | null = null;

    if (totalStaffInDept >= 2 && maxAbsentOnAnyDay >= 1) {
      if (coveragePercentage < 50 || remainingStaff <= 1) {
        severity = "HIGH";
        hasConflict = true;
        warningMessage = `Critical Staffing Alert: Approving this leave leaves only ${remainingStaff} of ${totalStaffInDept} (${coveragePercentage}% coverage) in ${dept}. Peers on leave: ${peerNames.join(", ")}.`;
      } else if (coveragePercentage <= 70) {
        severity = "MEDIUM";
        hasConflict = true;
        warningMessage = `Staffing Notice: ${peerNames.length} peer(s) in ${dept} (${peerNames.join(", ")}) already on leave during this period (${coveragePercentage}% department coverage remains).`;
      }
    }

    return {
      hasConflict,
      severity,
      department: dept,
      totalStaff: totalStaffInDept,
      peersOnLeaveCount: peerNames.length,
      peersOnLeaveNames: peerNames,
      conflictingDates,
      remainingStaffCount: remainingStaff,
      coveragePercentage,
      warningMessage,
    };
  }

  // ─── Statutory Termination Payout & Payroll Export ─────────────────────────

  /**
   * Calculate statutory termination payout for an employee.
   * California Labor Code § 227.3: All accrued, unused Vacation and PTO must be paid out
   * as wages at the employee's final rate of pay upon separation.
   * Sick leave is statutory and not required to be paid out unless company policy provides otherwise.
   */
  async calculateTerminationPayout(
    workspaceId: string,
    employeeId: string,
    hourlyRate: number,
    year?: number
  ) {
    const targetYear = year || new Date().getFullYear();

    const employee = await prisma.attendanceEmployeeDetails.findFirst({
      where: {
        id: employeeId,
        workspaceMember: {
          workspaceId,
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
          },
        },
      },
    });

    if (!employee) {
      return null;
    }

    const balances = await prisma.employeeLeaveBalance.findMany({
      where: {
        employeeId,
        year: targetYear,
        policy: {
          workspaceId,
          deletedAt: null,
        },
      },
      include: {
        policy: true,
      },
    });

    const allPolicies = await prisma.leavePolicy.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        isActive: true,
      },
    });

    const items = allPolicies.map((policy) => {
      const balance = balances.find((b) => b.policyId === policy.id);
      const carriedOver = Number(balance?.carriedOverHours || 0);
      const accrued = Number(balance?.accruedHours || 0);
      const used = Number(balance?.usedHours || 0);
      const pending = Number(balance?.pendingHours || 0);
      const availableHours = Math.max(0, carriedOver + accrued - used - pending);

      const requiresPayout =
        policy.payoutOnTermination === true ||
        policy.category === "VACATION" ||
        (policy.category === "PTO" && policy.payoutOnTermination !== false);

      const payoutHours = requiresPayout ? availableHours : 0;
      const payoutAmount = Math.round(payoutHours * hourlyRate * 100) / 100;
      const retainedHours = requiresPayout ? 0 : availableHours;

      let legalBasis = "";
      if (requiresPayout) {
        legalBasis =
          "Mandatory Payout (CA Labor Code § 227.3 / IL Wage Act): Earned Vacation/PTO cannot be forfeited upon separation.";
      } else {
        legalBasis =
          "Statutory / Non-vested (CA PSL / NY PSL / IL PLAAR): Sick leave and unpaid entitlements are exempt from separation payout.";
      }

      return {
        policyId: policy.id,
        policyName: policy.name,
        policyCode: policy.code,
        category: policy.category,
        isPaid: policy.isPaid,
        payoutOnTermination: policy.payoutOnTermination,
        carriedOverHours: carriedOver,
        accruedHours: accrued,
        usedHours: used,
        pendingHours: pending,
        availableHours: Math.round(availableHours * 100) / 100,
        payoutHours: Math.round(payoutHours * 100) / 100,
        payoutAmount,
        retainedHours: Math.round(retainedHours * 100) / 100,
        requiresPayout,
        legalBasis,
      };
    });

    const totalPayoutHours =
      Math.round(items.reduce((acc, i) => acc + i.payoutHours, 0) * 100) / 100;
    const totalPayoutAmount =
      Math.round(items.reduce((acc, i) => acc + i.payoutAmount, 0) * 100) / 100;
    const totalRetainedHours =
      Math.round(items.reduce((acc, i) => acc + i.retainedHours, 0) * 100) / 100;

    return {
      employee: {
        id: employee.id,
        employeeCode: employee.employeeCode,
        fullName: employee.workspaceMember?.user?.fullName || "Employee",
        email: employee.workspaceMember?.user?.email || "",
        department: employee.department || "General",
        designation: employee.designation || "Staff",
      },
      hourlyRate,
      targetYear,
      items,
      totalPayoutHours,
      totalPayoutAmount,
      totalRetainedHours,
      complianceNotice: [
        "California Labor Code § 227.3: All earned, unused vacation and PTO time must be paid as wages at the employee's final rate of pay.",
        "Timing: If terminated by employer, payout must be delivered immediately at the time of termination (CA Labor Code § 201). If employee resigns with 72+ hours notice, payout is due at final shift; with <72 hours notice, within 72 hours (CA Labor Code § 202).",
        "Illinois PLAAR / IL Wage Act: Accrued PTO/Vacation must be paid on the next regular payday.",
        "Paid Sick Leave (CA PSL / NY PSL): Statutory sick leave does not require payout upon termination unless unified in a generic PTO bank.",
      ],
    };
  }

  /**
   * Aggregate attendance and leave records for US payroll processing (Gusto / ADP / Paychex compatible).
   */
  async getPayrollExportData(
    workspaceId: string,
    startDate: Date,
    endDate: Date,
    department?: string
  ) {
    const employeeWhere: Prisma.AttendanceEmployeeDetailsWhereInput = {
      deletedAt: null,
      workspaceMember: {
        workspaceId,
        deletedAt: null,
      },
    };
    if (department && department !== "ALL") {
      employeeWhere.department = department;
    }

    const employees = await prisma.attendanceEmployeeDetails.findMany({
      where: employeeWhere,
      include: {
        workspaceMember: {
          include: {
            user: {
              select: {
                fullName: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { employeeCode: "asc" },
    });

    const employeeIds = employees.map((e) => e.id);

    const attendanceRecords = await prisma.attendanceRecord.findMany({
      where: {
        employeeId: { in: employeeIds },
        clockInDate: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const approvedLeaves = await prisma.leaveRequest.findMany({
      where: {
        employeeId: { in: employeeIds },
        workspaceId,
        status: "APPROVED",
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      include: {
        policy: true,
      },
    });

    const rows = employees.map((emp) => {
      const records = attendanceRecords.filter((r) => r.employeeId === emp.id);

      let regularHours = 0;
      let overtimeHours = 0;

      for (const rec of records) {
        const hrs = Number(rec.workingHours || 0);
        if (hrs > 8) {
          regularHours += 8;
          overtimeHours += hrs - 8;
        } else {
          regularHours += hrs;
        }
      }

      const leaves = approvedLeaves.filter((l) => l.employeeId === emp.id);

      let vacationHours = 0;
      let sickHours = 0;
      let ptoHours = 0;
      let otherPaidHours = 0;
      let unpaidHours = 0;

      for (const l of leaves) {
        const hrs = Number(l.totalHours || 0);
        if (!l.policy.isPaid) {
          unpaidHours += hrs;
        } else {
          switch (l.policy.category) {
            case "VACATION":
              vacationHours += hrs;
              break;
            case "SICK":
              sickHours += hrs;
              break;
            case "PTO":
              ptoHours += hrs;
              break;
            default:
              otherPaidHours += hrs;
              break;
          }
        }
      }

      const totalPaidLeaveHours =
        vacationHours + sickHours + ptoHours + otherPaidHours;
      const totalPaidHours =
        Math.round((regularHours + overtimeHours + totalPaidLeaveHours) * 100) / 100;

      return {
        employeeId: emp.id,
        employeeCode: emp.employeeCode,
        fullName: emp.workspaceMember?.user?.fullName || "Employee",
        email: emp.workspaceMember?.user?.email || "",
        department: emp.department || "General",
        regularHours: Math.round(regularHours * 100) / 100,
        overtimeHours: Math.round(overtimeHours * 100) / 100,
        vacationHours: Math.round(vacationHours * 100) / 100,
        sickHours: Math.round(sickHours * 100) / 100,
        ptoHours: Math.round(ptoHours * 100) / 100,
        otherPaidHours: Math.round(otherPaidHours * 100) / 100,
        totalPaidLeaveHours: Math.round(totalPaidLeaveHours * 100) / 100,
        unpaidHours: Math.round(unpaidHours * 100) / 100,
        totalPaidHours,
      };
    });

    const summary = {
      totalEmployees: rows.length,
      totalRegularHours:
        Math.round(rows.reduce((sum, r) => sum + r.regularHours, 0) * 100) / 100,
      totalOvertimeHours:
        Math.round(rows.reduce((sum, r) => sum + r.overtimeHours, 0) * 100) / 100,
      totalPaidLeaveHours:
        Math.round(rows.reduce((sum, r) => sum + r.totalPaidLeaveHours, 0) * 100) /
        100,
      totalPaidHours:
        Math.round(rows.reduce((sum, r) => sum + r.totalPaidHours, 0) * 100) / 100,
    };

    return {
      dateRange: {
        startDate: startDate.toISOString().split("T")[0],
        endDate: endDate.toISOString().split("T")[0],
      },
      department: department || "ALL",
      summary,
      rows,
    };
  }
}
