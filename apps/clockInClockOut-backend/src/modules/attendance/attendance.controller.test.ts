import { describe, it, expect, vi, beforeEach } from "vitest";
import { AttendanceController } from "./attendance.controller.js";
import { AttendanceService } from "./attendance.service.js";
import type { Request, Response } from "express";

describe("AttendanceController Unit Tests", () => {
  let controller: AttendanceController;
  let mockService: Partial<AttendanceService>;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonSpy: any;
  let statusSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();

    jsonSpy = vi.fn();
    statusSpy = vi.fn().mockReturnValue({ json: jsonSpy });

    mockRes = {
      status: statusSpy,
      json: jsonSpy,
    };

    mockReq = {
      user: { userId: "usr_001" } as any,
      tenant: { tenantId: "ten_001" } as any,
      headers: { "x-workspace-id": "ws_001" },
      body: {},
      query: {},
    };

    mockService = {
      verifyLocation: vi.fn(),
      getChallenge: vi.fn(),
      checkIn: vi.fn(),
      checkOut: vi.fn(),
      getTodayShift: vi.fn(),
    };

    controller = new AttendanceController(mockService as AttendanceService);
  });

  it("verifyLocation returns 200 with result and message", async () => {
    const mockResult = {
      isWithinGeofence: true,
      workspaceId: "ws_001",
      workspaceName: "Headquarters",
      distanceMeters: 12.5,
      allowedRadiusMeters: 150,
      canProceedToFaceScan: true,
      message: "Location verified within perimeter.",
    };
    (mockService.verifyLocation as any).mockResolvedValue(mockResult);

    mockReq.body = { latitude: 37.7749, longitude: -122.4194 };

    await controller.verifyLocation(mockReq as Request, mockRes as Response);

    expect(statusSpy).toHaveBeenCalledWith(200);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: true,
      data: mockResult,
      message: mockResult.message,
    });
    expect(mockService.verifyLocation).toHaveBeenCalledWith(
      "usr_001",
      "ten_001",
      mockReq.body,
      "ws_001"
    );
  });

  it("checkIn returns 201 when clock-in punch succeeds", async () => {
    const mockCheckInResult = {
      id: "att_001",
      checkInTime: "09:00 AM",
      status: "PRESENT",
      message: "Clocked in successfully.",
    };
    (mockService.checkIn as any).mockResolvedValue(mockCheckInResult);

    mockReq.body = { latitude: 37.7749, longitude: -122.4194 };

    await controller.checkIn(mockReq as Request, mockRes as Response);

    expect(statusSpy).toHaveBeenCalledWith(201);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: true,
      data: mockCheckInResult,
      message: mockCheckInResult.message,
    });
  });

  it("checkOut returns 200 when clock-out punch succeeds", async () => {
    const mockCheckOutResult = {
      id: "att_001",
      checkOutTime: "05:00 PM",
      workingHours: 8.0,
      status: "PRESENT",
      message: "Clocked out successfully.",
    };
    (mockService.checkOut as any).mockResolvedValue(mockCheckOutResult);

    mockReq.body = { notes: "Done for today" };

    await controller.checkOut(mockReq as Request, mockRes as Response);

    expect(statusSpy).toHaveBeenCalledWith(200);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: true,
      data: mockCheckOutResult,
      message: mockCheckOutResult.message,
    });
  });

  it("today returns 200 with active shift payload", async () => {
    const mockTodayResult = {
      hasActiveSession: true,
      state: "checked_in",
      currentSession: {
        id: "att_001",
        checkInTime: "09:00 AM",
      },
    };
    (mockService.getTodayShift as any).mockResolvedValue(mockTodayResult);

    await controller.today(mockReq as Request, mockRes as Response);

    expect(statusSpy).toHaveBeenCalledWith(200);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: true,
      data: mockTodayResult,
    });
  });
});
