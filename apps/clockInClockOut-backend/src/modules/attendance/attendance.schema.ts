import { z } from "zod";

export const VerifyLocationSchema = z.object({
  workspaceId: z.string().optional(),
  latitude: z.coerce.number().min(-90).max(90, "Latitude must be between -90 and 90"),
  longitude: z.coerce.number().min(-180).max(180, "Longitude must be between -180 and 180"),
  accuracy: z.coerce.number().optional(),
});

export type VerifyLocationInput = z.infer<typeof VerifyLocationSchema>;

export const CheckInSchema = z.object({
  workspaceId: z.string().optional(),
  latitude: z.union([z.coerce.number().min(-90).max(90), z.null()]).optional().transform((val) => val ?? 0),
  longitude: z.union([z.coerce.number().min(-180).max(180), z.null()]).optional().transform((val) => val ?? 0),
  accuracy: z.union([z.coerce.number(), z.null()]).optional().transform((val) => val ?? undefined),
  angle: z.string().optional(),
  campusName: z.string().optional(),
  faceVerificationId: z.string().optional(),
  challengeToken: z.string().optional(),
  selfieUri: z.string().optional(),
  notes: z.string().optional(),
  employeeId: z.string().optional(),
  employeeName: z.string().optional(),
});

export type CheckInInput = z.infer<typeof CheckInSchema>;

export const CheckOutSchema = z.object({
  workspaceId: z.string().optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  notes: z.string().optional(),
  employeeId: z.string().optional(),
});

export type CheckOutInput = z.infer<typeof CheckOutSchema>;

export const AttendanceHistoryQuerySchema = z.object({
  month: z.string().optional(), // YYYY-MM
  workspaceId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(31),
});

export type AttendanceHistoryQueryInput = z.infer<typeof AttendanceHistoryQuerySchema>;

export const LedgerExportSchema = z.object({
  month: z.string().optional(), // YYYY-MM
  format: z.enum(["csv", "pdf"]).default("pdf"),
  workspaceId: z.string().optional(),
});

export type LedgerExportInput = z.infer<typeof LedgerExportSchema>;
