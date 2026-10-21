import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { CheckSettings, InvitedMember, Member, RoleSlug, Workspace, WorkspaceWithAccess } from "./types";

export interface WorkspaceInput {
  businessName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipCode: string;
  phone?: string;
}

export function useWorkspaces(enabled = true) {
  return useQuery({
    queryKey: ["workspaces"],
    queryFn: async () => (await api<Workspace[]>("/workspaces")).data,
    enabled,
  });
}

export function useWorkspace(wid: string | undefined) {
  return useQuery({
    queryKey: ["workspace", wid],
    queryFn: async () => (await api<WorkspaceWithAccess>(`/workspaces/${wid}`)).data,
    enabled: Boolean(wid),
    retry: (count, err) => count < 1 && (err as { status?: number }).status !== 404 && (err as { status?: number }).status !== 403,
  });
}

export function useCreateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: WorkspaceInput) => (await api<Workspace>("/workspaces", { method: "POST", body: input })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspaces"] }),
  });
}

export function useUpdateWorkspace(wid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<WorkspaceInput>) => (await api<Workspace>(`/workspaces/${wid}`, { method: "PUT", body: input })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspace", wid] });
      qc.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });
}

// ─── Members ───────────────────────────────────────────────

export function useMembers(wid: string, enabled = true) {
  return useQuery({
    queryKey: ["members", wid],
    queryFn: async () => (await api<Member[]>(`/workspaces/${wid}/members`)).data,
    enabled,
  });
}

export function useAddMember(wid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { email: string; fullName: string; roleSlugs: RoleSlug[] }) =>
      (await api<InvitedMember>(`/workspaces/${wid}/members`, { method: "POST", body: input })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members", wid] }),
  });
}

// Emails a new invitation link (the old one stops working). At most once a minute per person.
export function useResendInvitation(wid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (memberId: string) =>
      (await api<{ message: string }>(`/workspaces/${wid}/members/${memberId}/invitation`, { method: "POST" })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members", wid] }),
  });
}

export function useUpdateMember(wid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ memberId, roleSlugs }: { memberId: string; roleSlugs: RoleSlug[] }) =>
      (await api<Member>(`/workspaces/${wid}/members/${memberId}`, { method: "PUT", body: { roleSlugs } })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members", wid] });
      qc.invalidateQueries({ queryKey: ["workspace", wid] });
    },
  });
}

export function useRemoveMember(wid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (memberId: string) => {
      await api(`/workspaces/${wid}/members/${memberId}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members", wid] }),
  });
}

// ─── Check limits ──────────────────────────────────────────

export function useCheckSettings(wid: string) {
  return useQuery({
    queryKey: ["settings", wid],
    queryFn: async () => (await api<CheckSettings>(`/workspaces/${wid}/check-printing-settings`)).data,
  });
}

export function useUpdateCheckSettings(wid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { maxCheckAmount?: number; maxPastDays?: number; maxFutureDays?: number }) =>
      (await api<CheckSettings>(`/workspaces/${wid}/check-printing-settings`, { method: "PUT", body: input })).data,
    onSuccess: (data) => qc.setQueryData(["settings", wid], data),
  });
}
