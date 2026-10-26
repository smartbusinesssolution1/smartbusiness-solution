import { z } from "zod";
import { day, list } from "../check/check-filter.js";
import { WORKSPACE_CATEGORIES } from "./activity-catalog.js";

// ?cursor= is the last entry of the previous page: its time and id, so paging stays
// correct while new entries are being written.
const cursor = z
  .string()
  .max(200)
  .transform((s, ctx) => {
    try {
      const parsed = JSON.parse(Buffer.from(s, "base64url").toString("utf8")) as { at?: unknown; id?: unknown };
      const at = new Date(String(parsed.at));
      if (typeof parsed.id !== "string" || !/^[0-9a-f-]{36}$/i.test(parsed.id) || Number.isNaN(at.getTime())) throw new Error();
      return { at, id: parsed.id };
    } catch {
      ctx.addIssue({ code: "custom", message: "Not a valid page cursor" });
      return z.NEVER;
    }
  });

export function encodeCursor(at: Date, id: string): string {
  return Buffer.from(JSON.stringify({ at: at.toISOString(), id }), "utf8").toString("base64url");
}

const range = <T extends { from?: Date; to?: Date }>(q: T, ctx: z.RefinementCtx) => {
  // Runs even when a day failed its own check (then it is still the raw string).
  if (!(q.from instanceof Date) || !(q.to instanceof Date)) return;
  if (q.to < q.from) ctx.addIssue({ code: "custom", path: ["to"], message: "The end is before the start" });
};

// The workspace's activity (admins).
export const activityQuerySchema = z
  .strictObject({
    userId: z.uuid().optional(),
    category: list(z.enum(WORKSPACE_CATEGORIES as [string, ...string[]])).optional(),
    // Everything about one record: a check, a bank account, a payee…
    entityId: z.uuid().optional(),
    from: day.optional(),
    to: day.optional(),
    cursor: cursor.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .superRefine(range);

// Sign-ins and security events of the company's members (the company owner).
export const securityQuerySchema = z
  .strictObject({
    userId: z.uuid().optional(),
    // failed: wrong passwords, refused access, deactivated accounts trying to sign in.
    outcome: z.enum(["failed"]).optional(),
    from: day.optional(),
    to: day.optional(),
    cursor: cursor.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .superRefine(range);

export type ActivityQuery = z.infer<typeof activityQuerySchema>;
export type SecurityQuery = z.infer<typeof securityQuerySchema>;
