// ═══════════════════════════════════════════════════════════════
// APPROVAL RULE TYPES
//
// API response shapes for the Approval Workflow Rule module.
//
// WHY separate from Prisma types?
// Prisma returns Decimal objects → API returns strings
// Prisma returns flat user IDs → API returns { id, fullName }
// Prisma includes all columns → API may exclude internals
//
// These types are the CONTRACT with the frontend. Changing
// the database schema should NOT change the API response.
// ═══════════════════════════════════════════════════════════════

export interface ApprovalRuleResponse {
  id: string;
  minAmount: string;
  maxAmount: string | null;
  priority: number;
  requiredApprovals: number;
  allowSelfApproval: boolean;
  isActive: boolean;
  createdBy: {
    id: string;
    fullName: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalRuleListResponse {
  items: ApprovalRuleResponse[];
  meta: {
    total: number;
    approvalEnabled: boolean;
  };
}

export interface ApproverResponse {
  id: string;
  userId: string;
  fullName: string;
  email: string;
}

export interface EligibleApproverResponse {
  userId: string;
  fullName: string;
  email: string;
  roles: string[];
}

export interface AuditContext {
  userId: string;
  tenantId: string;
  ipAddress?: string;
}
