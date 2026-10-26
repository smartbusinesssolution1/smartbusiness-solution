import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(
    /[^A-Za-z0-9]/,
    "Password must contain at least one special character",
  );

export const registerSchema = z.object({
  fullName: z.string().min(1, "Full Name is required").max(255).trim(),
  // Trim and lower-case BEFORE checking the format, so a pasted " Maria@X.com " is accepted.
  email: z.string().trim().toLowerCase().pipe(z.email({ error: "Invalid email format" }).max(255)),
  password: passwordSchema,
  companyName: z.string().min(1, "Company name is required").max(255).trim(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email({ error: "Invalid email format" })),
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email({ error: "Invalid email format" })),
  redirectUrl: z.string().url().optional(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "The reset link is missing its token").max(200),
  // The same strength rules as sign-up: checked before the link is used up.
  password: passwordSchema,
});

export const updateProfileSchema = z.object({
  fullName: z.string().min(1, "Full Name is required").max(255).trim().optional(),
});

export type RegisterInputType = z.infer<typeof registerSchema>;
export type LoginInputType = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UpdateProfileInputType = z.infer<typeof updateProfileSchema>;
