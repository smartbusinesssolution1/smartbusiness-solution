import cron, { ScheduledTask } from "node-cron";
import { leaveRolloverService } from "./leave-rollover.service.js";
import { logger } from "../../shared/services/logger.js";

let yearEndTask: ScheduledTask | null = null;
let newYearTask: ScheduledTask | null = null;

/**
 * Initializes the automated annual leave rollover schedulers:
 * 1. Dec 31st 11:59 PM (23:59) -> Executes statutory carryover limits before year closes
 * 2. Jan 1st 12:01 AM (00:01)  -> Safety catch-up & new year frontload allocations
 */
export function initLeaveRolloverScheduler(): void {
  if (yearEndTask || newYearTask) {
    logger.warn("LeaveRolloverScheduler already initialized, skipping duplicate start.");
    return;
  }

  // 1. Year-End Cron: 11:59 PM on December 31st (59 23 31 12 *)
  yearEndTask = cron.schedule("59 23 31 12 *", async () => {
    try {
      logger.info("[CRON] Starting Dec 31st 11:59 PM Year-End Leave Rollover Sweep...");
      const result = await leaveRolloverService.sweepAllWorkspacesRollover();
      logger.info(
        {
          fromYear: result.fromYear,
          toYear: result.toYear,
          workspaces: result.workspacesProcessed,
          employees: result.totalEmployeesUpdated,
          hoursRolledOver: result.totalHoursRolledOver,
        },
        "[CRON] Dec 31st Year-End Leave Rollover Sweep completed successfully"
      );
    } catch (err: any) {
      logger.error(
        { err: err?.message || err },
        "[CRON] Error during Dec 31st Year-End Leave Rollover Sweep"
      );
    }
  });

  // 2. New-Year Cron: 12:01 AM on January 1st (1 0 1 1 *)
  newYearTask = cron.schedule("1 0 1 1 *", async () => {
    try {
      logger.info("[CRON] Starting Jan 1st 12:01 AM New-Year Leave Rollover Catch-Up Sweep...");
      const result = await leaveRolloverService.sweepAllWorkspacesRollover();
      logger.info(
        {
          fromYear: result.fromYear,
          toYear: result.toYear,
          workspaces: result.workspacesProcessed,
          employees: result.totalEmployeesUpdated,
          hoursRolledOver: result.totalHoursRolledOver,
        },
        "[CRON] Jan 1st New-Year Leave Rollover Catch-Up Sweep completed successfully"
      );
    } catch (err: any) {
      logger.error(
        { err: err?.message || err },
        "[CRON] Error during Jan 1st New-Year Leave Rollover Sweep"
      );
    }
  });

  logger.info(
    "LeaveRolloverScheduler successfully initialized: [59 23 31 12 * (Dec 31 23:59)] & [1 0 1 1 * (Jan 1 00:01)]"
  );
}

/**
 * Gracefully stops the leave rollover cron jobs on server shutdown
 */
export function stopLeaveRolloverScheduler(): void {
  if (yearEndTask) {
    yearEndTask.stop();
    yearEndTask = null;
  }
  if (newYearTask) {
    newYearTask.stop();
    newYearTask = null;
  }
  logger.info("LeaveRolloverScheduler stopped.");
}
