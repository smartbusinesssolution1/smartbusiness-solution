import { describe, it, expect, vi, beforeEach } from "vitest";
import { AttendanceService } from "./attendance.service.js";
import { AttendanceRepository } from "./attendance.repository.js";
import { AttendanceStatus } from "@smartbusiness/database";

// Mock dependencies
vi.mock("../../shared/services/redis.service.js", () => ({
  redisClient: {
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
  },
}));

vi.mock("../../shared/services/cache.service.js", () => ({
  memoryCache: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(true),
    delPattern: vi.fn().mockResolvedValue(true),
    invalidatePattern: vi.fn().mockReturnValue(true),
  },
}));

vi.mock("../../shared/services/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("AttendanceService Unit Tests", () => {
  let mockRepo: Partial<AttendanceRepository>;
  let service: AttendanceService;

  const mockEmployee = {
    id: "emp_001",
    employeeCode: "EMP001",
    fullName: "John Doe",
    workspaceMember: {
      workspace: {
        id: "ws_hq",
        businessName: "Acme HQ",
        attendanceSettings: {
          latitude: 37.774929,
          longitude: -122.419416,
          radiusMeters: 150,
          defaultShiftStartTime: "09:00",
          defaultShiftEndTime: "18:00",
          graceMinutes: 15,
        },
      },
      user: {
        id: "usr_001",
        name: "John Doe",
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo = {
      findEmployeeByUserId: vi.fn().mockResolvedValue(mockEmployee),
      findWorkspaceWithGeofence: vi.fn().mockResolvedValue(mockEmployee.workspaceMember.workspace),
      findActiveSession: vi.fn().mockResolvedValue(null),
      findTodaySessions: vi.fn().mockResolvedValue([]),
      updateClockOutRecord: vi.fn().mockResolvedValue({
        id: "att_001",
        status: AttendanceStatus.PRESENT,
        clockInTime: new Date("2026-10-29T09:00:00Z"),
        clockOutTime: new Date("2026-10-29T17:00:00Z"),
        workingHours: 8,
      }),
      updateTodayRecordsStatus: vi.fn().mockResolvedValue({ count: 1 }),
    };
    service = new AttendanceService(mockRepo as AttendanceRepository);
  });

  describe("verifyLocation", () => {
    it("approves verification when employee is within geofence perimeter", async () => {
      const result = await service.verifyLocation("usr_001", "ten_001", {
        latitude: 37.774929,
        longitude: -122.419416,
      });

      expect(result.isWithinGeofence).toBe(true);
      expect(result.canProceedToFaceScan).toBe(true);
      expect(result.distanceMeters).toBe(0);
      expect(result.allowedRadiusMeters).toBe(150);
      expect(result.workspaceName).toBe("Acme HQ");
    });

    it("rejects verification when employee is outside geofence perimeter", async () => {
      // Coordinate far outside 150m boundary
      const result = await service.verifyLocation("usr_001", "ten_001", {
        latitude: 37.804929,
        longitude: -122.419416,
      });

      expect(result.isWithinGeofence).toBe(false);
      expect(result.canProceedToFaceScan).toBe(false);
      expect(result.distanceMeters).toBeGreaterThan(150);
      expect(result.message).toContain("outside the authorized geofence boundary");
    });
  });

  describe("checkOut", () => {
    it("throws 400 ERR_NOT_CLOCKED_IN when no active session exists", async () => {
      mockRepo.findActiveSession = vi.fn().mockResolvedValue(null);

      await expect(
        service.checkOut("usr_001", "ten_001", {})
      ).rejects.toMatchObject({
        statusCode: 400,
        code: "ERR_NOT_CLOCKED_IN",
      });
    });

    it("successfully checks out active session and calculates working hours", async () => {
      const activeClockIn = new Date(Date.now() - 4 * 60 * 60 * 1000); // 4 hours ago
      mockRepo.findActiveSession = vi.fn().mockResolvedValue({
        id: "att_001",
        employeeId: "emp_001",
        clockInTime: activeClockIn,
        clockOutTime: null,
        status: AttendanceStatus.PRESENT,
      });

      const result = await service.checkOut("usr_001", "ten_001", {
        latitude: 37.774929,
        longitude: -122.419416,
      });

      expect(result).toBeDefined();
      expect(result.id).toBe("att_001");
      expect(mockRepo.updateClockOutRecord).toHaveBeenCalled();
    });
  });

  describe("checkIn validation guard", () => {
    it("rejects checkIn with 409 ERR_ALREADY_CLOCKED_IN if session is active today", async () => {
      const activeClockIn = new Date(); // right now today
      mockRepo.findActiveSession = vi.fn().mockResolvedValue({
        id: "att_001",
        employeeId: "emp_001",
        clockInTime: activeClockIn,
        clockOutTime: null,
        status: AttendanceStatus.PRESENT,
      });

      await expect(
        service.checkIn("usr_001", "ten_001", {
          latitude: 37.774929,
          longitude: -122.419416,
          accuracy: undefined,
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "ERR_ALREADY_CLOCKED_IN",
      });
    });
  });
});
