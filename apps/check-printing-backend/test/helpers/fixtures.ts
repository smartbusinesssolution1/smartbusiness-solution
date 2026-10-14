import { randomUUID } from "crypto";
import jwt from "jsonwebtoken";
import { prisma } from "@smartbusiness/database";
import { PERMISSIONS, PRODUCT_SLUG, ROLES } from "../../src/shared/constants/rbac.js";
import { encryptionService } from "../../src/shared/services/encryption.service.js";
import { TEST_JWT_SECRET } from "../setup/test-env.js";

// ═══════════════════════════════════════════════════════════════
// TEST WORLD
//
// One tenant with one workspace and a member for every role, built
// through Prisma so each test starts from a known state. Role
// permissions mirror packages/database/prisma/seed.ts.
// ═══════════════════════════════════════════════════════════════

const ALL_PERMISSIONS = Object.values(PERMISSIONS);

const ROLE_PERMISSIONS: Record<string, string[]> = {
  [ROLES.ADMIN]: ALL_PERMISSIONS,
  [ROLES.EDITOR]: [PERMISSIONS.CHECK_CREATE, PERMISSIONS.CHECK_VIEW, PERMISSIONS.PAYEE_WRITE, PERMISSIONS.REPORT_VIEW],
  [ROLES.PRINTER]: [PERMISSIONS.CHECK_PRINT, PERMISSIONS.CHECK_VIEW],
  [ROLES.APPROVER]: [PERMISSIONS.CHECK_APPROVE, PERMISSIONS.CHECK_VIEW],
  [ROLES.VIEWER]: [PERMISSIONS.CHECK_VIEW, PERMISSIONS.REPORT_VIEW],
};

export interface TestUser {
  id: string;
  email: string;
  tenantId: string;
}

export interface TestWorld {
  tenantId: string;
  workspaceId: string;
  bankAccountId: string;
  admin: TestUser;
  editor: TestUser;
  approver1: TestUser;
  approver2: TestUser;
  printer: TestUser;
  viewer: TestUser;
}

// The product, permissions and roles are global; several worlds in one test share them.
async function seedRbac(): Promise<{ productId: string; roleIds: Map<string, string> }> {
  const existing = await prisma.product.findUnique({
    where: { slug: PRODUCT_SLUG },
    include: { roles: { select: { id: true, slug: true } } },
  });
  if (existing) {
    return { productId: existing.id, roleIds: new Map(existing.roles.map((r) => [r.slug, r.id])) };
  }

  const product = await prisma.product.create({
    data: { slug: PRODUCT_SLUG, name: "Check Printing", isActive: true },
  });

  const permissionIds = new Map<string, string>();
  for (const action of ALL_PERMISSIONS) {
    const permission = await prisma.permission.create({
      data: { productId: product.id, action, description: action },
    });
    permissionIds.set(action, permission.id);
  }

  const roleIds = new Map<string, string>();
  for (const [slug, actions] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.create({
      data: { productId: product.id, slug, name: slug, isSystem: true },
    });
    roleIds.set(slug, role.id);
    await prisma.rolePermission.createMany({
      data: actions.map((action) => ({ roleId: role.id, permissionId: permissionIds.get(action)! })),
    });
  }

  return { productId: product.id, roleIds };
}

