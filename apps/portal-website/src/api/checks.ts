import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { api, apiBlob } from "@/lib/api";
import type {
  Aging,
  Attachment,
  Check,
  InvoiceItem,
  NumberIntegrity,
  RegisterItem,
  RegisterMeta,
  ViewCount,
} from "./types";

// Every change to a check can move it between queues, so the lists, the counts and the
// check itself are refreshed together.
export function invalidateChecks(
  qc: QueryClient,
  wid: string,
  checkId?: string,
) {
  qc.invalidateQueries({ queryKey: ["checks", wid] });
  qc.invalidateQueries({ queryKey: ["views", wid] });
  qc.invalidateQueries({ queryKey: ["approval-queue", wid] });
  qc.invalidateQueries({ queryKey: ["aging", wid] });
  if (checkId) qc.invalidateQueries({ queryKey: ["check", wid, checkId] });
}

export type CheckFilters = Record<string, string | number | undefined>;

export function useCheckList(
  wid: string,
  filters: CheckFilters,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: ["checks", wid, filters],
    queryFn: async () =>
      api<RegisterItem[], RegisterMeta>(`/workspaces/${wid}/checks`, {
        query: filters,
      }),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

export function useViews(wid: string) {
  return useQuery({
    queryKey: ["views", wid],
    queryFn: async () =>
      (await api<ViewCount[]>(`/workspaces/${wid}/checks/views`)).data,
    refetchInterval: 60_000,
  });
}

export function useCheck(wid: string, checkId: string | undefined) {
  return useQuery({
    queryKey: ["check", wid, checkId],
    queryFn: async () =>
      (await api<Check>(`/workspaces/${wid}/checks/${checkId}`)).data,
    enabled: Boolean(checkId),
  });
}

export function useApprovalQueue(wid: string, enabled = true) {
  return useQuery({
    queryKey: ["approval-queue", wid],
    queryFn: async () =>
      (await api<Check[]>(`/workspaces/${wid}/checks/approval-queue`)).data,
    enabled,
  });
}

export interface CheckInput {
  bankAccountId: string;
  payeeName: string;
  amount: number;
  checkDate: string;
  memo?: string;
  invoiceItems?: Array<{ description: string; amount: number }>;
  // Stay a draft so invoices can be attached before submitting (attachments freeze then).
  saveAsDraft?: boolean;
}

export function useCreateCheck(wid: string) {
  const qc = useQueryClient();
  return useMutation({
    // The key makes a retried request (double click, flaky network) create one check, not two.
    mutationFn: async ({
      input,
      idempotencyKey,
    }: {
      input: CheckInput;
      idempotencyKey: string;
    }) =>
      (
        await api<Check>(`/workspaces/${wid}/checks`, {
          method: "POST",
          body: input,
          headers: { "Idempotency-Key": idempotencyKey },
        })
      ).data,
    onSuccess: () => invalidateChecks(qc, wid),
  });
}

export function useUpdateCheck(wid: string, checkId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: Partial<Omit<CheckInput, "bankAccountId" | "invoiceItems" | "memo" | "saveAsDraft">> & {
        memo?: string | null;
        invoiceItems?: InvoiceItem[] | null;
      },
    ) =>
      (
        await api<Check>(`/workspaces/${wid}/checks/${checkId}`, {
          method: "PUT",
          body: input,
        })
      ).data,
    onSuccess: () => invalidateChecks(qc, wid, checkId),
  });
}

function useCheckAction<TBody = void>(
  wid: string,
  path: string,
  method: "POST" | "DELETE" = "POST",
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ checkId, body }: { checkId: string; body?: TBody }) =>
      (
        await api<Check>(`/workspaces/${wid}/checks/${checkId}${path}`, {
          method,
          body: body ?? (method === "POST" ? {} : undefined),
        })
      ).data,
    onSuccess: (_data, { checkId }) => invalidateChecks(qc, wid, checkId),
  });
}

export const useSubmitCheck = (wid: string) => useCheckAction(wid, "/submit");
export const useApproveCheck = (wid: string) => useCheckAction(wid, "/approve");
export const useRejectCheck = (wid: string) =>
  useCheckAction<{ reason: string }>(wid, "/reject");
export const useResubmitCheck = (wid: string) =>
  useCheckAction(wid, "/resubmit");
export const useVoidCheck = (wid: string) =>
  useCheckAction<{ reason: string }>(wid, "/void");
export const useClearCheck = (wid: string) =>
  useCheckAction<{ clearedDate?: string; clearedAmount?: number }>(
    wid,
    "/clear",
  );
export const useReissueCheck = (wid: string) => useCheckAction(wid, "/reissue");
export const useDeleteDraft = (wid: string) =>
  useCheckAction(wid, "", "DELETE");
export const usePrintOutcome = (wid: string) =>
  useCheckAction<{ outcome: "OK" } | { outcome: "SPOILED"; reason: string }>(
    wid,
    "/print-outcome",
  );

export function usePrintCheck(wid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      checkId,
      calibrationProfileId,
      position,
      idempotencyKey,
    }: {
      checkId: string;
      calibrationProfileId: string;
      position?: number;
      idempotencyKey: string;
    }) =>
      (
        await api<Check>(`/workspaces/${wid}/checks/${checkId}/print`, {
          method: "POST",
          body: { calibrationProfileId, ...(position ? { position } : {}) },
          headers: { "Idempotency-Key": idempotencyKey },
        })
      ).data,
    onSuccess: (_data, { checkId }) => invalidateChecks(qc, wid, checkId),
  });
}

export function fetchCheckPdf(wid: string, checkId: string): Promise<Blob> {
  return apiBlob(`/workspaces/${wid}/checks/${checkId}/pdf`);
}

// ─── Attachments ───────────────────────────────────────────

export function useUploadAttachment(wid: string, checkId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return (
        await api<Attachment>(
          `/workspaces/${wid}/checks/${checkId}/attachments`,
          { method: "POST", body: form },
        )
      ).data;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["check", wid, checkId] }),
  });
}

export function useRemoveAttachment(wid: string, checkId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (attachmentId: string) => {
      await api(
        `/workspaces/${wid}/checks/${checkId}/attachments/${attachmentId}`,
        { method: "DELETE" },
      );
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["check", wid, checkId] }),
  });
}

export function fetchAttachment(
  wid: string,
  checkId: string,
  attachmentId: string,
): Promise<Blob> {
  return apiBlob(
    `/workspaces/${wid}/checks/${checkId}/attachments/${attachmentId}`,
  );
}

// ─── Reports ───────────────────────────────────────────────

export function useAging(wid: string, bankAccountId?: string) {
  return useQuery({
    queryKey: ["aging", wid, bankAccountId],
    queryFn: async () =>
      (
        await api<Aging>(`/workspaces/${wid}/checks/aging`, {
          query: { bankAccountId },
        })
      ).data,
  });
}

export function useNumberIntegrity(
  wid: string,
  params: { bankAccountId?: string; from?: number; to?: number },
) {
  return useQuery({
    queryKey: ["number-integrity", wid, params],
    queryFn: async () =>
      (
        await api<NumberIntegrity>(
          `/workspaces/${wid}/checks/number-integrity`,
          { query: params },
        )
      ).data,
    enabled: Boolean(params.bankAccountId && params.from && params.to),
  });
}
