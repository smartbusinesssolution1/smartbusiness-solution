import * as fs from "fs";
import * as path from "path";
import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabase } from "../helpers/db.js";
import { createPrinterProfile, createWorld, type TestWorld } from "../helpers/fixtures.js";
import { checksApi } from "../helpers/api.js";

// Found by the web app's end-to-end test: the API stores invoice line amounts as JSON
// numbers, the PDF stub expected strings, and every check with invoice lines failed to
// print with a 500.

const hasFont = fs.existsSync(path.resolve(process.env.E13B_FONT_PATH ?? ""));

let world: TestWorld;

beforeEach(async () => {
  await resetDatabase();
  world = await createWorld({ approvalEnabled: false });
  await createPrinterProfile(world);
});

describe.skipIf(!hasFont)("printing a check with invoice lines", () => {
  it("prints, with the lines written through the API as numbers", async () => {
    const api = checksApi(world, world.editor);
    const created = await api.create({
      amount: 2450,
      invoiceItems: [
        { description: "Hardwood mulch, 40 yd", amount: 1650 },
        { description: "River stone, 8 t", amount: 800 },
      ],
    });
    expect(created.status).toBe(201);

    const printed = await checksApi(world, world.printer).print(created.body.data.id);
    expect(printed.status).toBe(200);
    expect(printed.body.data.status).toBe("PRINTED");
    expect(printed.body.data.hasPdf).toBe(true);
  });

  it("prints a reissued check, whose lines were copied from the original", async () => {
    const api = checksApi(world, world.editor);
    const id = (await api.create({ amount: 120, invoiceItems: [{ description: "Fuel", amount: 120 }] })).body.data.id;
    const printer = checksApi(world, world.printer);
    expect((await printer.print(id)).status).toBe(200);
    expect((await printer.printOutcome(id, { outcome: "SPOILED", reason: "Jammed" })).status).toBe(200);

    const reissued = await api.reissue(id);
    expect(reissued.status).toBe(201);
    expect((await printer.print(reissued.body.data.id)).status).toBe(200);
  });
});
