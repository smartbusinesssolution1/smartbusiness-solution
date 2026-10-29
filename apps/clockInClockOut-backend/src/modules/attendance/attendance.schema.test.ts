import { describe, it, expect } from "vitest";
import {
  VerifyLocationSchema,
  CheckInSchema,
  CheckOutSchema,
  AttendanceHistoryQuerySchema,
} from "./attendance.schema.js";

describe("Attendance Schemas", () => {
  describe("VerifyLocationSchema", () => {
    it("accepts valid GPS coordinates and optional workspaceId", () => {
      const parsed = VerifyLocationSchema.parse({
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 10,
        workspaceId: "ws_12345",
      });

      expect(parsed.latitude).toBe(37.7749);
      expect(parsed.longitude).toBe(-122.4194);
      expect(parsed.accuracy).toBe(10);
      expect(parsed.workspaceId).toBe("ws_12345");
    });

    it("rejects latitude outside -90 to 90 range", () => {
      expect(() =>
        VerifyLocationSchema.parse({
          latitude: 91,
          longitude: 0,
        })
      ).toThrow();

      expect(() =>
        VerifyLocationSchema.parse({
          latitude: -91,
          longitude: 0,
        })
      ).toThrow();
    });

    it("rejects longitude outside -180 to 180 range", () => {
      expect(() =>
        VerifyLocationSchema.parse({
          latitude: 0,
          longitude: 181,
        })
      ).toThrow();

      expect(() =>
        VerifyLocationSchema.parse({
          latitude: 0,
          longitude: -181,
        })
      ).toThrow();
    });
  });

  describe("CheckInSchema", () => {
    it("defaults null or missing latitude/longitude to 0", () => {
      const parsed = CheckInSchema.parse({});
      expect(parsed.latitude).toBe(0);
      expect(parsed.longitude).toBe(0);
    });

    it("accepts valid check-in payload with face verification metadata", () => {
      const parsed = CheckInSchema.parse({
        latitude: 37.7749,
        longitude: -122.4194,
        faceVerificationId: "ver_test_01",
        challengeToken: "token_abc123",
        notes: "Morning shift",
      });

      expect(parsed.latitude).toBe(37.7749);
      expect(parsed.longitude).toBe(-122.4194);
      expect(parsed.faceVerificationId).toBe("ver_test_01");
      expect(parsed.challengeToken).toBe("token_abc123");
      expect(parsed.notes).toBe("Morning shift");
    });
  });

  describe("CheckOutSchema", () => {
    it("accepts empty checkout payload or with optional location and notes", () => {
      const parsedEmpty = CheckOutSchema.parse({});
      expect(parsedEmpty).toBeDefined();

      const parsedWithData = CheckOutSchema.parse({
        latitude: 37.7749,
        longitude: -122.4194,
        notes: "Shift complete",
      });
      expect(parsedWithData.latitude).toBe(37.7749);
      expect(parsedWithData.notes).toBe("Shift complete");
    });

    it("rejects invalid latitude bounds on checkout", () => {
      expect(() =>
        CheckOutSchema.parse({
          latitude: 100,
        })
      ).toThrow();
    });
  });

  describe("AttendanceHistoryQuerySchema", () => {
    it("applies default pagination values (page 1, limit 31)", () => {
      const parsed = AttendanceHistoryQuerySchema.parse({});
      expect(parsed.page).toBe(1);
      expect(parsed.limit).toBe(31);
    });

    it("coerces string page and limit parameters to numbers", () => {
      const parsed = AttendanceHistoryQuerySchema.parse({
        page: "2",
        limit: "50",
      });
      expect(parsed.page).toBe(2);
      expect(parsed.limit).toBe(50);
    });
  });
});
