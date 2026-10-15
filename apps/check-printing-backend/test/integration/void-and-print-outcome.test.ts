import * as fs from "fs";
import * as path from "path";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDatabase } from "../helpers/db.js";
import { createApprovalRule, createPrinterProfile, createWorld, type TestWorld } from "../helpers/fixtures.js";
import { checksApi } from "../helpers/api.js";

// ═══════════════════════════════════════════════════════════════
// Void any unprinted check, confirm prints, handle spoiled checks.
//
//   Situation 1  "We don't need this check"       void before printing   → CANCELLED
//   Situation 2  "The printer jammed"              report SPOILED         → SPOILED, then reissue
//                "It printed fine"                  report OK              → print confirmed
//   Situation 3  "Mistake found after mailing it"  void after printing    → VOIDED_AFTER_PRINT
//                                                                           + stop-payment notice
// ═══════════════════════════════════════════════════════════════

const hasFont = fs.existsSync(path.resolve(process.env.E13B_FONT_PATH ?? ""));

let world: TestWorld;

beforeEach(async () => {
  await resetDatabase();
  world = await createWorld({ approvalEnabled: false });
  await createPrinterProfile(world);
});

async function draft(): Promise<string> {
  const res = await checksApi(world, world.editor).create();
  expect(res.status).toBe(201);
  return res.body.data.id;
}

async function approved(): Promise<string> {
  const id = await draft();
  expect((await checksApi(world, world.approver1).approve(id)).status).toBe(200);
  return id;
}

async function printed(): Promise<string> {
  const id = await approved();
  expect((await checksApi(world, world.printer).print(id)).status).toBe(200);
  return id;
}

const stored = (id: string) => prisma.check.findUniqueOrThrow({ where: { id } });

// ─────────────────────────────────────────────────────────────────
describe("Situation 1: void a check before it is printed (CANCELLED)", () => {
  it("an admin voids an APPROVED check; no paper exists, so no notice", async () => {
    const id = await approved();

    const res = await checksApi(world, world.admin).void(id, "Vendor already paid by transfer");
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("VOID");
    expect(res.body.data.voidType).toBe("CANCELLED");
    expect(res.body.data.notice).toBeNull();

    const history = await prisma.checkStatusHistory.findFirstOrThrow({ where: { checkId: id, toStatus: "VOID" } });
    expect(history.fromStatus).toBe("APPROVED");
    expect(history.reason).toBe("Vendor already paid by transfer");
  });

  it("the creator withdraws their own check that is waiting for approval", async () => {
    await prisma.checkPrintingSettings.update({ where: { workspaceId: world.workspaceId }, data: { approvalEnabled: true } });
    await createApprovalRule(world, { approvers: [world.approver1] });
    const id = await draft();
    expect((await stored(id)).status).toBe("PENDING_APPROVAL");

    const res = await checksApi(world, world.editor).void(id, "Created by mistake");
    expect(res.status).toBe(200);
    expect(res.body.data.voidType).toBe("CANCELLED");
    // It disappears from the approver's queue.
    expect((await checksApi(world, world.approver1).approvalQueue()).body.data).toHaveLength(0);
  });

  it("the creator closes their own REJECTED check instead of resubmitting it", async () => {
    await prisma.checkPrintingSettings.update({ where: { workspaceId: world.workspaceId }, data: { approvalEnabled: true } });
    await createApprovalRule(world, { approvers: [world.approver1] });
    const id = await draft();
    expect((await checksApi(world, world.approver1).reject(id, "Wrong vendor")).status).toBe(200);

    const res = await checksApi(world, world.editor).void(id, "Not needed any more");
    expect(res.status).toBe(200);
    expect(res.body.data.voidType).toBe("CANCELLED");
  });

  it("someone else's check cannot be withdrawn without void permission", async () => {
    const id = await approved();
    // The approver has neither void permission nor authorship.
    const res = await checksApi(world, world.approver1).void(id, "Not mine");
    expect(res.status).toBe(403);
    expect((await stored(id)).status).toBe("APPROVED");
  });

  it("a NEW draft is deleted, not voided", async () => {
    const id = await draft();
    const res = await checksApi(world, world.admin).void(id, "Use delete");
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/cannot move from NEW to VOID/);
  });

  it("a void reason is required", async () => {
    const id = await approved();
    const res = await checksApi(world, world.admin).void(id, "");
    expect(res.status).toBe(400);
  });

  it("a cancelled check can be reissued as a new number", async () => {
    const id = await approved();
    await checksApi(world, world.admin).void(id, "Wrong amount");

    const res = await checksApi(world, world.editor).reissue(id);
    expect(res.status).toBe(201);
    expect(res.body.data.checkNumber).toBe(1002);
  });
});

