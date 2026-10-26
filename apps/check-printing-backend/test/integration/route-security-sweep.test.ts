import { randomUUID } from "crypto";
import { Agent, type Server } from "http";
import request from "supertest";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, resetDatabase } from "../helpers/db.js";
import { authHeaders, createApprovalRule, createPrinterProfile, createWorld, today, type TestUser, type TestWorld } from "../helpers/fixtures.js";
import { listRoutes } from "../helpers/route-map.js";
import { PERMISSIONS as P, PRODUCT_SLUG, ROLES, type PermissionAction } from "../../src/shared/constants/rbac.js";

// ═══════════════════════════════════════════════════════════════
// S6: EVERY ROUTE, CHECKED AUTOMATICALLY
//
// Each route's guards are written by hand, and one forgotten line (no permission check, a
// lookup by id without the workspace) is a hole that no other test would notice. This file
// reads the list of routes from Express itself and holds each one to the rule written for
// it below:
//
//   1. Inventory: a route with no rule here fails the build. A new route can't ship until
//      someone has written down who may call it.
//   2. Signed out: every route except /health answers 401.
//   3. Two-factor: someone who turned it on but didn't enter a code this session is refused.
//   4. Outsiders: another company's owner, and a colleague who isn't in the workspace,
//      get 404 for every workspace route (they don't even learn it exists).
//   5. Permissions: a member holding every permission EXCEPT the one a route needs is
//      refused, so the route checks exactly that permission.
//   6. Other workspaces' records: the same company's admin, in a second workspace where
//      they hold every permission, uses the first workspace's record ids. Every route
//      answers 404, and nothing in the first workspace changes.
// ═══════════════════════════════════════════════════════════════

// ─── Who may call each route ─────────────────────────────────────

type Who =
  | "public" // anyone, signed in or not
  | "signed-in" // any signed-in person
  | "company" // a member of the company, with Check Printing
  | "owner" // the company owner
  | "member" // any Check Printing role in the workspace
  | { all: PermissionAction[] } // every one of these permissions
  | { any: PermissionAction[] }; // at least one of them

interface Ids {
  mid: string;
  bid: string;
  pid: string;
  checkId: string;
  batchId: string;
  attachmentId: string;
  ruleId: string;
  userId: string;
  id: string;
}

interface Rule {
  who: Who;
  // Known exception to Check Printing's two-factor door (listed in the security audit).
  twoFactor?: false;
  // A request that passes validation, for check 6. Ids are the FIRST workspace's records.
  body?: (ids: Ids) => Record<string, unknown>;
  query?: (ids: Ids) => Record<string, unknown>;
  upload?: string; // multipart field name
  fields?: Record<string, string>; // other multipart fields
  // The route takes another workspace's record in its body or query, not its path.
  idsInRequest?: true;
}

const needs = (...all: PermissionAction[]): Who => ({ all });
const anyOf = (...any: PermissionAction[]): Who => ({ any });
const W = "/api/v1/workspaces/:wid";

