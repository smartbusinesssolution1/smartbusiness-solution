import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cityStateZip } from "../src/lib/format";

// The payee list's address line (BUG_026: "null" was printed; BUG_027: state and ZIP were
// hidden when there was no city).
describe("cityStateZip", () => {
  const cases: Array<[string, { city: string | null; state: string | null; zipCode: string | null }, string]> = [
    ["all three", { city: "Austin", state: "TX", zipCode: "78701" }, "Austin, TX 78701"],
    ["no state (stored as null)", { city: "Austin", state: null, zipCode: "78701" }, "Austin, 78701"],
    ["no city", { city: null, state: "TX", zipCode: "78701" }, "TX 78701"],
    ["blank city", { city: "", state: "TX", zipCode: "78701-1234" }, "TX 78701-1234"],
    ["only a ZIP", { city: null, state: null, zipCode: "78701" }, "78701"],
    ["only a city", { city: "Austin", state: null, zipCode: null }, "Austin"],
    ["nothing", { city: null, state: null, zipCode: null }, ""],
  ];
  for (const [label, input, expected] of cases) {
    it(label, () => assert.equal(cityStateZip(input), expected));
  }
});
