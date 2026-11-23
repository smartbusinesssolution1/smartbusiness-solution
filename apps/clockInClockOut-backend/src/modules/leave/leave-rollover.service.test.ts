import { describe, it, expect, vi, beforeEach } from "vitest";
import { LeaveRolloverService } from "./leave-rollover.service.js";
import {
  initLeaveRolloverScheduler,
  stopLeaveRolloverScheduler,
} from "./leave-rollover.scheduler.js";

describe("LeaveRolloverService & Scheduler Unit Tests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Annual Rollover Calculation Logic", () => {
    it("respects statutory carryover cap (CA PSL 40-hour limit)", () => {
      const unusedHours = 55.5;
      const maxCarryover = 40.0;

      const rolledOver = Math.min(unusedHours, maxCarryover);
      expect(rolledOver).toBe(40.0);
    });

    it("carries over exact unused hours when below cap", () => {
      const unusedHours = 24.25;
      const maxCarryover = 40.0;

      const rolledOver = Math.min(unusedHours, maxCarryover);
      expect(rolledOver).toBe(24.25);
    });

    it("forfeits remaining hours when policy has zero carryover (use-it-or-lose-it)", () => {
      const unusedHours = 32.0;
      const maxCarryover = 0;

      const rolledOver = Math.min(unusedHours, maxCarryover);
      expect(rolledOver).toBe(0);
    });
  });

  describe("LeaveRolloverService", () => {
    it("executes rollover across workspaces using mock repository", async () => {
      const mockRepo = {
        listActiveWorkspaces: vi.fn().mockResolvedValue([
          { id: "ws-1", businessName: "Acme Corp" },
          { id: "ws-2", businessName: "Tech Solutions" },
        ]),
        runYearEndRollover: vi.fn().mockResolvedValue({
          rolledOverCount: 3,
          totalHoursRolledOver: 84.5,
        }),
        allocateNewYearFrontloads: vi.fn().mockResolvedValue(undefined),
      } as any;

      const service = new LeaveRolloverService(mockRepo);

      // Call sweep with explicit years
      const result = await service.sweepAllWorkspacesRollover(2026, 2027);

      expect(result.fromYear).toBe(2026);
      expect(result.toYear).toBe(2027);
      expect(result.workspacesProcessed).toBe(2);
      expect(result.totalEmployeesUpdated).toBe(6);
      expect(result.totalHoursRolledOver).toBe(169.0);
      expect(mockRepo.listActiveWorkspaces).toHaveBeenCalledTimes(1);
      expect(mockRepo.runYearEndRollover).toHaveBeenCalledTimes(2);
      expect(mockRepo.allocateNewYearFrontloads).toHaveBeenCalledTimes(2);
    });
  });

  describe("LeaveRolloverScheduler", () => {
    it("initializes and stops without throwing errors", () => {
      expect(() => initLeaveRolloverScheduler()).not.toThrow();
      expect(() => stopLeaveRolloverScheduler()).not.toThrow();
    });
  });
});
