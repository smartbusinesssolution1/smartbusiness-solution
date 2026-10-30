import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

// Adding an employee no longer makes up a password: the account is created WITHOUT one, and
// the employee chooses their own through the invitation link (platform-api sends it). An
// existing SmartBusiness user who is added keeps their own password.
//
// Runs against a disposable local database, never a real one:
//   TEST_DATABASE_URL=postgresql://test:test@127.0.0.1:54329/platform_api_test pnpm test
// (the database from apps/check-printing-backend/docker-compose.test.yml, `test:db:up`).

const url = process.env.TEST_DATABASE_URL ?? 'postgresql://test:test@127.0.0.1:54329/platform_api_test';
const parsed = new URL(url);
if (!['127.0.0.1', 'localhost'].includes(parsed.hostname) || !parsed.pathname.toLowerCase().includes('test')) {
  throw new Error(`Refusing to run against ${parsed.hostname}${parsed.pathname}: use a local database whose name contains "test".`);
}
process.env.DATABASE_URL = url;

const { prisma } = await import('@smartbusiness/database');
const { AdminEmployeeRepository } = await import('../src/modules/admin/employee/admin-employee.repository.js');

const repo = new AdminEmployeeRepository();
const suffix = randomUUID().slice(0, 8);
let tenantId: string;
let workspaceId: string;
const createdUserIds: string[] = [];

const input = (email: string) =>
  ({
    name: 'Ravi Kumar',
    email,
    phone: '555-0100',
    designation: 'Crew lead',
    department: 'Operations',
    role: 'employee',
    status: 'active',
    shiftType: 'general',
    weeklySchedule: undefined,
  }) as never;

before(async () => {
  tenantId = (await prisma.tenant.create({ data: { name: `Test Co ${suffix}`, billingEmail: `billing-${suffix}@example.test` } })).id;
  workspaceId = (
    await prisma.workspace.create({ data: { tenantId, businessName: 'Yard', addressLine1: '1 Main St', city: 'Austin', state: 'TX', zipCode: '78701' } })
  ).id;
});

after(async () => {
  await prisma.attendanceEmployeeDetails.deleteMany({ where: { workspaceMember: { workspaceId } } });
  await prisma.workspaceMember.deleteMany({ where: { workspaceId } });
  await prisma.tenantMember.deleteMany({ where: { tenantId } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.workspace.deleteMany({ where: { id: workspaceId } });
  await prisma.tenant.deleteMany({ where: { id: tenantId } });
  await prisma.$disconnect();
});

describe('adding an employee', () => {
  it('creates the account WITHOUT a password (they choose it through the invitation)', async () => {
    const email = `new-${suffix}@example.test`;
    const employee = await repo.createEmployeeTransaction({
      tenantId, workspaceId, input: input(email), employeeCode: `EMP-${suffix}-1`, biometricPhotoUrl: 'https://example.test/p.jpg',
    });
    createdUserIds.push(employee.workspaceMember.user.id);

    assert.equal(employee.workspaceMember.user.passwordHash, null);
    // What the service needs to queue the invitation.
    assert.equal(employee.workspaceMember.workspaceId, workspaceId);
    assert.equal(employee.workspaceMember.user.email, email);
  });

  it('keeps the password of someone who already has an account', async () => {
    const email = `existing-${suffix}@example.test`;
    const existing = await prisma.user.create({ data: { email, fullName: 'Already Here', passwordHash: 'their-own-argon2-hash' } });
    createdUserIds.push(existing.id);

    const employee = await repo.createEmployeeTransaction({
      tenantId, workspaceId, input: input(email), employeeCode: `EMP-${suffix}-2`, biometricPhotoUrl: 'https://example.test/p.jpg',
    });

    assert.equal(employee.workspaceMember.user.id, existing.id);
    assert.equal(employee.workspaceMember.user.passwordHash, 'their-own-argon2-hash');
  });
});