const RULES: Record<string, Rule> = {
  "GET /api/v1/health": { who: "public" },
  // S9 in the security audit: only needs a sign-in (and skips the two-factor door).
  "POST /api/v1/validate-routing-number": { who: "signed-in", twoFactor: false },

  "POST /api/v1/workspaces": { who: "owner" },
  "GET /api/v1/workspaces": { who: "company" },
  [`GET ${W}`]: { who: "member" },
  [`PUT ${W}`]: { who: needs(P.WORKSPACE_MANAGE) },
  [`DELETE ${W}`]: { who: needs(P.WORKSPACE_MANAGE) },

  [`GET ${W}/members`]: { who: needs(P.MEMBER_VIEW) },
  [`POST ${W}/members`]: { who: needs(P.MEMBER_MANAGE) },
  [`PUT ${W}/members/:mid`]: { who: needs(P.MEMBER_MANAGE), body: () => ({ roleSlugs: [ROLES.VIEWER] }) },
  [`POST ${W}/members/:mid/invitation`]: { who: needs(P.MEMBER_MANAGE) },
  [`POST ${W}/members/:mid/two-factor/reset`]: { who: "owner" },
  [`DELETE ${W}/members/:mid`]: { who: needs(P.MEMBER_MANAGE) },

  [`POST ${W}/bank-accounts`]: { who: needs(P.BANK_ACCOUNT_MANAGE) },
  [`GET ${W}/bank-accounts`]: { who: anyOf(P.BANK_ACCOUNT_MANAGE, P.CHECK_CREATE) },
  [`GET ${W}/bank-accounts/:bid`]: { who: anyOf(P.BANK_ACCOUNT_MANAGE, P.CHECK_CREATE) },
  [`PUT ${W}/bank-accounts/:bid`]: { who: needs(P.BANK_ACCOUNT_MANAGE), body: () => ({ isActive: false }) },
  [`DELETE ${W}/bank-accounts/:bid`]: { who: needs(P.BANK_ACCOUNT_MANAGE) },
  [`POST ${W}/bank-accounts/:bid/restore`]: { who: needs(P.BANK_ACCOUNT_MANAGE) },
  [`PUT ${W}/bank-accounts/:bid/signature`]: { who: needs(P.BANK_ACCOUNT_MANAGE), upload: "signature", fields: { authorized: "true" } },
  [`GET ${W}/bank-accounts/:bid/signature`]: { who: needs(P.BANK_ACCOUNT_MANAGE) },
  [`DELETE ${W}/bank-accounts/:bid/signature`]: { who: needs(P.BANK_ACCOUNT_MANAGE) },

  [`GET ${W}/payees`]: { who: "member" },
  [`GET ${W}/payees/:pid`]: { who: "member" },
  [`POST ${W}/payees`]: { who: needs(P.PAYEE_WRITE) },
  [`PUT ${W}/payees/:pid`]: { who: needs(P.PAYEE_WRITE), body: () => ({ name: "Renamed Vendor LLC" }) },
  [`PATCH ${W}/payees/:pid/archive`]: { who: needs(P.PAYEE_MANAGE) },
  [`PATCH ${W}/payees/:pid/restore`]: { who: needs(P.PAYEE_MANAGE) },

  [`GET ${W}/checks/approval-queue`]: { who: needs(P.CHECK_APPROVE) },
  [`GET ${W}/checks/views`]: { who: "member" },
  [`GET ${W}/checks/number-integrity`]: { who: "member", idsInRequest: true, query: (ids) => ({ bankAccountId: ids.bid, from: 1, to: 10 }) },
  [`GET ${W}/checks/aging`]: { who: "member", idsInRequest: true, query: (ids) => ({ bankAccountId: ids.bid }) },
  [`GET ${W}/checks/export`]: { who: needs(P.REPORT_VIEW) },
  [`GET ${W}/checks/aging/export`]: { who: needs(P.REPORT_VIEW), idsInRequest: true, query: (ids) => ({ format: "csv", bankAccountId: ids.bid }) },
  [`GET ${W}/checks/number-integrity/export`]: {
    who: needs(P.REPORT_VIEW),
    idsInRequest: true,
    query: (ids) => ({ format: "csv", bankAccountId: ids.bid, from: 1, to: 10 }),
  },
  [`GET ${W}/checks/positive-pay`]: {
    who: needs(P.BANK_ACCOUNT_MANAGE),
    idsInRequest: true,
    query: (ids) => ({ bankAccountId: ids.bid, from: today(), to: today() }),
  },
  [`POST ${W}/checks/print-batches`]: { who: needs(P.CHECK_PRINT), idsInRequest: true, body: (ids) => ({ checkIds: [ids.checkId] }) },
  [`GET ${W}/checks/print-batches/:batchId`]: { who: needs(P.CHECK_PRINT) },
  [`GET ${W}/checks/print-batches/:batchId/pdf`]: { who: needs(P.CHECK_PRINT) },
  [`GET ${W}/checks`]: { who: "member" },
  [`POST ${W}/checks`]: {
    who: needs(P.CHECK_CREATE),
    idsInRequest: true,
    body: (ids) => ({ bankAccountId: ids.bid, payeeName: "Hill Country Supply Co.", amount: 25, checkDate: today() }),
  },
  [`GET ${W}/checks/:checkId`]: { who: "member" },
  [`PUT ${W}/checks/:checkId`]: { who: needs(P.CHECK_CREATE), body: () => ({ memo: "Changed from elsewhere" }) },
  [`DELETE ${W}/checks/:checkId`]: { who: needs(P.CHECK_CREATE) },
  [`POST ${W}/checks/:checkId/submit`]: { who: needs(P.CHECK_CREATE) },
  [`POST ${W}/checks/:checkId/approve`]: { who: needs(P.CHECK_APPROVE) },
  [`POST ${W}/checks/:checkId/reject`]: { who: needs(P.CHECK_APPROVE), body: () => ({ reason: "Wrong amount" }) },
  [`POST ${W}/checks/:checkId/resubmit`]: { who: needs(P.CHECK_CREATE) },
  [`POST ${W}/checks/:checkId/print`]: { who: needs(P.CHECK_PRINT) },
  [`GET ${W}/checks/:checkId/attachments`]: { who: "member" },
  [`GET ${W}/checks/:checkId/attachments/:attachmentId`]: { who: "member" },
  [`POST ${W}/checks/:checkId/attachments`]: { who: needs(P.CHECK_CREATE), upload: "file" },
  [`DELETE ${W}/checks/:checkId/attachments/:attachmentId`]: { who: needs(P.CHECK_CREATE) },
  [`GET ${W}/checks/:checkId/pdf`]: { who: needs(P.CHECK_PRINT) },
  [`POST ${W}/checks/:checkId/print-outcome`]: { who: needs(P.CHECK_PRINT), body: () => ({ outcome: "OK" }) },
  [`POST ${W}/checks/:checkId/void`]: { who: anyOf(P.CHECK_VOID, P.CHECK_CREATE), body: () => ({ reason: "Wrong payee" }) },
  [`POST ${W}/checks/:checkId/clear`]: { who: needs(P.CHECK_VOID) },
  [`POST ${W}/checks/:checkId/reissue`]: { who: needs(P.CHECK_CREATE) },

  [`PATCH ${W}/approval-rules/settings/approval-toggle`]: { who: needs(P.WORKSPACE_MANAGE) },
  [`GET ${W}/approval-rules/eligible-approvers`]: { who: needs(P.WORKSPACE_MANAGE) },
  [`GET ${W}/approval-rules`]: { who: needs(P.WORKSPACE_MANAGE) },
  [`POST ${W}/approval-rules`]: { who: needs(P.WORKSPACE_MANAGE) },
  [`GET ${W}/approval-rules/:ruleId`]: { who: needs(P.WORKSPACE_MANAGE) },
  [`PUT ${W}/approval-rules/:ruleId`]: { who: needs(P.WORKSPACE_MANAGE), body: () => ({ priority: 7 }) },
  [`POST ${W}/approval-rules/:ruleId/activate`]: { who: needs(P.WORKSPACE_MANAGE) },
  [`POST ${W}/approval-rules/:ruleId/deactivate`]: { who: needs(P.WORKSPACE_MANAGE) },
  [`DELETE ${W}/approval-rules/:ruleId`]: { who: needs(P.WORKSPACE_MANAGE) },
  [`GET ${W}/approval-rules/:ruleId/approvers`]: { who: needs(P.WORKSPACE_MANAGE) },
  [`PUT ${W}/approval-rules/:ruleId/approvers`]: { who: needs(P.WORKSPACE_MANAGE), body: () => ({ userIds: [] }) },
  [`POST ${W}/approval-rules/:ruleId/approvers`]: { who: needs(P.WORKSPACE_MANAGE), body: (ids) => ({ userId: ids.userId }) },
  [`DELETE ${W}/approval-rules/:ruleId/approvers/:userId`]: { who: needs(P.WORKSPACE_MANAGE) },

  [`GET ${W}/calibration/test-page`]: { who: needs(P.CHECK_PRINT) },
  [`POST ${W}/calibration`]: { who: needs(P.CHECK_PRINT) },
  [`GET ${W}/calibration`]: { who: needs(P.CHECK_PRINT) },
  [`GET ${W}/calibration/:id`]: { who: needs(P.CHECK_PRINT) },
  [`PUT ${W}/calibration/:id`]: { who: needs(P.CHECK_PRINT), body: () => ({ profileName: "Renamed printer" }) },
  [`PATCH ${W}/calibration/:id/default`]: { who: needs(P.CHECK_PRINT) },
  [`POST ${W}/calibration/:id/copy`]: { who: needs(P.CHECK_PRINT), body: () => ({ profileName: "Copied printer", layout: "CHECK_TOP" }) },
  [`GET ${W}/calibration/:id/verification-page`]: { who: needs(P.CHECK_PRINT) },
  [`POST ${W}/calibration/:id/verification`]: {
    who: needs(P.CHECK_PRINT),
    body: () => ({ unit: "mm", upperTearLine: 89, lowerTearLine: 178, micrBottom: 5, micrRightEdge: 50, amountBoxLeft: 150 }),
  },
  [`POST ${W}/calibration/:id/adjustment`]: { who: needs(P.CHECK_PRINT), body: () => ({ unit: "mm", horizontal: 1, vertical: 0 }) },
  [`DELETE ${W}/calibration/:id`]: { who: needs(P.CHECK_PRINT) },

  [`GET ${W}/check-printing-settings`]: { who: "member" },
  [`PUT ${W}/check-printing-settings`]: { who: needs(P.WORKSPACE_MANAGE) },

  [`GET ${W}/activity/security`]: { who: "owner" },
  [`GET ${W}/activity/security/people`]: { who: "owner" },
  [`GET ${W}/activity/security/export`]: { who: "owner" },
  [`GET ${W}/activity`]: { who: needs(P.WORKSPACE_MANAGE) },
  [`GET ${W}/activity/people`]: { who: needs(P.WORKSPACE_MANAGE) },
  [`GET ${W}/activity/export`]: { who: needs(P.WORKSPACE_MANAGE) },
};

