import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDatabase } from "../helpers/db.js";
import { authHeaders, createApprovalRule, createBankAccount, createWorld, type TestUser, type TestWorld } from "../helpers/fixtures.js";
import { getApp } from "../helpers/api.js";
import type { CheckStatus, VoidType } from "@smartbusiness/database";

// F06 (#6): the check register. Filters, smart search, cursor paging, totals and facets,
// action-inbox views, check-number integrity, outstanding aging and possible duplicates.

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);
const dateOnly = (d: Date) => new Date(`${d.toISOString().slice(0, 10)}T00:00:00.000Z`);

let numberSeq = 5000;

interface CheckSpec {
  status?: CheckStatus;
  amount?: number;
  payeeName?: string;
  memo?: string;
  checkDate?: Date;
  checkNumber?: number;
  bankAccountId?: string;
  createdBy?: TestUser;
  printedAt?: Date | null;
  printConfirmedAt?: Date | null;
  voidType?: VoidType | null;
  deletedAt?: Date | null;
  createdAt?: Date;
  workspaceId?: string;
}

async function makeCheck(world: TestWorld, spec: CheckSpec = {}) {
  const status = spec.status ?? "NEW";
  const printed = ["PRINTED", "CLEARED"].includes(status) || spec.voidType === "SPOILED" || spec.voidType === "VOIDED_AFTER_PRINT";
  return prisma.check.create({
    data: {
      workspaceId: spec.workspaceId ?? world.workspaceId,
      bankAccountId: spec.bankAccountId ?? world.bankAccountId,
      checkNumber: spec.checkNumber ?? numberSeq++,
      status,
      payeeName: spec.payeeName ?? "Hill Country Nursery",
      amount: spec.amount ?? 100,
      amountInWords: "words",
      checkDate: spec.checkDate ?? dateOnly(new Date()),
      memo: spec.memo ?? null,
      createdById: (spec.createdBy ?? world.editor).id,
      printedAt: spec.printedAt !== undefined ? spec.printedAt : printed ? new Date() : null,
      printedById: printed ? world.printer.id : null,
      printConfirmedAt: spec.printConfirmedAt ?? null,
      voidType: spec.voidType ?? null,
      voidReason: spec.voidType ? "Paper jam" : null,
      voidedAt: status === "VOID" ? new Date() : null,
      deletedAt: spec.deletedAt ?? null,
      ...(spec.createdAt && { createdAt: spec.createdAt }),
    },
  });
}

function register(world: TestWorld, user: TestUser) {
  const base = `/api/v1/workspaces/${world.workspaceId}/checks`;
  const headers = authHeaders(user);
  return {
    list: (query: Record<string, string> = {}) => request(getApp()).get(base).query(query).set(headers),
    views: () => request(getApp()).get(`${base}/views`).set(headers),
    integrity: (query: Record<string, string>) => request(getApp()).get(`${base}/number-integrity`).query(query).set(headers),
    aging: (query: Record<string, string> = {}) => request(getApp()).get(`${base}/aging`).query(query).set(headers),
  };
}

const numbersOf = (res: request.Response) =>
  (res.body.data as Array<{ checkNumber: number }>).map((c) => c.checkNumber).sort((a, b) => a - b);

