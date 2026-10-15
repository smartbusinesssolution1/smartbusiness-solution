import * as fs from "fs";
import * as path from "path";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDatabase } from "../helpers/db.js";
import { authHeaders, createWorld, type TestWorld } from "../helpers/fixtures.js";
import { checksApi, getApp } from "../helpers/api.js";
import { templateForPrinter } from "../../src/modules/pdf/pdf.templates.js";
import { PTS_PER_MM } from "../../src/modules/pdf/pdf.types.js";
import { verificationExpectations, type VerificationItem } from "../../src/modules/calibration/calibration.verification.js";

// ═══════════════════════════════════════════════════════════════
// #5: check-on-bottom and three-per-page paper.
//
//   The layout belongs to the printer profile (it describes the paper in that tray).
//   Changing it means different paper, so the old verification no longer counts.
//   On three-per-page paper the person printing picks the slot (1, 2 or 3); it is
//   saved on the check so the record shows exactly where it was printed.
// ═══════════════════════════════════════════════════════════════

const hasFont = fs.existsSync(path.resolve(process.env.E13B_FONT_PATH ?? ""));

let world: TestWorld;

beforeEach(async () => {
  await resetDatabase();
  world = await createWorld({ approvalEnabled: false });
});

function profilesApi() {
  const base = `/api/v1/workspaces/${world.workspaceId}/calibration`;
  const headers = authHeaders(world.printer);
  const http = () => request(getApp());
  return {
    // Measurements equal to the reference sheet: no offset, so the profile is usable.
    create: (body: Record<string, unknown>) =>
      http()
        .post(base)
        .set(headers)
        .send({
          profileName: "Office HP",
          paperSize: "LETTER",
          measurements: { unit: "in", sheets: Array(3).fill({ x1: 1, x2: 7.5, y1: 1, y2: 10 }) },
          ...body,
        }),
    update: (id: string, body: Record<string, unknown>) => http().put(`${base}/${id}`).set(headers).send(body),
    verificationPage: (id: string) => http().get(`${base}/${id}/verification-page`).set(headers),
    verify: (id: string, body: Record<string, unknown>) => http().post(`${base}/${id}/verification`).set(headers).send(body),
  };
}

async function newProfile(layout?: string): Promise<string> {
  const res = await profilesApi().create(layout ? { layout } : {});
  expect(res.status).toBe(201);
  return res.body.data.id;
}

// A perfect sample: every landmark measured exactly where the template puts it.
function perfectMeasurements(layout: "CHECK_MIDDLE" | "CHECK_BOTTOM" | "THREE_PER_PAGE"): { unit: "mm" } & Record<VerificationItem, number> {
  const expectations = verificationExpectations(
    templateForPrinter({ paperSize: "LETTER", stockType: "PLAIN_PAPER", layout }),
  );
  return {
    unit: "mm" as const,
    ...(Object.fromEntries(
      expectations.map((e) => [e.item, Math.round((e.expectedPts / PTS_PER_MM) * 100) / 100]),
    ) as Record<VerificationItem, number>),
  };
}

function printWith(checkId: string, body: Record<string, unknown>) {
  return request(getApp())
    .post(`/api/v1/workspaces/${world.workspaceId}/checks/${checkId}/print`)
    .set(authHeaders(world.printer))
    .send(body);
}

async function approvedCheck(body: Record<string, unknown> = {}): Promise<string> {
  const res = await checksApi(world, world.editor).create(body);
  expect(res.status).toBe(201);
  const id = res.body.data.id as string;
  if (res.body.data.status !== "APPROVED") {
    expect((await checksApi(world, world.approver1).approve(id)).status).toBe(200);
  }
  return id;
}

// ─────────────────────────────────────────────────────────────────
describe("the layout is part of the printer profile", () => {
  it("defaults to check in the middle, the most common voucher paper", async () => {
    const res = await profilesApi().create({});
    expect(res.status).toBe(201);
    expect(res.body.data.layout).toBe("CHECK_MIDDLE");
  });

  it.each(["CHECK_TOP", "CHECK_BOTTOM", "THREE_PER_PAGE"])("saves %s", async (layout) => {
    const res = await profilesApi().create({ layout });
    expect(res.status).toBe(201);
    expect(res.body.data.layout).toBe(layout);
  });

  it("refuses a layout it does not know", async () => {
    const res = await profilesApi().create({ layout: "CHECK_SIDEWAYS" });
    expect(res.status).toBe(400);
  });
});