// ─── The world the routes are tried against ─────────────────────

const ALL_PERMISSIONS = Object.values(P);
const DENIED = /do not have permission|only the company owner/i;
// A real signature-sized PNG (made in beforeAll), so uploads get past the file checks to
// the record lookup.
let PNG: Buffer;

// One server and one kept-alive connection for the ~420 requests. A new connection per
// request (supertest's default) made the test process abort itself now and then on Windows
// (exit code 0xC0000409, no JavaScript error), at a random point in the run: 15 of 15
// runs passed once connections were reused, against a crash every 3-6 runs before.
let server: Server;
const KEEP_ALIVE = new Agent({ keepAlive: true, maxSockets: 1 });
let appRoutes: string[];
let world: TestWorld; // company A, first workspace (W1): holds the records
let otherCompany: TestWorld; // company B
let secondWorkspaceId: string; // company A, W2: world.admin holds every permission there
let stranger: TestUser; // in company A, in no workspace
let ids: Ids;
let productId: string;
const membersByPermissions = new Map<string, TestUser>();

const keyOf = (route: string) => route;
const routeParts = (route: string) => {
  const [method, path] = route.split(" ") as [string, string];
  return { method, path };
};
const isWorkspaceRoute = (route: string) => route.includes("/:wid");
const objectParams = (route: string) => (route.match(/:\w+/g) ?? []).filter((p) => p !== ":wid");

