import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@smartbusiness/database";
import { prisma, resetDatabase } from "../helpers/db.js";
import { authHeaders, createWorld, type TestUser, type TestWorld } from "../helpers/fixtures.js";
import { getApp } from "../helpers/api.js";
import { ActivityRepository } from "../../src/modules/activity/activity.repository.js";
import { AuditService } from "../../src/shared/services/audit.service.js";

// #4: the activity log. Admins read their workspace's audit trail as sentences, with
// before → after, filters and paging; the company owner reads sign-ins and security events.

interface Item {
  id: string;
  action: string;
  category: string;
  summary: string;
  actor: { name: string };
  changes: Array<{ label: string; from: string; to: string }>;
  reason: string | null;
  link: { kind: string; id: string } | null;
  ipAddress: string | null;
}

let clock = Date.parse("2026-10-20T12:00:00Z");

async function entry(
  world: TestWorld,
  user: TestUser,
  action: string,
  o: { entityType?: string; entityId?: string; details?: Prisma.InputJsonValue; at?: Date; workspaceId?: string | null; tenantId?: string } = {},
) {
  clock += 60_000;
  return prisma.auditLog.create({
    data: {
      tenantId: o.tenantId ?? world.tenantId,
      userId: user.id,
      workspaceId: o.workspaceId === undefined ? world.workspaceId : o.workspaceId,
      action,
      entityType: o.entityType ?? "Workspace",
      entityId: o.entityId ?? world.workspaceId,
      detailsJson: o.details,
      ipAddress: "203.0.113.7",
      createdAt: o.at ?? new Date(clock),
    },
  });
}

async function makeCheck(world: TestWorld, n: number, amount = 9000, payeeName = "Lala Company") {
  return prisma.check.create({
    data: {
      workspaceId: world.workspaceId,
      bankAccountId: world.bankAccountId,
      checkNumber: n,
      status: "APPROVED",
      payeeName,
      amount,
      amountInWords: "words",
      checkDate: new Date("2026-10-20T00:00:00Z"),
      createdById: world.editor.id,
    },
  });
}

function api(world: TestWorld, user: TestUser) {
  const base = `/api/v1/workspaces/${world.workspaceId}/activity`;
  const h = authHeaders(user);
  return {
    list: (q: Record<string, string> = {}) => request(getApp()).get(base).query(q).set(h),
    people: () => request(getApp()).get(`${base}/people`).set(h),
    export: (q: Record<string, string>) =>
      request(getApp())
        .get(`${base}/export`)
        .query(q)
        .set(h)
        .buffer(true)
        .parse((res, done) => {
          const chunks: Buffer[] = [];
          res.on("data", (c: Buffer) => chunks.push(c));
          res.on("end", () => done(null, Buffer.concat(chunks)));
        }),
    security: (q: Record<string, string> = {}) => request(getApp()).get(`${base}/security`).query(q).set(h),
  };
}

const items = (res: request.Response) => res.body.data as Item[];

