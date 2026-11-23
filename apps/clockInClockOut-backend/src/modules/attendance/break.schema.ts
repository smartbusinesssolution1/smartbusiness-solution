import { z } from "zod";

export const BreakTypeSchema = z.enum(["MEAL", "REST"]);

export const StartBreakSchema = z.object({
  breakType: BreakTypeSchema.default("MEAL"),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  notes: z.string().trim().max(255).optional(),
  workspaceId: z.string().optional(),
});

export const EndBreakSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  notes: z.string().trim().max(255).optional(),
  workspaceId: z.string().optional(),
});

export const WaiveMealSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Waiver reason must be at least 3 characters")
    .max(255),
  attestationConfirmed: z.boolean().refine((val) => val === true, {
    message: "You must confirm mutual agreement to waive the meal period",
  }),
  workspaceId: z.string().optional(),
});

export const BreakHistoryQuerySchema = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format must be YYYY-MM-DD")
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format must be YYYY-MM-DD")
    .optional(),
  attendanceRecordId: z.string().uuid().optional(),
  workspaceId: z.string().optional(),
});

export type StartBreakInput = z.infer<typeof StartBreakSchema>;
export type EndBreakInput = z.infer<typeof EndBreakSchema>;
export type WaiveMealInput = z.infer<typeof WaiveMealSchema>;
export type BreakHistoryQuery = z.infer<typeof BreakHistoryQuerySchema>;
