import { describe, it, expect } from "vitest";
import {
  AdminAttendanceQuerySchema,
  AdminAttendanceExportSchema,
} from "./admin-attendance.schema.js";

describe("Admin Attendance & Dashboard Schemas", () => {
  describe("AdminAttendanceQuerySchema", () => {
    it("coerces and normalizes valid query params", () => {
      const parsed = AdminAttendanceQuerySchema.parse({
        page: "2",
        limit: "25",
        status: "PRESENT",
        date: "2026-10-29",
        search: "John",
        workspaceId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      });

      expect(parsed.page).toBe(2);
      expect(parsed.limit).toBe(25);
      expect(parsed.status).toBe("present"); // lowercased
      expect(parsed.date).toBe("2026-10-29");
      expect(parsed.search).toBe("John");
      expect(parsed.workspaceId).toBe("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11");
    });

    it("converts empty strings and 'null'/'undefined'/'all' strings to undefined", () => {
      const parsed = AdminAttendanceQuerySchema.parse({
        search: "   ",
        workspaceId: "null",
        status: "all",
      });

      expect(parsed.search).toBeUndefined();
      expect(parsed.workspaceId).toBeUndefined();
      expect(parsed.status).toBe("all");
    });

    it("rejects invalid date format", () => {
      expect(() =>
        AdminAttendanceQuerySchema.parse({
          date: "10-29-2026", // Not YYYY-MM-DD
        })
      ).toThrow();
    });
  });

  describe("AdminAttendanceExportSchema", () => {
    it("validates export format enum", () => {
      const parsedXlsx = AdminAttendanceExportSchema.parse({ format: "xlsx" });
      const parsedCsv = AdminAttendanceExportSchema.parse({ format: "csv" });
      const parsedPdf = AdminAttendanceExportSchema.parse({ format: "pdf" });

      expect(parsedXlsx.format).toBe("xlsx");
      expect(parsedCsv.format).toBe("csv");
      expect(parsedPdf.format).toBe("pdf");
    });

    it("rejects unsupported export format", () => {
      expect(() =>
        AdminAttendanceExportSchema.parse({
          format: "docx" as any,
        })
      ).toThrow();
    });
  });
});
