import { describe, it, expect, vi, beforeEach } from "vitest";
import { AttendanceService } from "./attendance.service.js";
import { AttendanceRepository } from "./attendance.repository.js";
import { autoClockOutService } from "./auto-clock-out.service.js";
import { faceRecognitionService } from "../../shared/services/faceRecognition.service.js";
import { storageService } from "../../shared/services/storage.service.js";
import { AttendanceStatus } from "@smartbusiness/database";

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

vi.mock("./auto-clock-out.service.js", () => ({
  autoClockOutService: {
    autoCloseStaleSession: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock("../../shared/services/faceRecognition.service.js", () => ({
  faceRecognitionService: {
    getChallenge: vi.fn(),
    verifyFace: vi.fn(),
    verifyFaceBurst: vi.fn(),
  },
}));

vi.mock("../../shared/services/storage.service.js", () => ({
  storageService: {
    getFileBuffer: vi.fn().mockResolvedValue(Buffer.from("fake-baseline-image")),
  },
}));

describe("Main Business Logic: Attendance & Shift Rules", () => {
  let mockRepo: Partial<AttendanceRepository>;
  let service: AttendanceService;

  const mockEmployee = {
    id: "emp_100",
    employeeCode: "EMP100",
    fullName: "Jane Doe",
    biometricPhotoUrl: "https://bucket.s3.amazonaws.com/baseline-jane.jpg",
    workspaceMember: {
      workspace: {
        id: "ws_austin",
        businessName: "Austin Campus",
        tenantId: "ten_001",
        attendanceSettings: {
          latitude: 30.2672,
          longitude: -97.7431,
          radiusMeters: 150,
          defaultShiftStartTime: "09:00",
          defaultShiftEndTime: "18:00",
          graceMinutes: 15, // limit is 09:15
        },
      },
      user: {
        id: "usr_100",
        name: "Jane Doe",
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
      createAttendanceRecord: vi.fn().mockImplementation(async (params) => ({
        id: "att_rec_" + Date.now(),
        ...params,
      })),
      updateClockOutRecord: vi.fn().mockImplementation(async (_id, params) => ({
        id: "att_rec_active",
        ...params,
      })),
      updateTodayRecordsStatus: vi.fn().mockResolvedValue({ count: 2 }),
      updateAttendanceRecordStatus: vi.fn().mockResolvedValue({ id: "att_rec_active" }),
    };
    service = new AttendanceService(mockRepo as AttendanceRepository);
  });

  describe("Late Arrival Determination", () => {
    it("marks status PRESENT when first clock-in is within shiftStartTime + graceMinutes", async () => {
      // Shift starts at 09:00 with 15m grace (cutoff 09:15). Clock-in at 09:10 AM
      const mockNow = new Date("2026-10-29T09:10:00");
      vi.useFakeTimers();
      vi.setSystemTime(mockNow);

      const result = await service.checkIn(
        "usr_100",
        "ten_001",
        { latitude: 30.2672, longitude: -97.7431, accuracy: undefined }
      );

      expect(result.status).toBe(AttendanceStatus.PRESENT);
      expect(mockRepo.createAttendanceRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          status: AttendanceStatus.PRESENT,
        })
      );
      vi.useRealTimers();
    });

    it("marks status LATE when first clock-in exceeds shiftStartTime + graceMinutes", async () => {
      // Clock-in at 09:20 AM (exceeds 09:15 cutoff)
      const mockNow = new Date("2026-10-29T09:20:00");
      vi.useFakeTimers();
      vi.setSystemTime(mockNow);

      const result = await service.checkIn(
        "usr_100",
        "ten_001",
        { latitude: 30.2672, longitude: -97.7431, accuracy: undefined }
      );

      expect(result.status).toBe(AttendanceStatus.LATE);
      expect(mockRepo.createAttendanceRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          status: AttendanceStatus.LATE,
        })
      );
      vi.useRealTimers();
    });

    it("defaults to PRESENT for subsequent punch sessions on the same calendar day", async () => {
      // Prior session completed today
      mockRepo.findTodaySessions = vi.fn().mockResolvedValue([
        {
          id: "att_rec_1",
          clockInTime: new Date("2026-10-29T09:00:00"),
          clockOutTime: new Date("2026-10-29T12:00:00"),
          workingHours: 3.0,
          status: AttendanceStatus.PRESENT,
        },
      ]);

      // Punching in afternoon at 01:00 PM for session #2
      const mockNow = new Date("2026-10-29T13:00:00");
      vi.useFakeTimers();
      vi.setSystemTime(mockNow);

      const result = await service.checkIn(
        "usr_100",
        "ten_001",
        { latitude: 30.2672, longitude: -97.7431, accuracy: undefined }
      );

      expect(result.status).toBe(AttendanceStatus.PRESENT);
      expect(result.sessionNumber).toBe(2);
      vi.useRealTimers();
    });
  });

  describe("Shift Clock-Out & Cumulative Hours Reconciliation", () => {
    it("marks status ABSENT if cumulative hours worked today are strictly under 1.0 hour", async () => {
      const clockIn = new Date("2026-10-29T09:00:00Z");
      const clockOut = new Date("2026-10-29T09:40:00Z"); // 40 minutes = 0.67 hrs

      mockRepo.findActiveSession = vi.fn().mockResolvedValue({
        id: "att_rec_01",
        employeeId: "emp_100",
        clockInTime: clockIn,
        clockOutTime: null,
        status: AttendanceStatus.PRESENT,
      });
      mockRepo.findTodaySessions = vi.fn().mockResolvedValue([]);

      vi.useFakeTimers();
      vi.setSystemTime(clockOut);

      const result = await service.checkOut("usr_100", "ten_001", {});

      expect(result.workingHours).toBeLessThan(1.0);
      expect(mockRepo.updateClockOutRecord).toHaveBeenCalledWith(
        "att_rec_01",
        expect.objectContaining({
          status: AttendanceStatus.ABSENT,
        })
      );
      vi.useRealTimers();
    });

    it("marks status HALF_DAY if cumulative hours are between 1.0h and 4.0h", async () => {
      const clockIn = new Date("2026-10-29T09:00:00Z");
      const clockOut = new Date("2026-10-29T11:30:00Z"); // 2.5 hours

      mockRepo.findActiveSession = vi.fn().mockResolvedValue({
        id: "att_rec_01",
        employeeId: "emp_100",
        clockInTime: clockIn,
        clockOutTime: null,
        status: AttendanceStatus.PRESENT,
      });

      vi.useFakeTimers();
      vi.setSystemTime(clockOut);

      const result = await service.checkOut("usr_100", "ten_001", {});

      expect(result.workingHours).toBe(2.5);
      expect(mockRepo.updateClockOutRecord).toHaveBeenCalledWith(
        "att_rec_01",
        expect.objectContaining({
          status: AttendanceStatus.HALF_DAY,
        })
      );
      vi.useRealTimers();
    });

    it("reconciles split shifts: adds prior completed hours so total reaches full-day PRESENT status", async () => {
      // Prior session #1: 3 hours worked on-time (9:00 AM to 12:00 PM local)
      mockRepo.findTodaySessions = vi.fn().mockResolvedValue([
        {
          id: "session_1",
          clockInTime: new Date(2026, 9, 29, 9, 0, 0),
          clockOutTime: new Date(2026, 9, 29, 12, 0, 0),
          workingHours: 3.0,
          status: AttendanceStatus.HALF_DAY,
        },
      ]);

      // Active session #2: clocked in at 13:00 local, clocking out at 18:00 local (5 hours)
      const clockIn = new Date(2026, 9, 29, 13, 0, 0);
      const clockOut = new Date(2026, 9, 29, 18, 0, 0);

      mockRepo.findActiveSession = vi.fn().mockResolvedValue({
        id: "session_2",
        employeeId: "emp_100",
        clockInTime: clockIn,
        clockOutTime: null,
        status: AttendanceStatus.PRESENT,
      });

      vi.useFakeTimers();
      vi.setSystemTime(clockOut);

      const result = await service.checkOut("usr_100", "ten_001", {});

      // Total cumulative working hours today: 3.0 (prior) + 5.0 (current) = 8.0 hrs -> PRESENT
      expect(result.workingHours).toBe(8.0);
      expect(mockRepo.updateTodayRecordsStatus).toHaveBeenCalledWith(
        "emp_100",
        expect.any(Date),
        AttendanceStatus.PRESENT
      );
      vi.useRealTimers();
    });
  });

  describe("Self-Healing Stale Sessions", () => {
    it("auto-closes open shift from previous day and allows immediate clock-in", async () => {
      // Session opened yesterday (24+ hours ago)
      const yesterday = new Date(Date.now() - 25 * 3600 * 1000);
      mockRepo.findActiveSession = vi.fn().mockResolvedValue({
        id: "stale_session_yesterday",
        employeeId: "emp_100",
        clockInTime: yesterday,
        clockOutTime: null,
      });

      const result = await service.checkIn(
        "usr_100",
        "ten_001",
        { latitude: 30.2672, longitude: -97.7431, accuracy: undefined }
      );

      // Verify self-healing auto-closure was invoked
      expect(autoClockOutService.autoCloseStaleSession).toHaveBeenCalled();
      // Clock in succeeds instead of throwing 409
      expect(result).toBeDefined();
      expect(mockRepo.createAttendanceRecord).toHaveBeenCalled();
    });
  });

  describe("Biometric Face Recognition & Anti-Spoofing Rules", () => {
    it("rejects clock-in with 400 ERR_FACE_MISMATCH when face does not match baseline", async () => {
      (faceRecognitionService.verifyFace as any).mockResolvedValueOnce({
        matched: false,
        message: "Captured face does not match employee profile",
      });

      const fakeFile = {
        buffer: Buffer.from("captured-face-bytes"),
        originalname: "selfie.jpg",
      } as Express.Multer.File;

      await expect(
        service.checkIn(
          "usr_100",
          "ten_001",
          { latitude: 30.2672, longitude: -97.7431, accuracy: undefined },
          fakeFile
        )
      ).rejects.toMatchObject({
        statusCode: 400,
        code: "ERR_FACE_MISMATCH",
      });
    });

    it("rejects clock-in with 400 ERR_LIVENESS_FAILED when photo spoofing is detected", async () => {
      (faceRecognitionService.verifyFace as any).mockResolvedValueOnce({
        matched: true,
        livenessPassed: false,
        status: "spoof_suspected",
        message: "Spoofing or invalid motion detected",
      });

      const fakeFile = {
        buffer: Buffer.from("captured-screen-replay"),
        originalname: "selfie.jpg",
      } as Express.Multer.File;

      await expect(
        service.checkIn(
          "usr_100",
          "ten_001",
          { latitude: 30.2672, longitude: -97.7431, accuracy: undefined },
          fakeFile
        )
      ).rejects.toMatchObject({
        statusCode: 400,
        code: "ERR_LIVENESS_FAILED",
      });
    });
  });
});
