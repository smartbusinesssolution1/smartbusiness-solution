import dotenv from "dotenv";
dotenv.config();

import { prisma } from "../src/index.js";
import { CheckStatus, PlanType, PlanStatus, TenantStatus, AccountType } from "../generated/prisma/client.js";

// ============================================================================
// DETERMINISTIC IDs — Makes API testing and debugging easy
// ============================================================================

const IDS = {
  // ─── Tenants ───
  TENANT_GREEN_ACRES: "10000000-0000-0000-0000-000000000001",
  TENANT_SUNSHINE: "10000000-0000-0000-0000-000000000002",

  // ─── Users ───
  USER_MARIA: "20000000-0000-0000-0000-000000000001",
  USER_JENNIFER: "20000000-0000-0000-0000-000000000002",
  USER_DAVID: "20000000-0000-0000-0000-000000000003",
  USER_EMILY: "20000000-0000-0000-0000-000000000004",
  USER_ROBERT: "20000000-0000-0000-0000-000000000005",
  USER_SARAH: "20000000-0000-0000-0000-000000000006",

  // ─── Workspaces ───
  WS_GREEN_ACRES: "30000000-0000-0000-0000-000000000001",
  WS_SUNSHINE: "30000000-0000-0000-0000-000000000002",

  // ─── Bank Accounts ───
  BANK_CHASE: "40000000-0000-0000-0000-000000000001",
  BANK_BOFA: "40000000-0000-0000-0000-000000000002",
  BANK_WELLS: "40000000-0000-0000-0000-000000000003",

  // ─── Payees (Green Acres) ───
  PAYEE_HILL_COUNTRY: "50000000-0000-0000-0000-000000000001",
  PAYEE_HOME_DEPOT: "50000000-0000-0000-0000-000000000002",
  PAYEE_AUSTIN_EQUIP: "50000000-0000-0000-0000-000000000003",
  PAYEE_SHELL: "50000000-0000-0000-0000-000000000004",
  PAYEE_CITY_WATER_GA: "50000000-0000-0000-0000-000000000005",
  PAYEE_LONE_STAR: "50000000-0000-0000-0000-000000000006",
  PAYEE_TX_LAWN: "50000000-0000-0000-0000-000000000007",
  PAYEE_DEACTIVATED: "50000000-0000-0000-0000-000000000008",

  // ─── Payees (Sunshine) ───
  PAYEE_POOL_CHEMICAL: "50000000-0000-0000-0000-000000000009",
  PAYEE_ACME_POOL: "50000000-0000-0000-0000-000000000010",
  PAYEE_CITY_WATER_SP: "50000000-0000-0000-0000-000000000011",

  // ─── Checks (Green Acres — Chase) ───
  CHECK_5001: "60000000-0000-0000-0000-000000005001",
  CHECK_5002: "60000000-0000-0000-0000-000000005002",
  CHECK_5003: "60000000-0000-0000-0000-000000005003",
  CHECK_5004: "60000000-0000-0000-0000-000000005004",
  CHECK_5005: "60000000-0000-0000-0000-000000005005",
  CHECK_5006: "60000000-0000-0000-0000-000000005006",
  CHECK_5007: "60000000-0000-0000-0000-000000005007",
  CHECK_5008: "60000000-0000-0000-0000-000000005008",
  CHECK_5009: "60000000-0000-0000-0000-000000005009",
  CHECK_5010: "60000000-0000-0000-0000-000000005010",
  CHECK_5011: "60000000-0000-0000-0000-000000005011",
  CHECK_5012: "60000000-0000-0000-0000-000000005012",
  CHECK_5013: "60000000-0000-0000-0000-000000005013",
  CHECK_5014: "60000000-0000-0000-0000-000000005014",
  CHECK_5015: "60000000-0000-0000-0000-000000005015",
  CHECK_5016: "60000000-0000-0000-0000-000000005016",
  CHECK_5017: "60000000-0000-0000-0000-000000005017",
  CHECK_5018: "60000000-0000-0000-0000-000000005018",
  CHECK_5019: "60000000-0000-0000-0000-000000005019",
  CHECK_5020: "60000000-0000-0000-0000-000000005020",

  // ─── Checks (Green Acres — BofA) ───
  CHECK_1001: "60000000-0000-0000-0000-000000001001",
  CHECK_1002: "60000000-0000-0000-0000-000000001002",

  // ─── Checks (Sunshine — Wells Fargo) ───
  CHECK_2001: "60000000-0000-0000-0000-000000002001",
  CHECK_2002: "60000000-0000-0000-0000-000000002002",
  CHECK_2003: "60000000-0000-0000-0000-000000002003",

  // ─── Approval ───
  RULE_GA_1000: "70000000-0000-0000-0000-000000000001",

  // ─── Templates ───
  TMPL_CHECK_ON_TOP: "80000000-0000-0000-0000-000000000001",
  TMPL_CHECK_ON_BOTTOM: "80000000-0000-0000-0000-000000000002",
  TMPL_THREE_PER_PAGE: "80000000-0000-0000-0000-000000000003",

  // ─── Calibration ───
  CAL_MARIA_HP: "90000000-0000-0000-0000-000000000001",
  CAL_JENNIFER_BROTHER: "90000000-0000-0000-0000-000000000002",
} as const;

// Bcrypt hash of "password123" — all seed users share this for dev login testing
const SEED_PASSWORD_HASH = "$2b$10$K4GtKKj1Y.PAzCbFDq/MreHj0IXwVHdXgN3LB8GHPpD5ECJzVTmRO";

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
async function cleanup() {
  console.log("🧹 Cleaning up existing data...");
  await prisma.auditLog.deleteMany();
  await prisma.approvalRecord.deleteMany();
  await prisma.approvalWorkflowApprover.deleteMany();
  await prisma.approvalWorkflowRule.deleteMany();
  await prisma.checkAttachment.deleteMany();
  await prisma.checkStatusHistory.deleteMany();
  await prisma.check.deleteMany();
  await prisma.calibrationProfile.deleteMany();
  await prisma.checkTemplate.deleteMany();
  await prisma.payee.deleteMany();
  await prisma.bankAccount.deleteMany();
  await prisma.workspaceMember.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
  console.log("✅ Cleanup complete\n");
}

