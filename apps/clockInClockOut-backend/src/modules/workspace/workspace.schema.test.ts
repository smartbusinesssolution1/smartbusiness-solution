import { describe, it, expect } from "vitest";
import { createWorkspaceSchema, updateWorkspaceSchema } from "./workspace.schema.js";

describe("Workspace Schemas", () => {
  describe("createWorkspaceSchema", () => {
    it("validates valid workspace creation payload", () => {
      const parsed = createWorkspaceSchema.parse({
        businessName: "Acme Austin HQ",
        addressLine1: "100 Congress Ave",
        city: "Austin",
        state: "tx",
        zipCode: "78701",
        phone: "+1 512-555-0100",
      });

      expect(parsed.businessName).toBe("Acme Austin HQ");
      expect(parsed.state).toBe("TX"); // transformed uppercase
      expect(parsed.zipCode).toBe("78701");
    });

    it("accepts ZIP+4 formats", () => {
      const parsed = createWorkspaceSchema.parse({
        businessName: "Acme Branch",
        addressLine1: "200 Main St",
        city: "Dallas",
        state: "TX",
        zipCode: "75201-1234",
      });

      expect(parsed.zipCode).toBe("75201-1234");
    });

    it("rejects state codes that are not 2 letters", () => {
      expect(() =>
        createWorkspaceSchema.parse({
          businessName: "Acme",
          addressLine1: "123 St",
          city: "Austin",
          state: "TEXAS",
          zipCode: "78701",
        })
      ).toThrow();
    });

    it("rejects invalid zip code formats", () => {
      expect(() =>
        createWorkspaceSchema.parse({
          businessName: "Acme",
          addressLine1: "123 St",
          city: "Austin",
          state: "TX",
          zipCode: "7870", // only 4 digits
        })
      ).toThrow();
    });
  });

  describe("updateWorkspaceSchema", () => {
    it("allows partial workspace updates", () => {
      const parsed = updateWorkspaceSchema.parse({
        businessName: "Acme New HQ",
      });

      expect(parsed.businessName).toBe("Acme New HQ");
      expect(parsed.city).toBeUndefined();
    });
  });
});