describe("activity log (#4)", () => {
  let world: TestWorld;

  beforeEach(async () => {
    await resetDatabase();
    world = await createWorld();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("the workspace's activity", () => {
    it("newest first, as sentences with names, amounts and before → after", async () => {
      const check = await makeCheck(world, 5009);
      await entry(world, world.editor, "CHECK_CREATED", { entityType: "Check", entityId: check.id, details: { checkNumber: 5009, initialStatus: "PENDING_APPROVAL" } });
      await entry(world, world.editor, "CHECK_UPDATED", {
        entityType: "Check",
        entityId: check.id,
        details: { changes: { amount: { from: "500.00", to: "9000.00" }, memo: { from: null, to: "Invoice 778" } } },
      });
      await entry(world, world.approver1, "CHECK_APPROVED", { entityType: "Check", entityId: check.id, details: { checkNumber: 5009, requiredApprovals: 1 } });

      const res = await api(world, world.admin).list();

      expect(res.status).toBe(200);
      const [approved, updated, created] = items(res);
      expect(approved!.summary).toBe("approved check #005009 · $9,000.00 to Lala Company");
      expect(approved!.category).toBe("approvals");
      expect(approved!.link).toEqual({ kind: "check", id: check.id });
      expect(approved!.ipAddress).toBe("203.0.113.7");
      expect(updated!.summary).toBe("edited check #005009 · $9,000.00 to Lala Company");
      expect(updated!.changes).toEqual([
        { field: "amount", label: "Amount", from: "$500.00", to: "$9,000.00" },
        { field: "memo", label: "Memo", from: "(empty)", to: "Invoice 778" },
      ]);
      expect(created!.summary).toBe("wrote check #005009 · $9,000.00 to Lala Company and sent it for approval");
      expect(created!.actor.name).toBeTruthy();
    });

    it("reasons, role changes, and older entries that recorded only the new value", async () => {
      const check = await makeCheck(world, 5010);
      await entry(world, world.approver1, "CHECK_REJECTED", { entityType: "Check", entityId: check.id, details: { checkNumber: 5010, reason: "Wrong vendor" } });
      await entry(world, world.admin, "MEMBER_UPDATED", {
        entityType: "WorkspaceMember",
        details: { memberEmail: "priya@example.com", previousRoleSlugs: ["check-editor"], roleSlugs: ["check-admin"] },
      });
      const rule = await prisma.approvalWorkflowRule.create({
        data: { workspaceId: world.workspaceId, priority: 1, minAmount: 2500, requiredApprovals: 1, createdById: world.admin.id },
      });
      await entry(world, world.admin, "APPROVAL_RULE_UPDATED", { entityType: "ApprovalRule", entityId: rule.id, details: { changes: { minAmount: 2500 } } });

      const [ruleEdit, role, rejected] = items(await api(world, world.admin).list());

      expect(rejected!.reason).toBe("Wrong vendor");
      expect(role!.summary).toBe("changed the role of priya@example.com");
      expect(role!.changes).toEqual([{ field: "roles", label: "Role", from: "Editor", to: "Admin" }]);
      expect(ruleEdit!.summary).toBe("changed the approval rule for $2,500.00 and above");
      expect(ruleEdit!.changes).toEqual([{ field: "minAmount", label: "From amount", from: "(not recorded)", to: "$2,500.00" }]);
    });

    it("only this workspace: not another company's, not company-level sign-ins", async () => {
      const other = await createWorld();
      await entry(other, other.admin, "PAYEE_CREATED", { details: { name: "Other Co Payee" } });
      await entry(world, world.admin, "USER_LOGIN", { workspaceId: null, entityType: "User", entityId: world.admin.id });
      await entry(world, world.admin, "PAYEE_CREATED", { entityType: "Payee", details: { name: "Home Depot" } });

      const list = items(await api(world, world.admin).list());

      expect(list.map((i) => i.summary)).toEqual(['added payee "Home Depot"']);
    });

    it("filters: person, category, one record, and days (both included)", async () => {
      const check = await makeCheck(world, 5011);
      await entry(world, world.editor, "CHECK_CREATED", { entityType: "Check", entityId: check.id, at: new Date("2026-10-01T00:00:00Z") });
      await entry(world, world.approver1, "CHECK_APPROVED", { entityType: "Check", entityId: check.id, at: new Date("2026-10-02T23:59:59Z") });
      await entry(world, world.admin, "PAYEE_CREATED", { entityType: "Payee", details: { name: "X" }, at: new Date("2026-10-03T00:00:00Z") });
      const user = api(world, world.admin);
      const actions = async (q: Record<string, string>) => items(await user.list(q)).map((i) => i.action);

      expect(await actions({ userId: world.approver1.id })).toEqual(["CHECK_APPROVED"]);
      expect(await actions({ category: "approvals,payees" })).toEqual(["PAYEE_CREATED", "CHECK_APPROVED"]);
      expect(await actions({ entityId: check.id })).toEqual(["CHECK_APPROVED", "CHECK_CREATED"]);
      expect(await actions({ from: "2026-10-01", to: "2026-10-02" })).toEqual(["CHECK_APPROVED", "CHECK_CREATED"]);
      expect(await actions({ from: "2026-10-03" })).toEqual(["PAYEE_CREATED"]);
    });

    it("pages with a cursor: nothing missed or repeated, even with identical times", async () => {
      const same = new Date("2026-10-21T09:00:00Z");
      const written = new Set<string>();
      for (let i = 0; i < 23; i++) written.add((await entry(world, world.admin, "PAYEE_CREATED", { details: { name: `P${i}` }, at: i < 10 ? same : undefined })).id);

      const seen: string[] = [];
      let cursor: string | undefined;
      let pages = 0;
      do {
        const res = await api(world, world.admin).list({ limit: "5", ...(cursor && { cursor }) });
        seen.push(...items(res).map((i) => i.id));
        cursor = res.body.meta.nextCursor ?? undefined;
        pages++;
      } while (cursor);

      expect(pages).toBe(5);
      expect(seen).toHaveLength(23);
      expect(new Set(seen)).toEqual(written);
    });

    it("admins only", async () => {
      for (const user of [world.editor, world.viewer, world.printer, world.approver1]) {
        expect((await api(world, user).list()).status).toBe(403);
        expect((await api(world, user).export({ format: "csv" })).status).toBe(403);
      }
      expect((await api(world, world.admin).list()).status).toBe(200);
    });

    it("bad input is refused", async () => {
      const user = api(world, world.admin);
      expect((await user.list({ cursor: "not-a-cursor" })).status).toBe(400);
      expect((await user.list({ category: "security" })).status).toBe(400);
      expect((await user.list({ from: "10/01/2026" })).status).toBe(400);
      expect((await user.list({ from: "2026-10-05", to: "2026-10-01" })).status).toBe(400);
      expect((await user.list({ colour: "blue" })).status).toBe(400);
    });

    it("the people in the log, for the 'who' filter", async () => {
      await entry(world, world.editor, "PAYEE_CREATED", { details: { name: "A" } });
      await entry(world, world.approver2, "PAYEE_CREATED", { details: { name: "B" } });

      const people = (await api(world, world.admin).people()).body.data as Array<{ id: string }>;

      expect(people.map((p) => p.id).sort()).toEqual([world.editor.id, world.approver2.id].sort());
    });

    it("exports what the screen shows, and the export is itself audited", async () => {
      const check = await makeCheck(world, 5012, 250.5, "=HYPERLINK(\"x\")");
      await entry(world, world.editor, "CHECK_UPDATED", {
        entityType: "Check",
        entityId: check.id,
        details: { changes: { amount: { from: "100.00", to: "250.50" } } },
      });
      await entry(world, world.admin, "PAYEE_CREATED", { details: { name: "Home Depot" } });

      const res = await api(world, world.admin).export({ format: "csv", category: "checks" });

      expect(res.status).toBe(200);
      expect(res.headers["content-disposition"]).toMatch(/^attachment; filename="activity-log-.*\.csv"$/);
      const lines = (res.body as Buffer).toString("utf8").replace(/^﻿/, "").trim().split("\r\n");
      expect(lines[0]).toBe('"When (UTC)","Who","Email","Category","What happened","Changes","Reason","IP address"');
      expect(lines).toHaveLength(2);
      expect(lines[1]).toContain('"Amount: $100.00 → $250.50"');
      // A payee name inside the sentence starts mid-cell, so it can't run as a formula.
      expect(lines[1]).toContain('"edited check #005012 · $250.50 to =HYPERLINK(""x"")"');

      const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "REPORT_EXPORTED" } });
      expect(audit.detailsJson).toMatchObject({ report: "activity-log", format: "csv", rowCount: 1, filter: { category: ["checks"] } });
    });

    it("no audit row, no file", async () => {
      await entry(world, world.admin, "PAYEE_CREATED", { details: { name: "Home Depot" } });
      vi.spyOn(AuditService.prototype as unknown as { write: () => Promise<void> }, "write").mockRejectedValue(new Error("database down"));

      const res = await api(world, world.admin).export({ format: "csv" });

      expect(res.status).toBe(503);
      expect(res.headers["content-disposition"]).toBeUndefined();
    });

    it("refuses more than 10,000 entries in one file", async () => {
      vi.spyOn(ActivityRepository.prototype, "count").mockResolvedValue(10_001);

      const res = await api(world, world.admin).export({ format: "xlsx" });

      expect(res.status).toBe(400);
      expect(await prisma.auditLog.count({ where: { action: "REPORT_EXPORTED" } })).toBe(0);
    });
  });

  describe("sign-ins and security (company owner)", () => {
    it("the company's members, wherever their sign-ins were filed; not outsiders", async () => {
      const other = await createWorld();
      // The editor also belongs to the other company, which filed this sign-in.
      await prisma.tenantMember.create({ data: { tenantId: other.tenantId, userId: world.editor.id, role: "MEMBER" } });
      await entry(world, world.editor, "USER_LOGIN", { workspaceId: null, tenantId: other.tenantId, entityType: "User", entityId: world.editor.id });
      await entry(world, world.admin, "LOGIN_FAILED", { workspaceId: null, entityType: "Auth", entityId: world.admin.id, details: { reason: "INVALID_PASSWORD" } });
      await entry(other, other.admin, "USER_LOGIN", { workspaceId: null, entityType: "User", entityId: other.admin.id });
      await entry(world, world.admin, "PAYEE_CREATED", { details: { name: "Not a security event" } });

      const res = await api(world, world.admin).security();

      expect(res.status).toBe(200);
      expect(items(res).map((i) => [i.action, i.summary])).toEqual([
        ["LOGIN_FAILED", "failed to sign in (wrong password)"],
        ["USER_LOGIN", "signed in"],
      ]);
      expect(items(res)[0]!.reason).toBeNull();
    });

    it("failed attempts only", async () => {
      await entry(world, world.admin, "USER_LOGIN", { workspaceId: null, entityType: "User", entityId: world.admin.id });
      await entry(world, world.editor, "LOGIN_FAILED", { workspaceId: null, entityType: "Auth", entityId: world.editor.id });

      expect(items(await api(world, world.admin).security({ outcome: "failed" })).map((i) => i.action)).toEqual(["LOGIN_FAILED"]);
    });

    it("only the company owner, not a company admin or a workspace admin", async () => {
      expect((await api(world, world.editor).security()).status).toBe(403);
      await prisma.tenantMember.updateMany({ where: { tenantId: world.tenantId, userId: world.admin.id }, data: { role: "ADMIN" } });
      expect((await api(world, world.admin).security()).status).toBe(403);
    });
  });
});