describe("changing the layout means different paper, so verification starts over", () => {
  it("clears the verification and records why in the audit log", async () => {
    const id = await newProfile("CHECK_MIDDLE");
    const verified = await profilesApi().verify(id, perfectMeasurements("CHECK_MIDDLE"));
    expect(verified.status).toBe(200);
    expect(verified.body.data.profile.verification.verified).toBe(true);

    const res = await profilesApi().update(id, { layout: "CHECK_BOTTOM" });
    expect(res.status).toBe(200);
    expect(res.body.data.layout).toBe("CHECK_BOTTOM");
    expect(res.body.data.verification.verified).toBe(false);

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { entityId: id, action: "CALIBRATION_UPDATED" },
      orderBy: { createdAt: "desc" },
    });
    expect(audit.detailsJson).toMatchObject({ verificationCleared: true, previousLayout: "CHECK_MIDDLE", layout: "CHECK_BOTTOM" });
  });

  it("keeps the verification when the layout is sent unchanged or only the name changes", async () => {
    const id = await newProfile("CHECK_MIDDLE");
    expect((await profilesApi().verify(id, perfectMeasurements("CHECK_MIDDLE"))).status).toBe(200);

    const same = await profilesApi().update(id, { layout: "CHECK_MIDDLE", profileName: "Front desk HP" });
    expect(same.status).toBe(200);
    expect(same.body.data.verification.verified).toBe(true);
  });

  it("verifies a check-on-bottom sample against check-on-bottom positions", async () => {
    const id = await newProfile("CHECK_BOTTOM");
    // The sample's tear lines are at different heights than a middle check's...
    const middle = perfectMeasurements("CHECK_MIDDLE");
    const bottom = perfectMeasurements("CHECK_BOTTOM");
    expect(bottom.upperTearLine).not.toBe(middle.upperTearLine);

    // ...so measuring the right paper passes, and middle-check numbers fail.
    expect((await profilesApi().verify(id, bottom)).body.data.passed).toBe(true);
    expect((await profilesApi().verify(id, middle)).body.data.passed).toBe(false);
  });

  it.each(["CHECK_BOTTOM", "THREE_PER_PAGE"])("prints a %s verification sample", async (layout) => {
    const id = await newProfile(layout);
    const res = await profilesApi().verificationPage(id);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(Buffer.from(res.body).subarray(0, 5).toString()).toBe("%PDF-");
  });
});

// ─────────────────────────────────────────────────────────────────
describe.skipIf(!hasFont)("printing on three-per-page paper", () => {
  it("prints in the chosen slot and saves layout and slot with the check", async () => {
    const profileId = await newProfile("THREE_PER_PAGE");
    const id = await approvedCheck();

    const res = await printWith(id, { calibrationProfileId: profileId, position: 2 });
    expect(res.status).toBe(200);
    expect(res.body.data.printSnapshot).toMatchObject({ layout: "THREE_PER_PAGE", position: 2, paperSize: "LETTER" });
    expect(res.body.data.notice).toBeNull();

    const stored = await prisma.check.findUniqueOrThrow({ where: { id } });
    expect(stored.printLayout).toBe("THREE_PER_PAGE");
    expect(stored.printPosition).toBe(2);
  });

  it("uses the top slot when no slot is given", async () => {
    const profileId = await newProfile("THREE_PER_PAGE");
    const res = await printWith(await approvedCheck(), { calibrationProfileId: profileId });
    expect(res.status).toBe(200);
    expect(res.body.data.printSnapshot.position).toBe(1);
  });

  it.each([0, 4, 1.5])("refuses slot %s (there are only slots 1, 2 and 3)", async (position) => {
    const profileId = await newProfile("THREE_PER_PAGE");
    const id = await approvedCheck();
    const res = await printWith(id, { calibrationProfileId: profileId, position });
    expect(res.status).toBe(400);
    expect((await prisma.check.findUniqueOrThrow({ where: { id } })).status).toBe("APPROVED");
  });

  it("refuses a slot on paper with one check per sheet, instead of ignoring it", async () => {
    const profileId = await newProfile("CHECK_BOTTOM");
    const id = await approvedCheck();
    const res = await printWith(id, { calibrationProfileId: profileId, position: 2 });
    expect(res.status).toBe(400);
    expect(res.body.error.details.position).toBeDefined();
    expect((await prisma.check.findUniqueOrThrow({ where: { id } })).status).toBe("APPROVED");
  });

  it("prints a check with invoice lines anyway, and says the lines were not printed", async () => {
    const profileId = await newProfile("THREE_PER_PAGE");
    const id = await approvedCheck({
      amount: 300,
      invoiceItems: [
        { description: "INV-1001 paper", amount: 100 },
        { description: "INV-1002 toner", amount: 200 },
      ],
    });
    const res = await printWith(id, { calibrationProfileId: profileId, position: 3 });
    expect(res.status).toBe(200);
    expect(res.body.data.notice).toMatch(/no stubs, so the invoice lines were not printed/);
  });

  it("check-on-bottom prints with its layout saved and no slot", async () => {
    const profileId = await newProfile("CHECK_BOTTOM");
    const res = await printWith(await approvedCheck(), { calibrationProfileId: profileId });
    expect(res.status).toBe(200);
    expect(res.body.data.printSnapshot).toMatchObject({ layout: "CHECK_BOTTOM", position: null });
  });
});
