// ═══════════════════════════════════════════════════════════════
// CHECK RESPONSE TYPES
//
// These define the shape of data returned by the API.
// They are NOT the Prisma model types — the service layer
// transforms raw Prisma data into these response shapes,
// stripping internal fields and formatting for the client.
// ═══════════════════════════════════════════════════════════════

export interface CheckResponse {
  id: string;
  checkNumber: number;
  status: string;
  payeeName: string;
  amount: string;
  amountInWords: string;
  checkDate: string;
  memo: string | null;
  invoiceItems: InvoiceItem[] | null;
  pdfStorageUrl: string | null;
  voidReason: string | null;
  voidedAt: string | null;
  printedAt: string | null;
  clearedAt: string | null;
  clearedDate: string | null;
  clearedAmount: string | null;

  createdBy: UserSummary;
  printedBy: UserSummary | null;
  voidedBy: UserSummary | null;
  clearedBy: UserSummary | null;

  bankAccount: BankAccountSummary;
  reissuedFromCheckId: string | null;

  statusHistory: StatusHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface UserSummary {
  id: string;
  fullName: string;
}

export interface BankAccountSummary {
  id: string;
  bankName: string;
  accountNumber: string;
  accountType: string;
}

export interface InvoiceItem {
  description: string;
  amount: number;
}

export interface StatusHistoryEntry {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  changedBy: UserSummary;
  reason: string | null;
  createdAt: string;
}

export interface CheckListResponse {
  items: CheckListItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface CheckListItem {
  id: string;
  checkNumber: number;
  status: string;
  payeeName: string;
  amount: string;
  checkDate: string;
  memo: string | null;
  createdBy: UserSummary;
  bankAccount: BankAccountSummary;
  createdAt: string;
}

export interface AuditContext {
  userId: string;
  tenantId: string;
  ipAddress?: string;
}
