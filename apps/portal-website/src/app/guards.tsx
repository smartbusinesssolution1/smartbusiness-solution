import * as React from "react";
import { Navigate, Outlet, useLocation, useNavigate, useParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion } from "motion/react";
import { chooseTenant, sessionKey, useSession } from "@/api/auth";
import { useWorkspace } from "@/api/workspace";
import { ApiError, onSessionEnded } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/app/layout";
import { BrandMark } from "@/components/app/brand";
import { WorkspaceProvider } from "./workspace-context";
import { AppShell } from "./shell";

export function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }} className="flex flex-col items-center gap-4">
        <BrandMark className="size-10" />
        <div className="h-1 w-24 overflow-hidden rounded-full bg-line">
          <motion.div className="h-full w-1/3 rounded-full bg-ink" animate={{ x: ["-100%", "300%"] }} transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }} />
        </div>
      </motion.div>
    </div>
  );
}

// Ends the session in the app when the API says it is over (refresh failed).
function useSessionEndedHandler() {
  const qc = useQueryClient();
  React.useEffect(
    () =>
      onSessionEnded(() => {
        if (qc.getQueryData(sessionKey)) {
          toast("You were signed out", { description: "Your session ended. Sign in again to continue." });
        }
        qc.setQueryData(sessionKey, null);
      }),
    [qc],
  );
}

export function RequireAuth() {
  useSessionEndedHandler();
  const { data: session, isPending, error, refetch } = useSession();
  const location = useLocation();

  if (isPending) return <Splash />;
  if (error) return <div className="mx-auto max-w-md p-8"><ErrorState error={error} onRetry={() => refetch()} /></div>;
  if (!session) {
    const next = location.pathname + location.search;
    return <Navigate to={next === "/" ? "/sign-in" : `/sign-in?next=${encodeURIComponent(next)}`} replace />;
  }
  chooseTenant(session);
  if (session.tenants.length === 0) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="font-semibold">Your account isn't part of an active company</p>
        <p className="text-sm text-muted">Ask your administrator to add you again, or contact support.</p>
      </div>
    );
  }
  return <Outlet />;
}

export function RedirectIfSignedIn() {
  const { data: session, isPending } = useSession();
  if (isPending) return <Splash />;
  if (session) return <Navigate to="/workspaces" replace />;
  return <Outlet />;
}

export function WorkspaceLayout() {
  const { wid } = useParams();
  const { data, isPending, error, refetch } = useWorkspace(wid);
  const navigate = useNavigate();

  React.useEffect(() => {
    if (wid) {
      try {
        localStorage.setItem("sb.lastWorkspace", wid);
      } catch {
        // Not remembering the last workspace is fine.
      }
    }
  }, [wid]);

  if (isPending) return <Splash />;
  if (error) {
    const status = error instanceof ApiError ? error.status : 0;
    if (status === 404 || status === 403) {
      return (
        <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="text-lg font-semibold">{status === 404 ? "This workspace doesn't exist or you're not a member" : "You don't have access to Check Printing here"}</p>
          <p className="text-sm text-muted">{error.message}</p>
          <Button variant="secondary" onClick={() => navigate("/workspaces")}>Choose another workspace</Button>
        </div>
      );
    }
    return <div className="mx-auto max-w-md p-8"><ErrorState error={error} onRetry={() => refetch()} /></div>;
  }

  return (
    <WorkspaceProvider workspace={data}>
      <AppShell>
        <Outlet />
      </AppShell>
    </WorkspaceProvider>
  );
}