describe("check register (F06)", () => {
  let world: TestWorld;

  beforeEach(async () => {
    await resetDatabase();
    world = await createWorld();
  });

  describe("filters", () => {
    it("several statuses at once", async () => {
      const a = await makeCheck(world, { status: "PRINTED" });
      const b = await makeCheck(world, { status: "CLEARED" });
      await makeCheck(world, { status: "NEW" });

      const res = await register(world, world.viewer).list({ status: "PRINTED,CLEARED" });

      expect(res.status).toBe(200);
      expect(numbersOf(res)).toEqual([a.checkNumber, b.checkNumber].sort());
    });

    it("bank accounts, check numbers (exact and range) and amounts (inclusive)", async () => {
      const other = await createBankAccount(world.workspaceId, { nextCheckNumber: 9000 });
      const c1 = await makeCheck(world, { checkNumber: 1100, amount: 100 });
      const c2 = await makeCheck(world, { checkNumber: 1101, amount: 250.5 });
      const c3 = await makeCheck(world, { checkNumber: 1102, amount: 999.99, bankAccountId: other });
      const api = register(world, world.viewer);

      expect(numbersOf(await api.list({ bankAccountId: other }))).toEqual([c3.checkNumber]);
      expect(numbersOf(await api.list({ checkNumber: "1101" }))).toEqual([1101]);
      expect(numbersOf(await api.list({ checkNumberFrom: "1101", checkNumberTo: "1102" }))).toEqual([1101, 1102]);
      expect(numbersOf(await api.list({ amountMin: "250.50", amountMax: "999.99" }))).toEqual([c2.checkNumber, c3.checkNumber]);
      expect(numbersOf(await api.list({ amountMax: "100" }))).toEqual([c1.checkNumber]);
    });

    it("payee and memo, ignoring case", async () => {
      const a = await makeCheck(world, { payeeName: "Austin Equipment Rentals" });
      const b = await makeCheck(world, { memo: "Invoice 778 - mulch" });
      await makeCheck(world, { payeeName: "Home Depot" });
      const api = register(world, world.viewer);

      expect(numbersOf(await api.list({ payee: "equipment" }))).toEqual([a.checkNumber]);
      expect(numbersOf(await api.list({ memo: "INVOICE 778" }))).toEqual([b.checkNumber]);
    });

    it("date ranges are inclusive by calendar day", async () => {
      const inRange = await makeCheck(world, { checkDate: new Date("2026-10-10T00:00:00Z"), status: "PRINTED", printedAt: new Date("2026-10-12T23:30:00Z") });
      await makeCheck(world, { checkDate: new Date("2026-10-11T00:00:00Z"), status: "PRINTED", printedAt: new Date("2026-10-13T00:30:00Z") });
      const api = register(world, world.viewer);

      expect(numbersOf(await api.list({ checkDateFrom: "2026-10-01", checkDateTo: "2026-10-10" }))).toEqual([inRange.checkNumber]);
      expect(numbersOf(await api.list({ printedFrom: "2026-10-12", printedTo: "2026-10-12" }))).toEqual([inRange.checkNumber]);
    });

    it("creator, void type, print confirmation, attachments and reissue chain", async () => {
      const mine = await makeCheck(world, { createdBy: world.admin });
      const spoiled = await makeCheck(world, { status: "VOID", voidType: "SPOILED" });
      const unconfirmed = await makeCheck(world, { status: "PRINTED" });
      await makeCheck(world, { status: "PRINTED", printConfirmedAt: new Date() });
      const withFile = await makeCheck(world);
      await prisma.checkAttachment.create({
        data: { checkId: withFile.id, fileName: "inv.pdf", fileType: "application/pdf", fileSizeBytes: 10, storageKey: "attachments/x/y/z", sha256: "a".repeat(64), uploadedById: world.editor.id },
      });
      const reissue = await makeCheck(world);
      await prisma.check.update({ where: { id: reissue.id }, data: { reissuedFromCheckId: spoiled.id } });
      const api = register(world, world.viewer);

      expect(numbersOf(await api.list({ createdBy: world.admin.id }))).toEqual([mine.checkNumber]);
      expect(numbersOf(await api.list({ voidType: "SPOILED" }))).toEqual([spoiled.checkNumber]);
      expect(numbersOf(await api.list({ printConfirmed: "false" }))).toEqual([unconfirmed.checkNumber]);
      expect(numbersOf(await api.list({ printUnconfirmed: "true" }))).toEqual([unconfirmed.checkNumber]);
      expect(numbersOf(await api.list({ hasAttachments: "true" }))).toEqual([withFile.checkNumber]);
      expect(numbersOf(await api.list({ reissued: "from" }))).toEqual([reissue.checkNumber]);
      expect(numbersOf(await api.list({ reissued: "to" }))).toEqual([spoiled.checkNumber]);
    });

    it("refuses an unknown filter by name instead of returning everything", async () => {
      const res = await register(world, world.viewer).list({ staus: "PRINTED" });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body.error.details)).toMatch(/staus/);
    });

    it("names the field of a reversed range", async () => {
      const res = await register(world, world.viewer).list({ amountMin: "500", amountMax: "100" });

      expect(res.status).toBe(400);
      expect(res.body.error.details).toHaveProperty("amountMax");
    });
  });

  describe("isolation", () => {
    it("never shows another company's checks, even when asked for its bank account", async () => {
      const other = await createWorld();
      await makeCheck(other, { workspaceId: other.workspaceId, bankAccountId: other.bankAccountId, createdBy: other.editor });
      const mine = await makeCheck(world);
      const api = register(world, world.viewer);

      expect(numbersOf(await api.list())).toEqual([mine.checkNumber]);
      expect((await api.list({ bankAccountId: other.bankAccountId })).body.data).toEqual([]);
    });

    it("never lists deleted drafts", async () => {
      await makeCheck(world, { deletedAt: new Date() });
      expect((await register(world, world.viewer).list()).body.data).toEqual([]);
    });
  });

  describe("smart search (q)", () => {
    it("understands #number, $amount, ****last4 and plain text", async () => {
      const byNumber = await makeCheck(world, { checkNumber: 4242, amount: 10 });
      const byAmount = await makeCheck(world, { amount: 1250.5 });
      const byText = await makeCheck(world, { payeeName: "Acme Pools", amount: 11 });
      const other = await createBankAccount(world.workspaceId, { nextCheckNumber: 9000 });
      await prisma.bankAccount.update({ where: { id: other }, data: { accountNumberLast4: "7777" } });
      const byAccount = await makeCheck(world, { bankAccountId: other, amount: 12 });
      const api = register(world, world.viewer);

      expect(numbersOf(await api.list({ q: "#4242" }))).toEqual([byNumber.checkNumber]);
      expect(numbersOf(await api.list({ q: "$1,250.50" }))).toEqual([byAmount.checkNumber]);
      expect(numbersOf(await api.list({ q: "acme" }))).toEqual([byText.checkNumber]);
      expect(numbersOf(await api.list({ q: "****7777" }))).toEqual([byAccount.checkNumber]);
    });
  });

  describe("cursor paging", () => {
    it("walks every check exactly once, even when a new check arrives mid-way", async () => {
      for (let i = 0; i < 5; i++) await makeCheck(world, { createdAt: new Date(Date.now() - (10 - i) * 1000) });
      const api = register(world, world.viewer);
      const seen: number[] = [];

      let res = await api.list({ limit: "2" });
      seen.push(...res.body.data.map((c: { checkNumber: number }) => c.checkNumber));
      await makeCheck(world); // newest: sorts before the cursor, must not shift the next pages
      while (res.body.meta.nextCursor) {
        res = await api.list({ limit: "2", cursor: res.body.meta.nextCursor });
        expect(res.status).toBe(200);
        seen.push(...res.body.data.map((c: { checkNumber: number }) => c.checkNumber));
      }

      expect(seen).toHaveLength(5);
      expect(new Set(seen).size).toBe(5);
    });

    it("refuses a cursor made for a different sort", async () => {
      for (let i = 0; i < 3; i++) await makeCheck(world);
      const api = register(world, world.viewer);
      const first = await api.list({ limit: "1", sortBy: "amount" });

      const res = await api.list({ limit: "1", sortBy: "checkDate", cursor: first.body.meta.nextCursor });

      expect(res.status).toBe(400);
    });

    it("still supports page numbers for existing clients", async () => {
      for (let i = 0; i < 3; i++) await makeCheck(world);

      const res = await register(world, world.viewer).list({ page: "2", limit: "2" });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta).toMatchObject({ total: 3, page: 2, limit: 2, totalPages: 2, hasMore: false });
    });
  });

  describe("totals and facets", () => {
    it("totals cover the whole filtered set, not just the page", async () => {
      await makeCheck(world, { status: "PRINTED", amount: 100.25 });
      await makeCheck(world, { status: "PRINTED", amount: 200.5 });
      await makeCheck(world, { status: "PRINTED", amount: 300 });
      await makeCheck(world, { status: "NEW", amount: 999 });

      const res = await register(world, world.viewer).list({ status: "PRINTED", limit: "1", include: "totals" });

      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta.totals).toEqual({ count: 3, amount: "600.75" });
    });

    it("each facet ignores its own filter, so the other choices keep their counts", async () => {
      const other = await createBankAccount(world.workspaceId, { nextCheckNumber: 9000 });
      await makeCheck(world, { status: "PRINTED", amount: 10 });
      await makeCheck(world, { status: "PRINTED", amount: 20, bankAccountId: other });
      await makeCheck(world, { status: "NEW", amount: 5 });

      const res = await register(world, world.viewer).list({ status: "PRINTED", bankAccountId: world.bankAccountId, include: "facets" });

      expect(res.body.meta.facets.status).toEqual({ PRINTED: { count: 1, amount: "10.00" }, NEW: { count: 1, amount: "5.00" } });
      expect(res.body.meta.facets.bankAccount).toEqual({
        [world.bankAccountId]: { count: 1, amount: "10.00" },
        [other]: { count: 1, amount: "20.00" },
      });
    });
  });

  describe("views (the action inbox)", () => {
    it("shows each person the views their role can use, with counts and amounts", async () => {
      await makeCheck(world, { status: "NEW", createdBy: world.editor, amount: 50 });
      await makeCheck(world, { status: "REJECTED", createdBy: world.editor, amount: 70 });
      await makeCheck(world, { status: "APPROVED", amount: 30 });
      await makeCheck(world, { status: "PRINTED", amount: 40 });

      const asEditor = await register(world, world.editor).views();
      const asPrinter = await register(world, world.printer).views();

      expect(asEditor.status).toBe(200);
      const editorViews = Object.fromEntries(asEditor.body.data.map((v: { view: string }) => [v.view, v]));
      expect(editorViews["my-drafts"]).toMatchObject({ count: 2, amount: "120.00" });
      expect(editorViews["ready-to-print"]).toBeUndefined();
      expect(editorViews["awaiting-my-approval"]).toBeUndefined();

      const printerViews = Object.fromEntries(asPrinter.body.data.map((v: { view: string }) => [v.view, v]));
      // Approval is off: the APPROVED check and the NEW draft are both ready to print (R-03).
      expect(printerViews["ready-to-print"]).toMatchObject({ count: 2, amount: "80.00" });
      expect(printerViews["outstanding"]).toMatchObject({ count: 1, amount: "40.00" });
    });

    it("ready-to-print leaves out drafts that need approval", async () => {
      await prisma.checkPrintingSettings.update({ where: { workspaceId: world.workspaceId }, data: { approvalEnabled: true } });
      await createApprovalRule(world, { minAmount: 1000 });
      const small = await makeCheck(world, { status: "NEW", amount: 500 });
      await makeCheck(world, { status: "NEW", amount: 5000 });
      const approved = await makeCheck(world, { status: "APPROVED", amount: 7000 });

      const res = await register(world, world.printer).list({ view: "ready-to-print" });

      expect(numbersOf(res)).toEqual([small.checkNumber, approved.checkNumber].sort());
    });

    it("awaiting-my-approval matches the approval queue, and needs approve permission", async () => {
      await prisma.checkPrintingSettings.update({ where: { workspaceId: world.workspaceId }, data: { approvalEnabled: true } });
      await createApprovalRule(world, { minAmount: 1000, approvers: [world.approver1] });
      const waiting = await makeCheck(world, { status: "PENDING_APPROVAL", amount: 2000 });
      await makeCheck(world, { status: "PENDING_APPROVAL", amount: 3000, createdBy: world.approver1 }); // own check

      const res = await register(world, world.approver1).list({ view: "awaiting-my-approval" });

      expect(numbersOf(res)).toEqual([waiting.checkNumber]);
      expect((await register(world, world.approver2).list({ view: "awaiting-my-approval" })).body.data).toEqual([]);
      expect((await register(world, world.editor).list({ view: "awaiting-my-approval" })).status).toBe(403);
    });

    it("stale = printed more than 90 days ago and still not cleared", async () => {
      const old = await makeCheck(world, { status: "PRINTED", printedAt: daysAgo(100) });
      await makeCheck(world, { status: "PRINTED", printedAt: daysAgo(10) });
      await makeCheck(world, { status: "CLEARED", printedAt: daysAgo(200) });

      expect(numbersOf(await register(world, world.viewer).list({ view: "stale" }))).toEqual([old.checkNumber]);
    });
  });

  describe("check-number integrity", () => {
    it("accounts for every number: issued, voided, deleted draft, missing, not issued", async () => {
      const account = await createBankAccount(world.workspaceId, { nextCheckNumber: 1006 });
      await makeCheck(world, { bankAccountId: account, checkNumber: 1001, status: "PRINTED" });
      await makeCheck(world, { bankAccountId: account, checkNumber: 1002, status: "VOID", voidType: "SPOILED" });
      await makeCheck(world, { bankAccountId: account, checkNumber: 1003, deletedAt: new Date() });
      await makeCheck(world, { bankAccountId: account, checkNumber: 1005, status: "CLEARED" });

      const res = await register(world, world.viewer).integrity({ bankAccountId: account, from: "999", to: "1007" });

      expect(res.status).toBe(200);
      const states = Object.fromEntries(res.body.data.rows.map((r: { checkNumber: number; state: string }) => [r.checkNumber, r.state]));
      expect(states).toEqual({
        999: "NOT_ISSUED", 1000: "NOT_ISSUED",
        1001: "PRINTED", 1002: "VOID", 1003: "DELETED_DRAFT", 1004: "MISSING", 1005: "CLEARED",
        1006: "NOT_ISSUED", 1007: "NOT_ISSUED",
      });
      const voided = res.body.data.rows.find((r: { checkNumber: number }) => r.checkNumber === 1002);
      expect(voided).toMatchObject({ voidType: "SPOILED", voidReason: "Paper jam" });
      expect(res.body.data.summary).toMatchObject({ MISSING: 1, DELETED_DRAFT: 1 });
    });

    it("refuses another company's bank account and oversized ranges", async () => {
      const other = await createWorld();
      const api = register(world, world.viewer);

      expect((await api.integrity({ bankAccountId: other.bankAccountId, from: "1", to: "10" })).status).toBe(404);
      expect((await api.integrity({ bankAccountId: world.bankAccountId, from: "1", to: "5000" })).status).toBe(400);
    });
  });

  describe("outstanding aging", () => {
    it("buckets printed, uncleared checks by age, with totals", async () => {
      await makeCheck(world, { status: "PRINTED", amount: 10, printedAt: daysAgo(5) });
      await makeCheck(world, { status: "PRINTED", amount: 20, printedAt: daysAgo(45) });
      await makeCheck(world, { status: "PRINTED", amount: 30, printedAt: daysAgo(75) });
      await makeCheck(world, { status: "PRINTED", amount: 40.5, printedAt: daysAgo(120) });
      await makeCheck(world, { status: "CLEARED", amount: 999, printedAt: daysAgo(120) });
      await makeCheck(world, { status: "VOID", voidType: "VOIDED_AFTER_PRINT", amount: 999, printedAt: daysAgo(120) });

      const res = await register(world, world.viewer).aging();

      expect(res.status).toBe(200);
      expect(res.body.data.buckets.map((b: { label: string; count: number; amount: string }) => [b.label, b.count, b.amount])).toEqual([
        ["0-30 days", 1, "10.00"],
        ["31-60 days", 1, "20.00"],
        ["61-90 days", 1, "30.00"],
        ["over 90 days (stale)", 1, "40.50"],
      ]);
      expect(res.body.data.total).toEqual({ count: 4, amount: "100.50" });
    });
  });

  describe("possible duplicates", () => {
    it("flags the same payee and amount within 30 days, and only those", async () => {
      const first = await makeCheck(world, { payeeName: "Home Depot", amount: 287.5, checkDate: dateOnly(daysAgo(20)) });
      const again = await makeCheck(world, { payeeName: "  home   DEPOT ", amount: 287.5, checkDate: dateOnly(daysAgo(5)) });
      await makeCheck(world, { payeeName: "Home Depot", amount: 287.5, checkDate: dateOnly(daysAgo(60)) }); // 40+ days from "again"
      await makeCheck(world, { payeeName: "Home Depot", amount: 300, checkDate: dateOnly(daysAgo(5)) }); // other amount
      const voided = await makeCheck(world, { payeeName: "Shell", amount: 45, status: "VOID", voidType: "CANCELLED" });
      const live = await makeCheck(world, { payeeName: "Shell", amount: 45 });

      const res = await register(world, world.viewer).list({ sortBy: "checkNumber", sortOrder: "asc", limit: "100" });
      const byNumber = Object.fromEntries(res.body.data.map((c: { checkNumber: number }) => [c.checkNumber, c]));

      expect(byNumber[again.checkNumber].possibleDuplicateOf).toEqual({ id: first.id, checkNumber: first.checkNumber });
      expect(byNumber[first.checkNumber].possibleDuplicateOf).toEqual({ id: again.id, checkNumber: again.checkNumber });
      expect(byNumber[live.checkNumber].possibleDuplicateOf).toBeNull(); // the other Shell check is void
      expect(byNumber[voided.checkNumber].possibleDuplicateOf).toBeNull();

      const flagged = await register(world, world.viewer).list({ possibleDuplicate: "true" });
      expect(numbersOf(flagged)).toEqual([first.checkNumber, again.checkNumber].sort());
    });
  });

  describe("list items", () => {
    it("carry print, clear, void and attachment information", async () => {
      await makeCheck(world, { status: "VOID", voidType: "SPOILED" });

      const res = await register(world, world.viewer).list();

      expect(res.body.data[0]).toMatchObject({ voidType: "SPOILED", hasAttachments: false, possibleDuplicateOf: null });
      expect(res.body.data[0]).toHaveProperty("printedAt");
      expect(res.body.data[0]).toHaveProperty("clearedDate");
    });
  });
});
