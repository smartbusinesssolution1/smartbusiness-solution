import { describe, it, expect } from "vitest";
import { AttendanceStatus } from "@smartbusiness/database";
import {
  ATTENDANCE_THRESHOLDS,
  resolveAttendanceStatusByHours,
} from "./attendance.constants.js";

describe("resolveAttendanceStatusByHours", () => {
  it("resolves ABSENT when worked hours are strictly less than MIN_HOURS_FOR_ABSENT (1.0h)", () => {
    expect(resolveAttendanceStatusByHours(0, false)).toBe(AttendanceStatus.ABSENT);
    expect(resolveAttendanceStatusByHours(0.5, false)).toBe(AttendanceStatus.ABSENT);
    expect(resolveAttendanceStatusByHours(0.99, true)).toBe(AttendanceStatus.ABSENT);
  });

  it("resolves HALF_DAY when worked hours are between 1.0h and 4.0h", () => {
    expect(resolveAttendanceStatusByHours(1.0, false)).toBe(AttendanceStatus.HALF_DAY);
    expect(resolveAttendanceStatusByHours(2.5, true)).toBe(AttendanceStatus.HALF_DAY);
    expect(resolveAttendanceStatusByHours(3.99, false)).toBe(AttendanceStatus.HALF_DAY);
  });

  it("resolves PRESENT when worked hours are >= 4.0h and arrival was on time", () => {
    expect(resolveAttendanceStatusByHours(4.0, false)).toBe(AttendanceStatus.PRESENT);
    expect(resolveAttendanceStatusByHours(8.0, false)).toBe(AttendanceStatus.PRESENT);
    expect(resolveAttendanceStatusByHours(9.5, false)).toBe(AttendanceStatus.PRESENT);
  });

  it("resolves LATE when worked hours are >= 4.0h and arrival was marked late", () => {
    expect(resolveAttendanceStatusByHours(4.0, true)).toBe(AttendanceStatus.LATE);
    expect(resolveAttendanceStatusByHours(8.0, true)).toBe(AttendanceStatus.LATE);
    expect(resolveAttendanceStatusByHours(10.0, true)).toBe(AttendanceStatus.LATE);
  });

  it("respects custom threshold overrides", () => {
    const customThresholds = {
      MIN_HOURS_FOR_ABSENT: 2.0,
      MIN_HOURS_FOR_HALF_DAY: 6.0,
      FULL_DAY_TARGET_HOURS: 8.0,
    };

    expect(resolveAttendanceStatusByHours(1.5, false, customThresholds)).toBe(
      AttendanceStatus.ABSENT
    );
    expect(resolveAttendanceStatusByHours(5.0, false, customThresholds)).toBe(
      AttendanceStatus.HALF_DAY
    );
    expect(resolveAttendanceStatusByHours(6.0, false, customThresholds)).toBe(
      AttendanceStatus.PRESENT
    );
  });
});