// ─────────────────────────────────────────────────────────────────
describe.skipIf(!hasFont)("Situation 2: report what came out of the printer", () => {
  it("OK: the print is confirmed, once, with who and when", async () => {
    const id = await printed();

    const res = await checksApi(world, world.printer).printOutcome(id, { outcome: "OK" });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("PRINTED");
    expect(res.body.data.printConfirmedBy.id).toBe(world.printer.id);
    expect(res.body.data.printConfirmedAt).toBeTruthy();

    const again = await checksApi(world, world.printer).printOutcome(id, { outcome: "OK" });
    expect(again.status).toBe(409);
    expect(await prisma.auditLog.count({ where: { action: "CHECK_PRINT_CONFIRMED", entityId: id } })).toBe(1);
  });

  it("SPOILED: the check is voided as spoiled, with the reason and a destroy-the-paper notice", async () => {
    const id = await printed();

    const res = await checksApi(world, world.printer).printOutcome(id, { outcome: "SPOILED", reason: "Paper jam" });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("VOID");
    expect(res.body.data.voidType).toBe("SPOILED");
    expect(res.body.data.voidReason).toBe("Spoiled during printing: Paper jam");
    expect(res.body.data.notice).toBe(
      "Destroy the spoiled paper for check #1001. To pay this payee, reissue the check: it gets a new number.",
    );
    expect(await prisma.auditLog.count({ where: { action: "CHECK_SPOILED", entityId: id } })).toBe(1);
  });

  it("a spoiled check's PDF can no longer be downloaded (no reprinting the same number)", async () => {
    const id = await printed();
    await checksApi(world, world.printer).printOutcome(id, { outcome: "SPOILED", reason: "Toner streak" });

    const res = await checksApi(world, world.printer).pdf(id);
    expect(res.status).toBe(409);
  });

  it("the replacement gets a new number and goes through approval like any new check", async () => {
    await prisma.checkPrintingSettings.update({ where: { workspaceId: world.workspaceId }, data: { approvalEnabled: true } });
    await createApprovalRule(world, { approvers: [world.approver1] });
    const id = await draft();
    await checksApi(world, world.approver1).approve(id);
    await checksApi(world, world.printer).print(id);
    await checksApi(world, world.printer).printOutcome(id, { outcome: "SPOILED", reason: "Paper jam" });

    const replacement = await checksApi(world, world.editor).reissue(id);
    expect(replacement.status).toBe(201);
    expect(replacement.body.data.checkNumber).not.toBe(1001);
    expect(replacement.body.data.status).toBe("PENDING_APPROVAL");
  });

  it("SPOILED needs a reason", async () => {
    const id = await printed();
    const res = await checksApi(world, world.printer).printOutcome(id, { outcome: "SPOILED" });
    expect(res.status).toBe(400);
    expect((await stored(id)).status).toBe("PRINTED");
  });

  it("a confirmed-OK print cannot later be reported as spoiled (that is a void after print)", async () => {
    const id = await printed();
    await checksApi(world, world.printer).printOutcome(id, { outcome: "OK" });

    const res = await checksApi(world, world.printer).printOutcome(id, { outcome: "SPOILED", reason: "Changed my mind" });
    expect(res.status).toBe(409);
    expect((await stored(id)).status).toBe("PRINTED");
  });

  it("an outcome can only be reported for a printed check", async () => {
    const id = await approved();
    const res = await checksApi(world, world.printer).printOutcome(id, { outcome: "OK" });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/has not been printed/);
  });

  it("OK and SPOILED reported at the same moment: exactly one is recorded", async () => {
    const id = await printed();
    const [ok, spoiled] = await Promise.all([
      checksApi(world, world.printer).printOutcome(id, { outcome: "OK" }),
      checksApi(world, world.admin).printOutcome(id, { outcome: "SPOILED", reason: "Paper jam" }),
    ]);

    expect([ok.status, spoiled.status].sort()).toEqual([200, 409]);
    const check = await stored(id);
    if (ok.status === 200) {
      expect(check.status).toBe("PRINTED");
      expect(check.printConfirmedAt).not.toBeNull();
    } else {
      expect(check.status).toBe("VOID");
      expect(check.printConfirmedAt).toBeNull();
    }
  });

  it("only people who can print may report the outcome", async () => {
    const id = await printed();
    const res = await checksApi(world, world.viewer).printOutcome(id, { outcome: "OK" });
    expect(res.status).toBe(403);
  });

  it("lists printed checks whose outcome nobody has reported yet", async () => {
    const unconfirmed = await printed();
    const confirmed = await printed();
    await checksApi(world, world.printer).printOutcome(confirmed, { outcome: "OK" });
    await approved(); // not printed: not listed

    const res = await checksApi(world, world.admin).list({ printUnconfirmed: "true" });
    expect(res.status).toBe(200);
    expect(res.body.data.map((c: { id: string }) => c.id)).toEqual([unconfirmed]);
  });
});

// ─────────────────────────────────────────────────────────────────
describe.skipIf(!hasFont)("Situation 3: void a check after it was printed (VOIDED_AFTER_PRINT)", () => {
  it("warns that the bank may still pay it unless a stop payment is placed", async () => {
    const id = await printed();
    await checksApi(world, world.printer).printOutcome(id, { outcome: "OK" });

    const res = await checksApi(world, world.admin).void(id, "Sent to the wrong vendor");
    expect(res.status).toBe(200);
    expect(res.body.data.voidType).toBe("VOIDED_AFTER_PRINT");
    expect(res.body.data.notice).toBe(
      "Check #1001 was printed. If it was sent or may be cashed, contact your bank to place a stop payment on it.",
    );
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "CHECK_VOIDED", entityId: id } });
    expect(audit.detailsJson).toMatchObject({ voidType: "VOIDED_AFTER_PRINT", stopPaymentAdvised: true });
  });

  it("only someone with void permission can void a printed check, even its creator", async () => {
    const id = await printed();
    const res = await checksApi(world, world.editor).void(id, "I created it");
    expect(res.status).toBe(403);
    expect((await stored(id)).status).toBe("PRINTED");
  });

  it("void and print at the same moment: exactly one wins", async () => {
    const id = await approved();
    const [print, voided] = await Promise.all([
      checksApi(world, world.printer).print(id),
      checksApi(world, world.admin).void(id, "Cancel it"),
    ]);

    expect([print.status, voided.status].sort()).toEqual([200, 409]);
    const check = await stored(id);
    if (print.status === 200) {
      expect(check.status).toBe("PRINTED");
    } else {
      expect(check.status).toBe("VOID");
      expect(check.voidType).toBe("CANCELLED");
      expect(check.pdfStorageUrl).toBeNull();
    }
  });
});
