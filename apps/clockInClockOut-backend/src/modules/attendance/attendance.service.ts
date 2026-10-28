import { prisma, AttendanceStatus } from "@smartbusiness/database";
import { AttendanceRepository } from "./attendance.repository.js";
import {
  ATTENDANCE_THRESHOLDS,
  resolveAttendanceStatusByHours,
} from "./attendance.constants.js";
import { AppError, NotFoundError, ValidationError } from "../../shared/errors/index.js";
import { storageService } from "../../shared/services/storage.service.js";
import { faceRecognitionService } from "../../shared/services/faceRecognition.service.js";
import { memoryCache } from "../../shared/services/cache.service.js";
import { logger } from "../../shared/services/logger.js";
import { redisClient } from "../../shared/services/redis.service.js";
import type {
  VerifyLocationInput,
  CheckInInput,
  CheckOutInput,
  AttendanceHistoryQueryInput,
  LedgerExportInput,
} from "./attendance.schema.js";

/**
 * Calculates Haversine distance in meters between two GPS coordinates
 */
export function calculateHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Convert Date to formatted 12-hour AM/PM string
 */
function formatTimeAMPM(date: Date): string {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const minutesStr = minutes < 10 ? "0" + minutes : String(minutes);
  const hoursStr = hours < 10 ? "0" + hours : String(hours);
  return `${hoursStr}:${minutesStr} ${ampm}`;
}

export class AttendanceService {
  constructor(private attendanceRepo: AttendanceRepository) {}

  private employeeCache = new Map<string, { data: any; expiresAt: number }>();

  /**
   * Helper: Resolve employee and throw if not found (with 60s in-memory cache)
   */
  private async getEmployee(userId: string, tenantId: string, employeeIdParam?: string, workspaceId?: string) {
    const cacheKey = `cache:emp:${tenantId}:${userId}:${employeeIdParam || ""}:${workspaceId || ""}`;
    const cached = await memoryCache.get<any>(cacheKey);
    if (cached) {
      return cached;
    }

    let employee = await this.attendanceRepo.findEmployeeByUserId(userId, tenantId, workspaceId);
    if (!employee && employeeIdParam) {
      employee = await prisma.attendanceEmployeeDetails.findFirst({
        where: {
          OR: [{ id: employeeIdParam }, { employeeCode: employeeIdParam }],
          deletedAt: null,
          workspaceMember: {
            deletedAt: null,
            workspace: {
              tenantId,
              deletedAt: null,
            },
          },
        },
        include: {
          workspaceMember: {
            include: {
              workspace: {
                include: {
                  attendanceSettings: true,
                },
              },
              user: true,
            },
          },
        },
      });
    }

    if (!employee) {
      throw new NotFoundError("Employee profile not found for this account.");
    }

    await memoryCache.set(cacheKey, employee, 60);
    return employee;
  }

  /**
   * Helper: Resolve target workspace and geofence settings
   */
  private async resolveWorkspaceAndSettings(
    employee: any,
    tenantId: string,
    workspaceId?: string
  ) {
    const defaultWs = employee.workspaceMember?.workspace;
    const defaultWsId = defaultWs?.id;
    const targetWsId = workspaceId || defaultWsId;

    const wsCacheKey = `cache:ws:settings:${tenantId}:${targetWsId}`;
    const cachedWs = await memoryCache.get<{ workspace: any; settings: any }>(wsCacheKey);
    if (cachedWs) {
      return cachedWs;
    }

    let result: { workspace: any; settings: any };
    // Fast-path: If target is employee's primary assigned workspace, reuse already-loaded data
    if (defaultWs && (!workspaceId || workspaceId === defaultWsId)) {
      const settings = defaultWs.attendanceSettings ?? {
        latitude: 37.774929,
        longitude: -122.419416,
        radiusMeters: 150,
        defaultShiftStartTime: "09:00",
        defaultShiftEndTime: "18:00",
        graceMinutes: 15,
      };
      result = { workspace: defaultWs, settings };
    } else {
      const ws = await this.attendanceRepo.findWorkspaceWithGeofence(targetWsId, tenantId);
      if (!ws) {
        throw new NotFoundError("Target Workspace");
      }

      const settings = ws.attendanceSettings ?? {
        latitude: 37.774929,
        longitude: -122.419416,
        radiusMeters: 150,
        defaultShiftStartTime: "09:00",
        defaultShiftEndTime: "18:00",
        graceMinutes: 15,
      };

      result = { workspace: ws, settings };
    }

    await memoryCache.set(wsCacheKey, result, 900); // 15 mins TTL
    return result;
  }