// ============================================================================
// SEED: Check Templates (system-wide, no tenant)
// ============================================================================
async function seedCheckTemplates() {
  console.log("📋 Seeding check templates...");

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
          stubAreas: [
            { top: 264, height: 252 },
            { top: 528, height: 252 },
          ],
          elements: {
            companyName: { x: 36, y: 24, fontSize: 12, fontWeight: "bold" },
            companyAddress: { x: 36, y: 40, fontSize: 9 },
            checkNumber: { x: 540, y: 24, fontSize: 10, fontWeight: "bold" },
            date: { x: 460, y: 60, fontSize: 10 },
            payToOrderOf: { x: 36, y: 96, fontSize: 10, label: "PAY TO THE ORDER OF" },
            payeeName: { x: 180, y: 96, fontSize: 11, fontWeight: "bold" },
            amountBox: { x: 500, y: 92, width: 90, height: 20, fontSize: 11 },
            amountInWords: { x: 36, y: 120, fontSize: 10 },
            bankName: { x: 36, y: 180, fontSize: 9 },
            memo: { x: 36, y: 210, fontSize: 9, label: "Memo" },
            signatureZone: { x: 380, y: 190, width: 200, height: 40 },
            micrLine: { x: 36, y: 227, fontSize: 12, font: "E-13B" },
          },
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
          stubAreas: [
            { top: 0, height: 252 },
            { top: 264, height: 252 },
          ],
          elements: {
            companyName: { x: 36, y: 552, fontSize: 12, fontWeight: "bold" },
            checkNumber: { x: 540, y: 552, fontSize: 10, fontWeight: "bold" },
            date: { x: 460, y: 588, fontSize: 10 },
            payeeName: { x: 180, y: 624, fontSize: 11, fontWeight: "bold" },
            amountBox: { x: 500, y: 620, width: 90, height: 20, fontSize: 11 },
            amountInWords: { x: 36, y: 648, fontSize: 10 },
            bankName: { x: 36, y: 708, fontSize: 9 },
            memo: { x: 36, y: 738, fontSize: 9 },
            signatureZone: { x: 380, y: 718, width: 200, height: 40 },
            micrLine: { x: 36, y: 755, fontSize: 12, font: "E-13B" },
          },
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
          checkAreas: [
            { top: 0, height: 252 },
            { top: 264, height: 252 },
            { top: 528, height: 252 },
          ],
          elements: {
            companyName: { xOffset: 36, yOffset: 24, fontSize: 11, fontWeight: "bold" },
            checkNumber: { xOffset: 540, yOffset: 24, fontSize: 10 },
            payeeName: { xOffset: 180, yOffset: 72, fontSize: 10 },
            amountBox: { xOffset: 500, yOffset: 68, width: 90, height: 18, fontSize: 10 },
            amountInWords: { xOffset: 36, yOffset: 96, fontSize: 9 },
            micrLine: { xOffset: 36, yOffset: 227, fontSize: 12, font: "E-13B" },
          },
        },
      },
    ],
  });

  console.log("  ✅ 3 check templates created");
}

