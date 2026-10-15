import * as fs from "fs";
import * as path from "path";
import request from "supertest";
import sharp from "sharp";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDatabase } from "../helpers/db.js";
import { authHeaders, createPrinterProfile, createWorld, type TestUser, type TestWorld } from "../helpers/fixtures.js";
import { checksApi, getApp } from "../helpers/api.js";
import { TEST_STORAGE_PATH } from "../setup/test-env.js";

// #3: upload, view, replace and remove a bank account's signature, and print with it.

const hasFont = fs.existsSync(path.resolve(process.env.E13B_FONT_PATH ?? ""));

const signaturePng = () =>
  sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="300">
        <rect width="100%" height="100%" fill="#ffffff"/>
        <path d="M 180 180 C 270 30, 360 270, 450 150 S 630 60, 720 165" stroke="#1a237e" stroke-width="10" fill="none"/>
      </svg>`,
    ),
  )
    .png()
    .toBuffer();

let world: TestWorld;

beforeEach(async () => {
  await resetDatabase();
  world = await createWorld();
});

const url = (suffix = "") => `/api/v1/workspaces/${world.workspaceId}/bank-accounts/${world.bankAccountId}${suffix}`;

async function upload(user: TestUser, file: Buffer | null, authorized: string | null = "true") {
  const req = request(getApp()).put(url("/signature")).set(authHeaders(user));
  if (authorized !== null) req.field("authorized", authorized);
  if (file) req.attach("signature", file, { filename: "signature.png", contentType: "image/png" });
  return req;
}

const view = (user: TestUser) =>
  request(getApp())
    .get(url("/signature"))
    .set(authHeaders(user))
    .buffer(true)
    .parse((res, done) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => done(null, Buffer.concat(chunks)));
    });

const storedSignatures = () => {
  const dir = path.join(TEST_STORAGE_PATH, "signatures", world.workspaceId);
  return fs.existsSync(dir) ? fs.readdirSync(dir) : [];
};

describe("signature upload", () => {
  it("an admin uploads a signature; the account now has one", async () => {
    const res = await upload(world.admin, await signaturePng());

    expect(res.status).toBe(200);
    expect(res.body.data.hasSignature).toBe(true);
    expect(res.body.data.signatureUpdatedAt).toBeTruthy();
    const account = await prisma.bankAccount.findUniqueOrThrow({ where: { id: world.bankAccountId } });
    expect(account.signatureStorageKey).toMatch(new RegExp(`^signatures/${world.workspaceId}/${world.bankAccountId}-[0-9a-f-]{36}\\.png$`));
    expect(account.signatureUpdatedById).toBe(world.admin.id);
  });

  it("stores the signature encrypted", async () => {
    await upload(world.admin, await signaturePng());
    const [file] = storedSignatures();
    const onDisk = fs.readFileSync(path.join(TEST_STORAGE_PATH, "signatures", world.workspaceId, file!));
    expect(onDisk.subarray(0, 4).toString()).toBe("SBE1");
    expect(onDisk.toString("latin1")).not.toContain("PNG");
  });

  it("records the upload and the authorization confirmation in the audit log", async () => {
    await upload(world.admin, await signaturePng());
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "SIGNATURE_UPLOADED" } });
    expect(audit.userId).toBe(world.admin.id);
    expect(audit.detailsJson).toMatchObject({ authorizedAttestation: true, previousStorageKey: null });
  });

  it("requires the uploader to confirm they are authorized", async () => {
    for (const authorized of [null, "false"]) {
      const res = await upload(world.admin, await signaturePng(), authorized);
      expect(res.status).toBe(400);
      expect(res.body.error.details.authorized).toBeDefined();
    }
    expect(storedSignatures()).toHaveLength(0);
  });

  it("refuses a request without a file", async () => {
    const res = await upload(world.admin, null);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("MISSING_FILE");
  });

  it("refuses a file that only pretends to be a PNG", async () => {
    const res = await upload(world.admin, Buffer.from("%PDF-1.7 a PDF renamed to signature.png"));
    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe("UNSUPPORTED_IMAGE_TYPE");
  });

  it("cuts off an upload over 5 MB", async () => {
    const res = await upload(world.admin, Buffer.alloc(5 * 1024 * 1024 + 10, 0x41));
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("refuses an image with no signature on it", async () => {
    const blank = await sharp({ create: { width: 800, height: 300, channels: 3, background: "#ffffff" } }).png().toBuffer();
    const res = await upload(world.admin, blank);
    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/couldn't find a signature/);
  });

  it.each(["editor", "printer", "approver1", "viewer"] as const)("refuses an upload by a %s", async (role) => {
    const res = await upload(world[role], await signaturePng());
    expect(res.status).toBe(403);
    expect(storedSignatures()).toHaveLength(0);
  });

  it("replacing keeps the old file and records both in the audit log", async () => {
    await upload(world.admin, await signaturePng());
    const first = (await prisma.bankAccount.findUniqueOrThrow({ where: { id: world.bankAccountId } })).signatureStorageKey;
    await upload(world.admin, await signaturePng());

    expect(storedSignatures()).toHaveLength(2);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "SIGNATURE_REPLACED" } });
    expect(audit.detailsJson).toMatchObject({ previousStorageKey: first });
  });

  it("another company's admin cannot upload to this account", async () => {
    const other = await createWorld();
    const res = await request(getApp())
      .put(url("/signature"))
      .set(authHeaders(other.admin))
      .field("authorized", "true")
      .attach("signature", await signaturePng(), "signature.png");
    expect(res.status).toBe(404);
  });
});

describe("viewing and removing the signature", () => {
  beforeEach(async () => {
    await upload(world.admin, await signaturePng());
  });

  it("an admin sees the cleaned PNG, never cached, and the view is recorded", async () => {
    const res = await view(world.admin);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("image/png");
    expect(res.headers["cache-control"]).toContain("no-store");
    const meta = await sharp(res.body as Buffer).metadata();
    expect(meta.format).toBe("png");
    expect(meta.hasAlpha).toBe(true);
    expect(await prisma.auditLog.count({ where: { action: "SIGNATURE_VIEWED", userId: world.admin.id } })).toBe(1);
  });

  it("nobody else can see it, not even the people who write checks", async () => {
    for (const user of [world.editor, world.printer, world.approver1, world.viewer]) {
      expect((await view(user)).status).toBe(403);
    }
  });

  it("removing it leaves a blank signature line, and keeps the file on record", async () => {
    const res = await request(getApp()).delete(url("/signature")).set(authHeaders(world.admin));
    expect(res.status).toBe(200);
    expect(res.body.data.hasSignature).toBe(false);
    expect((await view(world.admin)).status).toBe(404);
    expect(storedSignatures()).toHaveLength(1);
    expect(await prisma.auditLog.count({ where: { action: "SIGNATURE_REMOVED" } })).toBe(1);
  });
});

describe.skipIf(!hasFont)("printing with the signature", () => {
  beforeEach(async () => {
    await createPrinterProfile(world);
  });

  async function printedPdf(): Promise<{ status: number; pdf?: Buffer; body?: { error: { code: string } } }> {
    const created = await checksApi(world, world.editor).create();
    await checksApi(world, world.approver1).approve(created.body.data.id);
    const printed = await checksApi(world, world.printer).print(created.body.data.id);
    if (printed.status !== 200) return { status: printed.status, body: printed.body };
    const pdf = await checksApi(world, world.printer)
      .pdf(created.body.data.id)
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => done(null, Buffer.concat(chunks)));
      });
    return { status: 200, pdf: pdf.body as Buffer };
  }

  it("prints the signature on the check", async () => {
    await upload(world.admin, await signaturePng());
    const { status, pdf } = await printedPdf();
    expect(status).toBe(200);
    expect(pdf!.toString("latin1")).toContain("/Subtype /Image");
  });

  it("prints a blank signature line when the account has no signature", async () => {
    const { pdf } = await printedPdf();
    expect(pdf!.toString("latin1")).not.toContain("/Subtype /Image");
  });

  it("refuses to print, rather than print unsigned, when the stored signature is gone", async () => {
    await upload(world.admin, await signaturePng());
    fs.rmSync(path.join(TEST_STORAGE_PATH, "signatures"), { recursive: true, force: true });

    const { status, body } = await printedPdf();
    expect(status).toBe(422);
    expect(body!.error.code).toBe("SIGNATURE_IMAGE_UNAVAILABLE");
  });
});
