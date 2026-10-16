import dotenv from "dotenv";
dotenv.config();

import { prisma } from "../src/index.js";

const PRODUCT_ID = "00000000-0000-4000-8000-000000000001";

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

const ROLES = [
  {
    slug: "check-admin",
    name: "Admin",
    description: "Full access to all check-printing features",
    permissions: PERMISSIONS.map((p) => p.action),
  },
  {
    slug: "check-editor",
    name: "Editor",
    description: "Create checks and manage payees",
    permissions: ["check:create", "check:view", "payee:write", "report:view"],
  },
  {
    slug: "check-printer",
    name: "Printer",
    description: "Print approved checks",
    permissions: ["check:print", "check:view"],
  },
  {
    slug: "check-approver",
    name: "Approver",
    description: "Approve or reject checks pending approval",
    permissions: ["check:approve", "check:view"],
  },
  {
    slug: "check-viewer",
    name: "Viewer",
    description: "Read-only access to checks and reports",
    permissions: ["check:view", "report:view"],
  },
];

async function main() {
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║   SmartBusiness — RBAC Seed Data                    ║");
  console.log("║   Product · Permissions · Roles · Mappings          ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  const product = await prisma.product.upsert({
    where: { slug: "check-printing" },
    update: {},
    create: {
      id: PRODUCT_ID,
      slug: "check-printing",
      name: "Check Printing",
      description: "Print professional checks on blank paper",
      isActive: true,
    },
  });
  console.log(`✅ Product: ${product.name} (${product.id})`);

  console.log("\n📋 Seeding permissions...");
  const permissionMap = new Map<string, string>();

  for (const perm of PERMISSIONS) {
    const record = await prisma.permission.upsert({
      where: {
        productId_action: { productId: product.id, action: perm.action },
      },
      update: { description: perm.description },
      create: {
        productId: product.id,
        action: perm.action,
        description: perm.description,
      },
    });
    permissionMap.set(perm.action, record.id);
    console.log(`  ✅ ${perm.action}`);
  }

  console.log("\n🎭 Seeding roles...");
  for (const roleDef of ROLES) {
    const role = await prisma.role.upsert({
      where: {
        productId_slug: { productId: product.id, slug: roleDef.slug },
      },
      update: {
        name: roleDef.name,
        description: roleDef.description,
      },
      create: {
        productId: product.id,
        slug: roleDef.slug,
        name: roleDef.name,
        description: roleDef.description,
        isSystem: true,
      },
    });

    // Replace the role's permissions in one transaction: done as two separate steps, a
    // request arriving in between (or a crash) would see the role with no permissions.
    await prisma.$transaction([
      prisma.rolePermission.deleteMany({
        where: { roleId: role.id },
      }),
      prisma.rolePermission.createMany({
        data: roleDef.permissions.map((action) => ({
          roleId: role.id,
          permissionId: permissionMap.get(action)!,
        })),
      }),
    ]);

    console.log(`  ✅ ${roleDef.slug} (${roleDef.permissions.length} permissions)`);
  }

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  RBAC SEED SUMMARY");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  Product          1`);
  console.log(`  Permissions      ${PERMISSIONS.length}`);
  console.log(`  Roles            ${ROLES.length}`);
  console.log(`  Role-Permissions ${ROLES.reduce((sum, r) => sum + r.permissions.length, 0)}`);
  console.log("═══════════════════════════════════════════════════════");
  console.log("\n✅ RBAC seeding complete!\n");
}

main()
  .catch((err) => {
    console.error("\n❌ RBAC seeding failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