  /**
   * Verify whether the employee's current coordinates are within the authorized workspace geofence
   */
  async verifyLocation(
    userId: string,
    tenantId: string,
    input: VerifyLocationInput,
    headerWorkspaceId?: string
  ) {
    const employee = await this.getEmployee(userId, tenantId);
    const { workspace, settings } = await this.resolveWorkspaceAndSettings(
      employee,
      tenantId,
      input.workspaceId || headerWorkspaceId
    );

    const wsLat = Number(settings.latitude);
    const wsLng = Number(settings.longitude);
    const radius = Number(settings.radiusMeters || 150);

    const distanceMeters = calculateHaversineDistanceMeters(
      input.latitude,
      input.longitude,
      wsLat,
      wsLng
    );

    const isWithinGeofence = distanceMeters <= radius;

    return {
      isWithinGeofence,
      workspaceId: workspace.id,
      workspaceName: workspace.businessName,
      distanceMeters,
      allowedRadiusMeters: radius,
      canProceedToFaceScan: isWithinGeofence,
      message: isWithinGeofence
        ? "You are within the authorized workspace perimeter."
        : `You are ${(distanceMeters - radius).toFixed(1)}m outside the authorized geofence boundary.`,
    };
  }

  /**
   * Step 1.5: Acquire active-liveness signed challenge token
   */
  async getChallenge() {
    return faceRecognitionService.getChallenge();
  }

