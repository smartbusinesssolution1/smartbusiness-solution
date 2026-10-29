import cron, { ScheduledTask } from "node-cron";
import { autoClockOutService } from "./auto-clock-out.service.js";
import { logger } from "../../shared/services/logger.js";

let midnightTask: ScheduledTask | null = null;
let middayTask: ScheduledTask | null = null;

/**
 * Initializes the dual cron jobs for automated clock-out:
 * 1. 12:00 AM Midnight (00:00) -> Sweeps and auto-closes day-shift forgotten punches
 * 2. 12:00 PM Midday   (12:00) -> Sweeps and auto-closes night-shift forgotten punches
 */
export function initAutoClockOutScheduler(): void {
  // Prevent duplicate scheduler registration
  if (midnightTask || middayTask) {
    logger.warn("AutoClockOutScheduler already initialized, skipping duplicate start.");
    return;
  }

  // 1. Midnight Cron: Run at 00:00 every day (12:00 AM)
  midnightTask = cron.schedule("0 0 * * *", async () => {
    try {
      logger.info("[CRON] Starting 12:00 AM Midnight Day-Shift Auto-Clock-Out Sweep...");
      const res = await autoClockOutService.sweepDayShift();
      logger.info(
        {
          type: res.type,
          candidates: res.candidatesFound,
          closed: res.autoClosedCount,
          skipped: res.skippedCount,
        },
        "[CRON] 12:00 AM Midnight Sweep completed successfully"
      );
    } catch (err: any) {
      logger.error({ err: err?.message || err }, "[CRON] Error during Midnight Auto-Clock-Out Sweep");
    }
  });

  // 2. Midday Cron: Run at 12:00 every day (12:00 PM)
  middayTask = cron.schedule("0 12 * * *", async () => {
    try {
      logger.info("[CRON] Starting 12:00 PM Midday Night-Shift Auto-Clock-Out Sweep...");
      const res = await autoClockOutService.sweepNightShift();
      logger.info(
        {
          type: res.type,
          candidates: res.candidatesFound,
          closed: res.autoClosedCount,
          skipped: res.skippedCount,
        },
        "[CRON] 12:00 PM Midday Sweep completed successfully"
      );
    } catch (err: any) {
      logger.error({ err: err?.message || err }, "[CRON] Error during Midday Auto-Clock-Out Sweep");
    }
  });

  logger.info("AutoClockOutScheduler successfully initialized: [0 0 * * * (Midnight)] & [0 12 * * * (Midday)]");
}

/**
 * Gracefully stops the cron jobs on server shutdown
 */
export function stopAutoClockOutScheduler(): void {
  if (midnightTask) {
    midnightTask.stop();
    midnightTask = null;
  }
  if (middayTask) {
    middayTask.stop();
    middayTask = null;
  }
  logger.info("AutoClockOutScheduler stopped.");
}
