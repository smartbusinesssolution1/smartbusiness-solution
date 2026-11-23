import { describe, expect, it } from "vitest";
import { addMemberSchema, createWorkspaceSchema, updateWorkspaceSchema } from "./workspace.schema.js";

const validWorkspace = {
  businessName: "Maple Creek LLC",
  addressLine1: "4120 Ranch Road 620",
  city: "Austin",
  state: "TX",
  zipCode: "78701",
};

// BUG_029: Zod runs checks in order, so min(1) placed before trim() let "   " through
// and the business details were saved as "". trim() must run first.
describe("workspace text fields: spaces alone are not a value", () => {
  it.each([
    ["businessName", "Business name is required"],
    ["addressLine1", "Address is required"],
    ["city", "City is required"],
  ])("create refuses %s made of spaces", (field, message) => {
    const result = createWorkspaceSchema.safeParse({ ...validWorkspace, [field]: "   " });

    expect(result.success).toBe(false);
    expect(result.error!.issues[0]!.path).toEqual([field]);
    expect(result.error!.issues[0]!.message).toBe(message);
  });

  it.each(["businessName", "addressLine1", "city"])("update refuses %s made of spaces", (field) => {
    const result = updateWorkspaceSchema.safeParse({ [field]: " \t " });

    expect(result.success).toBe(false);
    expect(result.error!.issues[0]!.path).toEqual([field]);
  });

  it("keeps a real value and removes the spaces around it", () => {
    const result = createWorkspaceSchema.parse({ ...validWorkspace, businessName: "  Maple Creek LLC  ", city: " Austin " });

    expect(result.businessName).toBe("Maple Creek LLC");
    expect(result.city).toBe("Austin");
  });

  it("still lets an update leave a field out", () => {
    expect(updateWorkspaceSchema.parse({ phone: "512-555-0100" })).toEqual({ phone: "512-555-0100" });
  });

  it("checks the length after trimming", () => {
    const padded = `  ${"a".repeat(255)}  `;
    expect(createWorkspaceSchema.parse({ ...validWorkspace, businessName: padded }).businessName).toHaveLength(255);
  });
});

describe("addMemberSchema", () => {
  const valid = { email: "maria@example.com", fullName: "Maria Rodriguez", roleSlugs: ["approver"] };

  it("refuses a name made of spaces", () => {
    const result = addMemberSchema.safeParse({ ...valid, fullName: "   " });

    expect(result.success).toBe(false);
    expect(result.error!.issues[0]!.message).toBe("Name is required");
  });

  // BUG_053: the format was checked before trimming, so a pasted address with spaces
  // around it was refused when sent straight to the API.
  it("trims and lower-cases the email before checking its format", () => {
    expect(addMemberSchema.parse({ ...valid, email: "  Maria@Example.COM " }).email).toBe("maria@example.com");
  });

  it("still refuses an invalid email", () => {
    const result = addMemberSchema.safeParse({ ...valid, email: "not-an-email" });

    expect(result.success).toBe(false);
    expect(result.error!.issues[0]!.message).toBe("Invalid email format");
  });
});
