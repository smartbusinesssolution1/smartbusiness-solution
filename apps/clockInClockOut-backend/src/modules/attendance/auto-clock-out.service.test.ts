import { describe, it, expect } from "vitest";
import { AutoClockOutService } from "./auto-clock-out.service.js";

describe("AutoClockOutService Unit Tests", () => {
  const service = new AutoClockOutService();

  describe("classifyShift", () => {
    it("classifies daytime clock-in as day shift", () => {
      // 09:30 AM
      const morningTime = new Date("2026-10-29T09:30:00");
      expect(service.classifyShift(morningTime)).toBe("day");

      // 02:00 PM
      const afternoonTime = new Date("2026-10-29T14:00:00");
      expect(service.classifyShift(afternoonTime)).toBe("day");
    });

    it("classifies evening and overnight clock-in as night shift", () => {
      // 07:00 PM (19:00)
      const eveningTime = new Date("2026-10-29T19:00:00");
      expect(service.classifyShift(eveningTime)).toBe("night");

      // 02:00 AM
      const midnightTime = new Date("2026-10-29T02:00:00");
      expect(service.classifyShift(midnightTime)).toBe("night");
    });

    it("respects custom weekly schedule startTime configuration", () => {
      // Thu Oct 29 2026
      const time = new Date("2026-10-29T12:00:00");
      const weeklySchedule = [
        { day: "THU", isWorkDay: true, startTime: "20:00", endTime: "05:00" },
      ];

      expect(service.classifyShift(time, weeklySchedule)).toBe("night");
    });
  });

  describe("calculateAutoCloseTimes", () => {
    it("calculates auto-close time for standard daytime shift", () => {
      const clockInDate = new Date("2026-10-29T00:00:00Z");
      const clockInTime = new Date("2026-10-29T09:00:00");

      const result = service.calculateAutoCloseTimes(
        clockInTime,
        clockInDate,
        "day",
        undefined,
        { defaultShiftEndTime: "18:00" }
      );

      expect(result.workingHours).toBeGreaterThan(0);
      expect(result.workingHours).toBeLessThanOrEqual(16);
      expect(result.clockOutDate).toBeDefined();
      expect(result.clockOutTime).toBeDefined();
    });

    it("caps excessive unclosed hours at safe maximum", () => {
      const clockInDate = new Date("2026-10-28T00:00:00Z");
      const clockInTime = new Date("2026-10-28T08:00:00");

      const result = service.calculateAutoCloseTimes(
        clockInTime,
        clockInDate,
        "day"
      );

      // System caps at 10.0 or 12.0 hours
      expect(result.workingHours).toBeLessThanOrEqual(12.0);
    });
  });
});
