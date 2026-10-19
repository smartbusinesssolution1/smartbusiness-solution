import * as fs from "fs";
import * as path from "path";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDatabase } from "../helpers/db.js";
import { authHeaders, createWorld, type TestUser, type TestWorld } from "../helpers/fixtures.js";
import { checksApi, getApp } from "../helpers/api.js";

// ═══════════════════════════════════════════════════════════════
// Copy a printer profile for other check paper in the same printer.
//
//   Calibration measures the printer, so the copy keeps it exactly (offsets,
//   measurements, who calibrated it and when). Verification is about where the check
//   lands on the paper, so the copy starts unverified. The source is not touched.
// ═══════════════════════════════════════════════════════════════

const hasFont = fs.existsSync(path.resolve(process.env.E13B_FONT_PATH ?? ""));

let world: TestWorld;

beforeEach(async () => {
  await resetDatabase();
  world = await createWorld({ approvalEnabled: false });
});

const base = () => `/api/v1/workspaces/${world.workspaceId}/calibration`;

// Measured slightly off the reference lines, so the profile has real offsets to copy.
async function verifiedThreePerPage(): Promise<string> {
  const res = await request(getApp())
    .post(base())
    .set(authHeaders(world.printer))
    .send({
      profileName: "Office HP - 3 per page",
      paperSize: "LETTER",
      layout: "THREE_PER_PAGE",
      tray: "Tray 2",
      measurements: { unit: "in", sheets: Array(3).fill({ x1: 1.02, x2: 7.52, y1: 1.04, y2: 10.04 }) },
    });
  expect(res.status).toBe(201);
  await prisma.calibrationProfile.update({
    where: { id: res.body.data.id },
    data: { verifiedAt: new Date(), verifiedById: world.printer.id },
  });
  return res.body.data.id;
}

const copy = (id: string, body: Record<string, unknown>, user: TestUser = world.printer) =>
  request(getApp()).post(`${base()}/${id}/copy`).set(authHeaders(user)).send(body);

describe("copying a printer profile for other check paper", () => {
  it("keeps the calibration exactly, starts unverified and not default, and leaves the source alone", async () => {
    const sourceId = await verifiedThreePerPage();
    const before = await prisma.calibrationProfile.findUniqueOrThrow({ where: { id: sourceId } });

    const res = await copy(sourceId, { profileName: "Office HP - check on top", layout: "CHECK_TOP" });
    expect(res.status).toBe(201);
    const c = res.body.data;
    expect(c.id).not.toBe(sourceId);
    expect(c).toMatchObject({
      profileName: "Office HP - check on top",
      layout: "CHECK_TOP",
      paperSize: "LETTER",
      stockType: "PLAIN_PAPER",
      tray: "Tray 2",
      horizontalOffsetPts: before.horizontalOffsetPts.toFixed(2),
      verticalOffsetPts: before.verticalOffsetPts.toFixed(2),
      isDefault: false,
      nextSlot: 1,
      calibratedAt: before.calibratedAt.toISOString(),
      calibratedById: before.calibratedById,
    });
    expect(Number(c.horizontalOffsetPts)).not.toBe(0);
    expect(c.verification.verified).toBe(false);
    expect(c.measurements.sheets).toHaveLength(3);
    expect(c.repeatability).toEqual((await request(getApp()).get(`${base()}/${sourceId}`).set(authHeaders(world.printer))).body.data.repeatability);

    const after = await prisma.calibrationProfile.findUniqueOrThrow({ where: { id: sourceId } });
    expect(after).toEqual(before);

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "CALIBRATION_COPIED" } });
    expect(audit.entityId).toBe(c.id);
    expect((audit.detailsJson as { sourceProfileId: string }).sourceProfileId).toBe(sourceId);
  });

  it("allows the same layout on another paper type, and an explicit tray (or none)", async () => {
    const sourceId = await verifiedThreePerPage();
    const res = await copy(sourceId, { profileName: "Office HP - perforated", layout: "THREE_PER_PAGE", stockType: "PERFORATED_STOCK", tray: null });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ layout: "THREE_PER_PAGE", stockType: "PERFORATED_STOCK", tray: null });
  });

  it("refuses an exact duplicate (same layout and paper type)", async () => {
    const sourceId = await verifiedThreePerPage();
    const res = await copy(sourceId, { profileName: "Same again", layout: "THREE_PER_PAGE" });
    expect(res.status).toBe(400);
    expect(res.body.error.details.layout).toBeDefined();
    expect(await prisma.calibrationProfile.count()).toBe(1);
  });

  it("refuses to copy a profile calibrated with an older calibration sheet", async () => {
    const sourceId = await verifiedThreePerPage();
    await prisma.calibrationProfile.update({ where: { id: sourceId }, data: { refVersion: 1 } });
    const res = await copy(sourceId, { profileName: "Copy", layout: "CHECK_TOP" });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/older calibration sheet/);
    expect(await prisma.calibrationProfile.count()).toBe(1);
  });

  it("a profile of another workspace is not found", async () => {
    const otherWorld = await createWorld({ approvalEnabled: false });
    const sourceId = await verifiedThreePerPage();
    const res = await request(getApp())
      .post(`/api/v1/workspaces/${otherWorld.workspaceId}/calibration/${sourceId}/copy`)
      .set(authHeaders(otherWorld.printer))
      .send({ profileName: "Stolen", layout: "CHECK_TOP" });
    expect(res.status).toBe(404);
  });

  it("needs the print permission, and a name and layout", async () => {
    const sourceId = await verifiedThreePerPage();
    expect((await copy(sourceId, { profileName: "Copy", layout: "CHECK_TOP" }, world.viewer)).status).toBe(403);
    expect((await copy(sourceId, { layout: "CHECK_TOP" })).status).toBe(400);
    expect((await copy(sourceId, { profileName: "Copy" })).status).toBe(400);
    expect((await copy(sourceId, { profileName: "Copy", layout: "SIDEWAYS" })).status).toBe(400);
  });

  it.skipIf(!hasFont)("prints with the copy's layout and the source's offsets", async () => {
    const sourceId = await verifiedThreePerPage();
    const copyId = (await copy(sourceId, { profileName: "Office HP - check on top", layout: "CHECK_TOP" })).body.data.id;
    const created = await checksApi(world, world.editor).create();
    expect(created.status).toBe(201);

    const res = await request(getApp())
      .post(`/api/v1/workspaces/${world.workspaceId}/checks/${created.body.data.id}/print`)
      .set(authHeaders(world.printer))
      .send({ calibrationProfileId: copyId });
    expect(res.status).toBe(200);
    const source = await prisma.calibrationProfile.findUniqueOrThrow({ where: { id: sourceId } });
    expect(res.body.data.printSnapshot).toMatchObject({
      calibrationProfileId: copyId,
      layout: "CHECK_TOP",
      position: null,
      horizontalOffsetPts: source.horizontalOffsetPts.toFixed(2),
      verticalOffsetPts: source.verticalOffsetPts.toFixed(2),
    });
  });
});
