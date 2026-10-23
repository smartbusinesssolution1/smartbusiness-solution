import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api, apiFile, saveFile } from "@/lib/api";
import type { ExportFormat } from "./checks";

// ─── The activity log (admins) and sign-ins (company owner) ─

export interface ActivityChange {
  field: string;
  label: string;
  from: string;
  to: string;
}

export interface ActivityItem {
  id: string;
  at: string;
  action: string;
  category: string;
  categoryLabel: string;
  actor: { id: string; name: string; email: string };
  summary: string;
  changes: ActivityChange[];
  reason: string | null;
  link: { kind: "check" | "bank-account" | "payee"; id: string } | null;
  ipAddress: string | null;
  details: Record<string, unknown>;
}

interface PageMeta {
  limit: number;
  hasMore: boolean;
  nextCursor: string | null;
}

export interface ActivityPerson {
  id: string;
  fullName: string;
  email: string;
}

export type ActivityFilters = Record<string, string | undefined>;

export const ACTIVITY_CATEGORIES: Array<{ value: string; label: string }> = [
  { value: "checks", label: "Checks" },
  { value: "approvals", label: "Approvals" },
  { value: "printing", label: "Printing" },
  { value: "downloads", label: "Downloads and exports" },
  { value: "bank-accounts", label: "Bank accounts" },
  { value: "payees", label: "Payees" },
  { value: "rules", label: "Approval rules and limits" },
  { value: "printers", label: "Printer setup" },
  { value: "team", label: "Team" },
  { value: "business", label: "Business details" },
  { value: "access", label: "Access refused" },
];

function useLog(wid: string, path: string, filters: ActivityFilters, enabled = true) {
  return useInfiniteQuery({
    queryKey: ["activity", wid, path, filters],
    queryFn: ({ pageParam }) =>
      api<ActivityItem[], PageMeta>(`/workspaces/${wid}/activity${path}`, { query: { ...filters, cursor: pageParam } }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.meta?.nextCursor ?? undefined,
    enabled,
  });
}

export const useActivity = (wid: string, filters: ActivityFilters) => useLog(wid, "", filters);
export const useSecurityLog = (wid: string, filters: ActivityFilters, enabled: boolean) => useLog(wid, "/security", filters, enabled);

export function useActivityPeople(wid: string, security: boolean, enabled = true) {
  return useQuery({
    queryKey: ["activity-people", wid, security],
    queryFn: async () => (await api<ActivityPerson[]>(`/workspaces/${wid}/activity${security ? "/security" : ""}/people`)).data,
    enabled,
  });
}

export async function exportActivity(wid: string, security: boolean, filters: ActivityFilters, format: ExportFormat) {
  const { blob, fileName } = await apiFile(`/workspaces/${wid}/activity${security ? "/security" : ""}/export`, { query: { ...filters, format } });
  saveFile(blob, fileName);
}
