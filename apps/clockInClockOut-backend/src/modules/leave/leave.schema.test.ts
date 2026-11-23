import { describe, it, expect } from "vitest";
import {
  CreateLeavePolicySchema,
  SubmitLeaveRequestSchema,
  ReviewLeaveRequestSchema,
  ListLeaveRequestsQuerySchema,
  RunPayPeriodAccrualSchema,
  RunRolloverSchema,
  GetTeamCalendarQuerySchema,
  CheckConflictQuerySchema,
  CalculateTerminationPayoutSchema,
  PayrollExportQuerySchema,
  AssignLeaveBalanceSchema,
} from "./leave.schema.js";

describe("Leave Policy & Request Schemas", () => {
  describe("CreateLeavePolicySchema", () => {
    it("validates California Paid Sick Leave statutory configuration", () => {
      const parsed = CreateLeavePolicySchema.parse({
        name: "California Statutory Paid Sick Leave",
        code: "ca-psl",
        category: "SICK",
        accrualType: "HOURLY_ACCRUAL",
        rate: 0.0333,
        hoursPerYear: 40,
        maxCarryoverHours: 40,
        accrualCapHours: 80,
        waitingPeriodDays: 90,
        minNoticeDays: 0,
        isPaid: true,
        payoutOnTermination: false,
        requiresApproval: false,
        requiresDocDays: 3,
      });

      expect(parsed.code).toBe("CA-PSL");
      expect(parsed.category).toBe("SICK");
      expect(parsed.rate).toBe(0.0333);
      expect(parsed.hoursPerYear).toBe(40);
      expect(parsed.payoutOnTermination).toBe(false);
      expect(parsed.requiresDocDays).toBe(3);
    });

    it("validates Standard PTO with termination payout (CA/CO compliant)", () => {
      const parsed = CreateLeavePolicySchema.parse({
        name: "Unified PTO Bank",
        code: "PTO",
        category: "PTO",
        accrualType: "PER_PAY_PERIOD",
        rate: 4.62,
        hoursPerYear: 120,
        isPaid: true,
        payoutOnTermination: true,
      });

      expect(parsed.code).toBe("PTO");
      expect(parsed.payoutOnTermination).toBe(true);
      expect(parsed.accrualType).toBe("PER_PAY_PERIOD");
    });

    it("rejects invalid policy code characters", () => {
      expect(() =>
        CreateLeavePolicySchema.parse({
          name: "Invalid Code",
          code: "PTO@2026!",
        })
      ).toThrow();
    });
  });

  describe("SubmitLeaveRequestSchema", () => {
    it("accepts valid leave request in decimal hours", () => {
      const parsed = SubmitLeaveRequestSchema.parse({
        policyId: "123e4567-e89b-42d3-a456-426614174000",
        startDate: "2026-12-20",
        endDate: "2026-12-24",
        totalHours: 40.0,
        reason: "Family holiday trip",
      });

      expect(parsed.totalHours).toBe(40.0);
      expect(parsed.startDate).toBe("2026-12-20");
      expect(parsed.isIntermittent).toBe(false);
    });

    it("rejects request under 0.5 hours (30 min minimum)", () => {
      expect(() =>
        SubmitLeaveRequestSchema.parse({
          policyId: "123e4567-e89b-42d3-a456-426614174000",
          startDate: "2026-12-20",
          endDate: "2026-12-20",
          totalHours: 0.25,
        })
      ).toThrow();
    });
  });

  describe("ReviewLeaveRequestSchema", () => {
    it("validates manager approval and rejection", () => {
      const approved = ReviewLeaveRequestSchema.parse({
        status: "APPROVED",
        reviewerNotes: "Approved, coverage confirmed.",
      });
      expect(approved.status).toBe("APPROVED");

      const rejected = ReviewLeaveRequestSchema.parse({
        status: "REJECTED",
        reviewerNotes: "Blackout period for inventory week.",
      });
      expect(rejected.status).toBe("REJECTED");
    });
  });

  describe("Accrual Engine Schemas", () => {
    it("validates RunPayPeriodAccrualSchema", () => {
      const parsed = RunPayPeriodAccrualSchema.parse({
        workspaceId: "123e4567-e89b-42d3-a456-426614174000",
        year: 2026,
      });
      expect(parsed.year).toBe(2026);
    });

    it("validates RunRolloverSchema", () => {
      const parsed = RunRolloverSchema.parse({
        fromYear: 2026,
        toYear: 2027,
      });
      expect(parsed.fromYear).toBe(2026);
      expect(parsed.toYear).toBe(2027);
    });
  });

  describe("Calendar & Conflict Schemas", () => {
    it("validates GetTeamCalendarQuerySchema with month format", () => {
      const parsed = GetTeamCalendarQuerySchema.parse({
        month: "2026-11",
        department: "Engineering",
        status: "APPROVED",
      });
      expect(parsed.month).toBe("2026-11");
      expect(parsed.department).toBe("Engineering");
    });

    it("validates CheckConflictQuerySchema with valid date range", () => {
      const parsed = CheckConflictQuerySchema.parse({
        startDate: "2026-11-20",
        endDate: "2026-11-25",
      });
      expect(parsed.startDate).toBe("2026-11-20");
      expect(parsed.endDate).toBe("2026-11-25");
    });
  });

  describe("Termination Payout & Payroll Export Schemas", () => {
    it("validates CalculateTerminationPayoutSchema with default hourly rate", () => {
      const parsed = CalculateTerminationPayoutSchema.parse({
        employeeId: "123e4567-e89b-42d3-a456-426614174000",
      });
      expect(parsed.hourlyRate).toBe(25.0);
      expect(parsed.employeeId).toBe("123e4567-e89b-42d3-a456-426614174000");
    });

    it("validates CalculateTerminationPayoutSchema with custom wage and year", () => {
      const parsed = CalculateTerminationPayoutSchema.parse({
        employeeId: "123e4567-e89b-42d3-a456-426614174000",
        hourlyRate: "42.50",
        year: "2026",
      });
      expect(parsed.hourlyRate).toBe(42.5);
      expect(parsed.year).toBe(2026);
    });

    it("validates PayrollExportQuerySchema with CSV format option", () => {
      const parsed = PayrollExportQuerySchema.parse({
        startDate: "2026-11-01",
        endDate: "2026-11-15",
        format: "csv",
        department: "Engineering",
      });
      expect(parsed.format).toBe("csv");
      expect(parsed.department).toBe("Engineering");
    });

    it("validates AssignLeaveBalanceSchema for mid-year joiner proration", () => {
      const parsed = AssignLeaveBalanceSchema.parse({
        employeeId: "123e4567-e89b-42d3-a456-426614174000",
        policyId: "223e4567-e89b-42d3-a456-426614174000",
        year: 2026,
        allocatedHours: "40.5",
        carriedOverHours: "10.0",
        hireDate: "2026-07-01",
        notes: "Mid-year hire prorated allocation",
      });

      expect(parsed.employeeId).toBe("123e4567-e89b-42d3-a456-426614174000");
      expect(parsed.allocatedHours).toBe(40.5);
      expect(parsed.carriedOverHours).toBe(10.0);
      expect(parsed.hireDate).toBe("2026-07-01");
      expect(parsed.notes).toBe("Mid-year hire prorated allocation");
    });
  });
});
