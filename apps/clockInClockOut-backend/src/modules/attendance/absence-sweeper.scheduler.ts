import cron, { ScheduledTask } from "node-cron";
import { absenceSweeperService } from "./absence-sweeper.service.js";
import { logger } from "../../shared/services/logger.js";

let dailyAbsenceTask: ScheduledTask | null = null;

/**
 * Initializes the automated daily Absence Sweeper cron:
 * Runs daily at 00:05 AM (after midnight auto-clock-out sweep completes)
 * to permanently create ABSENT records for all employees who did not clock in.
 */
export function initAbsenceSweeperScheduler(): void {
  if (dailyAbsenceTask) {
    logger.warn("AbsenceSweeperScheduler already initialized, skipping duplicate start.");
    return;
  }

  // Daily Cron: 00:05 AM every night
  dailyAbsenceTask = cron.schedule("5 0 * * *", async () => {
    try {
      logger.info("[CRON] Starting 00:05 AM Daily Absence Sweep...");
      const res = await absenceSweeperService.sweepAbsences();
      logger.info(
        {
          date: res.date,
          created: res.absencesCreated,
          total: res.totalEmployeesChecked,
          skippedAlreadyRecorded: res.skippedAlreadyRecorded,
          skippedOnLeave: res.skippedOnLeave,
          skippedNonWorkDay: res.skippedNonWorkDay,
        },
        "[CRON] Daily Absence Sweep completed successfully"
      );
    } catch (err: any) {
      logger.error({ err: err?.message || err }, "[CRON] Error during Daily Absence Sweep");
    }
  });

  // Run backfill sweep asynchronously for past 30 days to populate missing past dates immediately
  setTimeout(async () => {
    try {
      logger.info("[INIT] Running retroactive absence backfill for the last 30 days...");
      const res = await absenceSweeperService.backfillMissingPastAbsences(30);
      logger.info(
        { daysProcessed: res.daysProcessed, created: res.totalAbsencesCreated },
        "[INIT] Retroactive absence backfill complete"
      );
    } catch (err: any) {
      logger.error({ err: err?.message || err }, "[INIT] Error during retroactive absence backfill");
    }
  }, 2000);
}

export function stopAbsenceSweeperScheduler(): void {
  if (dailyAbsenceTask) {
    dailyAbsenceTask.stop();
    dailyAbsenceTask = null;
    logger.info("AbsenceSweeperScheduler cron job stopped.");
  }
}
