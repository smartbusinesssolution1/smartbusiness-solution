import { AttendanceStatus } from "@smartbusiness/database";

/**
 * Attendance daily working-hour threshold limits
 */
export const ATTENDANCE_THRESHOLDS = {
  /**
   * Total working hours strictly less than this threshold (e.g. < 1.0 hour) are marked ABSENT
   */
  MIN_HOURS_FOR_ABSENT: 1.0,

  /**
   * Total working hours strictly less than this threshold (e.g. < 4.0 hours) are marked HALF_DAY
   */
  MIN_HOURS_FOR_HALF_DAY: 4.0,

  /**
   * Standard expected hours for a full shift
   */
  FULL_DAY_TARGET_HOURS: 8.0,
} as const;

export interface AttendanceThresholds {
  MIN_HOURS_FOR_ABSENT: number;
  MIN_HOURS_FOR_HALF_DAY: number;
  FULL_DAY_TARGET_HOURS: number;
}

/**
 * Resolves the final attendance status based on cumulative hours worked today
 * and whether the employee's initial arrival was late.
 *
 * Rules:
 * - totalWorkingHours < 1.0 hr -> ABSENT
 * - 1.0 hr <= totalWorkingHours < 4.0 hrs -> HALF_DAY
 * - totalWorkingHours >= 4.0 hrs -> LATE (if late arrival) or PRESENT (if on-time)
 */
export function resolveAttendanceStatusByHours(
  totalWorkingHours: number,
  isLateArrival: boolean,
  thresholds: AttendanceThresholds = ATTENDANCE_THRESHOLDS
): AttendanceStatus {
  if (totalWorkingHours < thresholds.MIN_HOURS_FOR_ABSENT) {
    return AttendanceStatus.ABSENT;
  }
  if (totalWorkingHours < thresholds.MIN_HOURS_FOR_HALF_DAY) {
    return AttendanceStatus.HALF_DAY;
  }
  return isLateArrival ? AttendanceStatus.LATE : AttendanceStatus.PRESENT;
}
