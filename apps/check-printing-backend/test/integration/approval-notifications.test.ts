import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma, resetDatabase } from "../helpers/db.js";
import { createApprovalRule, createWorld, type TestUser, type TestWorld } from "../helpers/fixtures.js";
import { checksApi } from "../helpers/api.js";
import { emailQueue } from "../../src/jobs/queues.js";
import { PERMISSIONS } from "../../src/shared/constants/rbac.js";

// ═══════════════════════════════════════════════════════════════
// Approval emails. Check Printing builds each email and queues it ready to send
// ("notification-email"); platform-api's worker sends it.
//
//   waiting for approval → every person who can approve it now (same rules as the queue)
//   fully approved       → the writer
//   rejected             → the writer, with the reason
//
// Emails never carry account or routing numbers; the link only opens the check.
// ═══════════════════════════════════════════════════════════════

let world: TestWorld;

beforeEach(async () => {
  await resetDatabase();
  await emailQueue.raw.obliterate({ force: true });
  world = await createWorld({ approvalEnabled: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

interface Sent { to: string; tag: string; subject: string; html: string; text: string }

async function sentEmails(tag?: string): Promise<Sent[]> {
  const jobs = await emailQueue.raw.getJobs(["waiting", "delayed", "prioritized", "active"]);
  return jobs
    .filter((j) => j.name === "notification-email")
    .map((j) => j.data as Sent)
    .filter((e) => !tag || e.tag === tag);
}
const recipients = async (tag: string) => (await sentEmails(tag)).map((e) => e.to).sort();

// Everyone in the world who holds the approve permission (admin and both approvers).
async function approverEmails(except: TestUser[] = []): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: {
      workspaceMembers: {
        some: {
          workspaceId: world.workspaceId,
          assignedRoles: { some: { role: { rolePermissions: { some: { permission: { action: PERMISSIONS.CHECK_APPROVE } } } } } },
        },
      },
    },
    select: { email: true },
  });
  const skip = new Set(except.map((u) => u.email));
  return users.map((u) => u.email).filter((e) => !skip.has(e)).sort();
}

const write = (by: TestUser = world.editor, body: Record<string, unknown> = {}) =>
  checksApi(world, by).create({ payeeName: "Lala Company Pvt Ltd", amount: 9000, memo: "Rent", ...body });

describe("a check waiting for approval", () => {
  it("emails everyone who can approve it, never the writer; the email names the check but no bank numbers", async () => {
    await createApprovalRule(world, { minAmount: 1000 });
    const res = await write();
    expect(res.body.data.status).toBe("PENDING_APPROVAL");

    expect(await recipients("approval-request")).toEqual(await approverEmails([world.editor]));
    const [email] = await sentEmails("approval-request");
    expect(email!.subject).toBe("Approval needed: check #001001 · $9,000.00 to Lala Company Pvt Ltd");
    expect(email!.text).toContain(`http://localhost:5173/w/${world.workspaceId}/checks/${res.body.data.id}`);
    expect(email!.text).toContain("editor wrote check #001001");
    expect(email!.text).toContain('Memo: "Rent"');
    // createBankAccount uses routing 111000025 and account 987654321012.
    for (const part of [email!.subject, email!.html, email!.text]) {
      expect(part).not.toContain("987654321012");
      expect(part).not.toContain("111000025");
    }
  });

  it("emails only the rule's named approvers when it has some", async () => {
    await createApprovalRule(world, { minAmount: 1000, approvers: [world.approver1] });
    await write();
    expect(await recipients("approval-request")).toEqual([world.approver1.email]);
  });

  it("says how many approvals it needs", async () => {
    await createApprovalRule(world, { minAmount: 1000, requiredApprovals: 2 });
    await write();
    expect((await sentEmails("approval-request"))[0]!.text).toContain("It needs 2 approvals.");
  });

  it("includes the writer only when the rule allows approving your own check", async () => {
    await createApprovalRule(world, { minAmount: 1000, allowSelfApproval: false });
    await write(world.admin);
    expect(await recipients("approval-request")).not.toContain(world.admin.email);

    await prisma.approvalWorkflowRule.updateMany({ data: { allowSelfApproval: true } });
    await emailQueue.raw.obliterate({ force: true });
    await write(world.admin);
    expect(await recipients("approval-request")).toContain(world.admin.email);
  });

  it("skips people who were deactivated or removed from the workspace", async () => {
    await createApprovalRule(world, { minAmount: 1000 });
    await prisma.user.update({ where: { id: world.approver1.id }, data: { isActive: false } });
    await prisma.workspaceMember.updateMany({ where: { workspaceId: world.workspaceId, userId: world.approver2.id }, data: { deletedAt: new Date() } });
    await write();
    expect(await recipients("approval-request")).toEqual([world.admin.email]);
  });

  it("sends nothing for a draft, then emails the approvers when it is submitted", async () => {
    await createApprovalRule(world, { minAmount: 1000 });
    const draft = await write(world.editor, { saveAsDraft: true });
    expect(draft.body.data.status).toBe("NEW");
    expect(await sentEmails()).toEqual([]);

    expect((await checksApi(world, world.editor).submit(draft.body.data.id)).status).toBe(200);
    expect(await recipients("approval-request")).toEqual(await approverEmails([world.editor]));
  });

  it("sends nothing for a check that needs no approval", async () => {
    await createApprovalRule(world, { minAmount: 10_000 });
    const res = await write(world.editor, { amount: 500 });
    expect(res.body.data.status).toBe("NEW");
    expect(await sentEmails()).toEqual([]);
  });

  it("still saves the check when the email cannot be queued", async () => {
    await createApprovalRule(world, { minAmount: 1000 });
    vi.spyOn(emailQueue, "add").mockRejectedValue(new Error("Redis is down"));
    const res = await write();
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("PENDING_APPROVAL");
  });
});

describe("decisions", () => {
  it("a partial approval tells nobody; the last approval tells the writer it is ready to print", async () => {
    await createApprovalRule(world, { minAmount: 1000, requiredApprovals: 2 });
    const id = (await write()).body.data.id as string;
    await emailQueue.raw.obliterate({ force: true });

    expect((await checksApi(world, world.approver1).approve(id)).body.data.status).toBe("PENDING_APPROVAL");
    expect(await sentEmails()).toEqual([]);

    expect((await checksApi(world, world.approver2).approve(id)).body.data.status).toBe("APPROVED");
    const done = await sentEmails();
    expect(done.map((e) => [e.tag, e.to])).toEqual([["check-approved", world.editor.email]]);
    expect(done[0]!.subject).toBe("Approved: check #001001 · $9,000.00 to Lala Company Pvt Ltd");
    expect(done[0]!.text).toContain("ready to print");
  });

  it("a rejection tells the writer who rejected it and why", async () => {
    await createApprovalRule(world, { minAmount: 1000 });
    const id = (await write()).body.data.id as string;
    await emailQueue.raw.obliterate({ force: true });

    expect((await checksApi(world, world.approver1).reject(id, "Wrong amount: should be $8,000")).status).toBe(200);
    const sent = await sentEmails();
    expect(sent.map((e) => [e.tag, e.to])).toEqual([["check-rejected", world.editor.email]]);
    expect(sent[0]!.text).toContain("approver1 rejected");
    expect(sent[0]!.text).toContain("Reason: Wrong amount: should be $8,000");
  });

  it("a resubmitted check asks every approver again, including the one who rejected it", async () => {
    await createApprovalRule(world, { minAmount: 1000 });
    const id = (await write()).body.data.id as string;
    await checksApi(world, world.approver1).reject(id, "Attach the invoice");
    await emailQueue.raw.obliterate({ force: true });

    expect((await checksApi(world, world.editor).resubmit(id)).body.data.status).toBe("PENDING_APPROVAL");
    expect(await recipients("approval-request")).toEqual(await approverEmails([world.editor]));
    expect(await recipients("approval-request")).toContain(world.approver1.email);
  });

  it("the writer gets nothing once they no longer work in the workspace", async () => {
    await createApprovalRule(world, { minAmount: 1000 });
    const id = (await write()).body.data.id as string;
    await prisma.workspaceMember.updateMany({ where: { workspaceId: world.workspaceId, userId: world.editor.id }, data: { deletedAt: new Date() } });
    await emailQueue.raw.obliterate({ force: true });

    expect((await checksApi(world, world.approver1).approve(id)).body.data.status).toBe("APPROVED");
    expect(await sentEmails()).toEqual([]);
  });
});