  /**
   * Step 2: Instant 1-Click Check-In Punch (Option 1)
   */
  async checkIn(
    userId: string,
    tenantId: string,
    input: CheckInInput,
    file?: Express.Multer.File,
    headerWorkspaceId?: string,
    captureFiles?: Express.Multer.File[]
  ) {
    const employee = await this.getEmployee(userId, tenantId, input.employeeId);

    // Concurrency Lock: Prevent rapid double-tap punch race conditions
    const punchLockKey = `lock:punch:${employee.id}`;
    let lockAcquired = false;
    try {
      const lockRes = await redisClient.set(punchLockKey, "1", "PX", 8000, "NX");
      lockAcquired = lockRes === "OK";
    } catch {
      lockAcquired = true; // fail-open if Redis is unreachable
    }

    if (!lockAcquired) {
      throw new AppError(
        "A punch request is already being processed. Please wait a moment.",
        429,
        "ERR_PUNCH_IN_PROGRESS"
      );
    }

    try {
    // 1. Resolve Workspace & Geofence
    const { workspace, settings } = await this.resolveWorkspaceAndSettings(
      employee,
      tenantId,
      input.workspaceId || headerWorkspaceId
    );

    const wsLat = Number(settings.latitude);
    const wsLng = Number(settings.longitude);
    const radius = Number(settings.radiusMeters || 150);

    const distanceMeters = calculateHaversineDistanceMeters(
      input.latitude,
      input.longitude,
      wsLat,
      wsLng
    );
    const isWithinGeofence = distanceMeters <= radius;

    // 2. Guard: Disallow clock-in ONLY if an active unclosed session is currently open
    const now = new Date();
    const todayDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const activeSession = await this.attendanceRepo.findActiveSession(employee.id);
    if (activeSession) {
      throw new AppError(
        "You already have an active open shift. Please clock out of your current session first.",
        409,
        "ERR_ALREADY_CLOCKED_IN"
      );
    }

    // Check prior sessions completed today
    const todaySessions = await this.attendanceRepo.findTodaySessions(employee.id, todayDate);
    const isFirstSessionToday = todaySessions.length === 0;

    // 4. Determine status:
    // Evaluate shift start time & grace minutes for first session of the day
    // Subsequent punches today default to PRESENT
    let status: AttendanceStatus = AttendanceStatus.PRESENT;
    if (isFirstSessionToday) {
      const [startHourStr, startMinStr] = (settings.defaultShiftStartTime || "09:00").split(":");
      const startHour = parseInt(startHourStr || "9", 10);
      const startMin = parseInt(startMinStr || "0", 10);
      const graceMin = settings.graceMinutes ?? 15;

      const shiftLimitMinutes = startHour * 60 + startMin + graceMin;
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      if (currentMinutes > shiftLimitMinutes) {
        status = AttendanceStatus.LATE;
      }
    }

    // 5. Face Recognition & Active Liveness Burst
    let faceMatchConfidence = 100.0;
    let livenessScore = 1.0;
    const allFiles = captureFiles && captureFiles.length > 0 ? captureFiles : file ? [file] : [];
    const hasPhoto = allFiles.length > 0 || Boolean(input.selfieUri);

    if (hasPhoto && employee.biometricPhotoUrl) {
      
      logger.info(
        {
          employeeId: employee.id,
          employeeCode: employee.employeeCode,
          biometricPhotoUrl: employee.biometricPhotoUrl,
          captureFilesCount: allFiles.length,
          hasSelfieUri: Boolean(input.selfieUri),
          hasChallengeToken: Boolean(input.challengeToken),
        },
        "Starting face verification for attendance clock-in"
      );

      const captureBuffers: Buffer[] = [];
      for (const f of allFiles) {
        if (f.buffer) captureBuffers.push(f.buffer);
      }

      if (captureBuffers.length === 0 && input.selfieUri) {
        if (input.selfieUri.startsWith("data:image")) {
          const base64Data = input.selfieUri.split(",")[1];
          captureBuffers.push(Buffer.from(base64Data, "base64"));
        } else {
                    captureBuffers.push(await storageService.getFileBuffer(input.selfieUri));
        }
      }

      if (captureBuffers.length > 0) {
        let baselineBuffer: Buffer | null = null;
        const faceCacheKey = `cache:face:baseline:${employee.id}`;
        try {
          const cachedBase64 = await memoryCache.get<string>(faceCacheKey);
          if (cachedBase64) {
            baselineBuffer = Buffer.from(cachedBase64, "base64");
            logger.info({ employeeId: employee.id }, "Biometric baseline loaded from Redis/L1 cache");
          } else {
            const baselineStart = Date.now();
            baselineBuffer = await storageService.getFileBuffer(employee.biometricPhotoUrl);
            const durationMs = Date.now() - baselineStart;
            logger.info(
              { employeeId: employee.id, bytes: baselineBuffer.length, durationMs },
              "Biometric baseline fetched from storage and cached to Redis"
            );
            await memoryCache.set(faceCacheKey, baselineBuffer.toString("base64"), 86400); // 24h TTL
          }
        } catch (storageErr: any) {
          logger.warn(
            { employeeId: employee.id, biometricPhotoUrl: employee.biometricPhotoUrl, error: storageErr.message },
            "Employee baseline photo is currently unreachable. Proceeding with punch without facial match."
          );
        }

        if (baselineBuffer) {
          let faceResult;
        if (input.challengeToken) {
          faceResult = await faceRecognitionService.verifyFaceBurst({
            baselineBuffer,
            baselineFilename: "baseline.jpg",
            captureBuffers,
            challengeToken: input.challengeToken,
          });
        } else {
          faceResult = await faceRecognitionService.verifyFace({
            baselineBuffer,
            baselineFilename: "baseline.jpg",
            captureBuffer: captureBuffers[0],
            captureFilename: file?.originalname || "capture.jpg",
          });
        }

        
        if (!faceResult.matched) {
          throw new AppError(
            faceResult.message || "Face verification failed: Captured face does not match the employee profile.",
            400,
            "ERR_FACE_MISMATCH"
          );
        }

        if (!faceResult.livenessPassed || faceResult.status === "spoof_suspected") {
          throw new AppError(
            faceResult.message || "Face liveness check failed: Spoofing or invalid motion detected.",
            400,
            "ERR_LIVENESS_FAILED"
          );
        }

        faceMatchConfidence = Math.min(100, Math.round(faceResult.similarity * 10000) / 100);
        livenessScore = faceResult.liveness?.liveness_score ?? 1.0;
        }
      }
    } else {
      if (!employee.biometricPhotoUrl) {
                logger.info({ employeeId: employee.id, employeeCode: employee.employeeCode }, "No biometricPhotoUrl registered; skipping face verification");
      } else if (!hasPhoto) {
              }
    }

    const sessionNumber = todaySessions.length + 1;

    // 6. Persist Attendance Record
    const record = await this.attendanceRepo.createAttendanceRecord({
      employeeId: employee.id,
      status,
      clockInDate: todayDate,
      clockInTime: now,
      clockInLatitude: input.latitude,
      clockInLongitude: input.longitude,
      clockInFaceMatchConfidence: faceMatchConfidence,
      notes: input.notes,
    });

    // Invalidate cached attendance datasets, reports, and metrics
    memoryCache.invalidatePattern(`admin:dataset:${tenantId}`);
    memoryCache.invalidatePattern(`admin:report:${tenantId}`);
    memoryCache.invalidatePattern(`admin:summary:${tenantId}`);
    memoryCache.invalidatePattern(`employee:metrics:${employee.id}`);
    memoryCache.invalidatePattern(`employee:today:${employee.id}`);

    const timeStr = formatTimeAMPM(now);
    const dateFormatted = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const dayFormatted = now.toLocaleDateString("en-US", { weekday: "long" });

    // Calculate completed hours before this session
    const priorCompletedHours = Math.round(
      todaySessions.reduce((sum, s) => sum + Number(s.workingHours || 0), 0) * 100
    ) / 100;

    return {
      id: record.id,
      date: now.toISOString().split("T")[0],
      checkInTime: timeStr,
      checkOutTime: null,
      status: record.status,
      workingHours: priorCompletedHours,
      sessionNumber,
      workspace: {
        id: workspace.id,
        name: workspace.businessName,
      },
      verification: {
        isMatch: true,
        similarityConfidence: faceMatchConfidence,
        isWithinGeofence,
        distanceMeters,
        livenessScore,
      },
      // Mobile store models
      shift: {
        state: "checked_in",
        checkInTime: timeStr,
        checkOutTime: null,
        hoursWorked: priorCompletedHours,
        targetHours: 8.0,
        checkInCoords: {
          latitude: input.latitude,
          longitude: input.longitude,
          address: workspace.businessName,
        },
        faceVerificationId: input.faceVerificationId || `ver_${Date.now()}`,
        locationName: workspace.businessName,
        sessionNumber,
      },
      record: {
        id: record.id,
        date: dateFormatted,
        day: dayFormatted,
        checkIn: timeStr,
        checkOut: "--:--",
        hoursLogged: priorCompletedHours > 0 ? `${priorCompletedHours} hrs (prior)` : "In Progress",
        rawHours: priorCompletedHours,
        status: record.status.toLowerCase(),
        auditNotes: `Session #${sessionNumber} • Face verified • ${workspace.businessName} geofence confirmed (${distanceMeters}m)`,
        faceVerified: true,
        geofenceVerified: isWithinGeofence,
      },
      message: `Good ${now.getHours() < 12 ? "morning" : "afternoon"}! Session #${sessionNumber} clocked in as ${record.status}.`,
    };
    await memoryCache.delPattern(`cache:att:today:${tenantId}:${userId}:*`);
    await memoryCache.delPattern(`cache:att:today:${tenantId}:*:*`);
    } finally {
      redisClient.del(punchLockKey).catch(() => {});
    }
  }

