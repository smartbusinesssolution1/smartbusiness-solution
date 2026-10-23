import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

// ─── Two-factor sign-in (platform-api, /auth/mfa) ───────────
// Sign-in is unchanged; Check Printing asks admins for a code once per session. Entering
// it here marks the session verified (the server re-issues the access cookie).

export interface TwoFactorStatus {
  enabled: boolean;
  enabledAt: string | null;
  backupCodesRemaining: number;
  verifiedThisSession: boolean;
}

const statusKey = ["two-factor"] as const;

export function useTwoFactorStatus(enabled = true) {
  return useQuery({
    queryKey: statusKey,
    queryFn: async () => (await api<TwoFactorStatus>("/auth/mfa")).data,
    enabled,
    staleTime: 60_000,
  });
}

// Everything cached before the code was entered was refused or is stale: start fresh.
function useAfterChange() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}

export function useStartTwoFactorSetup() {
  return useMutation({
    mutationFn: async () => (await api<{ secret: string; otpauthUrl: string }>("/auth/mfa/setup", { method: "POST" })).data,
  });
}

export function useConfirmTwoFactorSetup() {
  const after = useAfterChange();
  return useMutation({
    mutationFn: async (code: string) =>
      (await api<{ backupCodes: string[] }>("/auth/mfa/setup/confirm", { method: "POST", body: { code } })).data,
    onSuccess: after,
  });
}

export function useVerifyTwoFactor() {
  const after = useAfterChange();
  return useMutation({
    mutationFn: async (code: string) =>
      (await api<{ verified: true; backupCodesRemaining?: number }>("/auth/mfa/verify", { method: "POST", body: { code } })).data,
    onSuccess: after,
  });
}

export function useRegenerateBackupCodes() {
  const after = useAfterChange();
  return useMutation({
    mutationFn: async (code: string) =>
      (await api<{ backupCodes: string[] }>("/auth/mfa/backup-codes", { method: "POST", body: { code } })).data,
    onSuccess: after,
  });
}

export function useDisableTwoFactor() {
  const after = useAfterChange();
  return useMutation({
    mutationFn: async (body: { password: string; code: string }) =>
      (await api<{ enabled: false }>("/auth/mfa/disable", { method: "POST", body })).data,
    onSuccess: after,
  });
}
