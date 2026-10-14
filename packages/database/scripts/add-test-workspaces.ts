import "dotenv/config";
import { prisma } from "../src/index.js";

const TENANT_ID = "10000000-0000-0000-0000-000000000001"; // Green Acres Landscaping LLC

const USERS = {
  MARIA: "20000000-0000-0000-0000-000000000001",
  JENNIFER: "20000000-0000-0000-0000-000000000002",
  DAVID: "20000000-0000-0000-0000-000000000003",
};

async function main() {
  console.log("========================================");
  console.log(" Adding Test Workspaces to Green Acres ");
  console.log("========================================\n");

  // 1. North Branch & Operations
  const northWs = await prisma.workspace.upsert({
    where: { id: "30000000-0000-0000-0000-000000000003" },
    update: {
      businessName: "North Branch & Operations",
      addressLine1: "450 Research Blvd, Ste 200",
      city: "Round Rock",
      state: "TX",
      zipCode: "78664",
      phone: "(512) 555-0210",
    },
    create: {
      id: "30000000-0000-0000-0000-000000000003",
      tenantId: TENANT_ID,
      businessName: "North Branch & Operations",
      addressLine1: "450 Research Blvd, Ste 200",
      city: "Round Rock",
      state: "TX",
      zipCode: "78664",
      phone: "(512) 555-0210",
    },
  });

  await prisma.attendanceSettings.upsert({
    where: { workspaceId: northWs.id },
    update: {
      latitude: 30.5083,
      longitude: -97.6789,
      radiusMeters: 120,
      graceMinutes: 15,
    },
    create: {
      workspaceId: northWs.id,
      latitude: 30.5083,
      longitude: -97.6789,
      radiusMeters: 120,
      graceMinutes: 15,
    },
  });

  // Assign Maria and Jennifer as members to North Branch
  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: northWs.id, userId: USERS.MARIA } },
    update: {},
    create: { workspaceId: northWs.id, userId: USERS.MARIA },
  });

  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: northWs.id, userId: USERS.JENNIFER } },
    update: {},
    create: { workspaceId: northWs.id, userId: USERS.JENNIFER },
  });

  console.log("  Created/verified: North Branch & Operations (Round Rock, TX)");

  // 2. South Logistics & Warehouse
  const southWs = await prisma.workspace.upsert({
    where: { id: "30000000-0000-0000-0000-000000000004" },
    update: {
      businessName: "South Logistics & Warehouse",
      addressLine1: "920 Congress Ave, Bay 4",
      city: "San Marcos",
      state: "TX",
      zipCode: "78666",
      phone: "(512) 555-0340",
    },
    create: {
      id: "30000000-0000-0000-0000-000000000004",
      tenantId: TENANT_ID,
      businessName: "South Logistics & Warehouse",
      addressLine1: "920 Congress Ave, Bay 4",
      city: "San Marcos",
      state: "TX",
      zipCode: "78666",
      phone: "(512) 555-0340",
    },
  });

  await prisma.attendanceSettings.upsert({
    where: { workspaceId: southWs.id },
    update: {
      latitude: 29.8833,
      longitude: -97.9414,
      radiusMeters: 150,
      graceMinutes: 10,
    },
    create: {
      workspaceId: southWs.id,
      latitude: 29.8833,
      longitude: -97.9414,
      radiusMeters: 150,
      graceMinutes: 10,
    },
  });

  // Assign Maria and David as members to South Logistics
  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: southWs.id, userId: USERS.MARIA } },
    update: {},
    create: { workspaceId: southWs.id, userId: USERS.MARIA },
  });

  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: southWs.id, userId: USERS.DAVID } },
    update: {},
    create: { workspaceId: southWs.id, userId: USERS.DAVID },
  });

  console.log("  Created/verified: South Logistics & Warehouse (San Marcos, TX)");

  console.log("\nTest workspaces successfully created!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
