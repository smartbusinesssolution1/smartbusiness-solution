import { z } from "zod";

export const UpdateProfileSchema = z.object({
  fullName: z.string().trim().min(2, "Full name must be at least 2 characters").optional(),
  name: z.string().trim().min(2).optional(),
  phone: z.string().trim().optional(),
  avatarUrl: z.string().trim().min(1).optional(),
  biometricPhotoUrl: z.string().trim().min(1).optional(),
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

export const RegisterPushTokenSchema = z.object({
  pushToken: z.string().trim().min(1, "pushToken is required"),
  platform: z.enum(["ios", "android", "web"]).optional(),
  deviceName: z.string().trim().optional(),
});

export type RegisterPushTokenInput = z.infer<typeof RegisterPushTokenSchema>;
