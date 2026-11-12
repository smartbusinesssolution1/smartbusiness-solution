import { logger } from "../../shared/services/logger.js";
import { LeaveRepository } from "./leave.repository.js";

export interface RolloverSweepResult {
  fromYear: number;
  toYear: number;
  workspacesProcessed: number;
  totalEmployeesUpdated: number;
  totalHoursRolledOver: number;
  details: Array<{
    workspaceId: string;
    workspaceName: string;
    rolledOverCount: number;
    hoursRolledOver: number;
  }>;
}

export class LeaveRolloverService {
  constructor(private repo: LeaveRepository = new LeaveRepository()) {}

  /**
   * Sweeps all active workspaces and executes annual statutory carryover from fromYear to toYear.
   * If years are not specified, defaults to fromYear = (currentYear - 1) and toYear = currentYear (for Jan 1 run)
   * or currentYear -> currentYear + 1 (for Dec 31 run).
   */
  async sweepAllWorkspacesRollover(
    targetFromYear?: number,
    targetToYear?: number
  ): Promise<RolloverSweepResult> {
    const now = new Date();
    const currentYear = now.getFullYear();

    // If running in December, default fromYear = currentYear, toYear = currentYear + 1
    // If running in January, default fromYear = currentYear - 1, toYear = currentYear
    let fromYear = targetFromYear;
    let toYear = targetToYear;

    if (!fromYear || !toYear) {
      if (now.getMonth() === 11) {
        // December
        fromYear = fromYear || currentYear;
        toYear = toYear || currentYear + 1;
      } else {
        // Any other month (e.g. Jan 1)
        fromYear = fromYear || currentYear - 1;
        toYear = toYear || currentYear;
      }
    }

    logger.info(
      { fromYear, toYear },
      "[LeaveRolloverService] Starting annual statutory carryover sweep across all active workspaces..."
    );

    // Fetch active workspaces via repository
    const workspaces = await this.repo.listActiveWorkspaces();

    const result: RolloverSweepResult = {
      fromYear,
      toYear,
      workspacesProcessed: 0,
      totalEmployeesUpdated: 0,
      totalHoursRolledOver: 0,
      details: [],
    };

    for (const ws of workspaces) {
      try {
        const wsResult = await this.repo.runYearEndRollover(ws.id, fromYear, toYear);

        // Also ensure FRONTLOAD policies are allocated for the new year
        await this.repo.allocateNewYearFrontloads(ws.id, toYear);

        result.workspacesProcessed += 1;
        result.totalEmployeesUpdated += wsResult.rolledOverCount;
        result.totalHoursRolledOver += wsResult.totalHoursRolledOver;

        result.details.push({
          workspaceId: ws.id,
          workspaceName: ws.businessName,
          rolledOverCount: wsResult.rolledOverCount,
          hoursRolledOver: wsResult.totalHoursRolledOver,
        });

        logger.info(
          {
            workspaceId: ws.id,
            workspaceName: ws.businessName,
            rolledOverCount: wsResult.rolledOverCount,
            hoursRolledOver: wsResult.totalHoursRolledOver,
          },
          "[LeaveRolloverService] Completed workspace annual rollover"
        );
      } catch (err: any) {
        logger.error(
          { workspaceId: ws.id, err: err?.message || err },
          "[LeaveRolloverService] Failed to execute rollover for workspace"
        );
      }
    }

    logger.info(
      {
        fromYear,
        toYear,
        workspacesProcessed: result.workspacesProcessed,
        totalEmployeesUpdated: result.totalEmployeesUpdated,
        totalHoursRolledOver: result.totalHoursRolledOver,
      },
      "[LeaveRolloverService] Annual statutory carryover sweep completed successfully"
    );

    return result;
  }
}

export const leaveRolloverService = new LeaveRolloverService();