// ============================================================================
// SEED: Green Acres Landscaping (Primary Tenant)
// ============================================================================
async function seedGreenAcres() {
  console.log("🌿 Seeding Tenant: Green Acres Landscaping...\n");

  // ─── Tenant ───
  const tenant = await prisma.tenant.create({
    data: {
      id: IDS.TENANT_GREEN_ACRES,
      name: "Green Acres Landscaping LLC",
      email: "billing@greenacres.com",
      plan: PlanType.PROFESSIONAL,
      planStatus: PlanStatus.ACTIVE,
      status: TenantStatus.ACTIVE,
      trialEndsAt: d(30), // Trial ended 30 days ago
      subscriptionEndsAt: d(-335), // Subscription valid for ~11 more months
      stripeCustomerId: "cus_greenacres_001",
      stripeSubscriptionId: "sub_greenacres_001",
    },
  });
  console.log("  ✅ Tenant: Green Acres Landscaping LLC");

  // ─── Users ───
  const maria = await prisma.user.create({
    data: {
      id: IDS.USER_MARIA,
      tenantId: tenant.id,
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
      tenantId: tenant.id,
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
      tenantId: tenant.id,
      fullName: "David Park",
      email: "david@greenacres.com",
      passwordHash: SEED_PASSWORD_HASH,
      isActive: true,
      emailVerifiedAt: d(40),
      lastLoginAt: d(1, 17, 0),
    },
  });

  // Emily — inactive, unverified (edge case user)
  await prisma.user.create({
    data: {
      id: IDS.USER_EMILY,
      tenantId: tenant.id,
      fullName: "Emily Watson",
      email: "emily@greenacres.com",
      passwordHash: SEED_PASSWORD_HASH,
      isActive: false,
      emailVerifiedAt: null,
      lastLoginAt: null,
    },
  });

  // Robert — soft-deleted (edge case user)
  await prisma.user.create({
    data: {
      id: IDS.USER_ROBERT,
      tenantId: tenant.id,
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
      approvalEnabled: true,
      maxCheckAmount: 50000.0,
      maxPastDays: 30,
      maxFutureDays: 90,
    },
  });
  console.log("  ✅ Workspace: Green Acres Landscaping");

  // ─── Workspace Members ───
  await prisma.workspaceMember.createMany({
    data: [
      {
        workspaceId: workspace.id,
        userId: maria.id,
        isSuperUser: true,
        canCreate: true,
        canPrint: true,
        canApprove: true,
      },
      {
        workspaceId: workspace.id,
        userId: jennifer.id,
        isSuperUser: false,
        canCreate: true,
        canPrint: true,
        canApprove: false, // Jennifer CANNOT approve
      },
      {
        workspaceId: workspace.id,
        userId: david.id,
        isSuperUser: false,
        canCreate: true,
        canPrint: false, // David CANNOT print
        canApprove: true,
      },
    ],
  });
  console.log("  ✅ 3 Workspace Members (Maria=SuperUser, Jennifer=Create+Print, David=Create+Approve)");

  // ─── Bank Accounts ───
  const chase = await prisma.bankAccount.create({
    data: {
      id: IDS.BANK_CHASE,
      workspaceId: workspace.id,
      bankName: "JPMorgan Chase",
      routingNumberEncrypted: "enc_v1_111000025",
      routingNumberLast4: "0025",
      accountNumberEncrypted: "enc_v1_987654321012",
      accountNumberLast4: "1012",
      accountType: AccountType.CHECKING,
      nextCheckNumber: 5021, // After seeding 20 checks (5001-5020)
      checkNumberPadding: 6,
      signatureImageUrl: "https://storage.smartbusiness.dev/signatures/ga_chase_signature.png",
      encryptionKeyVersion: 1,
      isActive: true,
    },
  });

  const bofa = await prisma.bankAccount.create({
    data: {
      id: IDS.BANK_BOFA,
      workspaceId: workspace.id,
      bankName: "Bank of America",
      routingNumberEncrypted: "enc_v1_026009593",
      routingNumberLast4: "9593",
      accountNumberEncrypted: "enc_v1_123456785678",
      accountNumberLast4: "5678",
      accountType: AccountType.CHECKING,
      nextCheckNumber: 1003, // After seeding 2 checks (1001-1002)
      checkNumberPadding: 6,
      signatureImageUrl: null, // No signature — tests warning in UI
      encryptionKeyVersion: 1,
      isActive: true,
    },
  });
  console.log("  ✅ 2 Bank Accounts: Chase (with signature), BofA (no signature)");

  // ─── Payees ───
  await prisma.payee.createMany({
    data: [
      {
        id: IDS.PAYEE_HILL_COUNTRY,
        workspaceId: workspace.id,
        name: "Hill Country Nursery",
        addressLine1: "1200 Ranch Road 620",
        city: "Lakeway",
        state: "TX",
        zipCode: "78734",
        defaultMemo: "Plant supplies",
        isActive: true,
      },
      {
        id: IDS.PAYEE_HOME_DEPOT,
        workspaceId: workspace.id,
        name: "Home Depot",
        addressLine1: "9300 Research Blvd",
        city: "Austin",
        state: "TX",
        zipCode: "78758",
        defaultMemo: "Building materials",
        isActive: true,
      },
      {
        id: IDS.PAYEE_AUSTIN_EQUIP,
        workspaceId: workspace.id,
        name: "Austin Equipment Rentals",
        addressLine1: "5500 S Congress Ave",
        city: "Austin",
        state: "TX",
        zipCode: "78745",
        defaultMemo: "Equipment rental",
        isActive: true,
      },
      {
        id: IDS.PAYEE_SHELL,
        workspaceId: workspace.id,
        name: "Shell Gas Station",
        defaultMemo: "Fuel",
        isActive: true,
      },
      {
        id: IDS.PAYEE_CITY_WATER_GA,
        workspaceId: workspace.id,
        name: "City of Austin Water Dept",
        addressLine1: "625 E 10th Street",
        city: "Austin",
        state: "TX",
        zipCode: "78701",
        defaultMemo: "Water bill",
        isActive: true,
      },
      {
        id: IDS.PAYEE_LONE_STAR,
        workspaceId: workspace.id,
        name: "Lone Star Insurance",
        addressLine1: "100 Congress Ave",
        addressLine2: "Suite 400",
        city: "Austin",
        state: "TX",
        zipCode: "78701",
        defaultMemo: "Monthly premium",
        isActive: true,
      },
      {
        id: IDS.PAYEE_TX_LAWN,
        workspaceId: workspace.id,
        name: "Texas Lawn Care Supply",
        addressLine1: "8200 Burnet Rd",
        city: "Austin",
        state: "TX",
        zipCode: "78757",
        defaultMemo: null, // No default memo — tests empty memo
        isActive: true,
      },
      {
        id: IDS.PAYEE_DEACTIVATED,
        workspaceId: workspace.id,
        name: "DEACTIVATED Vendor Inc",
        isActive: false, // Deactivated payee — shouldn't appear in dropdown
      },
    ],
  });
  console.log("  ✅ 8 Payees (including 1 deactivated)");

  // ─── Approval Workflow Rule ───
  const approvalRule = await prisma.approvalWorkflowRule.create({
    data: {
      id: IDS.RULE_GA_1000,
      workspaceId: workspace.id,
      priority: 1,
      minAmount: 1000.0,
      maxAmount: null, // No upper limit
      requiredApprovals: 1,
      allowSelfApproval: false,
      isActive: true,
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
        id: IDS.CAL_MARIA_HP,
        workspaceId: workspace.id,
        userId: maria.id,
        profileName: "HP LaserJet Pro - Main Office",
        horizontalOffsetPts: -1.44,
        verticalOffsetPts: -2.88,
        isDefault: true,
      },
      {
        id: IDS.CAL_JENNIFER_BROTHER,
        workspaceId: workspace.id,
        userId: jennifer.id,
        profileName: "Brother HL-L2350DW - Home Office",
        horizontalOffsetPts: 0.72,
        verticalOffsetPts: 1.44,
        isDefault: false,
      },
    ],
  });
  console.log("  ✅ 2 Calibration Profiles: Maria (HP), Jennifer (Brother)");

  // ─── CHECKS ───
  console.log("\n  📝 Seeding checks...");

  // Helper for check data
  const chk = (
    id: string,
    checkNumber: number,
    bankAccountId: string,
    payeeName: string,
    amount: number,
    amountInWords: string,
    status: CheckStatus,
    daysAgo: number,
    createdById: string,
    overrides: Record<string, unknown> = {}
  ) => ({
    id,
    workspaceId: workspace.id,
    bankAccountId,
    checkNumber,
    status,
    payeeName,
    amount,
    amountInWords,
    checkDate: d(daysAgo),
    createdById,
    createdAt: d(daysAgo),
    ...overrides,
  });

  // Check #5001 — VOID (duplicate payment)
  await prisma.check.create({
    data: chk(IDS.CHECK_5001, 5001, chase.id, "Hill Country Nursery", 3500.0, "Three Thousand Five Hundred and 00/100", CheckStatus.VOID, 30, maria.id, {
      memo: "Plant supplies - September order",
      printedAt: d(30, 10, 30),
      printedById: maria.id,
      pdfStorageUrl: "https://storage.smartbusiness.dev/checks/ch_5001.pdf",
      voidedAt: d(27),
      voidedById: maria.id,
      voidReason: "Duplicate payment — vendor paid via bank transfer",
    }),
  });

  // Check #5002 — PRINTED (happy path, under threshold)
  await prisma.check.create({
    data: chk(IDS.CHECK_5002, 5002, chase.id, "Home Depot", 287.5, "Two Hundred Eighty-Seven and 50/100", CheckStatus.PRINTED, 28, maria.id, {
      memo: "Building materials",
      printedAt: d(28, 11, 0),
      printedById: maria.id,
      pdfStorageUrl: "https://storage.smartbusiness.dev/checks/ch_5002.pdf",
    }),
  });

  // Check #5003 — PRINTED
  await prisma.check.create({
    data: chk(IDS.CHECK_5003, 5003, chase.id, "Shell Gas Station", 156.0, "One Hundred Fifty-Six and 00/100", CheckStatus.PRINTED, 27, jennifer.id, {
      memo: "Fuel - company trucks",
      printedAt: d(27, 14, 0),
      printedById: maria.id,
      pdfStorageUrl: "https://storage.smartbusiness.dev/checks/ch_5003.pdf",
    }),
  });

  // Check #5004 — CLEARED (fully reconciled)
  await prisma.check.create({
    data: chk(IDS.CHECK_5004, 5004, chase.id, "City of Austin Water Dept", 89.5, "Eighty-Nine and 50/100", CheckStatus.CLEARED, 25, jennifer.id, {
      memo: "Water bill - September",
      printedAt: d(25, 10, 0),
      printedById: maria.id,
      pdfStorageUrl: "https://storage.smartbusiness.dev/checks/ch_5004.pdf",
      clearedAt: d(11),
      clearedById: maria.id,
      clearedDate: d(11),
      clearedAmount: 89.5,
    }),
  });

  // Check #5005 — PRINTED (went through approval)
  await prisma.check.create({
    data: chk(IDS.CHECK_5005, 5005, chase.id, "Lone Star Insurance", 4200.0, "Four Thousand Two Hundred and 00/100", CheckStatus.PRINTED, 22, jennifer.id, {
      memo: "Monthly premium - October",
      printedAt: d(20, 9, 0),
      printedById: maria.id,
      pdfStorageUrl: "https://storage.smartbusiness.dev/checks/ch_5005.pdf",
    }),
  });

  // Check #5006 — PRINTED (under threshold, no approval)
  await prisma.check.create({
    data: chk(IDS.CHECK_5006, 5006, chase.id, "Hill Country Nursery", 750.0, "Seven Hundred Fifty and 00/100", CheckStatus.PRINTED, 20, maria.id, {
      memo: "Seasonal flowers",
      printedAt: d(20, 15, 0),
      printedById: maria.id,
      pdfStorageUrl: "https://storage.smartbusiness.dev/checks/ch_5006.pdf",
    }),
  });

  // Check #5007 — APPROVED (waiting in print queue)
  await prisma.check.create({
    data: chk(IDS.CHECK_5007, 5007, chase.id, "Texas Lawn Care Supply", 1500.0, "One Thousand Five Hundred and 00/100", CheckStatus.APPROVED, 18, jennifer.id, {
      memo: "Fertilizer bulk order",
    }),
  });

  // Check #5008 — PENDING_APPROVAL (waiting for decision)
  await prisma.check.create({
    data: chk(IDS.CHECK_5008, 5008, chase.id, "Home Depot", 2200.0, "Two Thousand Two Hundred and 00/100", CheckStatus.PENDING_APPROVAL, 5, jennifer.id, {
      memo: "Power tools",
    }),
  });

  // Check #5009 — APPROVED (the walkthrough check)
  await prisma.check.create({
    data: chk(IDS.CHECK_5009, 5009, chase.id, "Austin Equipment Rentals", 2500.0, "Two Thousand Five Hundred and 00/100", CheckStatus.APPROVED, 15, jennifer.id, {
      memo: "Excavator rental - 1 week",
    }),
  });

  // Check #5010 — REJECTED
  await prisma.check.create({
    data: chk(IDS.CHECK_5010, 5010, chase.id, "Hill Country Nursery", 8500.0, "Eight Thousand Five Hundred and 00/100", CheckStatus.REJECTED, 14, jennifer.id, {
      memo: "Tree installation project",
    }),
  });

  // Check #5011 — CLEARED (different cleared amount — edge case)
  await prisma.check.create({
    data: chk(IDS.CHECK_5011, 5011, chase.id, "Lone Star Insurance", 4200.0, "Four Thousand Two Hundred and 00/100", CheckStatus.CLEARED, 20, jennifer.id, {
      memo: "Monthly premium - November",
      printedAt: d(18, 9, 0),
      printedById: maria.id,
      pdfStorageUrl: "https://storage.smartbusiness.dev/checks/ch_5011.pdf",
      clearedAt: d(6),
      clearedById: maria.id,
      clearedDate: d(6),
      clearedAmount: 4195.0, // Bank cleared $5 less — edge case for reconciliation
    }),
  });

  // Check #5012 — NEW (no approval needed, just created)
  await prisma.check.create({
    data: chk(IDS.CHECK_5012, 5012, chase.id, "Shell Gas Station", 45.0, "Forty-Five and 00/100", CheckStatus.NEW, 3, jennifer.id, {
      memo: "Fuel",
    }),
  });

  // Check #5013 — NEW (same payee+amount as #5004 — tests report aggregation)
  await prisma.check.create({
    data: chk(IDS.CHECK_5013, 5013, chase.id, "City of Austin Water Dept", 89.5, "Eighty-Nine and 50/100", CheckStatus.NEW, 2, jennifer.id, {
      memo: "Water bill - October",
    }),
  });

  // Check #5014 — NEW ($999.99 — one cent below threshold, NO approval)
  await prisma.check.create({
    data: chk(IDS.CHECK_5014, 5014, chase.id, "Home Depot", 999.99, "Nine Hundred Ninety-Nine and 99/100", CheckStatus.NEW, 2, jennifer.id, {
      memo: "Boundary test - under threshold",
    }),
  });

  // Check #5015 — PENDING_APPROVAL ($1,000.00 — exactly at threshold)
  await prisma.check.create({
    data: chk(IDS.CHECK_5015, 5015, chase.id, "Home Depot", 1000.0, "One Thousand and 00/100", CheckStatus.PENDING_APPROVAL, 1, jennifer.id, {
      memo: "Boundary test - at threshold",
    }),
  });

  // Check #5016 — PRINTED (reissued from voided #5001)
  await prisma.check.create({
    data: chk(IDS.CHECK_5016, 5016, chase.id, "Hill Country Nursery", 3500.0, "Three Thousand Five Hundred and 00/100", CheckStatus.PRINTED, 25, maria.id, {
      memo: "Plant supplies - September order (reissued)",
      reissuedFromCheckId: IDS.CHECK_5001,
      printedAt: d(25, 11, 0),
      printedById: maria.id,
      pdfStorageUrl: "https://storage.smartbusiness.dev/checks/ch_5016.pdf",
    }),
  });

  // Check #5017 — PENDING_APPROVAL (high value, near max)
  await prisma.check.create({
    data: chk(IDS.CHECK_5017, 5017, chase.id, "Home Depot", 15000.0, "Fifteen Thousand and 00/100", CheckStatus.PENDING_APPROVAL, 1, jennifer.id, {
      memo: "Commercial mower purchase",
    }),
  });

  // Check #5018 — VOID (voided before printing)
  await prisma.check.create({
    data: chk(IDS.CHECK_5018, 5018, chase.id, "Texas Lawn Care Supply", 500.0, "Five Hundred and 00/100", CheckStatus.VOID, 10, jennifer.id, {
      memo: "Wrong vendor selected",
      voidedAt: d(10, 11, 0),
      voidedById: maria.id,
      voidReason: "Wrong vendor — should be Hill Country Nursery",
    }),
  });

  // Check #5019 — PRINTED (has attachments)
  await prisma.check.create({
    data: chk(IDS.CHECK_5019, 5019, chase.id, "Hill Country Nursery", 1200.0, "One Thousand Two Hundred and 00/100", CheckStatus.PRINTED, 8, jennifer.id, {
      memo: "Invoice INV-2024-01 payment",
      invoiceTableJson: {
        rows: [
          { description: "Red Oak Tree (6ft)", quantity: 2, unitPrice: 350.0, total: 700.0 },
          { description: "Delivery charge", quantity: 1, unitPrice: 150.0, total: 150.0 },
          { description: "Planting labor", quantity: 1, unitPrice: 350.0, total: 350.0 },
        ],
        subtotal: 1200.0,
      },
      printedAt: d(7, 10, 0),
      printedById: maria.id,
      pdfStorageUrl: "https://storage.smartbusiness.dev/checks/ch_5019.pdf",
    }),
  });

  // Check #5020 — NEW (minimum amount edge case)
  await prisma.check.create({
    data: chk(IDS.CHECK_5020, 5020, chase.id, "Austin Equipment Rentals", 0.01, "Zero and 01/100", CheckStatus.NEW, 1, maria.id, {
      memo: "Minimum amount test",
    }),
  });

  // ─── BofA Checks ───
  await prisma.check.create({
    data: chk(IDS.CHECK_1001, 1001, bofa.id, "Hill Country Nursery", 2000.0, "Two Thousand and 00/100", CheckStatus.PRINTED, 15, maria.id, {
      memo: "Separate bank account payment",
      printedAt: d(14, 10, 0),
      printedById: maria.id,
      pdfStorageUrl: "https://storage.smartbusiness.dev/checks/ch_1001.pdf",
    }),
  });

  await prisma.check.create({
    data: chk(IDS.CHECK_1002, 1002, bofa.id, "Home Depot", 850.0, "Eight Hundred Fifty and 00/100", CheckStatus.NEW, 3, jennifer.id, {
      memo: "Materials from BofA account",
    }),
  });

  console.log("  ✅ 22 Checks across 2 bank accounts (every status covered)");

  // ─── Check Status History ───
  console.log("\n  📜 Seeding check status history...");

  const histories = [
    // Check #5001 — NEW → PRINTED → VOID
    { checkId: IDS.CHECK_5001, fromStatus: null, toStatus: CheckStatus.NEW, changeById: maria.id, createdAt: d(30) },
    { checkId: IDS.CHECK_5001, fromStatus: CheckStatus.NEW, toStatus: CheckStatus.PRINTED, changeById: maria.id, createdAt: d(30, 10, 30) },
    { checkId: IDS.CHECK_5001, fromStatus: CheckStatus.PRINTED, toStatus: CheckStatus.VOID, changeById: maria.id, reason: "Duplicate payment — vendor paid via bank transfer", createdAt: d(27) },

    // Check #5002 — NEW → PRINTED
    { checkId: IDS.CHECK_5002, fromStatus: null, toStatus: CheckStatus.NEW, changeById: maria.id, createdAt: d(28) },
    { checkId: IDS.CHECK_5002, fromStatus: CheckStatus.NEW, toStatus: CheckStatus.PRINTED, changeById: maria.id, createdAt: d(28, 11, 0) },

    // Check #5003 — NEW → PRINTED
    { checkId: IDS.CHECK_5003, fromStatus: null, toStatus: CheckStatus.NEW, changeById: jennifer.id, createdAt: d(27) },
    { checkId: IDS.CHECK_5003, fromStatus: CheckStatus.NEW, toStatus: CheckStatus.PRINTED, changeById: maria.id, createdAt: d(27, 14, 0) },

    // Check #5004 — NEW → PRINTED → CLEARED
    { checkId: IDS.CHECK_5004, fromStatus: null, toStatus: CheckStatus.NEW, changeById: jennifer.id, createdAt: d(25) },
    { checkId: IDS.CHECK_5004, fromStatus: CheckStatus.NEW, toStatus: CheckStatus.PRINTED, changeById: maria.id, createdAt: d(25, 10, 0) },
    { checkId: IDS.CHECK_5004, fromStatus: CheckStatus.PRINTED, toStatus: CheckStatus.CLEARED, changeById: maria.id, createdAt: d(11) },

    // Check #5005 — NEW → PENDING_APPROVAL → APPROVED → PRINTED
    { checkId: IDS.CHECK_5005, fromStatus: null, toStatus: CheckStatus.PENDING_APPROVAL, changeById: jennifer.id, createdAt: d(22) },
    { checkId: IDS.CHECK_5005, fromStatus: CheckStatus.PENDING_APPROVAL, toStatus: CheckStatus.APPROVED, changeById: maria.id, createdAt: d(22, 14, 0) },
    { checkId: IDS.CHECK_5005, fromStatus: CheckStatus.APPROVED, toStatus: CheckStatus.PRINTED, changeById: maria.id, createdAt: d(20, 9, 0) },

    // Check #5007 — PENDING → APPROVED (sitting in print queue)
    { checkId: IDS.CHECK_5007, fromStatus: null, toStatus: CheckStatus.PENDING_APPROVAL, changeById: jennifer.id, createdAt: d(18) },
    { checkId: IDS.CHECK_5007, fromStatus: CheckStatus.PENDING_APPROVAL, toStatus: CheckStatus.APPROVED, changeById: david.id, createdAt: d(18, 11, 0) },

    // Check #5008 — PENDING (waiting)
    { checkId: IDS.CHECK_5008, fromStatus: null, toStatus: CheckStatus.PENDING_APPROVAL, changeById: jennifer.id, createdAt: d(5) },

    // Check #5009 — PENDING → APPROVED (the walkthrough check)
    { checkId: IDS.CHECK_5009, fromStatus: null, toStatus: CheckStatus.PENDING_APPROVAL, changeById: jennifer.id, createdAt: d(15) },
    { checkId: IDS.CHECK_5009, fromStatus: CheckStatus.PENDING_APPROVAL, toStatus: CheckStatus.APPROVED, changeById: maria.id, createdAt: d(15, 15, 45) },

    // Check #5010 — PENDING → REJECTED
    { checkId: IDS.CHECK_5010, fromStatus: null, toStatus: CheckStatus.PENDING_APPROVAL, changeById: jennifer.id, createdAt: d(14) },
    { checkId: IDS.CHECK_5010, fromStatus: CheckStatus.PENDING_APPROVAL, toStatus: CheckStatus.REJECTED, changeById: david.id, reason: "Split into two separate POs", createdAt: d(14, 11, 0) },

    // Check #5012 — NEW
    { checkId: IDS.CHECK_5012, fromStatus: null, toStatus: CheckStatus.NEW, changeById: jennifer.id, createdAt: d(3) },

    // Check #5015 — PENDING (boundary test)
    { checkId: IDS.CHECK_5015, fromStatus: null, toStatus: CheckStatus.PENDING_APPROVAL, changeById: jennifer.id, createdAt: d(1) },

    // Check #5016 — NEW → PRINTED (reissue)
    { checkId: IDS.CHECK_5016, fromStatus: null, toStatus: CheckStatus.NEW, changeById: maria.id, createdAt: d(25) },
    { checkId: IDS.CHECK_5016, fromStatus: CheckStatus.NEW, toStatus: CheckStatus.PRINTED, changeById: maria.id, createdAt: d(25, 11, 0) },

    // Check #5018 — NEW → VOID (voided before print)
    { checkId: IDS.CHECK_5018, fromStatus: null, toStatus: CheckStatus.NEW, changeById: jennifer.id, createdAt: d(10) },
    { checkId: IDS.CHECK_5018, fromStatus: CheckStatus.NEW, toStatus: CheckStatus.VOID, changeById: maria.id, reason: "Wrong vendor", createdAt: d(10, 11, 0) },

    // Check #5019 — PENDING → APPROVED → PRINTED (has attachments)
    { checkId: IDS.CHECK_5019, fromStatus: null, toStatus: CheckStatus.PENDING_APPROVAL, changeById: jennifer.id, createdAt: d(8) },
    { checkId: IDS.CHECK_5019, fromStatus: CheckStatus.PENDING_APPROVAL, toStatus: CheckStatus.APPROVED, changeById: maria.id, createdAt: d(8, 14, 0) },
    { checkId: IDS.CHECK_5019, fromStatus: CheckStatus.APPROVED, toStatus: CheckStatus.PRINTED, changeById: maria.id, createdAt: d(7, 10, 0) },
  ];

  for (const h of histories) {
    await prisma.checkStatusHistory.create({
      data: {
        checkId: h.checkId,
        fromStatus: h.fromStatus,
        toStatus: h.toStatus,
        changeById: h.changeById,
        reason: h.reason ?? null,
        ipAddress: "192.168.1.100",
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        createdAt: h.createdAt,
      },
    });
  }
  console.log(`  ✅ ${histories.length} Check Status History entries`);

  // ─── Approval Records ───
  console.log("\n  ✅ Seeding approval records...");

  await prisma.approvalRecord.createMany({
    data: [
      {
        checkId: IDS.CHECK_5005,
        ruleId: approvalRule.id,
        approverId: maria.id,
        decision: "approved",
        createdAt: d(22, 14, 0),
      },
      {
        checkId: IDS.CHECK_5007,
        ruleId: approvalRule.id,
        approverId: david.id,
        decision: "approved",
        createdAt: d(18, 11, 0),
      },
      {
        checkId: IDS.CHECK_5009,
        ruleId: approvalRule.id,
        approverId: maria.id,
        decision: "approved",
        createdAt: d(15, 15, 45),
      },
      {
        checkId: IDS.CHECK_5010,
        ruleId: approvalRule.id,
        approverId: david.id,
        decision: "rejected",
        reason: "Split into two separate POs — each under $5,000",
        createdAt: d(14, 11, 0),
      },
      {
        checkId: IDS.CHECK_5019,
        ruleId: approvalRule.id,
        approverId: maria.id,
        decision: "approved",
        createdAt: d(8, 14, 0),
      },
    ],
  });
  console.log("  ✅ 5 Approval Records (4 approved, 1 rejected)");

  // ─── Check Attachments ───
  await prisma.checkAttachment.createMany({
    data: [
      {
        checkId: IDS.CHECK_5019,
        fileName: "invoice_INV-2024-01.pdf",
        fileType: "application/pdf",
        fileSizeBytes: BigInt(251658), // ~245KB
        storageUrl: "https://storage.smartbusiness.dev/attachments/invoice_INV-2024-01.pdf",
        uploadedById: jennifer.id,
        createdAt: d(8),
      },
      {
        checkId: IDS.CHECK_5019,
        fileName: "receipt_photo.jpg",
        fileType: "image/jpeg",
        fileSizeBytes: BigInt(1258291), // ~1.2MB
        storageUrl: "https://storage.smartbusiness.dev/attachments/receipt_photo.jpg",
        uploadedById: jennifer.id,
        createdAt: d(8, 9, 5),
      },
    ],
  });
  console.log("  ✅ 2 Check Attachments on check #5019");

  // ─── Audit Log ───
  console.log("\n  📋 Seeding audit log...");

  await prisma.auditLog.createMany({
    data: [
      {
        tenantId: tenant.id,
        userId: maria.id,
        action: "tenant.created",
        entityType: "tenant",
        entityId: tenant.id,
        detailsJson: { name: "Green Acres Landscaping LLC" },
        ipAddress: "73.162.45.100",
        createdAt: d(60),
      },
      {
        tenantId: tenant.id,
        workspaceId: workspace.id,
        userId: maria.id,
        action: "workspace.created",
        entityType: "workspace",
        entityId: workspace.id,
        detailsJson: { businessName: "Green Acres Landscaping LLC" },
        ipAddress: "73.162.45.100",
        createdAt: d(59),
      },
      {
        tenantId: tenant.id,
        workspaceId: workspace.id,
        userId: maria.id,
        action: "bank_account.created",
        entityType: "bank_account",
        entityId: chase.id,
        detailsJson: { bankName: "JPMorgan Chase", accountLast4: "1012" },
        ipAddress: "73.162.45.100",
        createdAt: d(58),
      },
      {
        tenantId: tenant.id,
        workspaceId: workspace.id,
        userId: maria.id,
        action: "member.invited",
        entityType: "workspace_member",
        entityId: jennifer.id,
        detailsJson: { email: "jennifer@greenacres.com", role: "Office Manager" },
        ipAddress: "73.162.45.100",
        createdAt: d(55),
      },
      {
        tenantId: tenant.id,
        workspaceId: workspace.id,
        userId: maria.id,
        action: "check.created",
        entityType: "check",
        entityId: IDS.CHECK_5001,
        detailsJson: { checkNumber: 5001, amount: 3500.0, payeeName: "Hill Country Nursery" },
        ipAddress: "192.168.1.100",
        createdAt: d(30),
      },
      {
        tenantId: tenant.id,
        workspaceId: workspace.id,
        userId: maria.id,
        action: "check.printed",
        entityType: "check",
        entityId: IDS.CHECK_5001,
        detailsJson: { checkNumber: 5001 },
        ipAddress: "192.168.1.100",
        createdAt: d(30, 10, 30),
      },
      {
        tenantId: tenant.id,
        workspaceId: workspace.id,
        userId: maria.id,
        action: "check.voided",
        entityType: "check",
        entityId: IDS.CHECK_5001,
        detailsJson: { checkNumber: 5001, reason: "Duplicate payment — vendor paid via bank transfer" },
        ipAddress: "192.168.1.100",
        createdAt: d(27),
      },
      {
        tenantId: tenant.id,
        workspaceId: workspace.id,
        userId: maria.id,
        action: "check.approved",
        entityType: "check",
        entityId: IDS.CHECK_5009,
        detailsJson: { checkNumber: 5009, amount: 2500.0, payeeName: "Austin Equipment Rentals" },
        ipAddress: "192.168.1.100",
        createdAt: d(15, 15, 45),
      },
      {
        tenantId: tenant.id,
        workspaceId: workspace.id,
        userId: david.id,
        action: "check.rejected",
        entityType: "check",
        entityId: IDS.CHECK_5010,
        detailsJson: { checkNumber: 5010, amount: 8500.0, reason: "Split into two POs" },
        ipAddress: "192.168.1.105",
        createdAt: d(14, 11, 0),
      },
    ],
  });
  console.log("  ✅ 9 Audit Log entries");

  console.log("\n🌿 Green Acres Landscaping — DONE\n");
}

