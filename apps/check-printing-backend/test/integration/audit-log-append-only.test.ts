import { beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDatabase } from "../helpers/db.js";
import { createWorld, type TestWorld } from "../helpers/fixtures.js";

// #4: the audit log is evidence. Entries can be added, never changed or removed, whatever
// code sends the statement (the database refuses it, not the app).

describe("audit log is append-only", () => {
  let world: TestWorld;
  let entryId: string;

  beforeEach(async () => {
    await resetDatabase();
    world = await createWorld();
    entryId = (
      await prisma.auditLog.create({
        data: {
          tenantId: world.tenantId,
          userId: world.admin.id,
          workspaceId: world.workspaceId,
          action: "CHECK_APPROVED",
          entityType: "Check",
          entityId: world.bankAccountId,
          detailsJson: { amount: "9000.00" },
        },
      })
    ).id;
  });

  it("new entries are written", async () => {
    expect(await prisma.auditLog.count()).toBe(1);
  });

  it("an entry cannot be changed", async () => {
    await expect(prisma.auditLog.update({ where: { id: entryId }, data: { action: "CHECK_REJECTED" } })).rejects.toThrow(/append-only/);
    await expect(prisma.$executeRawUnsafe(`UPDATE audit_log SET details_json = '{"amount":"1.00"}' WHERE id = '${entryId}'`)).rejects.toThrow(
      /append-only/,
    );

    const entry = await prisma.auditLog.findUniqueOrThrow({ where: { id: entryId } });
    expect(entry.action).toBe("CHECK_APPROVED");
    expect(entry.detailsJson).toEqual({ amount: "9000.00" });
  });

  it("an entry cannot be deleted", async () => {
    await expect(prisma.auditLog.delete({ where: { id: entryId } })).rejects.toThrow(/append-only/);
    await expect(prisma.auditLog.deleteMany({})).rejects.toThrow(/append-only/);
    await expect(prisma.$executeRawUnsafe(`DELETE FROM audit_log`)).rejects.toThrow(/append-only/);

    expect(await prisma.auditLog.count()).toBe(1);
  });

  it("removing a workspace for real cannot rewrite its history", async () => {
    // Workspaces are only ever soft-deleted. A hard delete would clear workspace_id on its
    // entries (ON DELETE SET NULL is an UPDATE), so it is refused and the history stays
    // attached. An empty workspace, so nothing but the log refers to it.
    const empty = await prisma.workspace.create({
      data: { tenantId: world.tenantId, businessName: "Empty LLC", addressLine1: "1 Main St", city: "Austin", state: "TX", zipCode: "78701" },
    });
    const entry = await prisma.auditLog.create({
      data: { tenantId: world.tenantId, userId: world.admin.id, workspaceId: empty.id, action: "WORKSPACE_CREATED", entityType: "Workspace", entityId: empty.id },
    });

    await expect(prisma.$executeRawUnsafe(`DELETE FROM workspaces WHERE id = '${empty.id}'`)).rejects.toThrow(/append-only/);

    expect((await prisma.auditLog.findUniqueOrThrow({ where: { id: entry.id } })).workspaceId).toBe(empty.id);
  });
});