export async function createWorld(options: { approvalEnabled?: boolean } = {}): Promise<TestWorld> {
  const { productId, roleIds } = await seedRbac();
  const suffix = randomUUID().slice(0, 8);

  const tenant = await prisma.tenant.create({
    data: { name: `Test Tenant ${suffix}`, billingEmail: `billing-${suffix}@example.test`, status: "ACTIVE" },
  });
  await prisma.productSubscription.create({
    data: { tenantId: tenant.id, productId, plan: "PROFESSIONAL", status: "ACTIVE" },
  });

  const workspace = await prisma.workspace.create({
    data: {
      tenantId: tenant.id,
      businessName: "Green Acres Landscaping LLC",
      addressLine1: "456 Oak Avenue",
      city: "Austin",
      state: "TX",
      zipCode: "78701",
    },
  });
  await prisma.checkPrintingSettings.create({
    data: {
      workspaceId: workspace.id,
      approvalEnabled: options.approvalEnabled ?? false,
      maxCheckAmount: 50000,
      maxPastDays: 30,
      maxFutureDays: 90,
    },
  });

  const makeMember = async (name: string, roles: string[]): Promise<TestUser> => {
    const email = `${name}-${suffix}@example.test`;
    const user = await prisma.user.create({
      data: { fullName: name, email, passwordHash: "not-a-real-hash", isActive: true },
    });
    await prisma.tenantMember.create({
      data: { tenantId: tenant.id, userId: user.id, role: name === "admin" ? "OWNER" : "MEMBER" },
    });
    const member = await prisma.workspaceMember.create({
      data: { workspaceId: workspace.id, userId: user.id },
    });
    await prisma.workspaceMemberRole.createMany({
      data: roles.map((slug) => ({
        workspaceMemberId: member.id,
        roleId: roleIds.get(slug)!,
        assignedById: user.id,
      })),
    });
    return { id: user.id, email, tenantId: tenant.id };
  };

  const admin = await makeMember("admin", [ROLES.ADMIN]);
  const editor = await makeMember("editor", [ROLES.EDITOR]);
  const approver1 = await makeMember("approver1", [ROLES.APPROVER]);
  const approver2 = await makeMember("approver2", [ROLES.APPROVER]);
  const printer = await makeMember("printer", [ROLES.PRINTER]);
  const viewer = await makeMember("viewer", [ROLES.VIEWER]);

  const bankAccountId = await createBankAccount(workspace.id);

  return {
    tenantId: tenant.id,
    workspaceId: workspace.id,
    bankAccountId,
    admin,
    editor,
    approver1,
    approver2,
    printer,
    viewer,
  };
}

export async function createBankAccount(
  workspaceId: string,
  options: { isActive?: boolean; nextCheckNumber?: number } = {},
): Promise<string> {
  const routingNumber = "111000025";
  const accountNumber = "987654321012";
  const account = await prisma.bankAccount.create({
    data: {
      workspaceId,
      bankName: "JPMorgan Chase",
      routingNumberEncrypted: encryptionService.encrypt(routingNumber),
      routingNumberLast4: routingNumber.slice(-4),
      accountNumberEncrypted: encryptionService.encrypt(accountNumber),
      accountNumberLast4: accountNumber.slice(-4),
      accountType: "CHECKING",
      nextCheckNumber: options.nextCheckNumber ?? 1001,
      checkNumberPadding: 6,
      encryptionKeyVersion: 1,
      isActive: options.isActive ?? true,
    },
  });
  return account.id;
}

export async function createApprovalRule(
  world: TestWorld,
  options: {
    requiredApprovals?: number;
    minAmount?: number;
    maxAmount?: number | null;
    approvers?: TestUser[];
    allowSelfApproval?: boolean;
  } = {},
): Promise<string> {
  const rule = await prisma.approvalWorkflowRule.create({
    data: {
      workspaceId: world.workspaceId,
      priority: 1,
      minAmount: options.minAmount ?? 0,
      maxAmount: options.maxAmount ?? null,
      requiredApprovals: options.requiredApprovals ?? 1,
      allowSelfApproval: options.allowSelfApproval ?? false,
      createdById: world.admin.id,
    },
  });
  if (options.approvers?.length) {
    await prisma.approvalWorkflowApprover.createMany({
      data: options.approvers.map((u) => ({ ruleId: rule.id, userId: u.id })),
    });
  }
  return rule.id;
}

/** A verified A4 printer profile, set as the workspace default. */
export async function createPrinterProfile(world: TestWorld): Promise<string> {
  const profile = await prisma.calibrationProfile.create({
    data: {
      workspaceId: world.workspaceId,
      calibratedById: world.admin.id,
      profileName: "Office HP - A4",
      paperSize: "A4",
      stockType: "PLAIN_PAPER",
      horizontalOffsetPts: 0,
      verticalOffsetPts: 0,
      refVersion: 2,
      isDefault: true,
    },
  });
  return profile.id;
}

/** Request headers that authenticate as `user` in its tenant. */
export function authHeaders(user: TestUser): Record<string, string> {
  const token = jwt.sign({ userId: user.id, email: user.email }, TEST_JWT_SECRET, { expiresIn: "15m" });
  return {
    Cookie: `access_token=${token}`,
    "X-Tenant-Id": user.tenantId,
  };
}

/** Today as YYYY-MM-DD in UTC, a check date that always passes the date-range rule. */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