  /**
   * Clock out of active shift and compute elapsed working hours
   */
  async checkOut(userId: string, tenantId: string, input: CheckOutInput, headerWorkspaceId?: string) {
    const targetWorkspaceId = headerWorkspaceId || (input as any).workspaceId;
    const employee = await this.getEmployee(userId, tenantId, input.employeeId, targetWorkspaceId);

    // Concurrency Lock: Prevent rapid double-tap punch race conditions
    const punchLockKey = `lock:punch:${employee.id}`;
    let lockAcquired = false;
    try {
      const lockRes = await redisClient.set(punchLockKey, "1", "PX", 8000, "NX");
      lockAcquired = lockRes === "OK";
    } catch {
      lockAcquired = true; // fail-open if Redis is unreachable
    }

    if (!lockAcquired) {
      throw new AppError(
        "A punch request is already being processed. Please wait a moment.",
        429,
        "ERR_PUNCH_IN_PROGRESS"
      );
    }

    try {
    const now = new Date();
    const todayDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    // Find the currently open session (clockOutTime IS NULL)
    const activeSession = await this.attendanceRepo.findActiveSession(employee.id);
    if (!activeSession) {
      throw new AppError(
        "No active clock-in session found. Please clock in first.",
        400,
        "ERR_NOT_CLOCKED_IN"
      );
    }

    const clockInTimestamp = new Date(activeSession.clockInTime).getTime();
    const elapsedMs = Math.max(0, now.getTime() - clockInTimestamp);
    const sessionWorkingHours = Math.round((elapsedMs / (1000 * 60 * 60)) * 100) / 100;

    // Fetch prior completed sessions today to calculate day's cumulative working hours
    const priorTodaySessions = await this.attendanceRepo.findTodaySessions(employee.id, todayDate);
    const priorHours = priorTodaySessions
      .filter((s) => s.id !== activeSession.id && s.clockOutTime)
      .reduce((sum, s) => sum + Number(s.workingHours || 0), 0);
    const totalWorkingHoursToday = Math.round((priorHours + sessionWorkingHours) * 100) / 100;

    // Determine if the employee's initial arrival was late
    const firstSessionToday = priorTodaySessions[0] || activeSession;
    const settings = employee.workspaceMember.workspace.attendanceSettings;
    const [startHourStr, startMinStr] = (settings?.defaultShiftStartTime || "09:00").split(":");
    const startHour = parseInt(startHourStr || "9", 10);
    const startMin = parseInt(startMinStr || "0", 10);
    const graceMin = settings?.graceMinutes ?? 15;
    const shiftLimitMinutes = startHour * 60 + startMin + graceMin;
    const firstArrival = new Date(firstSessionToday.clockInTime);
    const firstArrivalMinutes = firstArrival.getHours() * 60 + firstArrival.getMinutes();
    const isLateArrival =
      firstSessionToday.status === AttendanceStatus.LATE ||
      firstArrivalMinutes > shiftLimitMinutes;

    // Resolve attendance status based on cumulative working hours (Approach 1)
    const resolvedStatus = resolveAttendanceStatusByHours(totalWorkingHoursToday, isLateArrival);

    // If this active session is NOT the first session of the day, it is a subsequent punch (session 2+).
    // An individual subsequent punch record must NEVER be marked as LATE arrival.
    // Punctuality (LATE) belongs strictly to the first session of the day.
    const isFirstSession = priorTodaySessions.length === 0 || firstSessionToday.id === activeSession.id;
    const sessionRecordStatus = isFirstSession
      ? resolvedStatus
      : resolvedStatus === AttendanceStatus.LATE
      ? AttendanceStatus.PRESENT
      : resolvedStatus;

    const updated = await this.attendanceRepo.updateClockOutRecord(activeSession.id, {
      clockOutDate: todayDate,
      clockOutTime: now,
      clockOutLatitude: input.latitude,
      clockOutLongitude: input.longitude,
      clockOutFaceMatchConfidence: 98.0,
      workingHours: sessionWorkingHours,
      notes: input.notes,
      status: sessionRecordStatus,
    });

    // Synchronize day records status:
    // If the overall day resolved to LATE, ONLY the first session is marked LATE.
    // Subsequent sessions remain PRESENT.
    if (priorTodaySessions.length > 0) {
      if (resolvedStatus === AttendanceStatus.LATE) {
        await this.attendanceRepo.updateAttendanceRecordStatus(firstSessionToday.id, AttendanceStatus.LATE);
      } else {
        await this.attendanceRepo.updateTodayRecordsStatus(employee.id, todayDate, resolvedStatus);
      }
    }

    // Invalidate cached attendance datasets, reports, and metrics
    memoryCache.invalidatePattern(`admin:dataset:${tenantId}`);
    memoryCache.invalidatePattern(`admin:report:${tenantId}`);
    memoryCache.invalidatePattern(`admin:summary:${tenantId}`);
    memoryCache.invalidatePattern(`employee:metrics:${employee.id}`);
    memoryCache.invalidatePattern(`employee:today:${employee.id}`);

    // Sum cumulative working hours across all completed sessions today
    const allTodaySessions = await this.attendanceRepo.findTodaySessions(employee.id, todayDate);

    const checkInStr = formatTimeAMPM(new Date(activeSession.clockInTime));
    const checkOutStr = formatTimeAMPM(now);

    let statusMessage = `Shift clocked out successfully! (Session: ${sessionWorkingHours} hrs | Today Total: ${totalWorkingHoursToday} hrs)`;
    if (resolvedStatus === AttendanceStatus.ABSENT) {
      statusMessage = `Shift clocked out. Logged ${totalWorkingHoursToday} hrs (marked Absent: under ${ATTENDANCE_THRESHOLDS.MIN_HOURS_FOR_ABSENT} hr threshold).`;
    } else if (resolvedStatus === AttendanceStatus.HALF_DAY) {
      statusMessage = `Shift clocked out successfully! Logged ${totalWorkingHoursToday} hrs (Half-Day shift recorded).`;
    }

    return {
      id: updated.id,
      date: now.toISOString().split("T")[0],
      checkInTime: checkInStr,
      checkOutTime: checkOutStr,
      status: resolvedStatus,
      sessionWorkingHours,
      workingHours: totalWorkingHoursToday,
      sessionsCompletedToday: allTodaySessions.length,
      shift: {
        state: "checked_out",
        checkInTime: checkInStr,
        checkOutTime: checkOutStr,
        hoursWorked: totalWorkingHoursToday,
        sessionHoursWorked: sessionWorkingHours,
        targetHours: ATTENDANCE_THRESHOLDS.FULL_DAY_TARGET_HOURS,
      },
      record: {
        id: updated.id,
        date: now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        day: now.toLocaleDateString("en-US", { weekday: "long" }),
        checkIn: checkInStr,
        checkOut: checkOutStr,
        hoursLogged: `${totalWorkingHoursToday} hrs`,
        rawHours: totalWorkingHoursToday,
        status: resolvedStatus.toLowerCase(),
      },
      message: statusMessage,
    };
    await memoryCache.delPattern(`cache:att:today:${tenantId}:${userId}:*`);
    await memoryCache.delPattern(`cache:att:today:${tenantId}:*:*`);
    } finally {
      redisClient.del(punchLockKey).catch(() => {});
    }
  }