// The path with real values: the workspace given, records either the first workspace's
// (check 6) or made-up ids that exist nowhere (checks 2-5: nothing real is touched).
function fill(path: string, wid: string, records: Ids | null): string {
  return path.replace(/:(\w+)/g, (_m, name: string) => (name === "wid" ? wid : records ? records[name as keyof Ids] : randomUUID()));
}

function send(route: string, options: { wid?: string; records?: Ids | null; headers?: Record<string, string>; withRequest?: boolean } = {}) {
  const { method, path } = routeParts(route);
  const rule = RULES[route]!;
  const url = fill(path, options.wid ?? world.workspaceId, options.records ?? null);
  let req = request(server)[method.toLowerCase() as "get" | "post" | "put" | "patch" | "delete"](url).agent(KEEP_ALIVE).set("Idempotency-Key", randomUUID());
  if (options.headers) req = req.set(options.headers);
  if (options.withRequest && rule.query) req = req.query(rule.query(ids));
  if (options.withRequest && rule.upload) {
    for (const [name, value] of Object.entries(rule.fields ?? {})) req = req.field(name, value);
    return req.attach(rule.upload, PNG, { filename: "file.png", contentType: "image/png" });
  }
  if (method === "GET" || method === "DELETE") return req;
  return req.send(options.withRequest && rule.body ? rule.body(ids) : {});
}

