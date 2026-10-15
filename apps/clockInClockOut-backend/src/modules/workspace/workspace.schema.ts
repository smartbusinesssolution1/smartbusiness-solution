import { z } from "zod";

const US_STATE_REGEX = /^[A-Za-z]{2}$/;
const ZIP_CODE_REGEX = /^\d{5}(-\d{4})?$/;
const PHONE_REGEX = /^[\d\s\-\(\)\+\.]{7,20}$/;

export const createWorkspaceSchema = z.object({
  businessName: z.string().min(1, "Business name is required").max(255).trim(),
  addressLine1: z.string().min(1, "Address is required").max(255).trim(),
  addressLine2: z.string().max(255).trim().optional().or(z.literal("")),
  city: z.string().min(1, "City is required").max(100).trim(),
  state: z
    .string()
    .regex(US_STATE_REGEX, "State must be a 2-letter US state code (e.g., TX, CA)")
    .transform((s) => s.toUpperCase()),
  zipCode: z
    .string()
    .regex(ZIP_CODE_REGEX, "ZIP code must be 5 digits or ZIP+4 format (e.g., 78701 or 78701-1234)"),
  phone: z.string().regex(PHONE_REGEX, "Invalid phone number format").optional().or(z.literal("")),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