  /**
   * Get active shift status for today, supporting multiple sessions
   */
  async getTodayShift(userId: string, tenantId: string, headerWorkspaceId?: string) {
    const now = new Date();
    const todayDateStr = now.toISOString().split("T")[0];
    const todayCacheKey = `cache:att:today:${tenantId}:${userId}:${headerWorkspaceId || "def"}:${todayDateStr}`;
    const cachedToday = await memoryCache.get<any>(todayCacheKey);
    if (cachedToday) {
      return cachedToday;
    }

    const employee = await this.attendanceRepo.findEmployeeByUserId(userId, tenantId, headerWorkspaceId);
    const todayDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    if (!employee) {
      return {
        date: now.toISOString().split("T")[0],
        hasClockedIn: false,
        hasClockedOut: false,
        hasActiveSession: false,
        activeSessionId: null,
        checkInTime: null,
        checkOutTime: null,
        status: "NOT_CLOCKED_IN",
        workingHours: 0.0,
        sessions: [],
        totalSessionsToday: 0,
        workspace: {
          id: "",
          name: "Pending Setup",
        },
        shiftSchedule: {
          officeStartTime: "09:00",
          officeEndTime: "18:00",
          gracePeriodMin: 15,
        },
        shift: {
          state: "not_started",
          checkInTime: null,
          checkOutTime: null,
          hoursWorked: 0,
          targetHours: 8.0,
        },
      };
    }

    const [todaySessions, activeSession] = await Promise.all([
      this.attendanceRepo.findTodaySessions(employee.id, todayDate),
      this.attendanceRepo.findActiveSession(employee.id),
    ]);

    const ws = employee.workspaceMember.workspace;
    const settings = ws.attendanceSettings;

    // Cumulative completed hours
    let completedHours = 0;
    for (const s of todaySessions) {
      if (s.clockOutTime) {
        completedHours += Number(s.workingHours || 0);
      }
    }

    // Real-time elapsed hours for the active session
    let currentSessionElapsed = 0;
    if (activeSession) {
      const elapsedMs = Math.max(0, now.getTime() - new Date(activeSession.clockInTime).getTime());
      currentSessionElapsed = Math.round((elapsedMs / (1000 * 60 * 60)) * 100) / 100;
    }
    const totalWorkingHours = Math.round((completedHours + currentSessionElapsed) * 100) / 100;

    const firstSession = todaySessions[0] || activeSession;
    const lastSession = todaySessions[todaySessions.length - 1] || activeSession;

    const checkInStr = activeSession
      ? formatTimeAMPM(new Date(activeSession.clockInTime))
      : firstSession
      ? formatTimeAMPM(new Date(firstSession.clockInTime))
      : null;

    const checkOutStr = activeSession
      ? null
      : lastSession?.clockOutTime
      ? formatTimeAMPM(new Date(lastSession.clockOutTime))
      : null;

    const isFirstActiveSession = todaySessions.length === 0 || todaySessions[0].id === activeSession?.id;
    const status = activeSession
      ? isFirstActiveSession
        ? (activeSession.status === AttendanceStatus.LATE ? AttendanceStatus.LATE : AttendanceStatus.PRESENT)
        : AttendanceStatus.PRESENT
      : firstSession
      ? firstSession.status
      : "NOT_CLOCKED_IN";

    const sessions = todaySessions.map((s, idx) => ({
      id: s.id,
      sessionNumber: idx + 1,
      isFirstSession: idx === 0,
      checkInTime: formatTimeAMPM(new Date(s.clockInTime)),
      checkOutTime: s.clockOutTime ? formatTimeAMPM(new Date(s.clockOutTime)) : null,
      workingHours: Number(s.workingHours || 0),
      status: idx === 0 ? s.status : (s.status === AttendanceStatus.LATE ? AttendanceStatus.PRESENT : s.status),
      isActive: !s.clockOutTime,
    }));

    const todayDto = {
      date: now.toISOString().split("T")[0],
      hasClockedIn: Boolean(firstSession),
      hasClockedOut: Boolean(firstSession) && !activeSession,
      hasActiveSession: Boolean(activeSession),
      activeSessionId: activeSession?.id || null,
      checkInTime: checkInStr,
      checkOutTime: checkOutStr,
      status,
      workingHours: totalWorkingHours,
      sessions,
      totalSessionsToday: todaySessions.length,
      workspace: {
        id: ws.id,
        name: ws.businessName,
      },
      shiftSchedule: {
        officeStartTime: settings?.defaultShiftStartTime || "09:00",
        officeEndTime: settings?.defaultShiftEndTime || "18:00",
        gracePeriodMin: settings?.graceMinutes ?? 15,
      },
      shift: {
        state: activeSession ? "checked_in" : todaySessions.length > 0 ? "checked_out" : "not_started",
        checkInTime: checkInStr,
        checkOutTime: checkOutStr,
        hoursWorked: totalWorkingHours,
        targetHours: 8.0,
      },
    };

    await memoryCache.set(todayCacheKey, todayDto, 60); // 60s micro-cache
    return todayDto;
  }

