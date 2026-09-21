import { z } from "zod";

const passwordSchema = z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

export const registerSchema = z.object({
    fullName: z
        .string()
        .min(1, "Full Name is Required")
        .max(255)
        .trim(),

    email: z
        .email({ error: "Invalid email format" })
        .max(255)
        .trim()
        .toLowerCase(),

    password: passwordSchema,

    companyName: z
        .string()
        .min(1, "Company name is required")
        .max(255)
        .trim()
})

export const loginSchema = z.object({
    email: z
        .email({ error: "Invalid email format" })
        .trim()
        .toLowerCase(),

    password: z.string().min(1, "password is required")
})

export type RegisterInputType = z.infer<typeof registerSchema>;
export type LoginInputType = z.infer<typeof loginSchema>;