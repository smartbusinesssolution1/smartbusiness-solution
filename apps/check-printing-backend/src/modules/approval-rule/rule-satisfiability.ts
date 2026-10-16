import { prisma, type Prisma } from "@smartbusiness/database";
import { ROLES } from "../../shared/constants/rbac.js";

// ═══════════════════════════════════════════════════════════════
// CAN THIS APPROVAL RULE EVER BE SATISFIED? (R-20)
//
// An active rule needing N approvals must always have at least N people who can approve:
// active workspace members with the Approver or Admin role, limited to the rule's designated
// approvers when it names any. Otherwise every check matching the rule waits forever.
//
// Checked when a rule or its approvers change (approval-rule service) and when a member is
// removed or loses a role (workspace repository, inside its locked transaction).
//
// Known limit: when the check's creator is one of those people and self-approval is off,
// that particular check needs one more approver than counted here.
// ═══════════════════════════════════════════════════════════════

type Db = typeof prisma | Prisma.TransactionClient;

const APPROVER_ROLES = [ROLES.APPROVER, ROLES.ADMIN];

// Users who can approve checks in this workspace right now.
export async function eligibleApproverIds(db: Db, workspaceId: string): Promise<Set<string>> {
  const members = await db.workspaceMember.findMany({
    where: {
      workspaceId,
      deletedAt: null,
      assignedRoles: { some: { role: { slug: { in: APPROVER_ROLES } } } },
    },
    select: { userId: true },
  });
  return new Set(members.map((m) => m.userId));
}

// How many people could approve under a rule with these designated approvers.
export function availableApprovers(designatedIds: string[], eligible: Set<string>): number {
  if (designatedIds.length === 0) return eligible.size;
  return new Set(designatedIds.filter((id) => eligible.has(id))).size;
}

export interface UnsatisfiableRule {
  id: string;
  label: string;
  requiredApprovals: number;
  available: number;
}

// Active rules of the workspace that cannot currently be satisfied.
export async function unsatisfiableActiveRules(db: Db, workspaceId: string): Promise<UnsatisfiableRule[]> {
  const [rules, eligible] = await Promise.all([
    db.approvalWorkflowRule.findMany({
      where: { workspaceId, isActive: true },
      select: { id: true, minAmount: true, maxAmount: true, requiredApprovals: true, approvers: { select: { userId: true } } },
    }),
    eligibleApproverIds(db, workspaceId),
  ]);
  return rules
    .map((rule) => ({
      id: rule.id,
      label: ruleLabel(rule.minAmount, rule.maxAmount),
      requiredApprovals: rule.requiredApprovals,
      available: availableApprovers(rule.approvers.map((a) => a.userId), eligible),
    }))
    .filter((r) => r.available < r.requiredApprovals);
}

// "$1,000.00 to $4,999.99" / "$5,000.00 and above": how an admin recognises the rule.
export function ruleLabel(min: unknown, max: unknown): string {
  const money = (v: unknown) => Number(v ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
  return max === null || max === undefined ? `${money(min)} and above` : `${money(min)} to ${money(max)}`;
}