// ============================================================================
// SEED: Sunshine Pool Service (Secondary Tenant — isolation testing)
// ============================================================================
async function seedSunshinePool() {
  console.log("☀️  Seeding Tenant: Sunshine Pool Service...\n");

  // ─── Tenant (TRIAL plan, 14 days left) ───
  const tenant = await prisma.tenant.create({
    data: {
      id: IDS.TENANT_SUNSHINE,
      name: "Sunshine Pool Service",
      email: "admin@sunshinepool.com",
      plan: PlanType.TRIAL,
      planStatus: PlanStatus.TRIALING,
      status: TenantStatus.ACTIVE,
      trialEndsAt: d(-14), // Trial ends in 14 days
      stripeCustomerId: null,
      stripeSubscriptionId: null,
    },
  });
  console.log("  ✅ Tenant: Sunshine Pool Service (TRIAL)");

  // ─── Users ───
  // David is already created under Green Acres — he belongs to BOTH tenants
  // But in Prisma's model, User belongs to ONE tenant.
  // David's Green Acres user is his primary. For Sunshine, Sarah is the user.

  const sarah = await prisma.user.create({
    data: {
      id: IDS.USER_SARAH,
      tenantId: tenant.id,
      fullName: "Sarah Miller",
      email: "sarah@sunshinepool.com",
      passwordHash: SEED_PASSWORD_HASH,
      isActive: true,
      emailVerifiedAt: d(10),
      lastLoginAt: d(0, 10, 0),
    },
  });
  console.log("  ✅ 1 User: Sarah Miller");

  // ─── Workspace ───
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
      approvalEnabled: false, // NO approval workflow
      maxCheckAmount: 25000.0,
    },
  });
  console.log("  ✅ Workspace: Sunshine Pool Service (approval DISABLED)");

  // ─── Members ───
  await prisma.workspaceMember.createMany({
    data: [
      {
        workspaceId: workspace.id,
        userId: sarah.id,
        isSuperUser: true,
        canCreate: true,
        canPrint: true,
        canApprove: true,
      },
      {
        // David is a member here too — tests cross-tenant membership
        workspaceId: workspace.id,
        userId: IDS.USER_DAVID,
        isSuperUser: false,
        canCreate: true,
        canPrint: false,
        canApprove: false,
      },
    ],
  });
  console.log("  ✅ 2 Members: Sarah (SuperUser), David (Create only)");

  // ─── Bank Account ───
  const wells = await prisma.bankAccount.create({
    data: {
      id: IDS.BANK_WELLS,
      workspaceId: workspace.id,
      bankName: "Wells Fargo",
      routingNumberEncrypted: "enc_v1_121000248",
      routingNumberLast4: "0248",
      accountNumberEncrypted: "enc_v1_555666777999",
      accountNumberLast4: "9999",
      accountType: AccountType.CHECKING,
      nextCheckNumber: 2004,
      checkNumberPadding: 6,
      signatureImageUrl: "https://storage.smartbusiness.dev/signatures/sp_wells_signature.png",
      encryptionKeyVersion: 1,
      isActive: true,
    },
  });
  console.log("  ✅ 1 Bank Account: Wells Fargo");

  // ─── Payees ───
  await prisma.payee.createMany({
    data: [
      {
        id: IDS.PAYEE_POOL_CHEMICAL,
        workspaceId: workspace.id,
        name: "Pool Chemical Depot",
        addressLine1: "4500 S Lamar",
        city: "Austin",
        state: "TX",
        zipCode: "78745",
        defaultMemo: "Pool chemicals",
        isActive: true,
      },
      {
        id: IDS.PAYEE_ACME_POOL,
        workspaceId: workspace.id,
        name: "Acme Pool Parts",
        addressLine1: "1100 E Riverside",
        city: "Austin",
        state: "TX",
        zipCode: "78741",
        defaultMemo: "Pool parts",
        isActive: true,
      },
      {
        id: IDS.PAYEE_CITY_WATER_SP,
        workspaceId: workspace.id,
        name: "City of Austin Water Dept", // Same name as GA payee — tests @@unique([workspaceId, name])
        addressLine1: "625 E 10th Street",
        city: "Austin",
        state: "TX",
        zipCode: "78701",
        defaultMemo: "Water bill",
        isActive: true,
      },
    ],
  });
  console.log("  ✅ 3 Payees");

  // ─── Checks (no approval workflow) ───
  await prisma.check.createMany({
    data: [
      {
        id: IDS.CHECK_2001,
        workspaceId: workspace.id,
        bankAccountId: wells.id,
        checkNumber: 2001,
        status: CheckStatus.PRINTED,
        payeeName: "Pool Chemical Depot",
        amount: 425.0,
        amountInWords: "Four Hundred Twenty-Five and 00/100",
        checkDate: d(10),
        memo: "Monthly chemical supply",
        printedAt: d(10, 14, 0),
        printedById: sarah.id,
        pdfStorageUrl: "https://storage.smartbusiness.dev/checks/sp_ch_2001.pdf",
        createdById: sarah.id,
        createdAt: d(10),
      },
      {
        id: IDS.CHECK_2002,
        workspaceId: workspace.id,
        bankAccountId: wells.id,
        checkNumber: 2002,
        status: CheckStatus.PRINTED,
        payeeName: "Acme Pool Parts",
        amount: 1800.0,
        amountInWords: "One Thousand Eight Hundred and 00/100",
        checkDate: d(7),
        memo: "Pump replacement parts",
        printedAt: d(7, 11, 0),
        printedById: sarah.id,
        pdfStorageUrl: "https://storage.smartbusiness.dev/checks/sp_ch_2002.pdf",
        createdById: sarah.id,
        createdAt: d(7),
      },
      {
        id: IDS.CHECK_2003,
        workspaceId: workspace.id,
        bankAccountId: wells.id,
        checkNumber: 2003,
        status: CheckStatus.NEW,
        payeeName: "City of Austin Water Dept",
        amount: 65.0,
        amountInWords: "Sixty-Five and 00/100",
        checkDate: d(1),
        memo: "Water bill",
        createdById: sarah.id,
        createdAt: d(1),
      },
    ],
  });
  console.log("  ✅ 3 Checks (no approval needed — workflow disabled)");

  // Status history for Sunshine checks
  const sunshineHistories = [
    { checkId: IDS.CHECK_2001, fromStatus: null, toStatus: CheckStatus.NEW, changeById: sarah.id, createdAt: d(10) },
    { checkId: IDS.CHECK_2001, fromStatus: CheckStatus.NEW, toStatus: CheckStatus.PRINTED, changeById: sarah.id, createdAt: d(10, 14, 0) },
    { checkId: IDS.CHECK_2002, fromStatus: null, toStatus: CheckStatus.NEW, changeById: sarah.id, createdAt: d(7) },
    { checkId: IDS.CHECK_2002, fromStatus: CheckStatus.NEW, toStatus: CheckStatus.PRINTED, changeById: sarah.id, createdAt: d(7, 11, 0) },
    { checkId: IDS.CHECK_2003, fromStatus: null, toStatus: CheckStatus.NEW, changeById: sarah.id, createdAt: d(1) },
  ];

  for (const h of sunshineHistories) {
    await prisma.checkStatusHistory.create({
      data: {
        checkId: h.checkId,
        fromStatus: h.fromStatus,
        toStatus: h.toStatus,
        changeById: h.changeById,
        ipAddress: "10.0.0.50",
        createdAt: h.createdAt,
      },
    });
  }
  console.log(`  ✅ ${sunshineHistories.length} Status History entries`);

  console.log("\n☀️  Sunshine Pool Service — DONE\n");
}

