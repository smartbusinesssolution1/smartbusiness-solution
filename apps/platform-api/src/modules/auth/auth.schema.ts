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
  password: passwordSchema.optional(),
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

// The link from an invitation email. Sent in the body, never the URL path, so it does
// not end up in access logs.
export const invitationTokenSchema = z.object({
  token: z.string().min(1, "The invitation link is missing its token").max(200),
});

// Accepting: the invited person confirms their name and chooses a password (same
// strength rules as sign-up). Email and roles come from the invitation.
export const acceptInvitationSchema = z.object({
  token: z.string().min(1, "The invitation link is missing its token").max(200),
  fullName: z.string().trim().min(1, "Enter your name").max(255),
  password: passwordSchema,
});

export type RegisterInputType = z.infer<typeof registerSchema>;
export type LoginInputType = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UpdateProfileInputType = z.infer<typeof updateProfileSchema>;
export type InvitationTokenInput = z.infer<typeof invitationTokenSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
