import { z } from "zod";

// ═══════════════════════════════════════════════════════════════
// APPROVAL RULE SCHEMAS
//
// Zod validation for the Approval Workflow Rule module.
//
// KEY DESIGN DECISIONS:
//
// 1. minAmount is required. The schema has it as Decimal? (nullable)
//    but a rule without a minimum amount is meaningless — it would
//    match every check regardless of amount. If we ever need a
//    "match all" rule, we can revisit this.
//
// 2. maxAmount is optional. When null, the rule matches any amount
//    above minAmount (i.e., no upper bound). The Check module's
//    determineInitialStatus already handles this:
//      const max = rule.maxAmount ? Number(rule.maxAmount) : Infinity;
//
// 3. priority is optional with default 1. The Check module orders
//    rules by priority ASC, so lower numbers match first. When an
//    admin doesn't care about order, defaulting to 1 is fine.
//
// 4. multipleOf(0.01) prevents fractional cents. In financial
//    systems, the smallest unit is a cent ($0.01). A threshold of
//    $1,000.005 is not meaningful.
//
// 5. max(9,999,999.99) matches the Check schema's amount cap.
//    A threshold higher than the maximum check amount would
//    never trigger.
// ═══════════════════════════════════════════════════════════════

const amountField = z
  .number()
  .positive("Amount must be greater than zero")
  .max(9_999_999.99, "Amount cannot exceed $9,999,999.99")
  .multipleOf(0.01, "Amount cannot have more than 2 decimal places");

export const createApprovalRuleSchema = z.object({
  minAmount: amountField,
  maxAmount: amountField.optional(),
  priority: z
    .number()
    .int("Priority must be a whole number")
    .min(1, "Priority must be at least 1")
    .max(100, "Priority cannot exceed 100")
    .optional(),
  requiredApprovals: z
    .number()
    .int("Must be a whole number")
    .min(1, "At least 1 approval is required")
    .max(10, "Cannot require more than 10 approvals")
    .optional(),
  allowSelfApproval: z.boolean().optional(),
}).refine(
  (data) => {
    if (data.maxAmount !== undefined) {
      return data.maxAmount > data.minAmount;
    }
    return true;
  },
  { message: "Maximum amount must be greater than minimum amount", path: ["maxAmount"] },
);

export const updateApprovalRuleSchema = z.object({
  minAmount: amountField.optional(),
  maxAmount: amountField.nullable().optional(),
  priority: z
    .number()
    .int("Priority must be a whole number")
    .min(1, "Priority must be at least 1")
    .max(100, "Priority cannot exceed 100")
    .optional(),
  requiredApprovals: z
    .number()
    .int("Must be a whole number")
    .min(1, "At least 1 approval is required")
    .max(10, "Cannot require more than 10 approvals")
    .optional(),
  allowSelfApproval: z.boolean().optional(),
});

export const listApprovalRulesQuerySchema = z.object({
  includeInactive: z.coerce.boolean().optional().default(false),
});

export const addApproverSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
});

export const syncApproversSchema = z.object({
  userIds: z
    .array(z.string().uuid("Invalid user ID"))
    .max(50, "Cannot assign more than 50 approvers to a single rule"),
});

export type CreateApprovalRuleInput = z.infer<typeof createApprovalRuleSchema>;
export type UpdateApprovalRuleInput = z.infer<typeof updateApprovalRuleSchema>;
export type ListApprovalRulesQuery = z.infer<typeof listApprovalRulesQuerySchema>;
export type AddApproverInput = z.infer<typeof addApproverSchema>;
export type SyncApproversInput = z.infer<typeof syncApproversSchema>;