// ============================================================================
// MAIN
// ============================================================================
async function main() {
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║   SmartBusiness — Production Seed Data              ║");
  console.log("║   2 Tenants · 6 Users · 25 Checks · Full Lifecycle ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  await cleanup();
  await seedCheckTemplates();
  await seedGreenAcres();
  await seedSunshinePool();

  // ─── Summary ───
  const counts = {
    tenants: await prisma.tenant.count(),
    users: await prisma.user.count(),
    workspaces: await prisma.workspace.count(),
    members: await prisma.workspaceMember.count(),
    bankAccounts: await prisma.bankAccount.count(),
    payees: await prisma.payee.count(),
    checks: await prisma.check.count(),
    statusHistory: await prisma.checkStatusHistory.count(),
    approvalRules: await prisma.approvalWorkflowRule.count(),
    approvalRecords: await prisma.approvalRecord.count(),
    attachments: await prisma.checkAttachment.count(),
    calibrationProfiles: await prisma.calibrationProfile.count(),
    checkTemplates: await prisma.checkTemplate.count(),
    auditLogs: await prisma.auditLog.count(),
  };

  console.log("═══════════════════════════════════════════════════════");
  console.log("  SEED SUMMARY");
  console.log("═══════════════════════════════════════════════════════");
  Object.entries(counts).forEach(([key, count]) => {
    console.log(`  ${key.padEnd(22)} ${count}`);
  });
  console.log("═══════════════════════════════════════════════════════");
  console.log("\n✅ Seeding complete! Run 'npx prisma studio' to explore.\n");
}

main()
  .catch((err) => {
    console.error("\n❌ Seeding failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });