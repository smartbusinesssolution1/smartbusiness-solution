import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiBlob } from "@/lib/api";
import type {
  ApprovalRule,
  Approver,
  BankAccount,
  CalibrationSheet,
  CheckLayout,
  EligibleApprover,
  PaperSize,
  Payee,
  PrinterProfile,
  RoutingLookup,
  StockType,
  VerificationItem,
  VerificationOutcome,
} from "./types";

// ─── Bank accounts ─────────────────────────────────────────

export function useBankAccounts(wid: string, enabled = true) {
  return useQuery({
    queryKey: ["bank-accounts", wid],
    queryFn: async () => (await api<BankAccount[]>(`/workspaces/${wid}/bank-accounts`)).data,
    enabled,
  });
}

export function useBankAccount(wid: string, bid: string | undefined) {
  return useQuery({
    queryKey: ["bank-account", wid, bid],
    queryFn: async () => (await api<BankAccount>(`/workspaces/${wid}/bank-accounts/${bid}`)).data,
    enabled: Boolean(bid),
  });
}

export async function lookupRouting(routingNumber: string): Promise<RoutingLookup> {
  return (await api<RoutingLookup>("/validate-routing-number", { method: "POST", body: { routingNumber } })).data;
}

export function useCreateBankAccount(wid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { routingNumber: string; accountNumber: string; accountType: "CHECKING" | "SAVINGS"; startingCheckNumber: number }) =>
      (await api<BankAccount>(`/workspaces/${wid}/bank-accounts`, { method: "POST", body: input })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bank-accounts", wid] }),
  });
}

export function useUpdateBankAccount(wid: string, bid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { accountType?: "CHECKING" | "SAVINGS"; checkNumberPadding?: number; isActive?: boolean }) =>
      (await api<BankAccount>(`/workspaces/${wid}/bank-accounts/${bid}`, { method: "PUT", body: input })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bank-accounts", wid] });
      qc.invalidateQueries({ queryKey: ["bank-account", wid, bid] });
    },
  });
}

export function useUploadSignature(wid: string, bid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: Blob) => {
      const form = new FormData();
      form.append("authorized", "true");
      form.append("signature", file, file instanceof File ? file.name : "signature.png");
      return (await api<BankAccount>(`/workspaces/${wid}/bank-accounts/${bid}/signature`, { method: "PUT", body: form })).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bank-accounts", wid] });
      qc.invalidateQueries({ queryKey: ["bank-account", wid, bid] });
      qc.invalidateQueries({ queryKey: ["signature", wid, bid] });
    },
  });
}

export function useRemoveSignature(wid: string, bid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api(`/workspaces/${wid}/bank-accounts/${bid}/signature`, { method: "DELETE" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bank-accounts", wid] });
      qc.invalidateQueries({ queryKey: ["bank-account", wid, bid] });
      qc.removeQueries({ queryKey: ["signature", wid, bid] });
    },
  });
}

// The cleaned signature as stored (black on transparent PNG), as an object URL.
export function useSignatureImage(wid: string, bid: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["signature", wid, bid],
    queryFn: async () => URL.createObjectURL(await apiBlob(`/workspaces/${wid}/bank-accounts/${bid}/signature`)),
    enabled: Boolean(bid) && enabled,
    staleTime: Infinity,
    gcTime: 60_000,
  });
}

// ─── Printers (calibration profiles) ───────────────────────

export function usePrinters(wid: string, enabled = true) {
  return useQuery({
    queryKey: ["printers", wid],
    queryFn: async () => (await api<PrinterProfile[]>(`/workspaces/${wid}/calibration`)).data,
    enabled,
  });
}

export function usePrinter(wid: string, pid: string | undefined) {
  return useQuery({
    queryKey: ["printer", wid, pid],
    queryFn: async () => (await api<PrinterProfile>(`/workspaces/${wid}/calibration/${pid}`)).data,
    enabled: Boolean(pid),
  });
}

export interface PrinterInput {
  profileName: string;
  paperSize: PaperSize;
  stockType: StockType;
  layout: CheckLayout;
  tray?: string;
  measurements: { unit: "mm" | "in"; sheets: CalibrationSheet[] };
}

function usePrinterInvalidation(wid: string) {
  const qc = useQueryClient();
  return (pid?: string) => {
    qc.invalidateQueries({ queryKey: ["printers", wid] });
    if (pid) qc.invalidateQueries({ queryKey: ["printer", wid, pid] });
  };
}

export function useCreatePrinter(wid: string) {
  const invalidate = usePrinterInvalidation(wid);
  return useMutation({
    mutationFn: async (input: PrinterInput) => (await api<PrinterProfile>(`/workspaces/${wid}/calibration`, { method: "POST", body: input })).data,
    onSuccess: (p) => invalidate(p.id),
  });
}

export function useUpdatePrinter(wid: string, pid: string) {
  const invalidate = usePrinterInvalidation(wid);
  return useMutation({
    mutationFn: async (input: Partial<PrinterInput> & { tray?: string | null }) =>
      (await api<PrinterProfile>(`/workspaces/${wid}/calibration/${pid}`, { method: "PUT", body: input })).data,
    onSuccess: () => invalidate(pid),
  });
}

export function useVerifyPrinter(wid: string, pid: string) {
  const invalidate = usePrinterInvalidation(wid);
  return useMutation({
    mutationFn: async (input: { unit: "mm" | "in" } & Record<VerificationItem, number>) =>
      (await api<VerificationOutcome & { profile: PrinterProfile }>(`/workspaces/${wid}/calibration/${pid}/verification`, { method: "POST", body: input })).data,
    onSuccess: () => invalidate(pid),
  });
}

export function useAdjustPrinter(wid: string, pid: string) {
  const invalidate = usePrinterInvalidation(wid);
  return useMutation({
    mutationFn: async (input: { unit: "mm" | "in"; horizontal: number; vertical: number }) =>
      (await api<PrinterProfile>(`/workspaces/${wid}/calibration/${pid}/adjustment`, { method: "POST", body: input })).data,
    onSuccess: () => invalidate(pid),
  });
}

export function useSetDefaultPrinter(wid: string) {
  const invalidate = usePrinterInvalidation(wid);
  return useMutation({
    mutationFn: async (pid: string) => (await api<PrinterProfile>(`/workspaces/${wid}/calibration/${pid}/default`, { method: "PATCH" })).data,
    onSuccess: () => invalidate(),
  });
}

export function useDeletePrinter(wid: string) {
  const invalidate = usePrinterInvalidation(wid);
  return useMutation({
    mutationFn: async (pid: string) => {
      await api(`/workspaces/${wid}/calibration/${pid}`, { method: "DELETE" });
    },
    onSuccess: () => invalidate(),
  });
}

export const fetchCalibrationSheet = (wid: string, paperSize: PaperSize) =>
  apiBlob(`/workspaces/${wid}/calibration/test-page`, { query: { paperSize } });

export const fetchVerificationSample = (wid: string, pid: string) =>
  apiBlob(`/workspaces/${wid}/calibration/${pid}/verification-page`);

// ─── Payees ────────────────────────────────────────────────

export interface PayeeInput {
  name: string;
  defaultMemo?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

export function usePayees(wid: string, params: { search?: string; activeOnly?: boolean; limit?: number } = {}) {
  return useQuery({
    queryKey: ["payees", wid, params],
    queryFn: async () => api<Payee[], { total?: number }>(`/workspaces/${wid}/payees`, {
      query: { search: params.search, activeOnly: params.activeOnly === undefined ? undefined : String(params.activeOnly), limit: params.limit ?? 50 },
    }),
  });
}

export function useSavePayee(wid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: PayeeInput }) =>
      (await api<Payee>(id ? `/workspaces/${wid}/payees/${id}` : `/workspaces/${wid}/payees`, { method: id ? "PUT" : "POST", body: input })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payees", wid] }),
  });
}

export function useArchivePayee(wid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, archive }: { id: string; archive: boolean }) =>
      (await api<Payee>(`/workspaces/${wid}/payees/${id}/${archive ? "archive" : "restore"}`, { method: "PATCH" })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payees", wid] }),
  });
}

// ─── Approval rules ────────────────────────────────────────

export function useApprovalRules(wid: string, enabled = true) {
  return useQuery({
    queryKey: ["approval-rules", wid],
    queryFn: async () => api<ApprovalRule[], { total: number; approvalEnabled: boolean }>(`/workspaces/${wid}/approval-rules`, { query: { includeInactive: "true" } }),
    enabled,
  });
}

export function useRuleApprovers(wid: string, ruleId: string | undefined) {
  return useQuery({
    queryKey: ["rule-approvers", wid, ruleId],
    queryFn: async () => (await api<Approver[]>(`/workspaces/${wid}/approval-rules/${ruleId}/approvers`)).data,
    enabled: Boolean(ruleId),
  });
}

export function useEligibleApprovers(wid: string, enabled = true) {
  return useQuery({
    queryKey: ["eligible-approvers", wid],
    queryFn: async () => (await api<EligibleApprover[]>(`/workspaces/${wid}/approval-rules/eligible-approvers`)).data,
    enabled,
  });
}

function useRulesInvalidation(wid: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["approval-rules", wid] });
    qc.invalidateQueries({ queryKey: ["rule-approvers", wid] });
    qc.invalidateQueries({ queryKey: ["settings", wid] });
  };
}

export function useToggleApproval(wid: string) {
  const invalidate = useRulesInvalidation(wid);
  return useMutation({
    mutationFn: async (enabled: boolean) => (await api(`/workspaces/${wid}/approval-rules/settings/approval-toggle`, { method: "PATCH", body: { enabled } })).data,
    onSuccess: invalidate,
  });
}

export interface RuleInput {
  minAmount: number;
  maxAmount?: number;
  priority?: number;
  requiredApprovals?: number;
  allowSelfApproval?: boolean;
}

export function useSaveRule(wid: string) {
  const invalidate = useRulesInvalidation(wid);
  return useMutation({
    mutationFn: async ({ id, input, approverIds }: { id?: string; input: RuleInput; approverIds: string[] }) => {
      const rule = (await api<ApprovalRule>(id ? `/workspaces/${wid}/approval-rules/${id}` : `/workspaces/${wid}/approval-rules`, { method: id ? "PUT" : "POST", body: input })).data;
      await api(`/workspaces/${wid}/approval-rules/${rule.id}/approvers`, { method: "PUT", body: { userIds: approverIds } });
      return rule;
    },
    onSuccess: invalidate,
  });
}

export function useRuleState(wid: string) {
  const invalidate = useRulesInvalidation(wid);
  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "activate" | "deactivate" | "delete" }) => {
      if (action === "delete") await api(`/workspaces/${wid}/approval-rules/${id}`, { method: "DELETE" });
      else await api(`/workspaces/${wid}/approval-rules/${id}/${action}`, { method: "POST", body: {} });
    },
    onSuccess: invalidate,
  });
}
