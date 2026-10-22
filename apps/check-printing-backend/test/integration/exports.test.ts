import request from "supertest";
import ExcelJS from "exceljs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma, resetDatabase } from "../helpers/db.js";
import { authHeaders, createBankAccount, createWorld, type TestUser, type TestWorld } from "../helpers/fixtures.js";
import { getApp } from "../helpers/api.js";
import type { CheckStatus, VoidType } from "@smartbusiness/database";
import { CheckExportRepository } from "../../src/modules/check/check-export.repository.js";
import { AuditService } from "../../src/shared/services/audit.service.js";

// #3 Reports and exports: the check register, outstanding checks and the check-number
// audit as CSV, Excel and PDF, and the Positive Pay file for the bank.

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

let numberSeq = 7000;

interface CheckSpec {
  status?: CheckStatus;
  amount?: number;
  payeeName?: string;
  checkDate?: Date;
  checkNumber?: number;
  bankAccountId?: string;
  createdBy?: TestUser;
  printedAt?: Date | null;
  voidType?: VoidType | null;
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
      checkDate: spec.checkDate ?? new Date("2026-10-15T00:00:00Z"),
      createdById: (spec.createdBy ?? world.editor).id,
      printedAt: spec.printedAt !== undefined ? spec.printedAt : printed ? new Date() : null,
      printedById: printed ? world.printer.id : null,
      voidType: spec.voidType ?? null,
      voidReason: spec.voidType ? "Paper jam" : null,
      voidedAt: status === "VOID" ? new Date() : null,
    },
  });
}

const binary = (req: request.Test) =>
  req.buffer(true).parse((res, done) => {
    const chunks: Buffer[] = [];
    res.on("data", (c: Buffer) => chunks.push(c));
    res.on("end", () => done(null, Buffer.concat(chunks)));
  });

function api(world: TestWorld, user: TestUser) {
  const base = `/api/v1/workspaces/${world.workspaceId}/checks`;
  const get = (path: string, query: Record<string, string>) => binary(request(getApp()).get(`${base}${path}`).query(query).set(authHeaders(user)));
  return {
    list: (query: Record<string, string> = {}) => request(getApp()).get(base).query(query).set(authHeaders(user)),
    register: (query: Record<string, string>) => get("/export", query),
    outstanding: (query: Record<string, string>) => get("/aging/export", query),
    numberAudit: (query: Record<string, string>) => get("/number-integrity/export", query),
    positivePay: (query: Record<string, string>) => get("/positive-pay", query),
  };
}

// A small RFC 4180 reader: quoted fields, doubled quotes, CRLF rows.
function parseCsv(buffer: Buffer): string[][] {
  const text = buffer.toString("utf8").replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\r" && text[i + 1] === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
    } else field += ch;
  }
  return rows;
}

async function readXlsx(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  return workbook.worksheets[0]!;
}

