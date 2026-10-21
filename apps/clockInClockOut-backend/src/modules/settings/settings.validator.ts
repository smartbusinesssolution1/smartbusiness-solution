import { z } from "zod";

export const updateSettingsSchema = z.object({
    latitude: z.number().min(-90).max(90),

    longitude: z.number().min(-180).max(180),

    radiusMeters: z.number().int().positive().max(10_000),

    shiftStartTime: z
        .string()
        .regex(
            /^([01]\d|2[0-3]):[0-5]\d$/,
            "Time must be in HH:mm format",
        ),

    shiftEndTime: z
        .string()
        .regex(
            /^([01]\d|2[0-3]):[0-5]\d$/,
            "Time must be in HH:mm format",
        ),

    graceMinutes: z.number().int().nonnegative(),
});