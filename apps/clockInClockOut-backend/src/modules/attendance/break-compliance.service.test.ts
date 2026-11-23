import { describe, it, expect } from "vitest";
import { BreakComplianceService } from "./break-compliance.service.js";

describe("BreakComplianceService - Statutory Labor Compliance Engine", () => {
  const baseTime = new Date("2026-11-13T09:00:00.000Z");

  it("calculates gross hours correctly", () => {
    const clockIn = new Date("2026-11-13T09:00:00.000Z");
    const clockOut = new Date("2026-11-13T17:30:00.000Z"); // 8.5 hours
    const gross = BreakComplianceService.calculateGrossHours(clockIn, clockOut);
    expect(gross).toBe(8.5);
  });

  it("calculates net working hours deducting unpaid meal breaks but preserving paid rest breaks", () => {
    const gross = 8.5;
    const unpaidMealMinutes = 30; // 0.5 hours
    const net = BreakComplianceService.calculateNetWorkingHours(gross, unpaidMealMinutes);
    expect(net).toBe(8.0);
  });

  it("verifies compliant California shift with on-time 30-min meal", () => {
    const clockIn = new Date("2026-11-13T09:00:00.000Z");
    const mealStart = new Date("2026-11-13T13:00:00.000Z"); // 4.0h into shift (<= 5.0h)
    const mealEnd = new Date("2026-11-13T13:30:00.000Z"); // 30 min duration
    const clockOut = new Date("2026-11-13T17:30:00.000Z"); // 8.5h gross, 8.0h net

    const result = BreakComplianceService.auditShiftCompliance({
      clockInTime: clockIn,
      clockOutTime: clockOut,
      breaks: [
        {
          breakType: "MEAL",
          isPaid: false,
          startTime: mealStart,
          endTime: mealEnd,
          durationMinutes: 30,
        },
      ],
      compliancePolicy: "CALIFORNIA_STRICT",
    });

    expect(result.grossHours).toBe(8.5);
    expect(result.unpaidBreakMinutes).toBe(30);
    expect(result.netWorkingHours).toBe(8.0);
    expect(result.isCompliant).toBe(true);
    expect(result.mealPenaltyHours).toBe(0.0);
    expect(result.violations).toHaveLength(0);
  });

  it("flags violation and assesses 1.0h penalty when meal break is late (> 5.0 hours into shift)", () => {
    const clockIn = new Date("2026-11-13T09:00:00.000Z");
    const mealStart = new Date("2026-11-13T14:30:00.000Z"); // 5.5h into shift (> 5.0h deadline)
    const mealEnd = new Date("2026-11-13T15:00:00.000Z");
    const clockOut = new Date("2026-11-13T17:30:00.000Z");

    const result = BreakComplianceService.auditShiftCompliance({
      clockInTime: clockIn,
      clockOutTime: clockOut,
      breaks: [
        {
          breakType: "MEAL",
          isPaid: false,
          startTime: mealStart,
          endTime: mealEnd,
          durationMinutes: 30,
        },
      ],
      compliancePolicy: "CALIFORNIA_STRICT",
      autoAssessPenalties: true,
    });

    expect(result.isCompliant).toBe(false);
    expect(result.mealPenaltyHours).toBe(1.0);
    expect(result.violations.some((v) => v.type === "LATE_MEAL")).toBe(true);
  });

  it("flags violation and assesses 1.0h penalty when meal break is short (< 30 minutes)", () => {
    const clockIn = new Date("2026-11-13T09:00:00.000Z");
    const mealStart = new Date("2026-11-13T13:00:00.000Z"); // 4.0h
    const mealEnd = new Date("2026-11-13T13:20:00.000Z"); // Only 20 mins (< 30 min min)
    const clockOut = new Date("2026-11-13T17:00:00.000Z");

    const result = BreakComplianceService.auditShiftCompliance({
      clockInTime: clockIn,
      clockOutTime: clockOut,
      breaks: [
        {
          breakType: "MEAL",
          isPaid: false,
          startTime: mealStart,
          endTime: mealEnd,
          durationMinutes: 20,
        },
      ],
      compliancePolicy: "CALIFORNIA_STRICT",
      autoAssessPenalties: true,
    });

    expect(result.isCompliant).toBe(false);
    expect(result.mealPenaltyHours).toBe(1.0);
    expect(result.violations.some((v) => v.type === "SHORT_MEAL")).toBe(true);
  });

  it("permits meal waiver for shift <= 6.0 hours with no penalty", () => {
    const clockIn = new Date("2026-11-13T09:00:00.000Z");
    const clockOut = new Date("2026-11-13T14:45:00.000Z"); // 5.75 hours (<= 6.0h)

    const result = BreakComplianceService.auditShiftCompliance({
      clockInTime: clockIn,
      clockOutTime: clockOut,
      breaks: [],
      mealWaiverSigned: true, // Mutual written waiver
      compliancePolicy: "CALIFORNIA_STRICT",
    });

    expect(result.grossHours).toBe(5.75);
    expect(result.isCompliant).toBe(true);
    expect(result.mealPenaltyHours).toBe(0.0);
  });

  it("rejects meal waiver if shift exceeds 6.0 hours (statutory mandate under CA § 512)", () => {
    const clockIn = new Date("2026-11-13T09:00:00.000Z");
    const clockOut = new Date("2026-11-13T15:30:00.000Z"); // 6.5 hours (> 6.0h limit for waiver)

    const result = BreakComplianceService.auditShiftCompliance({
      clockInTime: clockIn,
      clockOutTime: clockOut,
      breaks: [],
      mealWaiverSigned: true, // Waiver cannot legally apply over 6.0h
      compliancePolicy: "CALIFORNIA_STRICT",
      autoAssessPenalties: true,
    });

    expect(result.isCompliant).toBe(false);
    expect(result.mealPenaltyHours).toBe(1.0);
    expect(result.violations.some((v) => v.type === "MISSED_MEAL")).toBe(true);
  });

  it("ensures paid rest breaks are tracked but NOT deducted from net working hours", () => {
    const clockIn = new Date("2026-11-13T09:00:00.000Z");
    const rest1Start = new Date("2026-11-13T11:00:00.000Z");
    const rest1End = new Date("2026-11-13T11:10:00.000Z"); // 10 min paid
    const mealStart = new Date("2026-11-13T13:00:00.000Z");
    const mealEnd = new Date("2026-11-13T13:30:00.000Z"); // 30 min unpaid
    const rest2Start = new Date("2026-11-13T15:30:00.000Z");
    const rest2End = new Date("2026-11-13T15:40:00.000Z"); // 10 min paid
    const clockOut = new Date("2026-11-13T17:30:00.000Z"); // 8.5h gross

    const result = BreakComplianceService.auditShiftCompliance({
      clockInTime: clockIn,
      clockOutTime: clockOut,
      breaks: [
        {
          breakType: "REST",
          isPaid: true,
          startTime: rest1Start,
          endTime: rest1End,
          durationMinutes: 10,
        },
        {
          breakType: "MEAL",
          isPaid: false,
          startTime: mealStart,
          endTime: mealEnd,
          durationMinutes: 30,
        },
        {
          breakType: "REST",
          isPaid: true,
          startTime: rest2Start,
          endTime: rest2End,
          durationMinutes: 10,
        },
      ],
      compliancePolicy: "CALIFORNIA_STRICT",
    });

    expect(result.grossHours).toBe(8.5);
    expect(result.paidBreakMinutes).toBe(20);
    expect(result.unpaidBreakMinutes).toBe(30);
    // 8.5 gross - 0.5 unpaid = 8.0 net hours (paid breaks remain inside net hours)
    expect(result.netWorkingHours).toBe(8.0);
    expect(result.isCompliant).toBe(true);
    expect(result.mealPenaltyHours).toBe(0.0);
  });
});
