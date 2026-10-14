import { z } from "zod";

export const UpdateGeofenceSchema = z.object({
  latitude: z
    .number({ message: "Latitude is required" })
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90"),
  longitude: z
    .number({ message: "Longitude is required" })
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180"),
  radiusMeters: z
    .number({ message: "Radius in meters is required" })
    .int("Radius must be an integer")
    .positive("Radius must be greater than 0")
    .max(10_000, "Radius cannot exceed 10,000 meters")
    .default(100),
  graceMinutes: z
    .number()
    .int("Grace minutes must be an integer")
    .min(0, "Grace minutes cannot be negative")
    .max(120, "Grace minutes cannot exceed 120 minutes")
    .default(15),
  defaultShiftStartTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Shift start time must be in HH:mm 24-hr format")
    .default("09:00"),
  defaultShiftEndTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Shift end time must be in HH:mm 24-hr format")
    .default("18:00"),
});

export const WorkspaceIdParamSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID format"),
});

export type UpdateGeofenceInput = z.infer<typeof UpdateGeofenceSchema>;
export type WorkspaceIdParamInput = z.infer<typeof WorkspaceIdParamSchema>;