const pageCount = (pdf: Buffer) => (pdf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length;

const auditRows = (action: string) => prisma.auditLog.findMany({ where: { action }, orderBy: { createdAt: "asc" } });

describe("exports (#3)", () => {
  let world: TestWorld;

  beforeEach(async () => {
    await resetDatabase();
    world = await createWorld();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("check register", () => {
    it("CSV holds exactly the checks the list shows, in the same order", async () => {
      const a = await makeCheck(world, { status: "PRINTED", amount: 250.5, payeeName: "Austin Equipment Rentals" });
      const b = await makeCheck(world, { status: "CLEARED", amount: 1200, payeeName: "Austin Water Utility" });
      await makeCheck(world, { status: "NEW", payeeName: "Austin Draft Only" });
      await makeCheck(world, { status: "PRINTED", payeeName: "Home Depot" });
      const filters = { status: "PRINTED,CLEARED", payee: "austin", sortBy: "amount", sortOrder: "desc" };
      const user = api(world, world.viewer);

      const listed = (await user.list(filters)).body.data as Array<{ checkNumber: number }>;
      const res = await user.register({ ...filters, format: "csv" });

      expect(res.status).toBe(200);
      const [header, ...rows] = parseCsv(res.body as Buffer);
      expect(header!.slice(0, 5)).toEqual(["Check #", "Bank account", "Check date", "Payee", "Amount"]);
      expect(rows.map((r) => Number(r[0]))).toEqual(listed.map((c) => c.checkNumber));
      expect(rows.map((r) => Number(r[0]))).toEqual([b.checkNumber, a.checkNumber]);
      expect(rows[0]).toEqual(expect.arrayContaining(["JPMorgan Chase ****1012", "2026-10-15", "Austin Water Utility", "1200.00", "Cleared"]));
    });

    it("ignores the list's page size: every matching check is exported", async () => {
      for (let i = 0; i < 25; i++) await makeCheck(world, { status: "PRINTED" });

      const res = await api(world, world.viewer).register({ format: "csv", limit: "5" });

      expect(parseCsv(res.body as Buffer)).toHaveLength(26);
    });

    it("download headers: attachment, no caching, declared type kept", async () => {
      await makeCheck(world, { status: "PRINTED" });
      const user = api(world, world.viewer);

      const csv = await user.register({ format: "csv" });
      expect(csv.headers["content-type"]).toBe("text/csv; charset=utf-8");
      expect(csv.headers["content-disposition"]).toMatch(/^attachment; filename="check-register-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}\.csv"$/);
      expect(csv.headers["cache-control"]).toContain("no-store");
      expect(csv.headers["x-content-type-options"]).toBe("nosniff");
      expect((csv.body as Buffer).subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));

      const xlsx = await user.register({ format: "xlsx" });
      expect(xlsx.headers["content-type"]).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      expect(xlsx.headers["content-disposition"]).toMatch(/\.xlsx"$/);

      const pdf = await user.register({ format: "pdf" });
      expect(pdf.headers["content-type"]).toBe("application/pdf");
      expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe("%PDF-");
    });

    it("a payee name cannot run as a spreadsheet formula", async () => {
      const evil = '=HYPERLINK("https://evil.example","Click")';
      await makeCheck(world, { status: "PRINTED", payeeName: evil });
      await makeCheck(world, { status: "PRINTED", payeeName: "@SUM(A1:A9)" });
      const user = api(world, world.viewer);

      const csv = parseCsv((await user.register({ format: "csv", sortBy: "checkNumber", sortOrder: "asc" })).body as Buffer);
      expect(csv[1]![3]).toBe(`'${evil}`);
      expect(csv[2]![3]).toBe("'@SUM(A1:A9)");

      const sheet = await readXlsx((await user.register({ format: "xlsx", sortBy: "checkNumber", sortOrder: "asc" })).body as Buffer);
      const payees: ExcelJS.Cell[] = [];
      sheet.eachRow((row) => {
        const cell = row.getCell(4);
        if (cell.value === evil || cell.value === "@SUM(A1:A9)") payees.push(cell);
      });
      expect(payees).toHaveLength(2);
      for (const cell of payees) expect(cell.type).toBe(ExcelJS.ValueType.String);
    });

    it("Excel: a title, the filters in words, typed cells and a totals row", async () => {
      await makeCheck(world, { status: "PRINTED", amount: 250.5 });
      await makeCheck(world, { status: "PRINTED", amount: 1000.25 });

      const res = await api(world, world.admin).register({ format: "xlsx", status: "PRINTED", bankAccountId: world.bankAccountId, createdBy: world.editor.id });
      const sheet = await readXlsx(res.body as Buffer);

      expect(sheet.getCell("A1").value).toBe("Check register");
      const filterLine = String(sheet.getCell("A3").value);
      expect(filterLine).toContain("Status: Printed");
      expect(filterLine).toContain("Bank account: JPMorgan Chase ****1012");
      expect(filterLine).toMatch(/Written by: \S+/);
      expect(filterLine).not.toContain(world.bankAccountId);
      expect(filterLine).not.toContain(world.editor.id);

      let headerRow = 0;
      sheet.eachRow((row, n) => {
        if (row.getCell(1).value === "Check #") headerRow = n;
      });
      const first = sheet.getRow(headerRow + 1);
      expect(typeof first.getCell(1).value).toBe("number");
      expect(first.getCell(3).value).toBeInstanceOf(Date);
      expect(typeof first.getCell(5).value).toBe("number");
      expect(first.getCell(5).numFmt).toBe('"$"#,##0.00');

      const totals = sheet.getRow(headerRow + 3);
      expect(totals.getCell(4).value).toBe("Total: 2 checks");
      expect(totals.getCell(5).value).toBe(1250.75);
    });

    it("PDF: the header repeats over several pages; an empty result is still a report", async () => {
      for (let i = 0; i < 70; i++) await makeCheck(world, { status: "PRINTED" });
      const user = api(world, world.viewer);

      expect(pageCount((await user.register({ format: "pdf" })).body as Buffer)).toBeGreaterThanOrEqual(2);
      const empty = await user.register({ format: "pdf", status: "CLEARED" });
      expect(empty.status).toBe(200);
      expect(pageCount(empty.body as Buffer)).toBe(1);
    });

    it("views apply exactly as on screen, including their permission", async () => {
      const mine = await makeCheck(world, { status: "NEW", createdBy: world.editor });
      await makeCheck(world, { status: "NEW", createdBy: world.admin });

      const drafts = parseCsv((await api(world, world.editor).register({ format: "csv", view: "my-drafts" })).body as Buffer);
      expect(drafts.slice(1).map((r) => Number(r[0]))).toEqual([mine.checkNumber]);

      // The viewer cannot approve, so cannot see (or export) the approval queue.
      expect((await api(world, world.viewer).register({ format: "csv", view: "awaiting-my-approval" })).status).toBe(403);
    });

    it("never includes another workspace's checks", async () => {
      const other = await createWorld();
      await makeCheck(other, { status: "PRINTED", payeeName: "Other Company Payee" });
      await makeCheck(world, { status: "PRINTED" });

      const csv = parseCsv((await api(world, world.viewer).register({ format: "csv" })).body as Buffer);
      expect(csv).toHaveLength(2);
      expect(JSON.stringify(csv)).not.toContain("Other Company Payee");
    });

    it("refuses more than 10,000 checks in one file, before reading them", async () => {
      vi.spyOn(CheckExportRepository.prototype, "count").mockResolvedValue(10_001);
      const rows = vi.spyOn(CheckExportRepository.prototype, "rows");

      const res = await api(world, world.viewer).register({ format: "xlsx" });

      expect(res.status).toBe(400);
      expect(JSON.parse((res.body as Buffer).toString()).error.message).toContain("10,001");
      expect(rows).not.toHaveBeenCalled();
      expect(await auditRows("REPORT_EXPORTED")).toHaveLength(0);
    });

    it("format is required and checked; unknown filters are refused", async () => {
      const user = api(world, world.viewer);
      expect((await user.register({})).status).toBe(400);
      expect((await user.register({ format: "docx" })).status).toBe(400);
      expect((await user.register({ format: "csv", colour: "blue" })).status).toBe(400);
      expect((await user.register({ format: "csv", status: "SHREDDED" })).status).toBe(400);
    });

    it("only people who can view reports may export", async () => {
      expect((await api(world, world.printer).register({ format: "csv" })).status).toBe(403);
      expect((await api(world, world.approver1).register({ format: "csv" })).status).toBe(403);
      expect((await api(world, world.editor).register({ format: "csv" })).status).toBe(200);
      expect((await api(world, world.admin).register({ format: "csv" })).status).toBe(200);
    });

    it("every export is audited with its format, filters and row count", async () => {
      await makeCheck(world, { status: "PRINTED" });
      await makeCheck(world, { status: "CLEARED" });

      await api(world, world.viewer).register({ format: "xlsx", status: "PRINTED,CLEARED", checkDateFrom: "2026-10-01" });

      const [row] = await auditRows("REPORT_EXPORTED");
      expect(row).toMatchObject({ userId: world.viewer.id, workspaceId: world.workspaceId, entityType: "Workspace", entityId: world.workspaceId });
      expect(row!.detailsJson).toMatchObject({
        report: "check-register",
        format: "xlsx",
        rowCount: 2,
        filter: { status: ["PRINTED", "CLEARED"], checkDateFrom: "2026-10-01" },
      });
    });

    it("no audit row, no file", async () => {
      await makeCheck(world, { status: "PRINTED" });
      vi.spyOn(AuditService.prototype as unknown as { write: () => Promise<void> }, "write").mockRejectedValue(new Error("database down"));

      const res = await api(world, world.viewer).register({ format: "csv" });

      expect(res.status).toBe(503);
      expect(res.headers["content-disposition"]).toBeUndefined();
    });
  });

  describe("outstanding checks", () => {
    it("printed and not cleared, oldest first, with days outstanding", async () => {
      const old = await makeCheck(world, { status: "PRINTED", printedAt: daysAgo(100), amount: 50 });
      const recent = await makeCheck(world, { status: "PRINTED", printedAt: daysAgo(3), amount: 75 });
      await makeCheck(world, { status: "CLEARED", printedAt: daysAgo(40) });
      await makeCheck(world, { status: "VOID", voidType: "SPOILED" });

      const res = await api(world, world.viewer).outstanding({ format: "csv" });

      expect(res.status).toBe(200);
      const [header, ...rows] = parseCsv(res.body as Buffer);
      expect(header).toContain("Days outstanding");
      expect(rows.map((r) => Number(r[0]))).toEqual([old.checkNumber, recent.checkNumber]);
      expect(rows[0]!.slice(-2)).toEqual(["100", "over 90 days (stale)"]);
      expect(rows[1]!.slice(-2)).toEqual(["3", "0-30 days"]);
      expect((await auditRows("REPORT_EXPORTED"))[0]!.detailsJson).toMatchObject({ report: "outstanding-checks", rowCount: 2 });
    });

    it("one bank account only, when asked", async () => {
      const other = await createBankAccount(world.workspaceId, { nextCheckNumber: 9000 });
      await makeCheck(world, { status: "PRINTED" });
      const there = await makeCheck(world, { status: "PRINTED", bankAccountId: other });

      const rows = parseCsv((await api(world, world.viewer).outstanding({ format: "csv", bankAccountId: other })).body as Buffer).slice(1);

      expect(rows.map((r) => Number(r[0]))).toEqual([there.checkNumber]);
    });
  });

  describe("check-number audit", () => {
    it("every number in the range and what became of it, MISSING included", async () => {
      await prisma.bankAccount.update({ where: { id: world.bankAccountId }, data: { nextCheckNumber: 4004 } });
      await makeCheck(world, { checkNumber: 4000, status: "PRINTED" });
      await makeCheck(world, { checkNumber: 4001, status: "VOID", voidType: "SPOILED" });
      await makeCheck(world, { checkNumber: 4003, status: "CLEARED" });

      const res = await api(world, world.viewer).numberAudit({ format: "csv", bankAccountId: world.bankAccountId, from: "4000", to: "4005" });

      expect(res.status).toBe(200);
      const rows = parseCsv(res.body as Buffer).slice(1);
      expect(rows.map((r) => [r[0], r[1]])).toEqual([
        ["4000", "Printed"],
        ["4001", "Void"],
        ["4002", "MISSING (no record)"],
        ["4003", "Cleared"],
        ["4004", "Not issued yet"],
        ["4005", "Not issued yet"],
      ]);
      expect(rows[1]![4]).toBe("Spoiled");
    });
  });

  describe("Positive Pay", () => {
    const period = (world: TestWorld) => ({ bankAccountId: world.bankAccountId, from: "2026-10-01", to: "2026-10-31" });
    const inPeriod = new Date("2026-10-20T15:00:00Z");

    it("lists every issued check with the full account and routing numbers; printed-then-voided ones marked V", async () => {
      const printed = await makeCheck(world, { status: "PRINTED", printedAt: inPeriod, amount: 1250.5, checkDate: new Date("2026-10-19T00:00:00Z"), payeeName: "Lala Company" });
      const cleared = await makeCheck(world, { status: "CLEARED", printedAt: inPeriod });
      const spoiled = await makeCheck(world, { status: "VOID", voidType: "SPOILED", printedAt: inPeriod });
      const voidedAfter = await makeCheck(world, { status: "VOID", voidType: "VOIDED_AFTER_PRINT", printedAt: inPeriod });
      // Never on paper, or outside the period, or another account: not in the file.
      await makeCheck(world, { status: "VOID", voidType: "CANCELLED", printedAt: null });
      await makeCheck(world, { status: "APPROVED", printedAt: null });
      await makeCheck(world, { status: "PRINTED", printedAt: new Date("2026-09-30T23:59:00Z") });
      await makeCheck(world, { status: "PRINTED", printedAt: new Date("2026-11-01T00:00:00Z") });
      const other = await createBankAccount(world.workspaceId, { nextCheckNumber: 9000 });
      await makeCheck(world, { status: "PRINTED", printedAt: inPeriod, bankAccountId: other });

      const res = await api(world, world.admin).positivePay(period(world));

      expect(res.status).toBe(200);
      expect(res.headers["content-disposition"]).toBe('attachment; filename="positive-pay-1012-10012026-10312026.csv"');
      // No byte-order mark: some bank uploaders reject it.
      expect((res.body as Buffer)[0]).toBe('"'.charCodeAt(0));
      const [header, ...rows] = parseCsv(res.body as Buffer);
      expect(header).toEqual(["Account Number", "Routing Number", "Check Number", "Issue Date", "Amount", "Payee", "Void"]);
      expect(rows.map((r) => Number(r[2]))).toEqual([printed, cleared, spoiled, voidedAfter].map((c) => c.checkNumber));
      expect(rows[0]).toEqual(["987654321012", "111000025", String(printed.checkNumber), "10/19/2026", "1250.50", "Lala Company", ""]);
      expect(rows.map((r) => r[6])).toEqual(["", "", "V", "V"]);
    });

    it("a printed check voided without a void type is still listed, marked V", async () => {
      const untyped = await makeCheck(world, { status: "VOID", printedAt: inPeriod });

      const rows = parseCsv((await api(world, world.admin).positivePay(period(world))).body as Buffer).slice(1);

      expect(rows.map((r) => [Number(r[2]), r[6]])).toEqual([[untyped.checkNumber, "V"]]);
    });

    it("the last day of the period counts in full", async () => {
      const late = await makeCheck(world, { status: "PRINTED", printedAt: new Date("2026-10-31T23:59:59Z") });

      const rows = parseCsv((await api(world, world.admin).positivePay(period(world))).body as Buffer).slice(1);

      expect(rows.map((r) => Number(r[2]))).toEqual([late.checkNumber]);
    });

    it("only people who manage bank accounts may download it", async () => {
      for (const user of [world.editor, world.viewer, world.printer, world.approver1]) {
        expect((await api(world, user).positivePay(period(world))).status).toBe(403);
      }
    });

    it("is audited with the checks it listed", async () => {
      const c = await makeCheck(world, { status: "VOID", voidType: "SPOILED", printedAt: inPeriod });

      await api(world, world.admin).positivePay(period(world));

      const [row] = await auditRows("POSITIVE_PAY_EXPORTED");
      expect(row).toMatchObject({ userId: world.admin.id, entityType: "BankAccount", entityId: world.bankAccountId });
      expect(row!.detailsJson).toMatchObject({ from: "2026-10-01", to: "2026-10-31", rowCount: 1, voidCount: 1, checkNumbers: [c.checkNumber] });
    });

    it("another workspace's bank account is not found; the period is checked", async () => {
      const other = await createWorld();
      const user = api(world, world.admin);

      expect((await user.positivePay({ ...period(world), bankAccountId: other.bankAccountId })).status).toBe(404);
      expect((await user.positivePay({ ...period(world), from: "2026-10-31", to: "2026-10-01" })).status).toBe(400);
      expect((await user.positivePay({ ...period(world), from: "2025-01-01", to: "2026-10-01" })).status).toBe(400);
      expect((await user.positivePay({ ...period(world), from: "10/01/2026" })).status).toBe(400);
    });
  });
});
