import "dotenv/config";
import { createCipheriv, randomBytes } from "crypto";
import { prisma } from "../src/index.js";
import { decideSeed } from "./seed-guard.js";
import { bankAccountFingerprint } from "../src/bank-fingerprint.js";

// The same fingerprint the API stores (R-08), so seeded accounts are protected from duplicates too.
function seedFingerprint(routingNumber: string, accountNumber: string): string {
  return bankAccountFingerprint(process.env.ENCRYPTION_KEY ?? "", routingNumber, accountNumber);
}

// ============================================================================
// ENCRYPTION HELPER — mirrors EncryptionService from check-printing-backend
// so that seeded bank accounts can be decrypted at runtime.
// ============================================================================
function seedEncrypt(plainText: string): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length < 64) {
    throw new Error(
      "ENCRYPTION_KEY env var missing or too short (need 64 hex chars). " +
      "Add it to packages/database/.env or run with ENCRYPTION_KEY=... npx ts-node ..."
    );
  }
  const encryptionKey = Buffer.from(key, "hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
  let encrypted = cipher.update(plainText, "utf-8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${encrypted}:${authTag.toString("hex")}`;
}

// ============================================================================
// DETERMINISTIC IDs — Makes API testing and debugging easy
// ============================================================================

const IDS = {
  // ─── Product ───
  PRODUCT_CHECK_PRINTING: "00000000-0000-4000-8000-000000000001",
  PRODUCT_CLOCK_IN_CLOCK_OUT: "00000000-0000-4000-8000-000000000002",

  // ─── Tenants ───
  TENANT_GREEN_ACRES: "10000000-0000-4000-8000-000000000001",
  TENANT_SUNSHINE: "10000000-0000-4000-8000-000000000002",

  // ─── Users ───
  USER_MARIA: "20000000-0000-4000-8000-000000000001",
  USER_JENNIFER: "20000000-0000-4000-8000-000000000002",
  USER_DAVID: "20000000-0000-4000-8000-000000000003",
  USER_EMILY: "20000000-0000-4000-8000-000000000004",
  USER_ROBERT: "20000000-0000-4000-8000-000000000005",
  USER_SARAH: "20000000-0000-4000-8000-000000000006",

  // ─── Workspaces ───
  WS_GREEN_ACRES: "30000000-0000-4000-8000-000000000001",
  WS_SUNSHINE: "30000000-0000-4000-8000-000000000002",

  // ─── Bank Accounts ───
  BANK_CHASE: "40000000-0000-4000-8000-000000000001",
  BANK_BOFA: "40000000-0000-4000-8000-000000000002",
  BANK_WELLS: "40000000-0000-4000-8000-000000000003",

  // ─── Payees (Green Acres) ───
  PAYEE_HILL_COUNTRY: "50000000-0000-4000-8000-000000000001",
  PAYEE_HOME_DEPOT: "50000000-0000-4000-8000-000000000002",
  PAYEE_AUSTIN_EQUIP: "50000000-0000-4000-8000-000000000003",
  PAYEE_SHELL: "50000000-0000-4000-8000-000000000004",
  PAYEE_CITY_WATER_GA: "50000000-0000-4000-8000-000000000005",
  PAYEE_LONE_STAR: "50000000-0000-4000-8000-000000000006",
  PAYEE_TX_LAWN: "50000000-0000-4000-8000-000000000007",
  PAYEE_DEACTIVATED: "50000000-0000-4000-8000-000000000008",

  // ─── Payees (Sunshine) ───
  PAYEE_POOL_CHEMICAL: "50000000-0000-4000-8000-000000000009",
  PAYEE_ACME_POOL: "50000000-0000-4000-8000-000000000010",
  PAYEE_CITY_WATER_SP: "50000000-0000-4000-8000-000000000011",

  // ─── Checks (Green Acres — Chase) ───
  CHECK_5001: "60000000-0000-4000-8000-000000005001",
  CHECK_5002: "60000000-0000-4000-8000-000000005002",
  CHECK_5003: "60000000-0000-4000-8000-000000005003",
  CHECK_5004: "60000000-0000-4000-8000-000000005004",
  CHECK_5005: "60000000-0000-4000-8000-000000005005",
  CHECK_5006: "60000000-0000-4000-8000-000000005006",
  CHECK_5007: "60000000-0000-4000-8000-000000005007",
  CHECK_5008: "60000000-0000-4000-8000-000000005008",

  // ─── Checks (Green Acres — BofA) ───
  CHECK_1001: "60000000-0000-4000-8000-000000001001",

  // ─── Checks (Sunshine — Wells Fargo) ───
  CHECK_2001: "60000000-0000-4000-8000-000000002001",
  CHECK_2002: "60000000-0000-4000-8000-000000002002",

  // ─── Approval ───
  RULE_GA_1000: "70000000-0000-4000-8000-000000000001",

  // ─── Templates ───
  TMPL_CHECK_ON_TOP: "80000000-0000-4000-8000-000000000001",
  TMPL_CHECK_ON_BOTTOM: "80000000-0000-4000-8000-000000000002",
  TMPL_THREE_PER_PAGE: "80000000-0000-4000-8000-000000000003",

  // ─── Calibration ───
  CAL_MARIA_HP: "90000000-0000-4000-8000-000000000001",
  CAL_JENNIFER_BROTHER: "90000000-0000-4000-8000-000000000002",
} as const;

// Argon2id hash of "Password1!" — all seed users share this for dev login testing.
// Generated via: argon2.hash("Password1!", { type: argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4 })
const SEED_PASSWORD_HASH =
  "$argon2id$v=19$m=65536,p=4,t=3$p3c2JyNpec+zdlYFqOkEfQ$V/1y7kKAxZkXcmu3K60lR7ut4/8hbM/y1IXdNjnidGw";

// ============================================================================
// HELPER: date builder
// ============================================================================
function d(daysAgo: number, hours = 9, minutes = 0): Date {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

// ============================================================================
// CLEANUP — Delete everything in reverse FK dependency order
// ============================================================================
// Empties every application table in ONE statement, so the wipe is all or nothing: a list
// of deletes stops halfway on the first foreign key it did not expect (a password-reset
// link pointing at a user, for example), leaving checks deleted and users still there.
// Listing the tables from the database also covers tables added after this file was written.
async function cleanup() {
  console.log("🧹 Cleaning up existing data...");
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length > 0) {
    const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  }
  console.log(`✅ Cleanup complete (${tables.length} tables emptied)\n`);
}

// ============================================================================
// SEED: Product, Permissions, Roles (RBAC foundation)
// ============================================================================
async function seedRBAC() {
  console.log("🔐 Seeding RBAC: Product, Permissions, Roles...");

  const product = await prisma.product.create({
    data: {
      id: IDS.PRODUCT_CHECK_PRINTING,
      slug: "check-printing",
      name: "Check Printing",
      description: "Print professional checks on blank paper",
      isActive: true,
    },
  });

  const clockInProduct = await prisma.product.create({
    data: {
      id: IDS.PRODUCT_CLOCK_IN_CLOCK_OUT,
      slug: "clock-in-clock-out",
      name: "Clock-In Clock-Out",
      description: "Employee time tracking, biometric verification, and attendance reports",
      isActive: true,
    },
  });

  const PERMISSIONS = [
    { action: "workspace:manage", description: "Update and delete workspace settings" },
    { action: "member:manage", description: "Add, update, and remove workspace members" },
    { action: "member:view", description: "View workspace member list" },
    { action: "bank-account:manage", description: "Create, update, and delete bank accounts" },
    { action: "check:create", description: "Create new checks" },
    { action: "check:print", description: "Print checks" },
    { action: "check:approve", description: "Approve or reject checks" },
    { action: "check:void", description: "Void printed checks" },
    { action: "check:view", description: "View all checks" },
    { action: "payee:manage", description: "Archive and restore payees" },
    { action: "payee:write", description: "Create and update payees" },
    { action: "report:view", description: "View financial reports" },
  ];

  const permMap = new Map<string, string>();
  for (const perm of PERMISSIONS) {
    const record = await prisma.permission.create({
      data: { productId: product.id, action: perm.action, description: perm.description },
    });
    permMap.set(perm.action, record.id);
  }

  const ROLES = [
    { slug: "check-admin", name: "Admin", description: "Full access", perms: PERMISSIONS.map((p) => p.action) },
    { slug: "check-editor", name: "Editor", description: "Create checks and manage payees", perms: ["check:create", "check:view", "payee:write", "report:view"] },
    { slug: "check-printer", name: "Printer", description: "Print approved checks", perms: ["check:print", "check:view"] },
    { slug: "check-approver", name: "Approver", description: "Approve or reject checks", perms: ["check:approve", "check:view"] },
    { slug: "check-viewer", name: "Viewer", description: "Read-only access", perms: ["check:view", "report:view"] },
  ];

  const roleMap = new Map<string, string>();
  for (const roleDef of ROLES) {
    const role = await prisma.role.create({
      data: {
        productId: product.id,
        slug: roleDef.slug,
        name: roleDef.name,
        description: roleDef.description,
        isSystem: true,
      },
    });
    roleMap.set(roleDef.slug, role.id);

    await prisma.rolePermission.createMany({
      data: roleDef.perms.map((action) => ({
        roleId: role.id,
        permissionId: permMap.get(action)!,
      })),
    });
  }

  console.log(`  ✅ Product: ${product.name}`);
  console.log(`  ✅ Product: ${clockInProduct.name}`);
  console.log(`  ✅ ${PERMISSIONS.length} Permissions`);
  console.log(`  ✅ ${ROLES.length} Roles`);

  return { product, clockInProduct, roleMap };
}

// ============================================================================
// SEED: Check Templates (system-wide, no tenant)
// ============================================================================
async function seedCheckTemplates() {
  console.log("\n📋 Seeding check templates...");

  await prisma.checkTemplate.createMany({
    data: [
      {
        id: IDS.TMPL_CHECK_ON_TOP,
        name: "Check on Top - Standard",
        formatType: "check_on_top",
        isDefault: true,
        isSystem: true,
        layoutJson: {
          pageSize: { width: 612, height: 792 },
          checkArea: { top: 0, height: 252 },
          stubAreas: [{ top: 264, height: 252 }, { top: 528, height: 252 }],
        },
      },
      {
        id: IDS.TMPL_CHECK_ON_BOTTOM,
        name: "Check on Bottom - Standard",
        formatType: "check_on_bottom",
        isDefault: false,
        isSystem: true,
        layoutJson: {
          pageSize: { width: 612, height: 792 },
          checkArea: { top: 528, height: 252 },
          stubAreas: [{ top: 0, height: 252 }, { top: 264, height: 252 }],
        },
      },
      {
        id: IDS.TMPL_THREE_PER_PAGE,
        name: "Three per Page",
        formatType: "three_per_page",
        isDefault: false,
        isSystem: true,
        layoutJson: {
          pageSize: { width: 612, height: 792 },
          checksPerPage: 3,
          checkAreas: [{ top: 0, height: 252 }, { top: 264, height: 252 }, { top: 528, height: 252 }],
        },
      },
    ],
  });

  console.log("  ✅ 3 check templates created");
}

// ============================================================================
// SEED: Green Acres Landscaping (Primary Tenant)
// ============================================================================
async function seedGreenAcres(productId: string, clockInProductId: string, roleMap: Map<string, string>) {
  console.log("\n🌿 Seeding Tenant: Green Acres Landscaping...\n");

  // ─── Tenant ───
  const tenant = await prisma.tenant.create({
    data: {
      id: IDS.TENANT_GREEN_ACRES,
      name: "Green Acres Landscaping LLC",
      billingEmail: "billing@greenacres.com",
      status: "ACTIVE",
      stripeCustomerId: "cus_greenacres_001",
    },
  });
  console.log("  ✅ Tenant: Green Acres Landscaping LLC");

  // ─── Product Subscription (PROFESSIONAL plan, active) ───
  await prisma.productSubscription.create({
    data: {
      tenantId: tenant.id,
      productId,
      plan: "PROFESSIONAL",
      status: "ACTIVE",
      trialEndsAt: d(30),
      currentPeriodEndsAt: d(-335),
      stripeSubscriptionId: "sub_greenacres_001",
    },
  });
  console.log("  ✅ ProductSubscription (Check Printing): PROFESSIONAL (active)");

  // ─── Product Subscription: Clock-In Clock-Out (PROFESSIONAL plan, active) ───
  await prisma.productSubscription.create({
    data: {
      tenantId: tenant.id,
      productId: clockInProductId,
      plan: "PROFESSIONAL",
      status: "ACTIVE",
      trialEndsAt: d(30),
      currentPeriodEndsAt: d(-335),
      stripeSubscriptionId: "sub_greenacres_clockin_001",
    },
  });
  console.log("  ✅ ProductSubscription (Clock-In Clock-Out): PROFESSIONAL (active)");

  // ─── Users (no tenantId on User — linked via TenantMember) ───
  const maria = await prisma.user.create({
    data: {
      id: IDS.USER_MARIA,
      fullName: "Maria Rodriguez",
      email: "maria@greenacres.com",
      passwordHash: SEED_PASSWORD_HASH,
      isActive: true,
      emailVerifiedAt: d(60),
      lastLoginAt: d(0, 8, 30),
    },
  });

  const jennifer = await prisma.user.create({
    data: {
      id: IDS.USER_JENNIFER,
      fullName: "Jennifer Chen",
      email: "jennifer@greenacres.com",
      passwordHash: SEED_PASSWORD_HASH,
      isActive: true,
      emailVerifiedAt: d(45),
      lastLoginAt: d(0, 9, 15),
    },
  });

  const david = await prisma.user.create({
    data: {
      id: IDS.USER_DAVID,
      fullName: "David Park",
      email: "david@greenacres.com",
      passwordHash: SEED_PASSWORD_HASH,
      isActive: true,
      emailVerifiedAt: d(40),
      lastLoginAt: d(1, 17, 0),
    },
  });

  await prisma.user.create({
    data: {
      id: IDS.USER_EMILY,
      fullName: "Emily Watson",
      email: "emily@greenacres.com",
      passwordHash: SEED_PASSWORD_HASH,
      isActive: false,
      emailVerifiedAt: null,
      lastLoginAt: null,
    },
  });

  await prisma.user.create({
    data: {
      id: IDS.USER_ROBERT,
      fullName: "Robert Kim",
      email: "robert@greenacres.com",
      passwordHash: SEED_PASSWORD_HASH,
      isActive: false,
      emailVerifiedAt: d(50),
      lastLoginAt: d(15),
      deletedAt: d(10),
    },
  });

  console.log("  ✅ 5 Users: Maria, Jennifer, David, Emily (inactive), Robert (deleted)");

  // ─── Tenant Members ───
  await prisma.tenantMember.createMany({
    data: [
      { tenantId: tenant.id, userId: maria.id, role: "OWNER" },
      { tenantId: tenant.id, userId: jennifer.id, role: "MEMBER" },
      { tenantId: tenant.id, userId: david.id, role: "MEMBER" },
      { tenantId: tenant.id, userId: IDS.USER_EMILY, role: "MEMBER" },
      { tenantId: tenant.id, userId: IDS.USER_ROBERT, role: "MEMBER" },
    ],
  });
  console.log("  ✅ 5 TenantMembers");

  // ─── Workspace ───
  const workspace = await prisma.workspace.create({
    data: {
      id: IDS.WS_GREEN_ACRES,
      tenantId: tenant.id,
      businessName: "Green Acres Landscaping LLC",
      addressLine1: "456 Oak Avenue",
      addressLine2: "Suite 100",
      city: "Austin",
      state: "TX",
      zipCode: "78701",
      phone: "512-555-0142",
    },
  });

  await prisma.checkPrintingSettings.create({
    data: {
      workspaceId: workspace.id,
      approvalEnabled: true,
      maxCheckAmount: 50000.0,
      maxPastDays: 30,
      maxFutureDays: 90,
    },
  });
  console.log("  ✅ Workspace + CheckPrintingSettings");

  // ─── Workspace Members + RBAC Roles ───
  const mariaMember = await prisma.workspaceMember.create({
    data: { workspaceId: workspace.id, userId: maria.id },
  });
  await prisma.workspaceMemberRole.create({
    data: { workspaceMemberId: mariaMember.id, roleId: roleMap.get("check-admin")!, assignedById: maria.id },
  });

  const jenniferMember = await prisma.workspaceMember.create({
    data: { workspaceId: workspace.id, userId: jennifer.id },
  });
  await prisma.workspaceMemberRole.createMany({
    data: [
      { workspaceMemberId: jenniferMember.id, roleId: roleMap.get("check-editor")!, assignedById: maria.id },
      { workspaceMemberId: jenniferMember.id, roleId: roleMap.get("check-printer")!, assignedById: maria.id },
    ],
  });

  const davidMember = await prisma.workspaceMember.create({
    data: { workspaceId: workspace.id, userId: david.id },
  });
  await prisma.workspaceMemberRole.createMany({
    data: [
      { workspaceMemberId: davidMember.id, roleId: roleMap.get("check-editor")!, assignedById: maria.id },
      { workspaceMemberId: davidMember.id, roleId: roleMap.get("check-approver")!, assignedById: maria.id },
    ],
  });

  console.log("  ✅ 3 Members: Maria=Admin, Jennifer=Editor+Printer, David=Editor+Approver");

  // ─── Bank Accounts ───
  const chase = await prisma.bankAccount.create({
    data: {
      id: IDS.BANK_CHASE,
      workspaceId: workspace.id,
      bankName: "JPMorgan Chase",
      routingNumberEncrypted: seedEncrypt("111000025"),
      routingNumberLast4: "0025",
      accountNumberEncrypted: seedEncrypt("987654321012"),
      accountNumberLast4: "1012",
      accountFingerprint: seedFingerprint("111000025", "987654321012"),
      accountType: "CHECKING",
      nextCheckNumber: 5009,
      checkNumberPadding: 6,
      signatureStorageKey: null,
      encryptionKeyVersion: 1,
      isActive: true,
    },
  });

  const bofa = await prisma.bankAccount.create({
    data: {
      id: IDS.BANK_BOFA,
      workspaceId: workspace.id,
      bankName: "Bank of America",
      routingNumberEncrypted: seedEncrypt("026009593"),
      routingNumberLast4: "9593",
      accountNumberEncrypted: seedEncrypt("123456785678"),
      accountFingerprint: seedFingerprint("026009593", "123456785678"),
      accountNumberLast4: "5678",
      accountType: "CHECKING",
      nextCheckNumber: 1002,
      checkNumberPadding: 6,
      signatureStorageKey: null,
      encryptionKeyVersion: 1,
      isActive: true,
    },
  });
  console.log("  ✅ 2 Bank Accounts: Chase, BofA (encrypted with ENCRYPTION_KEY)");

  // ─── Payees ───
  await prisma.payee.createMany({
    data: [
      { id: IDS.PAYEE_HILL_COUNTRY, workspaceId: workspace.id, name: "Hill Country Nursery", addressLine1: "1200 Ranch Road 620", city: "Lakeway", state: "TX", zipCode: "78734", defaultMemo: "Plant supplies", isActive: true },
      { id: IDS.PAYEE_HOME_DEPOT, workspaceId: workspace.id, name: "Home Depot", addressLine1: "9300 Research Blvd", city: "Austin", state: "TX", zipCode: "78758", defaultMemo: "Building materials", isActive: true },
      { id: IDS.PAYEE_AUSTIN_EQUIP, workspaceId: workspace.id, name: "Austin Equipment Rentals", addressLine1: "5500 S Congress Ave", city: "Austin", state: "TX", zipCode: "78745", defaultMemo: "Equipment rental", isActive: true },
      { id: IDS.PAYEE_SHELL, workspaceId: workspace.id, name: "Shell Gas Station", defaultMemo: "Fuel", isActive: true },
      { id: IDS.PAYEE_CITY_WATER_GA, workspaceId: workspace.id, name: "City of Austin Water Dept", addressLine1: "625 E 10th Street", city: "Austin", state: "TX", zipCode: "78701", defaultMemo: "Water bill", isActive: true },
      { id: IDS.PAYEE_LONE_STAR, workspaceId: workspace.id, name: "Lone Star Insurance", addressLine1: "100 Congress Ave", addressLine2: "Suite 400", city: "Austin", state: "TX", zipCode: "78701", defaultMemo: "Monthly premium", isActive: true },
      { id: IDS.PAYEE_TX_LAWN, workspaceId: workspace.id, name: "Texas Lawn Care Supply", addressLine1: "8200 Burnet Rd", city: "Austin", state: "TX", zipCode: "78757", defaultMemo: null, isActive: true },
      { id: IDS.PAYEE_DEACTIVATED, workspaceId: workspace.id, name: "DEACTIVATED Vendor Inc", isActive: false },
    ],
  });
  console.log("  ✅ 8 Payees (including 1 deactivated)");

  // ─── Checks (representative subset covering all statuses) ───
  console.log("\n  📝 Seeding checks...");

  await prisma.check.create({
    data: {
      id: IDS.CHECK_5001, workspaceId: workspace.id, bankAccountId: chase.id, checkNumber: 5001,
      status: "VOID", payeeName: "Hill Country Nursery", amount: 3500.0,
      amountInWords: "Three Thousand Five Hundred and 00/100", checkDate: d(30),
      memo: "Plant supplies - September order", createdById: maria.id, createdAt: d(30),
      printedAt: d(30, 10, 30), printedById: maria.id,
      pdfStorageUrl: "https://storage.smartbusiness.dev/checks/ch_5001.pdf",
      voidedAt: d(27), voidedById: maria.id, voidReason: "Duplicate payment — vendor paid via bank transfer",
    },
  });

  await prisma.check.create({
    data: {
      id: IDS.CHECK_5002, workspaceId: workspace.id, bankAccountId: chase.id, checkNumber: 5002,
      status: "PRINTED", payeeName: "Home Depot", amount: 287.5,
      amountInWords: "Two Hundred Eighty-Seven and 50/100", checkDate: d(28),
      memo: "Building materials", createdById: maria.id, createdAt: d(28),
      printedAt: d(28, 11, 0), printedById: maria.id,
      pdfStorageUrl: "https://storage.smartbusiness.dev/checks/ch_5002.pdf",
    },
  });

  await prisma.check.create({
    data: {
      id: IDS.CHECK_5003, workspaceId: workspace.id, bankAccountId: chase.id, checkNumber: 5003,
      status: "CLEARED", payeeName: "City of Austin Water Dept", amount: 89.5,
      amountInWords: "Eighty-Nine and 50/100", checkDate: d(25),
      memo: "Water bill - September", createdById: jennifer.id, createdAt: d(25),
      printedAt: d(25, 10, 0), printedById: maria.id,
      pdfStorageUrl: "https://storage.smartbusiness.dev/checks/ch_5003.pdf",
      clearedAt: d(11), clearedById: maria.id, clearedDate: d(11), clearedAmount: 89.5,
    },
  });

  await prisma.check.create({
    data: {
      id: IDS.CHECK_5004, workspaceId: workspace.id, bankAccountId: chase.id, checkNumber: 5004,
      status: "APPROVED", payeeName: "Austin Equipment Rentals", amount: 2500.0,
      amountInWords: "Two Thousand Five Hundred and 00/100", checkDate: d(15),
      memo: "Excavator rental - 1 week", createdById: jennifer.id, createdAt: d(15),
    },
  });

  await prisma.check.create({
    data: {
      id: IDS.CHECK_5005, workspaceId: workspace.id, bankAccountId: chase.id, checkNumber: 5005,
      status: "PENDING_APPROVAL", payeeName: "Home Depot", amount: 2200.0,
      amountInWords: "Two Thousand Two Hundred and 00/100", checkDate: d(5),
      memo: "Power tools", createdById: jennifer.id, createdAt: d(5),
    },
  });

  await prisma.check.create({
    data: {
      id: IDS.CHECK_5006, workspaceId: workspace.id, bankAccountId: chase.id, checkNumber: 5006,
      status: "REJECTED", payeeName: "Hill Country Nursery", amount: 8500.0,
      amountInWords: "Eight Thousand Five Hundred and 00/100", checkDate: d(14),
      memo: "Tree installation project", createdById: jennifer.id, createdAt: d(14),
    },
  });

  await prisma.check.create({
    data: {
      id: IDS.CHECK_5007, workspaceId: workspace.id, bankAccountId: chase.id, checkNumber: 5007,
      status: "NEW", payeeName: "Shell Gas Station", amount: 45.0,
      amountInWords: "Forty-Five and 00/100", checkDate: d(3),
      memo: "Fuel", createdById: jennifer.id, createdAt: d(3),
    },
  });

  await prisma.check.create({
    data: {
      id: IDS.CHECK_5008, workspaceId: workspace.id, bankAccountId: chase.id, checkNumber: 5008,
      status: "NEW", payeeName: "City of Austin Water Dept", amount: 89.5,
      amountInWords: "Eighty-Nine and 50/100", checkDate: d(2),
      memo: "Water bill - October", createdById: jennifer.id, createdAt: d(2),
    },
  });

  await prisma.check.create({
    data: {
      id: IDS.CHECK_1001, workspaceId: workspace.id, bankAccountId: bofa.id, checkNumber: 1001,
      status: "PRINTED", payeeName: "Hill Country Nursery", amount: 2000.0,
      amountInWords: "Two Thousand and 00/100", checkDate: d(15),
      memo: "Separate bank account payment", createdById: maria.id, createdAt: d(15),
      printedAt: d(14, 10, 0), printedById: maria.id,
      pdfStorageUrl: "https://storage.smartbusiness.dev/checks/ch_1001.pdf",
    },
  });

  console.log("  ✅ 9 Checks across 2 bank accounts (every status covered)");

  // ─── Approval Workflow Rule ───
  const approvalRule = await prisma.approvalWorkflowRule.create({
    data: {
      id: IDS.RULE_GA_1000,
      workspaceId: workspace.id,
      priority: 1,
      minAmount: 1000.0,
      maxAmount: null,
      requiredApprovals: 1,
      allowSelfApproval: false,
      isActive: true,
      createdById: maria.id,
    },
  });

  await prisma.approvalWorkflowApprover.createMany({
    data: [
      { ruleId: approvalRule.id, userId: maria.id },
      { ruleId: approvalRule.id, userId: david.id },
    ],
  });
  console.log("  ✅ Approval Rule: checks ≥ $1,000 need 1 approval (Maria or David)");

  // ─── Calibration Profiles ───
  await prisma.calibrationProfile.createMany({
    data: [
      {
        id: IDS.CAL_MARIA_HP, workspaceId: workspace.id, calibratedById: maria.id,
        profileName: "HP LaserJet Pro - Main Office", paperSize: "LETTER", tray: "Tray 2",
        horizontalOffsetPts: -1.44, verticalOffsetPts: -2.88, scaleX: 1.0, scaleY: 1.0,
        measurementsJson: {
          unit: "in",
          sheets: [
            { x1: 1.02, x2: 7.52, y1: 1.04, y2: 10.04 },
            { x1: 1.02, x2: 7.52, y1: 1.04, y2: 10.04 },
            { x1: 1.02, x2: 7.52, y1: 1.04, y2: 10.04 },
          ],
          repeatability: { sheets: 3, spreadXPts: 0, spreadYPts: 0 },
        },
        refVersion: 2, isDefault: true,
      },
      {
        id: IDS.CAL_JENNIFER_BROTHER, workspaceId: workspace.id, calibratedById: jennifer.id,
        profileName: "Brother HL-L2350DW - Home Office", paperSize: "A4", tray: "Manual feed",
        horizontalOffsetPts: 0.72, verticalOffsetPts: 1.44, scaleX: 1.0, scaleY: 1.0,
        measurementsJson: {
          unit: "mm",
          sheets: [
            { x1: 25.146, x2: 183.896, y1: 24.892, y2: 266.192 },
            { x1: 25.146, x2: 183.896, y1: 24.892, y2: 266.192 },
            { x1: 25.146, x2: 183.896, y1: 24.892, y2: 266.192 },
          ],
          repeatability: { sheets: 3, spreadXPts: 0, spreadYPts: 0 },
        },
        refVersion: 2, isDefault: false,
      },
    ],
  });
  console.log("  ✅ 2 Printer (calibration) profiles");

  console.log("\n🌿 Green Acres Landscaping — DONE\n");
}

// ============================================================================
// SEED: Sunshine Pool Service (Secondary Tenant — isolation testing)
// ============================================================================
async function seedSunshinePool(productId: string, clockInProductId: string, roleMap: Map<string, string>) {
  console.log("☀️  Seeding Tenant: Sunshine Pool Service...\n");

  const tenant = await prisma.tenant.create({
    data: {
      id: IDS.TENANT_SUNSHINE,
      name: "Sunshine Pool Service",
      billingEmail: "admin@sunshinepool.com",
      status: "ACTIVE",
    },
  });

  await prisma.productSubscription.create({
    data: {
      tenantId: tenant.id,
      productId,
      plan: "TRIAL",
      status: "TRIALING",
      trialEndsAt: d(-14),
    },
  });

  // Clock-In Clock-Out Subscription (TRIAL, active)
  await prisma.productSubscription.create({
    data: {
      tenantId: tenant.id,
      productId: clockInProductId,
      plan: "TRIAL",
      status: "ACTIVE",
      trialEndsAt: d(30),
    },
  });
  console.log("  ✅ Tenant: Sunshine Pool Service (Check Printing TRIAL + Clock-In ACTIVE)");

  const sarah = await prisma.user.create({
    data: {
      id: IDS.USER_SARAH,
      fullName: "Sarah Miller",
      email: "sarah@sunshinepool.com",
      passwordHash: SEED_PASSWORD_HASH,
      isActive: true,
      emailVerifiedAt: d(10),
      lastLoginAt: d(0, 10, 0),
    },
  });

  await prisma.tenantMember.createMany({
    data: [
      { tenantId: tenant.id, userId: sarah.id, role: "OWNER" },
      { tenantId: tenant.id, userId: IDS.USER_DAVID, role: "MEMBER" },
    ],
  });
  console.log("  ✅ 1 User: Sarah + David as cross-tenant member");

  const workspace = await prisma.workspace.create({
    data: {
      id: IDS.WS_SUNSHINE,
      tenantId: tenant.id,
      businessName: "Sunshine Pool Service",
      addressLine1: "789 Pool Lane",
      city: "Austin",
      state: "TX",
      zipCode: "78745",
      phone: "512-555-0199",
    },
  });

  await prisma.checkPrintingSettings.create({
    data: {
      workspaceId: workspace.id,
      approvalEnabled: false,
      maxCheckAmount: 25000.0,
    },
  });
  console.log("  ✅ Workspace (approval DISABLED)");

  const sarahMember = await prisma.workspaceMember.create({
    data: { workspaceId: workspace.id, userId: sarah.id },
  });
  await prisma.workspaceMemberRole.create({
    data: { workspaceMemberId: sarahMember.id, roleId: roleMap.get("check-admin")!, assignedById: sarah.id },
  });

  const davidMember = await prisma.workspaceMember.create({
    data: { workspaceId: workspace.id, userId: IDS.USER_DAVID },
  });
  await prisma.workspaceMemberRole.create({
    data: { workspaceMemberId: davidMember.id, roleId: roleMap.get("check-editor")!, assignedById: sarah.id },
  });
  console.log("  ✅ 2 Members: Sarah=Admin, David=Editor");

  const wells = await prisma.bankAccount.create({
    data: {
      id: IDS.BANK_WELLS,
      workspaceId: workspace.id,
      bankName: "Wells Fargo",
      routingNumberEncrypted: seedEncrypt("121000248"),
      routingNumberLast4: "0248",
      accountNumberEncrypted: seedEncrypt("555666777999"),
      accountFingerprint: seedFingerprint("121000248", "555666777999"),
      accountNumberLast4: "9999",
      accountType: "CHECKING",
      nextCheckNumber: 2003,
      checkNumberPadding: 6,
      signatureStorageKey: null,
      encryptionKeyVersion: 1,
      isActive: true,
    },
  });
  console.log("  ✅ 1 Bank Account: Wells Fargo (encrypted)");

  await prisma.payee.createMany({
    data: [
      { id: IDS.PAYEE_POOL_CHEMICAL, workspaceId: workspace.id, name: "Pool Chemical Depot", addressLine1: "4500 S Lamar", city: "Austin", state: "TX", zipCode: "78745", defaultMemo: "Pool chemicals", isActive: true },
      { id: IDS.PAYEE_ACME_POOL, workspaceId: workspace.id, name: "Acme Pool Parts", addressLine1: "1100 E Riverside", city: "Austin", state: "TX", zipCode: "78741", defaultMemo: "Pool parts", isActive: true },
      { id: IDS.PAYEE_CITY_WATER_SP, workspaceId: workspace.id, name: "City of Austin Water Dept", addressLine1: "625 E 10th Street", city: "Austin", state: "TX", zipCode: "78701", defaultMemo: "Water bill", isActive: true },
    ],
  });
  console.log("  ✅ 3 Payees");

  await prisma.check.createMany({
    data: [
      {
        id: IDS.CHECK_2001, workspaceId: workspace.id, bankAccountId: wells.id, checkNumber: 2001,
        status: "PRINTED", payeeName: "Pool Chemical Depot", amount: 425.0,
        amountInWords: "Four Hundred Twenty-Five and 00/100", checkDate: d(10),
        memo: "Monthly chemical supply", printedAt: d(10, 14, 0), printedById: sarah.id,
        pdfStorageUrl: "https://storage.smartbusiness.dev/checks/sp_ch_2001.pdf",
        createdById: sarah.id, createdAt: d(10),
      },
      {
        id: IDS.CHECK_2002, workspaceId: workspace.id, bankAccountId: wells.id, checkNumber: 2002,
        status: "NEW", payeeName: "City of Austin Water Dept", amount: 65.0,
        amountInWords: "Sixty-Five and 00/100", checkDate: d(1),
        memo: "Water bill", createdById: sarah.id, createdAt: d(1),
      },
    ],
  });
  console.log("  ✅ 2 Checks");

  console.log("\n☀️  Sunshine Pool Service — DONE\n");
}

// ============================================================================
// MAIN
// ============================================================================
async function main() {
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║   SmartBusiness — Complete Seed Data                ║");
  console.log("║   RBAC + 2 Tenants + Users + Checks + Full Flow    ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  // Decided before any connection is opened: this erases every table (seed-guard.ts).
  const decision = decideSeed(process.env.DATABASE_URL, process.env);
  if (!decision.allowed) {
    console.error(`\n❌ ${decision.message}\n`);
    process.exit(1);
  }
  console.log(`⚠️  Erasing all data in "${decision.target.database}" on ${decision.target.host} (${decision.reason})\n`);

  await cleanup();

  const { product, clockInProduct, roleMap } = await seedRBAC();
  await seedCheckTemplates();
  await seedGreenAcres(product.id, clockInProduct.id, roleMap);
  await seedSunshinePool(product.id, clockInProduct.id, roleMap);

  // ─── Summary ───
  const counts = {
    products: await prisma.product.count(),
    permissions: await prisma.permission.count(),
    roles: await prisma.role.count(),
    tenants: await prisma.tenant.count(),
    users: await prisma.user.count(),
    tenantMembers: await prisma.tenantMember.count(),
    productSubscriptions: await prisma.productSubscription.count(),
    workspaces: await prisma.workspace.count(),
    workspaceMembers: await prisma.workspaceMember.count(),
    workspaceMemberRoles: await prisma.workspaceMemberRole.count(),
    bankAccounts: await prisma.bankAccount.count(),
    payees: await prisma.payee.count(),
    checks: await prisma.check.count(),
    approvalRules: await prisma.approvalWorkflowRule.count(),
    calibrationProfiles: await prisma.calibrationProfile.count(),
    checkTemplates: await prisma.checkTemplate.count(),
  };

  console.log("═══════════════════════════════════════════════════════");
  console.log("  SEED SUMMARY");
  console.log("═══════════════════════════════════════════════════════");
  Object.entries(counts).forEach(([key, count]) => {
    console.log(`  ${key.padEnd(24)} ${count}`);
  });
  console.log("═══════════════════════════════════════════════════════");
  console.log("\n✅ Seeding complete!");
  console.log("\n📝 Test credentials:");
  console.log("   Email: maria@greenacres.com  |  Password: Password1!");
  console.log("   Email: sarah@sunshinepool.com  |  Password: Password1!");
  console.log("\n🔍 Run 'npx prisma studio' to explore.\n");
}

main()
  .catch((err) => {
    console.error("\n❌ Seeding failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
