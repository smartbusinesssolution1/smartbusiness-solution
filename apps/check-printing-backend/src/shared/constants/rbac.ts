export const PRODUCT_SLUG = "check-printing";

export const ROLES = {
  ADMIN: "check-admin",
  EDITOR: "check-editor",
  PRINTER: "check-printer",
  APPROVER: "check-approver",
  VIEWER: "check-viewer",
} as const;

export const PERMISSIONS = {
  WORKSPACE_MANAGE: "workspace:manage",
  MEMBER_MANAGE: "member:manage",
  MEMBER_VIEW: "member:view",
  BANK_ACCOUNT_MANAGE: "bank-account:manage",
  CHECK_CREATE: "check:create",
  CHECK_PRINT: "check:print",
  CHECK_APPROVE: "check:approve",
  CHECK_VOID: "check:void",
  CHECK_VIEW: "check:view",
  PAYEE_MANAGE: "payee:manage",
  PAYEE_WRITE: "payee:write",
  REPORT_VIEW: "report:view",
} as const;

export type RoleSlug = (typeof ROLES)[keyof typeof ROLES];
export type PermissionAction = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
