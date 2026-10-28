import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, tenantStore } from "@/lib/api";
import type { InvitationView, Session } from "./types";

export const sessionKey = ["session"] as const;

// Who is signed in. A 401 here (after the client's one refresh attempt) means nobody.
export function useSession() {
  return useQuery({
    queryKey: sessionKey,
    queryFn: async (): Promise<Session | null> => {
      try {
        const { data } = await api<Session>("/auth/me");
        return data;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
}

// The owner of the company being used now: company-level powers (sign-in history,
// resetting someone's two-factor) are theirs.
export function useIsCompanyOwner(): boolean {
  const { data: session } = useSession();
  const current = tenantStore.get();
  return session?.tenants.find((t) => t.tenantId === current)?.role === "OWNER";
}

// Keep the chosen company if the user still belongs to it, else take the first one.
// requested: the company the portal's "Open Check Printing" link names (?tenant=), for
// people in more than one company. Only one of the user's own companies is ever taken;
// anything else is ignored (and the API checks membership on every request regardless).
export function chooseTenant(session: Session, requested?: string | null): string | null {
  const current = tenantStore.get();
  const tenant =
    session.tenants.find((t) => t.tenantId === requested) ??
    session.tenants.find((t) => t.tenantId === current) ??
    session.tenants[0];
  tenantStore.set(tenant?.tenantId ?? null);
  return tenant?.tenantId ?? null;
}

function useSignedIn() {
  const qc = useQueryClient();
  return (session: Session) => {
    qc.clear();
    chooseTenant(session);
    qc.setQueryData(sessionKey, session);
  };
}

export function useLogin() {
  const signedIn = useSignedIn();
  return useMutation({
    mutationFn: async (input: { email: string; password: string }) => (await api<Session>("/auth/login", { method: "POST", body: input })).data,
    onSuccess: signedIn,
  });
}

// Sign-up moved to the SmartBusiness portal (apps/platform-web): companies create their
// account there, then open Check Printing already signed in. Kept, commented out, in case
// Check Printing ever needs its own sign-up again.
// export function useRegister() {
//   const signedIn = useSignedIn();
//   return useMutation({
//     mutationFn: async (input: { fullName: string; email: string; password: string; companyName: string }) =>
//       (await api<Session>("/auth/register", { method: "POST", body: input })).data,
//     onSuccess: signedIn,
//   });
// }

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (all: boolean = false) => {
      await api(all ? "/auth/logout-all" : "/auth/logout", { method: "POST" });
    },
    onSettled: () => {
      tenantStore.set(null);
      qc.clear();
      qc.setQueryData(sessionKey, null);
    },
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: async (email: string) => (await api<{ message: string }>("/auth/forgot-password", { method: "POST", body: { email } })).data,
  });
}

// The invitation behind an emailed link. The token travels in the body, never the URL path.
export function useInvitation(token: string) {
  return useQuery({
    queryKey: ["invitation", token],
    queryFn: async () => (await api<InvitationView>("/auth/invitations/inspect", { method: "POST", body: { token } })).data,
    enabled: token.length > 0,
    retry: false,
    staleTime: Infinity,
  });
}

// Choosing a password accepts the invitation and signs the person in (httpOnly cookies),
// straight into the company and workspace they were invited to.
export function useAcceptInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { token: string; fullName: string; password: string }) =>
      (await api<Session & { tenantId: string; workspaceId: string }>("/auth/invitations/accept", { method: "POST", body: input })).data,
    onSuccess: ({ user, tenants, tenantId }) => {
      qc.clear();
      tenantStore.set(tenantId);
      qc.setQueryData(sessionKey, { user, tenants });
    },
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: async (input: { token: string; password: string }) =>
      (await api<{ message: string }>("/auth/reset-password", { method: "POST", body: input })).data,
  });
}
