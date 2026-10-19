// Shapes returned by the APIs (see each backend module's format* function).

export type Permission =
  | "workspace:manage"
  | "member:manage"
  | "member:view"
  | "bank-account:manage"
  | "check:create"
  | "check:print"
  | "check:approve"
  | "check:void"
  | "check:view"
  | "payee:manage"
  | "payee:write"
  | "report:view";

export type RoleSlug = "check-admin" | "check-editor" | "check-printer" | "check-approver" | "check-viewer";

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
}

export interface TenantInfo {
  tenantId: string;
  tenantName: string;
  role: string;
  status: string;
}

export interface Session {
  user: AuthUser;
  tenants: TenantInfo[];
}

export interface Workspace {
  id: string;
  businessName: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  zipCode: string;
  phone: string | null;
  logoUrl: string | null;
  createdAt: string;
}

export interface WorkspaceWithAccess extends Workspace {
  myAccess: { roles: RoleSlug[]; permissions: Permission[] };
}

export interface Member {
  id: string;
  userId: string;
  email: string;
  fullName: string;
  isActive: boolean;
  lastLoginAt: string | null;
  roles: RoleSlug[];
  permissions: Permission[];
  createdAt: string;
}

export interface BankAccount {
  id: string;
  bankName: string;
  routingNumber: string;
  accountNumber: string;
  accountType: "CHECKING" | "SAVINGS";
  nextCheckNumber: number;
  checkNumberPadding: number;
  hasSignature: boolean;
  signatureUpdatedAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface RoutingLookup {
  valid: boolean;
  bankName?: string;
  city?: string;
  state?: string;
  error?: string;
}

export type CheckStatus = "NEW" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "PRINTED" | "CLEARED" | "VOID";
export type VoidType = "CANCELLED" | "SPOILED" | "VOIDED_AFTER_PRINT";
export type CheckLayout = "CHECK_TOP" | "CHECK_MIDDLE" | "CHECK_BOTTOM" | "THREE_PER_PAGE";
export type PaperSize = "LETTER" | "A4";
export type StockType = "PLAIN_PAPER" | "PERFORATED_STOCK";

export interface PersonRef {
  id: string;
  fullName: string;
}

export interface InvoiceItem {
  description: string;
  amount: number | string;
}

export interface Attachment {
  id: string;
  fileName: string;
  fileType: string;
  sizeBytes: number;
  uploadedBy: PersonRef;
  createdAt: string;
}

export interface ApprovalDecision {
  id: string;
  round: number;
  decision: "approved" | "rejected";
  reason: string | null;
  approver: PersonRef;
  createdAt: string;
}

export interface Check {
  id: string;
  checkNumber: number;
  status: CheckStatus;
  payeeName: string;
  amount: string;
  amountInWords: string;
  checkDate: string;
  memo: string | null;
  invoiceItems: InvoiceItem[] | null;
  hasPdf: boolean;
  voidReason: string | null;
  voidType: VoidType | null;
  voidedAt: string | null;
  printedAt: string | null;
  printConfirmedAt: string | null;
  printConfirmedBy: PersonRef | null;
  printSnapshot: {
    calibrationProfileId: string | null;
    paperSize: PaperSize | null;
    layout: CheckLayout | null;
    position: number | null;
    horizontalOffsetPts: string | null;
    verticalOffsetPts: string | null;
  } | null;
  clearedAt: string | null;
  clearedDate: string | null;
  clearedAmount: string | null;
  createdBy: PersonRef;
  printedBy: PersonRef | null;
  voidedBy: PersonRef | null;
  clearedBy: PersonRef | null;
  bankAccount: { id: string; bankName: string; accountNumber: string; accountType: string };
  reissuedFromCheckId: string | null;
  reissuedFrom: { id: string; checkNumber: number } | null;
  reissuedTo: { id: string; checkNumber: number } | null;
  statusHistory: Array<{
    id: string;
    fromStatus: CheckStatus | null;
    toStatus: CheckStatus;
    changedBy: PersonRef;
    reason: string | null;
    createdAt: string;
  }>;
  attachments: Attachment[];
  approval: {
    round: number;
    requiredApprovals: number | null;
    approvedCount: number;
    isFullyApproved: boolean;
    decisions: ApprovalDecision[];
  } | null;
  createdAt: string;
  updatedAt: string;
  // Present on responses to print / void / print-outcome.
  notice?: string | null;
  // On single-check responses: for a NEW check, whether it needs approval before printing.
  approvalRequired?: boolean | null;
}

export interface RegisterItem {
  id: string;
  checkNumber: number;
  status: CheckStatus;
  payeeName: string;
  amount: string;
  checkDate: string;
  memo: string | null;
  createdBy: PersonRef;
  bankAccount: { id: string; bankName: string; accountNumber: string; accountType: string };
  printedAt: string | null;
  printConfirmedAt: string | null;
  clearedDate: string | null;
  voidType: VoidType | null;
  hasAttachments: boolean;
  possibleDuplicateOf: { id: string; checkNumber: number } | null;
  createdAt: string;
}

// A print job: several checks in one PDF.
export interface PrintBatchSummary {
  id: string;
  checkCount: number;
  sheetCount: number;
  paperSize: PaperSize;
  layout: CheckLayout;
  startPosition: number | null;
  nextPosition: number | null;
  calibrationProfileId: string | null;
  createdAt: string;
}

export interface PrintBatchResult {
  batch: PrintBatchSummary;
  checks: Array<Check & { sheet: number }>;
  notice: string | null;
}

export interface PrintBatch extends PrintBatchSummary {
  createdBy: PersonRef;
  // False once any check in it is void or cleared: printing the PDF again would duplicate it.
  pdfAvailable: boolean;
  checks: Array<{
    id: string;
    checkNumber: number;
    status: CheckStatus;
    payeeName: string;
    amount: string;
    checkDate: string;
    bankAccount: { id: string; bankName: string; accountNumber: string; accountType: string };
    printedAt: string | null;
    printConfirmedAt: string | null;
    voidType: VoidType | null;
    position: number | null;
  }>;
}

export interface RegisterMeta {
  limit: number;
  hasMore: boolean;
  nextCursor?: string | null;
  totals?: { count: number; amount: string };
  facets?: {
    status: Record<string, { count: number; amount: string }>;
    bankAccount: Record<string, { count: number; amount: string }>;
  };
}

export type RegisterView =
  | "awaiting-my-approval"
  | "my-drafts"
  | "ready-to-print"
  | "print-unconfirmed"
  | "outstanding"
  | "stale"
  | "voided";

export interface ViewCount {
  view: RegisterView;
  label: string;
  count: number;
  amount: string;
}

export interface Aging {
  asOf: string;
  staleAfterDays: number;
  buckets: Array<{ label: string; minDays: number; maxDays: number | null; count: number; amount: string }>;
  total: { count: number; amount: string };
}

export interface NumberIntegrity {
  bankAccount: { id: string; bankName: string; accountNumber: string };
  range: { from: number; to: number };
  nextCheckNumber: number;
  summary: Record<string, number>;
  rows: Array<{
    checkNumber: number;
    state: string;
    checkId?: string;
    payeeName?: string;
    amount?: string;
    voidType?: VoidType | null;
    voidReason?: string | null;
  }>;
}

export interface Payee {
  id: string;
  name: string;
  defaultMemo: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CheckSettings {
  maxCheckAmount: string;
  maxPastDays: number;
  maxFutureDays: number;
  approvalEnabled: boolean;
}

export interface ApprovalRule {
  id: string;
  minAmount: string;
  maxAmount: string | null;
  priority: number;
  requiredApprovals: number;
  allowSelfApproval: boolean;
  isActive: boolean;
  createdBy: PersonRef;
  createdAt: string;
  updatedAt: string;
}

export interface Approver {
  id: string;
  userId: string;
  fullName: string;
  email: string;
}

export interface EligibleApprover {
  userId: string;
  fullName: string;
  email: string;
  roles: RoleSlug[];
}

export interface CalibrationSheet {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

export interface PrinterProfile {
  id: string;
  profileName: string;
  paperSize: PaperSize;
  stockType: StockType;
  layout: CheckLayout;
  tray: string | null;
  horizontalOffsetPts: string;
  verticalOffsetPts: string;
  scaleX: string | null;
  scaleY: string | null;
  measurements: { unit: "mm" | "in"; sheets: CalibrationSheet[] } | null;
  repeatability: { sheets: number; spreadXMm: number; spreadYMm: number } | null;
  verification: {
    verified: boolean;
    verifiedAt: string | null;
    verifiedById: string | null;
    lastResult: VerificationOutcome | null;
  };
  refVersion: number;
  needsRecalibration: boolean;
  calibratedById: string;
  calibratedAt: string;
  isDefault: boolean;
  // Three-per-page paper: the slot the next check goes into (the sheet in the tray may be
  // partly used). Always 1 for other layouts.
  nextSlot: 1 | 2 | 3;
  createdAt: string;
  updatedAt: string;
  warnings?: string[];
}

export type VerificationItem = "upperTearLine" | "lowerTearLine" | "micrBottom" | "micrRightEdge" | "amountBoxLeft";

export interface VerificationOutcome {
  passed: boolean;
  items: Array<{
    item: VerificationItem;
    label: string;
    expectedMm: number;
    measuredMm: number;
    errorMm: number;
    status: "ok" | "marginal" | "fail";
  }>;
  // Positive horizontal = move content right; positive vertical = move content down.
  suggestedAdjustment: { horizontalMm: number; verticalMm: number; description: string } | null;
  notes: string[];
}
