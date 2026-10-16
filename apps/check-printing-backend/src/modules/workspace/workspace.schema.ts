import { z } from "zod";

// ─── Validation Patterns ────────────────────────────────
const US_STATE_REGEX = /^[A-Za-z]{2}$/;
const ZIP_CODE_REGEX = /^\d{5}(-\d{4})?$/;
const PHONE_REGEX = /^[\d\s\-\(\)\+\.]{7,20}$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Reusable Field Builders ────────────────────────────
const businessNameField = z.string().min(1, "Business name is required").max(255).trim();
const addressLine1Field = z.string().min(1, "Address is required").max(255).trim();
const addressLine2Field = z.string().max(255).trim().optional().or(z.literal(""));
const cityField = z.string().min(1, "City is required").max(100).trim();
const stateField = z
  .string()
  .regex(US_STATE_REGEX, "State must be a 2-letter US state code (e.g., TX, CA)")
  .transform((s) => s.toUpperCase());
const zipCodeField = z
  .string()
  .regex(ZIP_CODE_REGEX, "ZIP code must be 5 digits or ZIP+4 format (e.g., 78701 or 78701-1234)");
const phoneField = z.string().regex(PHONE_REGEX, "Invalid phone number format").optional().or(z.literal(""));
// A field that is no longer accepted here: any value is refused with where it moved.
const movedTo = (endpoint: string) =>
  z.never({ error: `This setting moved: use ${endpoint} under this workspace` }).optional();

// ─── Param Validators ───────────────────────────────────
export const workspaceIdParam = z.object({
  wid: z.string().regex(UUID_REGEX, "Invalid workspace ID"),
});

export const memberIdParam = z.object({
  wid: z.string().regex(UUID_REGEX, "Invalid workspace ID"),
  mid: z.string().regex(UUID_REGEX, "Invalid member ID"),
});

// ─── Create Workspace ───────────────────────────────────
export const createWorkspaceSchema = z.object({
  businessName: businessNameField,
  addressLine1: addressLine1Field,
  addressLine2: addressLine2Field,
  city: cityField,
  state: stateField,
  zipCode: zipCodeField,
  phone: phoneField,
});

// ─── Update Workspace ───────────────────────────────────
export const updateWorkspaceSchema = z.object({
  businessName: z.string().min(1).max(255).trim().optional(),
  addressLine1: z.string().min(1).max(255).trim().optional(),
  addressLine2: z.string().max(255).trim().optional().or(z.literal("")),
  city: z.string().min(1).max(100).trim().optional(),
  state: z.string().regex(US_STATE_REGEX).transform((s) => s.toUpperCase()).optional(),
  zipCode: z.string().regex(ZIP_CODE_REGEX).optional(),
  phone: z.string().regex(PHONE_REGEX).optional().or(z.literal("")),
  // A workspace is a platform concept shared by every product; product settings have
  // their own endpoints. These fields used to live here, so a client still sending them
  // gets a pointer instead of having them silently dropped.
  maxCheckAmount: movedTo("PUT /check-printing-settings"),
  maxPastDays: movedTo("PUT /check-printing-settings"),
  maxFutureDays: movedTo("PUT /check-printing-settings"),
  approvalEnabled: movedTo("PATCH /approval-rules/settings/approval-toggle"),
});

// ─── Add Member ─────────────────────────────────────────
export const addMemberSchema = z.object({
  email: z.email({ error: "Invalid email format" }).trim().toLowerCase(),
  fullName: z.string().min(1, "Name is required").max(255).trim(),
  roleSlugs: z
    .array(z.string().min(1).max(50))
    .min(1, "At least one role is required"),
});

// ─── Update Member Roles ────────────────────────────────
export const updateMemberSchema = z.object({
  roleSlugs: z
    .array(z.string().min(1).max(50))
    .min(1, "At least one role is required"),
});

// ─── TypeScript Types ───────────────────────────────────
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
