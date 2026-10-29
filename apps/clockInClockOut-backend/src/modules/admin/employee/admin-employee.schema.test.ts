import { describe, it, expect } from "vitest";
import {
  CreateEmployeeSchema,
  UpdateEmployeeSchema,
  DayShiftConfigSchema,
  PreprocessedWeeklyScheduleSchema,
} from "./admin-employee.schema.js";

describe("Admin Employee Schemas", () => {
  describe("DayShiftConfigSchema", () => {
    it("validates valid day shift configuration", () => {
      const parsed = DayShiftConfigSchema.parse({
        day: "MON",
        isWorkDay: true,
        startTime: "08:30",
        endTime: "17:30",
      });

      expect(parsed.day).toBe("MON");
      expect(parsed.isWorkDay).toBe(true);
      expect(parsed.startTime).toBe("08:30");
      expect(parsed.endTime).toBe("17:30");
    });

    it("rejects invalid time formats", () => {
      expect(() =>
        DayShiftConfigSchema.parse({
          day: "MON",
          startTime: "8:30", // Missing leading 0
        })
      ).toThrow();

      expect(() =>
        DayShiftConfigSchema.parse({
          day: "MON",
          startTime: "25:00", // Invalid hour
        })
      ).toThrow();
    });
  });

  describe("PreprocessedWeeklyScheduleSchema", () => {
    it("parses JSON string serialized schedules", () => {
      const scheduleString = JSON.stringify([
        { day: "MON", isWorkDay: true, startTime: "09:00", endTime: "18:00" },
      ]);

      const parsed = PreprocessedWeeklyScheduleSchema.parse(scheduleString);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed?.[0].day).toBe("MON");
    });

    it("normalizes legacy map format { MON: { ... } } to array", () => {
      const legacyMap = {
        MON: { isWorkDay: true, startTime: "09:00", endTime: "18:00" },
        TUE: { isWorkDay: true, startTime: "09:00", endTime: "18:00" },
      };

      const parsed = PreprocessedWeeklyScheduleSchema.parse(legacyMap);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(7); // All 7 days generated
      expect(parsed?.find((d) => d.day === "MON")?.isWorkDay).toBe(true);
    });
  });

  describe("CreateEmployeeSchema", () => {
    it("validates valid new employee payload", () => {
      const parsed = CreateEmployeeSchema.parse({
        name: "Sarah Connor",
        email: "SARAH.CONNOR@ACME.COM",
        phone: "+1 555-0199",
        designation: "Software Engineer",
        department: "Engineering",
        role: "employee",
      });

      expect(parsed.name).toBe("Sarah Connor");
      expect(parsed.email).toBe("sarah.connor@acme.com"); // lowercased
      expect(parsed.role).toBe("employee");
      expect(parsed.status).toBe("active"); // default
      expect(parsed.shiftType).toBe("general"); // default
    });

    it("rejects invalid emails", () => {
      expect(() =>
        CreateEmployeeSchema.parse({
          name: "Sarah Connor",
          email: "not-an-email",
          phone: "555-0199",
          designation: "Engineer",
          department: "IT",
        })
      ).toThrow();
    });

    it("rejects short phone numbers", () => {
      expect(() =>
        CreateEmployeeSchema.parse({
          name: "Sarah Connor",
          email: "sarah@acme.com",
          phone: "12",
          designation: "Engineer",
          department: "IT",
        })
      ).toThrow();
    });
  });

  describe("UpdateEmployeeSchema", () => {
    it("allows partial updates", () => {
      const parsed = UpdateEmployeeSchema.parse({
        designation: "Principal Engineer",
      });

      expect(parsed.designation).toBe("Principal Engineer");
      expect(parsed.name).toBeUndefined();
    });
  });
});