// A member of W1 whose only role holds exactly these permissions (a role made for the test).
async function memberWith(permissions: PermissionAction[], tenantRole: "OWNER" | "MEMBER" = "MEMBER"): Promise<TestUser> {
  const key = `${tenantRole}:${[...permissions].sort().join(",")}`;
  const cached = membersByPermissions.get(key);
  if (cached) return cached;

  const suffix = randomUUID().slice(0, 8);
  const user = await prisma.user.create({ data: { fullName: `Sweep ${suffix}`, email: `sweep-${suffix}@example.test`, passwordHash: "x", isActive: true } });
  await prisma.tenantMember.create({ data: { tenantId: world.tenantId, userId: user.id, role: tenantRole } });
  const role = await prisma.role.create({ data: { productId, slug: `sweep-${suffix}`, name: `Sweep ${suffix}`, isSystem: false } });
  const granted = await prisma.permission.findMany({ where: { productId, action: { in: permissions } } });
  if (granted.length) await prisma.rolePermission.createMany({ data: granted.map((p) => ({ roleId: role.id, permissionId: p.id })) });
  const member = await prisma.workspaceMember.create({ data: { workspaceId: world.workspaceId, userId: user.id } });
  await prisma.workspaceMemberRole.create({ data: { workspaceMemberId: member.id, roleId: role.id, assignedById: world.admin.id } });

  const testUser = { id: user.id, email: user.email, tenantId: world.tenantId };
  membersByPermissions.set(key, testUser);
  return testUser;
}

// Everything in W1 a route could touch, to prove check 6 changed nothing.
async function snapshotOfFirstWorkspace() {
  const where = { workspaceId: world.workspaceId };
  return JSON.stringify(
    await Promise.all([
      prisma.workspace.findUnique({ where: { id: world.workspaceId } }),
      prisma.workspaceMember.findMany({ where, include: { assignedRoles: true }, orderBy: { id: "asc" } }),
      prisma.bankAccount.findMany({ where, orderBy: { id: "asc" } }),
      prisma.payee.findMany({ where, orderBy: { id: "asc" } }),
      prisma.check.findMany({ where, orderBy: { id: "asc" } }),
      prisma.checkAttachment.findMany({ where: { check: where }, orderBy: { id: "asc" } }),
      prisma.printBatch.findMany({ where, orderBy: { id: "asc" } }),
      prisma.approvalWorkflowRule.findMany({ where, include: { approvers: true }, orderBy: { id: "asc" } }),
      prisma.calibrationProfile.findMany({ where, orderBy: { id: "asc" } }),
    ]),
    (_k, v) => (typeof v === "bigint" ? v.toString() : v),
  );
}