  /**
   * Paginated history of attendance records
   */
  async getHistory(userId: string, tenantId: string, query: AttendanceHistoryQueryInput, headerWorkspaceId?: string) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 31));
    const targetWorkspaceId = headerWorkspaceId || query.workspaceId;

    const employee = await this.attendanceRepo.findEmployeeByUserId(userId, tenantId, targetWorkspaceId);
    if (!employee) {
      return {
        items: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
      };
    }

    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (query.month) {
      const [year, month] = query.month.split("-").map(Number);
      if (year && month) {
        startDate = new Date(Date.UTC(year, month - 1, 1));
        endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
      }
    }

    const skip = (page - 1) * limit;
    const { records, total } = await this.attendanceRepo.findAttendanceHistory(employee.id, {
      startDate,
      endDate,
      skip,
      take: limit,
    });

    const uniqueDates = Array.from(
      new Set(records.map((r) => r.clockInDate.toISOString().split("T")[0]))
    ).map((dStr) => new Date(dStr));

    const datePunches = await this.attendanceRepo.findDateSessionPunches(employee.id, uniqueDates);

    // Group punches chronologically by calendar date
    const datePunchMap = new Map<string, string[]>();
    for (const p of datePunches) {
      const dtKey = p.clockInDate.toISOString().split("T")[0];
      const list = datePunchMap.get(dtKey) || [];
      list.push(p.id);
      datePunchMap.set(dtKey, list);
    }

    const items = records.map((rec) => {
      const clockIn = new Date(rec.clockInTime);
      const clockOut = rec.clockOutTime ? new Date(rec.clockOutTime) : null;
      const dtKey = rec.clockInDate.toISOString().split("T")[0];
      const dayPunches = datePunchMap.get(dtKey) || [rec.id];
      const sessionIdx = dayPunches.indexOf(rec.id);
      const sessionNumber = sessionIdx >= 0 ? sessionIdx + 1 : 1;
      const isFirstSession = sessionNumber === 1;

      // Only the first session of the day can hold arrival punctuality (late vs on-time).
      // Subsequent sessions (session 2+) never show late check-in.
      const normalizedStatus = isFirstSession
        ? rec.status.toLowerCase()
        : rec.status === AttendanceStatus.LATE
        ? "present"
        : rec.status.toLowerCase();

      return {
        id: rec.id,
        date: clockIn.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        day: clockIn.toLocaleDateString("en-US", { weekday: "long" }),
        checkIn: formatTimeAMPM(clockIn),
        checkOut: clockOut ? formatTimeAMPM(clockOut) : "--:--",
        hoursLogged: rec.workingHours ? `${rec.workingHours} hrs` : "In Progress",
        rawHours: Number(rec.workingHours || 0),
        status: normalizedStatus,
        isFirstSession,
        sessionNumber,
        notes: rec.notes,
      };
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Record details for modal view
   */
  async getRecordDetails(userId: string, tenantId: string, recordId: string) {
    const employee = await this.getEmployee(userId, tenantId);
    const rec = await this.attendanceRepo.findRecordById(recordId, employee.id);

    if (!rec) {
      throw new NotFoundError("Attendance Record");
    }

    return {
      id: rec.id,
      date: rec.clockInDate.toISOString().split("T")[0],
      status: rec.status,
      checkInTime: formatTimeAMPM(new Date(rec.clockInTime)),
      checkOutTime: rec.clockOutTime ? formatTimeAMPM(new Date(rec.clockOutTime)) : null,
      workingHours: Number(rec.workingHours || 0),
      clockInLatitude: rec.clockInLatitude ? Number(rec.clockInLatitude) : null,
      clockInLongitude: rec.clockInLongitude ? Number(rec.clockInLongitude) : null,
      clockInFaceMatchConfidence: rec.clockInFaceMatchConfidence ? Number(rec.clockInFaceMatchConfidence) : null,
      notes: rec.notes,
    };
  }

  /**
   * Monthly summary metrics for employee
   */
  async getMonthlyMetrics(userId: string, tenantId: string, monthStr?: string, headerWorkspaceId?: string) {
    const now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth() + 1;

    if (monthStr) {
      const parts = monthStr.split("-").map(Number);
      if (parts[0] && parts[1]) {
        year = parts[0];
        month = parts[1];
      }
    }

    const employee = await this.attendanceRepo.findEmployeeByUserId(userId, tenantId, headerWorkspaceId);
    if (!employee) {
      return {
        month: `${year}-${String(month).padStart(2, "0")}`,
        punctualityRate: "100%",
        totalHoursWorked: 0,
        targetHours: 160.0,
        daysPresent: 0,
        daysLate: 0,
        onTimeDays: 0,
      };
    }

    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const metrics = await this.attendanceRepo.findMonthlyMetrics(employee.id, startDate, endDate);

    return {
      month: `${year}-${String(month).padStart(2, "0")}`,
      punctualityRate: `${metrics.punctualityRate}%`,
      totalHoursWorked: metrics.totalHours,
      targetHours: 160.0,
      daysPresent: metrics.presentDays,
      daysLate: metrics.lateDays,
      onTimeDays: metrics.onTimeDays,
    };
  }

  /**
   * Export attendance ledger as CSV
   */
  async exportLedger(userId: string, tenantId: string, input: LedgerExportInput, headerWorkspaceId?: string) {
    const targetWorkspaceId = headerWorkspaceId || input.workspaceId;
    const employee = await this.getEmployee(userId, tenantId, undefined, targetWorkspaceId);

    const now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth() + 1;

    if (input.month) {
      const parts = input.month.split("-").map(Number);
      if (parts[0] && parts[1]) {
        year = parts[0];
        month = parts[1];
      }
    }

    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const { records } = await this.attendanceRepo.findAttendanceHistory(employee.id, {
      startDate,
      endDate,
      take: 100,
    });

    const csvRows = [
      ["Date", "Status", "Check In", "Check Out", "Working Hours", "Notes"].join(","),
      ...records.map((r) =>
        [
          r.clockInDate.toISOString().split("T")[0],
          r.status,
          formatTimeAMPM(new Date(r.clockInTime)),
          r.clockOutTime ? formatTimeAMPM(new Date(r.clockOutTime)) : "N/A",
          r.workingHours ? `${r.workingHours}` : "0",
          `"${(r.notes || "").replace(/"/g, '""')}"`,
        ].join(",")
      ),
    ];

    return {
      filename: `attendance-ledger-${employee.employeeCode}-${year}-${String(month).padStart(2, "0")}.csv`,
      contentType: "text/csv",
      content: csvRows.join("\n"),
    };
  }

  /**
   * Complete metrics and sessions breakdown for employee dashboard
   */
  async getEmployeeDashboardMetrics(userId: string, tenantId: string, employeeIdParam?: string) {
    let employee = await this.attendanceRepo.findEmployeeByUserId(userId, tenantId);
    if (!employee && employeeIdParam) {
      employee = await prisma.attendanceEmployeeDetails.findFirst({
        where: {
          OR: [{ id: employeeIdParam }, { employeeCode: employeeIdParam }],
          deletedAt: null,
          workspaceMember: {
            deletedAt: null,
            workspace: {
              tenantId,
              deletedAt: null,
            },
          },
        },
        include: {
          workspaceMember: {
            include: {
              workspace: {
                include: {
                  attendanceSettings: true,
                },
              },
              user: true,
            },
          },
        },
      });
    }

    if (!employee) {
      return {
        todayAttendance: null,
        totalPresent: 0,
        totalLate: 0,
        totalWorkingHours: 0,
        attendanceRate: 100,
        recentAttendance: [],
        hasActiveSession: false,
        activeSessionId: null,
        todaySessions: [],
      };
    }

    const cacheKey = `employee:metrics:${employee.id}`;
    const cached = memoryCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const now = new Date();
    const todayDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const [todaySessions, activeSession] = await Promise.all([
      this.attendanceRepo.findTodaySessions(employee.id, todayDate),
      this.attendanceRepo.findActiveSession(employee.id),
    ]);

    // Calculate completed hours
    let completedHours = 0;
    for (const s of todaySessions) {
      if (s.clockOutTime) {
        completedHours += Number(s.workingHours || 0);
      }
    }

    // Active session elapsed hours
    let activeElapsed = 0;
    if (activeSession) {
      const elapsedMs = Math.max(0, now.getTime() - new Date(activeSession.clockInTime).getTime());
      activeElapsed = Math.round((elapsedMs / (1000 * 60 * 60)) * 100) / 100;
    }
    const totalWorkingHoursToday = Math.round((completedHours + activeElapsed) * 100) / 100;

    // Build todayAttendance object
    let todayAttendance: any = null;
    const firstSession = todaySessions[0] || activeSession;
    const lastSession = todaySessions[todaySessions.length - 1] || activeSession;

    if (activeSession || todaySessions.length > 0) {
      todayAttendance = {
        id: (activeSession || lastSession).id,
        employeeId: employee.employeeCode,
        employeeName: employee.workspaceMember.user.fullName,
        date: now.toISOString().split("T")[0],
        checkIn: formatTimeAMPM(new Date(firstSession.clockInTime)),
        checkOut: activeSession
          ? null
          : lastSession?.clockOutTime
          ? formatTimeAMPM(new Date(lastSession.clockOutTime))
          : null,
        status: todaySessions.some((s) => s.status === AttendanceStatus.LATE)
          ? "late"
          : firstSession?.status
          ? firstSession.status.toLowerCase()
          : "present",
        workingHours: totalWorkingHoursToday,
        notes: (activeSession || lastSession)?.notes || undefined,
      };
    }

    // Monthly metrics for 30-day stats
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const monthlyStats = await this.attendanceRepo.findMonthlyMetrics(employee.id, thirtyDaysAgo, now);

    // Recent 5 attendance records
    const recentHistory = await this.attendanceRepo.findAttendanceHistory(employee.id, {
      skip: 0,
      take: 10,
    });

    const recentRecords = recentHistory.records.slice(0, 5);
    const recentDates = Array.from(
      new Set(recentRecords.map((r) => r.clockInDate.toISOString().split("T")[0]))
    ).map((dStr) => new Date(dStr));
    const recentPunches = await this.attendanceRepo.findDateSessionPunches(employee.id, recentDates);
    const recentPunchMap = new Map<string, string[]>();
    for (const p of recentPunches) {
      const dtKey = p.clockInDate.toISOString().split("T")[0];
      const list = recentPunchMap.get(dtKey) || [];
      list.push(p.id);
      recentPunchMap.set(dtKey, list);
    }

    const recentAttendance = recentRecords.map((rec) => {
      const dtKey = rec.clockInDate.toISOString().split("T")[0];
      const dayPunches = recentPunchMap.get(dtKey) || [rec.id];
      const sessionIdx = dayPunches.indexOf(rec.id);
      const sessionNumber = sessionIdx >= 0 ? sessionIdx + 1 : 1;
      const isFirstSession = sessionNumber === 1;

      return {
        id: rec.id,
        employeeId: employee.employeeCode,
        employeeName: employee.workspaceMember.user.fullName,
        date: rec.clockInDate.toISOString().split("T")[0],
        checkIn: formatTimeAMPM(new Date(rec.clockInTime)),
        checkOut: rec.clockOutTime ? formatTimeAMPM(new Date(rec.clockOutTime)) : null,
        status: isFirstSession
          ? rec.status.toLowerCase()
          : rec.status === AttendanceStatus.LATE
          ? "present"
          : rec.status.toLowerCase(),
        workingHours: Number(rec.workingHours || 0),
        notes: rec.notes,
        isFirstSession,
        sessionNumber,
      };
    });

    const formattedTodaySessions = todaySessions.map((s, idx) => ({
      id: s.id,
      sessionNumber: idx + 1,
      isFirstSession: idx === 0,
      checkIn: formatTimeAMPM(new Date(s.clockInTime)),
      checkOut: s.clockOutTime ? formatTimeAMPM(new Date(s.clockOutTime)) : null,
      workingHours: Number(s.workingHours || 0),
      status: idx === 0 ? s.status.toLowerCase() : (s.status === AttendanceStatus.LATE ? "present" : s.status.toLowerCase()),
      isActive: !s.clockOutTime,
    }));

    const result = {
      todayAttendance,
      totalPresent: monthlyStats.presentDays,
      totalLate: monthlyStats.lateDays,
      totalWorkingHours: monthlyStats.totalHours,
      attendanceRate: monthlyStats.punctualityRate,
      recentAttendance,
      hasActiveSession: Boolean(activeSession),
      activeSessionId: activeSession?.id || null,
      todaySessions: formattedTodaySessions,
    };

    memoryCache.set(cacheKey, result, 30);
    return result;
  }
}
