import { describe, it, expect, vi, beforeEach } from "vitest";
import { BreakService } from "./break.service.js";
import { BreakRepository } from "./break.repository.js";
import { AppError } from "../../shared/errors/index.js";

describe("BreakService Unit Tests", () => {
  let mockRepo: Partial<BreakRepository>;
  let service: BreakService;

  const mockEmployeeId = "emp_123";
  const mockShift = {
    id: "att_001",
    employeeId: mockEmployeeId,
    clockInTime: new Date("2026-11-13T09:00:00.000Z"),
    clockOutTime: null,
    totalBreakMinutes: 0,
    unpaidBreakMinutes: 0,
    paidBreakMinutes: 0,
    mealPenaltyHours: 0,
    restPenaltyHours: 0,
    mealWaiverSigned: false,
    employee: {
      workspaceMemberId: "wm_001",
      workspaceMember: {
        workspaceId: "ws_001",
      },
    },
    breaks: [],
  };

  const mockSettings = {
    workspaceId: "ws_001",
    compliancePolicy: "CALIFORNIA_STRICT" as const,
    enableBreakTracking: true,
    mealBreakThresholdHours: 5.0 as any,
    minMealBreakMinutes: 30,
    maxMealStartShiftHour: 5.0 as any,
    secondMealThresholdHours: 10.0 as any,
    restBreakMinutes: 10,
    enforceBreakWaivers: true,
    autoAssessPenalties: true,
    latitude: 37.7749 as any,
    longitude: -122.4194 as any,
    radiusMeters: 100,
    graceMinutes: 15,
    defaultShiftStartTime: "09:00",
    defaultShiftEndTime: "18:00",
    enableRegularization: true,
    maxRegularizationPastDays: 30,
    monthlyRegularizationLimit: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockRepo = {
      findActiveShift: vi.fn().mockResolvedValue(mockShift),
      findActiveBreak: vi.fn().mockResolvedValue(null),
      getWorkspaceSettings: vi.fn().mockResolvedValue(mockSettings),
      createBreak: vi.fn().mockImplementation((data) =>
        Promise.resolve({
          id: "brk_001",
          attendanceRecordId: data.attendanceRecordId,
          breakType: data.breakType,
          isPaid: data.isPaid,
          startTime: data.startTime,
          endTime: null,
          durationMinutes: null,
          isCompliant: true,
          violationType: "NONE",
          notes: data.notes,
        })
      ),
      closeBreak: vi.fn().mockImplementation((id, data) =>
        Promise.resolve({
          id,
          attendanceRecordId: "att_001",
          breakType: "MEAL",
          isPaid: false,
          startTime: new Date("2026-11-13T12:00:00.000Z"),
          endTime: data.endTime,
          durationMinutes: data.durationMinutes,
          isCompliant: data.isCompliant,
          violationType: data.violationType,
          notes: data.notes,
        })
      ),
      getBreaksForRecord: vi.fn().mockResolvedValue([]),
      updateShiftBreakAggregates: vi.fn().mockResolvedValue(mockShift as any),
      recordMealWaiver: vi.fn().mockImplementation((id, reason) =>
        Promise.resolve({ ...mockShift, id, mealWaiverSigned: true, mealWaiverReason: reason })
      ),
    };

    service = new BreakService(mockRepo as BreakRepository);
  });

  it("successfully starts an unpaid meal break", async () => {
    const result = await service.startBreak(mockEmployeeId, {
      breakType: "MEAL",
      notes: "Lunch break",
    });

    expect(result.status).toBe("ON_BREAK");
    expect(result.breakType).toBe("MEAL");
    expect(result.isPaid).toBe(false);
    expect(mockRepo.createBreak).toHaveBeenCalledWith(
      expect.objectContaining({
        attendanceRecordId: "att_001",
        breakType: "MEAL",
        isPaid: false,
      })
    );
  });

  it("successfully starts a paid rest break", async () => {
    const result = await service.startBreak(mockEmployeeId, {
      breakType: "REST",
    });

    expect(result.status).toBe("ON_BREAK");
    expect(result.breakType).toBe("REST");
    expect(result.isPaid).toBe(true);
    expect(mockRepo.createBreak).toHaveBeenCalledWith(
      expect.objectContaining({
        attendanceRecordId: "att_001",
        breakType: "REST",
        isPaid: true,
      })
    );
  });

  it("throws 400 NO_ACTIVE_SHIFT when employee is not clocked in", async () => {
    mockRepo.findActiveShift = vi.fn().mockResolvedValue(null);

    await expect(
      service.startBreak(mockEmployeeId, { breakType: "MEAL" })
    ).rejects.toThrowError(AppError);
  });

  it("throws 409 BREAK_ALREADY_ACTIVE when employee is already on break", async () => {
    mockRepo.findActiveBreak = vi.fn().mockResolvedValue({
      id: "brk_existing",
      breakType: "MEAL",
      startTime: new Date(),
    } as any);

    await expect(
      service.startBreak(mockEmployeeId, { breakType: "MEAL" })
    ).rejects.toThrowError(AppError);
  });

  it("ends active break, computes duration and updates shift aggregates", async () => {
    mockRepo.findActiveBreak = vi.fn().mockResolvedValue({
      id: "brk_active",
      breakType: "MEAL",
      isPaid: false,
      startTime: new Date(Date.now() - 35 * 60 * 1000), // 35 minutes ago
    } as any);

    const result = await service.endBreak(mockEmployeeId, {});

    expect(result.status).toBe("CLOCKED_IN");
    expect(mockRepo.closeBreak).toHaveBeenCalled();
    expect(mockRepo.updateShiftBreakAggregates).toHaveBeenCalled();
  });

  it("records valid meal waiver for shifts <= 6.0 hours", async () => {
    const result = await service.waiveMeal(mockEmployeeId, {
      reason: "Shift under 6 hours mutual agreement",
      attestationConfirmed: true,
    });

    expect(result.mealWaiverSigned).toBe(true);
    expect(mockRepo.recordMealWaiver).toHaveBeenCalledWith(
      "att_001",
      "Shift under 6 hours mutual agreement"
    );
  });

  it("returns live break status and compliance countdown for active shift", async () => {
    const status = await service.getBreakStatus(mockEmployeeId);

    expect(status.isClockedIn).toBe(true);
    expect(status.isOnBreak).toBe(false);
    expect(status.compliance).toBeDefined();
    expect(status.compliance?.policy).toBe("CALIFORNIA_STRICT");
    expect(status.shiftSummary).toBeDefined();
  });
});
