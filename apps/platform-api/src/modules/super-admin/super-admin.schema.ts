import { z } from "zod";

export const superAdminLoginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email({ error: "Invalid administrator email address" })),
  password: z.string().min(1, "Password is required"),
});

export type SuperAdminLoginInput = z.infer<typeof superAdminLoginSchema>;

export const createOrganizationSchema = z.object({
  tenantName: z.string().min(2, "Tenant/Company name must be at least 2 characters").trim(),
  billingEmail: z.string().trim().toLowerCase().pipe(z.email({ error: "Invalid billing email address" })),
  fullName: z.string().min(2, "Owner full name must be at least 2 characters").trim(),
  email: z.string().trim().toLowerCase().pipe(z.email({ error: "Invalid owner email address" })),
  password: z.string().min(8, "Password must be at least 8 characters").optional(),
  city: z.string().min(1, "City is required").trim(),
  state: z.string().min(1, "State is required").trim(),
  workspaceName: z.string().trim().optional(),
  workspaceAddress: z.string().trim().optional(),
  zipCode: z.string().trim().optional(),
  serviceType: z.enum(["CHECK_PRINTING", "CLOCK_IN_CLOCK_OUT", "BOTH"]),
  planName: z.string().trim(),
  planPrice: z.number().min(0, "Plan price must be non-negative"),
  planDuration: z.string().trim(),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

export const createPlanSchema = z.object({
  name: z.string().min(2, "Plan name must be at least 2 characters").trim(),
  service: z.enum(["CHECK_PRINTING", "CLOCK_IN_CLOCK_OUT", "BOTH"]),
  durationCount: z.number().int().min(1, "Duration count must be at least 1"),
  durationUnit: z.enum(["DAY", "MONTH", "YEAR"]),
  price: z.number().min(0, "Price must be non-negative"),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  description: z.string().trim().optional(),
});

export type CreatePlanInput = z.infer<typeof createPlanSchema>;

export const updatePlanSchema = z.object({
  name: z.string().min(2).trim().optional(),
  price: z.number().min(0).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  description: z.string().trim().optional(),
});

export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  service: z.string().trim().optional(),
  status: z.string().trim().optional(),
});

export type PaginationQueryInput = z.infer<typeof paginationQuerySchema>;

export const telemetryQuerySchema = z.object({
  severity: z.enum(["ALL", "FATAL", "ERROR", "WARN", "INFO"]).optional(),
  service: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export type TelemetryQueryInput = z.infer<typeof telemetryQuerySchema>;
