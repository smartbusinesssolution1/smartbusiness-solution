import { z } from "zod";
import { payeeNameSchema } from "../check/check.schemas.js";

const usStateRegex = /^[A-Z]{2}$/;
const zipCodeRegex = /^\d{5}(-\d{4})?$/;

export const createPayeeSchema = z.object({
    // The same rule as a check's payee name: a vendor that cannot fit on a check is useless here.
    name: payeeNameSchema,

    defaultMemo: z.string().max(255).trim().optional().or(z.literal("")),

    addressLine1: z.string().max(255).trim().optional().or(z.literal("")),
    addressLine2: z.string().max(255).trim().optional().or(z.literal("")),

    city: z.string().max(100).trim().optional().or(z.literal("")),

    state: z.string().regex(usStateRegex, { error: "State must be a 2-letter code" }).toUpperCase().trim().optional().or(z.literal("")),

    zipCode: z.string().regex(zipCodeRegex, { error: "ZIP must be 5 digits or ZIP+4" }).optional().or(z.literal(""))
})

// ─── Update Payee ───────────────────────────────────────
// All fields optional — partial update
export const updatePayeeSchema = z.object({
    name: payeeNameSchema.optional(),
    defaultMemo: z.string().max(255).trim().optional().or(z.literal("")),
    addressLine1: z.string().max(255).trim().optional().or(z.literal("")),
    addressLine2: z.string().max(255).trim().optional().or(z.literal("")),
    city: z.string().max(100).trim().optional().or(z.literal("")),
    state: z.string().regex(usStateRegex).toUpperCase().optional().or(z.literal("")),
    zipCode: z.string().regex(zipCodeRegex).optional().or(z.literal("")),
});

// ─── Search/List Query Params ───────────────────────────
//When a user opens the Payees page or uses the search bar, the frontend sends a GET request:
//GET /api/v1/workspaces/ws_123/payees?search=plumb&activeOnly=true&limit=25&offset=0
// everything that comes in req.query is string "25" , "true" and all 
export const listPayeesQuerySchema = z.object({
    search: z.string().max(100).optional(),
    activeOnly: z
        .string()
        .transform((val) => val !== "false")  // "false" → false, everything else → true
        .default(true),

    limit: z
        .string()
        .default("25")
        .transform((val) => Math.min(parseInt(val, 10) || 25, 100)),
    offset: z
        .string()
        .default("0")
        .transform((val) => parseInt(val, 10) || 0),
});

// ─── Pagination Formula Note ───
// page = 1, limit = 10
// offset = (page - 1) * limit

// so when user clicks " Page 3 " in UI 
// frontend calculates offset : ( 3 - 1) * 25 = 50

// frontend sends : /api/v1/workspaces/w_id/payees?limit=25&offset=50

//then zod validates it
export type CreatePayeeInput = z.infer<typeof createPayeeSchema>;
export type UpdatePayeeInput = z.infer<typeof updatePayeeSchema>;
export type ListPayeesQuery = z.infer<typeof listPayeesQuerySchema>;