beforeAll(async () => {
  PNG = await sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="80"><rect width="100%" height="100%" fill="#fff"/><path d="M 30 60 C 90 10, 150 70, 270 30" stroke="#1a237e" stroke-width="4" fill="none"/></svg>`,
    ),
  )
    .png()
    .toBuffer();
  await resetDatabase();
  const built = await listRoutes();
  appRoutes = built.routes.map((r) => `${r.method} ${r.path}`);
  server = built.app.listen(0);

  world = await createWorld();
  otherCompany = await createWorld();
  productId = (await prisma.product.findUniqueOrThrow({ where: { slug: PRODUCT_SLUG } })).id;

  // The owner has turned two-factor on (check 3 signs them in without a code).
  await prisma.user.update({ where: { id: world.admin.id }, data: { mfaEnabledAt: new Date() } });

  const strangerUser = await prisma.user.create({ data: { fullName: "Stranger", email: `stranger-${randomUUID().slice(0, 8)}@example.test`, passwordHash: "x", isActive: true } });
  await prisma.tenantMember.create({ data: { tenantId: world.tenantId, userId: strangerUser.id, role: "MEMBER" } });
  stranger = { id: strangerUser.id, email: strangerUser.email, tenantId: world.tenantId };

  // W1's records, one of each kind a route can address.
  const payee = await prisma.payee.create({ data: { workspaceId: world.workspaceId, name: "Hill Country Supply Co." } });
  const check = await prisma.check.create({
    data: {
      workspaceId: world.workspaceId,
      bankAccountId: world.bankAccountId,
      checkNumber: 1001,
      payeeName: "Hill Country Supply Co.",
      amount: 125,
      amountInWords: "One hundred twenty-five and 00/100",
      checkDate: new Date(),
      createdById: world.editor.id,
    },
  });
  const batch = await prisma.printBatch.create({
    data: { workspaceId: world.workspaceId, checkCount: 1, sheetCount: 1, paperSize: "LETTER", layout: "CHECK_TOP", pdfStorageUrl: "batches/none.pdf", pdfSha256: "0".repeat(64), createdById: world.printer.id },
  });
  const attachment = await prisma.checkAttachment.create({
    data: { checkId: check.id, fileName: "invoice.pdf", fileType: "application/pdf", fileSizeBytes: 10n, storageKey: "attachments/none.pdf", sha256: "0".repeat(64), uploadedById: world.editor.id },
  });
  const editorMembership = await prisma.workspaceMember.findFirstOrThrow({ where: { workspaceId: world.workspaceId, userId: world.editor.id } });
  ids = {
    mid: editorMembership.id,
    bid: world.bankAccountId,
    pid: payee.id,
    checkId: check.id,
    batchId: batch.id,
    attachmentId: attachment.id,
    ruleId: await createApprovalRule(world, { approvers: [world.approver1] }),
    userId: world.approver1.id,
    id: await createPrinterProfile(world),
  };

  // A signature on W1's account, so reading it from W1 succeeds (the control in check 6).
  const signed = await request(server)
    .put(`/api/v1/workspaces/${world.workspaceId}/bank-accounts/${world.bankAccountId}/signature`)
    .set(authHeaders(world.admin))
    .field("authorized", "true")
    .attach("signature", PNG, { filename: "signature.png", contentType: "image/png" });
  expect(signed.status, JSON.stringify(signed.body)).toBe(200);

  // W2: same company, the owner is its admin (every permission).
  const second = await prisma.workspace.create({
    data: { tenantId: world.tenantId, businessName: "Green Acres Design LLC", addressLine1: "1 Elm St", city: "Austin", state: "TX", zipCode: "78701" },
  });
  secondWorkspaceId = second.id;
  const adminRole = await prisma.role.findFirstOrThrow({ where: { productId, slug: ROLES.ADMIN } });
  const membership = await prisma.workspaceMember.create({ data: { workspaceId: second.id, userId: world.admin.id } });
  await prisma.workspaceMemberRole.create({ data: { workspaceMemberId: membership.id, roleId: adminRole.id, assignedById: world.admin.id } });
});

afterAll(async () => {
  KEEP_ALIVE.destroy();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

// ─── 1. Inventory ───────────────────────────────────────────────

describe("1. every route has a written rule", () => {
  it("the app serves no route without a rule, and every rule names a real route", () => {
    const withoutRule = appRoutes.filter((r) => !(r in RULES));
    const withoutRoute = Object.keys(RULES).filter((r) => !appRoutes.includes(r));

    expect(withoutRule, "New routes: add each to RULES with who may call it").toEqual([]);
    expect(withoutRoute, "Rules for routes that no longer exist: remove them").toEqual([]);
  });
});

const ruleFor = (route: string) => RULES[keyOf(route)]!;
const ROUTES = Object.keys(RULES);
const nonPublic = ROUTES.filter((r) => ruleFor(r).who !== "public");
const behindTwoFactor = nonPublic.filter((r) => ruleFor(r).twoFactor !== false);
const workspaceRoutes = ROUTES.filter(isWorkspaceRoute);
const guarded = ROUTES.filter((r) => {
  const who = ruleFor(r).who;
  return who === "owner" || typeof who === "object";
});
const addressRecords = workspaceRoutes.filter((r) => objectParams(r).length > 0 || ruleFor(r).idsInRequest);

// Tries each route in turn and returns every one that answered wrongly, so a single
// failure names all the routes that need fixing.
async function offenders(routes: string[], problemWith: (route: string) => Promise<string | null>): Promise<string[]> {
  const found: string[] = [];
  for (const route of routes) {
    const problem = await problemWith(route);
    if (problem) found.push(`${route}: ${problem}`);
  }
  return found;
}

const answered = (res: request.Response) => `answered ${res.status} ${JSON.stringify(res.body?.error ?? res.body).slice(0, 160)}`;

// ─── 2. Signed out ──────────────────────────────────────────────

describe("2. signed out", () => {
  it("every route except /health answers 401", async () => {
    const wrong = await offenders(nonPublic, async (route) => {
      const res = await send(route);
      return res.status === 401 ? null : answered(res);
    });

    expect(wrong).toEqual([]);
  });
});

// ─── 3. Two-factor ──────────────────────────────────────────────

describe("3. two-factor turned on, no code entered this session", () => {
  it("every route behind Check Printing's door answers 403 MFA_REQUIRED", async () => {
    const wrong = await offenders(behindTwoFactor, async (route) => {
      const res = await send(route, { headers: authHeaders(world.admin, { amr: ["pwd"] }) });
      return res.status === 403 && res.body.error?.code === "MFA_REQUIRED" ? null : answered(res);
    });

    expect(wrong).toEqual([]);
  });
});

// ─── 4. Outsiders ───────────────────────────────────────────────

describe("4. outsiders don't learn the workspace exists", () => {
  it.each([
    ["another company's owner", () => otherCompany.admin],
    ["a colleague who isn't in the workspace", () => stranger],
  ] as const)("every workspace route answers 404 to %s", async (_who, outsider) => {
    const wrong = await offenders(workspaceRoutes, async (route) => {
      const res = await send(route, { headers: authHeaders(outsider()) });
      return res.status === 404 ? null : answered(res);
    });

    expect(wrong).toEqual([]);
  });
});

// ─── 5. Permissions ─────────────────────────────────────────────

// Each case: a member holding everything except what the route needs.
function permissionCases(route: string): { label: string; member: () => Promise<TestUser> }[] {
  const who = ruleFor(route).who;
  if (who === "owner") return [{ label: "every permission, but not the company owner", member: () => memberWith(ALL_PERMISSIONS) }];
  if (typeof who !== "object") return [];
  if ("any" in who) {
    return [{ label: `every permission except ${who.any.join(" and ")}`, member: () => memberWith(ALL_PERMISSIONS.filter((p) => !who.any.includes(p))) }];
  }
  return who.all.map((needed) => ({ label: `every permission except ${needed}`, member: () => memberWith(ALL_PERMISSIONS.filter((p) => p !== needed)) }));
}

describe("5. a member missing the route's permission is refused", () => {
  it("every guarded route answers 403 to a member holding everything except what it needs", async () => {
    const wrong: string[] = [];
    for (const route of guarded) {
      for (const { label, member } of permissionCases(route)) {
        const res = await send(route, { headers: authHeaders(await member()) });
        if (res.status !== 403 || !DENIED.test(res.body.error?.message ?? "")) wrong.push(`${route} (${label}): ${answered(res)}`);
      }
    }

    expect(wrong).toEqual([]);
  });
});

// ─── 6. Another workspace's records ─────────────────────────────

describe("6. records of another workspace can't be reached", () => {
  it("every route answers 404 to the first workspace's records, used from the second, and nothing changes", async () => {
    const before = await snapshotOfFirstWorkspace();

    const wrong = await offenders(addressRecords, async (route) => {
      const res = await send(route, { wid: secondWorkspaceId, records: ids, headers: authHeaders(world.admin), withRequest: true });
      return res.status === 404 ? null : answered(res);
    });

    expect(wrong).toEqual([]);
    expect(await snapshotOfFirstWorkspace()).toBe(before);
  });

  // Control: the same records ARE reachable from their own workspace, so the 404s above
  // come from the workspace check, not from ids that don't exist.
  it("control: from their own workspace, the same records are found", async () => {
    const wrong = await offenders(
      addressRecords.filter((r) => r.startsWith("GET ")),
      async (route) => {
        const res = await send(route, { records: ids, headers: authHeaders(world.admin), withRequest: true });
        return res.status === 404 ? answered(res) : null;
      },
    );

    expect(wrong).toEqual([]);
  });
});
