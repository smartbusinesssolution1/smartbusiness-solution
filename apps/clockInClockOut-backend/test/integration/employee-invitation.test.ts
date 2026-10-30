import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@smartbusiness/database";
import { AdminEmployeeRepository } from "../../src/modules/admin/employee/admin-employee.repository.js";

// Adding an employee no longer makes up a password: the account is created WITHOUT one, and
// the employee chooses their own through the invitation link (platform-api sends it). An
// existing SmartBusiness user who is added keeps their own password.
// Runs against clock_in_test (test/setup/test-env.ts), migrated with the production migrations.

const repo = new AdminEmployeeRepository();
const suffix = randomUUID().slice(0, 8);
let tenantId: string;
let workspaceId: string;
const createdUserIds: string[] = [];

const input = (email: string) =>
  ({
    name: "Ravi Kumar",
    email,
    phone: "555-0100",
    designation: "Crew lead",
    department: "Operations",
    role: "employee",
    status: "active",
    shiftType: "general",
    weeklySchedule: undefined,
  }) as never;

beforeAll(async () => {
  tenantId = (await prisma.tenant.create({ data: { name: `Test Co ${suffix}`, billingEmail: `billing-${suffix}@example.test` } })).id;
  workspaceId = (
    await prisma.workspace.create({ data: { tenantId, businessName: "Yard", addressLine1: "1 Main St", city: "Austin", state: "TX", zipCode: "78701" } })
  ).id;
});

afterAll(async () => {
  await prisma.attendanceEmployeeDetails.deleteMany({ where: { workspaceMember: { workspaceId } } });
  await prisma.workspaceMember.deleteMany({ where: { workspaceId } });
  await prisma.tenantMember.deleteMany({ where: { tenantId } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.workspace.deleteMany({ where: { id: workspaceId } });
  await prisma.tenant.deleteMany({ where: { id: tenantId } });
});

describe("adding an employee", () => {
  it("creates the account WITHOUT a password (they choose it through the invitation)", async () => {
    const email = `new-${suffix}@example.test`;
    const employee = await repo.createEmployeeTransaction({
      tenantId, workspaceId, input: input(email), employeeCode: `EMP-${suffix}-1`, biometricPhotoUrl: "https://example.test/p.jpg",
    });
    createdUserIds.push(employee.workspaceMember.user.id);

    expect(employee.workspaceMember.user.passwordHash).toBeNull();
    // What the service needs to queue the invitation.
    expect(employee.workspaceMember.workspaceId).toBe(workspaceId);
    expect(employee.workspaceMember.user.email).toBe(email);
  });

  it("keeps the password of someone who already has an account", async () => {
    const email = `existing-${suffix}@example.test`;
    const existing = await prisma.user.create({ data: { email, fullName: "Already Here", passwordHash: "their-own-argon2-hash" } });
    createdUserIds.push(existing.id);

    const employee = await repo.createEmployeeTransaction({
      tenantId, workspaceId, input: input(email), employeeCode: `EMP-${suffix}-2`, biometricPhotoUrl: "https://example.test/p.jpg",
    });

    expect(employee.workspaceMember.user.id).toBe(existing.id);
    expect(employee.workspaceMember.user.passwordHash).toBe("their-own-argon2-hash");
  });
});
