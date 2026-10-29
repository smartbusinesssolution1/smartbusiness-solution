import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  AdminEmployeeService,
  buildGeneralWeeklySchedule,
} from "./admin-employee.service.js";
import { AdminEmployeeRepository } from "./admin-employee.repository.js";
import { ForbiddenError, ValidationError } from "../../../shared/errors/index.js";

vi.mock("../../../shared/services/cache.service.js", () => ({
  memoryCache: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(true),
    delPattern: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock("../../../shared/services/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../../shared/services/storage.service.js", () => ({
  storageService: {
    uploadAvatar: vi.fn().mockResolvedValue({ url: "https://s3.amazonaws.com/avatar.jpg" }),
  },
}));

describe("Main Business Logic: Admin Employee Provisioning", () => {
  let mockRepo: Partial<AdminEmployeeRepository>;
  let service: AdminEmployeeService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo = {
      getFirstWorkspace: vi.fn().mockResolvedValue({ id: "ws_01", businessName: "Main Office" }),
      findWorkspace: vi.fn().mockResolvedValue({ id: "ws_01", businessName: "Main Office" }),
      findUserWithTenantWorkspaces: vi.fn().mockResolvedValue(null),
    };
    service = new AdminEmployeeService(mockRepo as AdminEmployeeRepository);
  });

  describe("buildGeneralWeeklySchedule", () => {
    it("creates standard 7-day schedule with Mon-Fri work and Sat-Sun off", () => {
      const schedule = buildGeneralWeeklySchedule("09:00", "18:00");

      expect(schedule).toHaveLength(7);

      const workDays = schedule.filter((s) => s.isWorkDay);
      const offDays = schedule.filter((s) => !s.isWorkDay);

      expect(workDays.map((d) => d.day)).toEqual(["MON", "TUE", "WED", "THU", "FRI"]);
      expect(offDays.map((d) => d.day)).toEqual(["SAT", "SUN"]);
      expect(workDays.every((d) => d.startTime === "09:00" && d.endTime === "18:00")).toBe(true);
    });
  });

  describe("createEmployee Role Permissions", () => {
    it("forbids non-owners from creating administrator accounts", async () => {
      await expect(
        service.createEmployee(
          "ten_01",
          {
            name: "New Admin",
            email: "admin@acme.com",
            phone: "+1 555-0199",
            designation: "Manager",
            department: "Operations",
            role: "admin",
            shiftType: "general",
            status: "active",
          },
          undefined,
          "ADMIN" // Caller is only ADMIN, not OWNER
        )
      ).rejects.toThrowError(ForbiddenError);
    });

    it("requires mandatory corporate portrait for biometric facial enrollment", async () => {
      await expect(
        service.createEmployee(
          "ten_01",
          {
            name: "John Staff",
            email: "john@acme.com",
            phone: "+1 555-0199",
            designation: "Support",
            department: "Support",
            role: "employee",
            shiftType: "general",
            status: "active",
          },
          undefined, // No avatar file
          "OWNER"
        )
      ).rejects.toThrowError(ValidationError);
    });
  });

  describe("checkEmailAvailability", () => {
    it("reports email as available when user does not exist in tenant", async () => {
      mockRepo.findUserWithTenantWorkspaces = vi.fn().mockResolvedValue(null);

      const result = await service.checkEmailAvailability("ten_01", "free@acme.com");

      expect(result.exists).toBe(false);
    });

    it("reports EXISTS_CURRENT_WORKSPACE when email is already registered in the active workspace", async () => {
      mockRepo.findUserWithTenantWorkspaces = vi.fn().mockResolvedValue({
        id: "usr_existing",
        fullName: "Existing Employee",
        email: "existing@acme.com",
        tenantMembers: [{ tenantId: "ten_01" }],
        workspaceMembers: [
          {
            workspace: { id: "ws_austin", businessName: "Austin Office" },
            employeeProfiles: [{ employeeCode: "EMP-001", designation: "Dev" }],
          },
        ],
      });

      const result = await service.checkEmailAvailability(
        "ten_01",
        "existing@acme.com",
        "ws_austin"
      );

      expect(result.exists).toBe(true);
      expect(result.status).toBe("EXISTS_CURRENT_WORKSPACE");
      expect(result.message).toContain("already exists in this workspace");
    });
  });
});
