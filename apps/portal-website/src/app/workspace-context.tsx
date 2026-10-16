import * as React from "react";
import type { Permission, WorkspaceWithAccess } from "@/api/types";

interface WorkspaceContextValue {
  workspace: WorkspaceWithAccess;
  wid: string;
  can: (permission: Permission) => boolean;
  canAny: (...permissions: Permission[]) => boolean;
}

const WorkspaceContext = React.createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ workspace, children }: { workspace: WorkspaceWithAccess; children: React.ReactNode }) {
  const value = React.useMemo<WorkspaceContextValue>(() => {
    const granted = new Set(workspace.myAccess.permissions);
    return {
      workspace,
      wid: workspace.id,
      can: (p) => granted.has(p),
      canAny: (...ps) => ps.some((p) => granted.has(p)),
    };
  }, [workspace]);
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspaceContext(): WorkspaceContextValue {
  const ctx = React.useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspaceContext must be used inside a workspace route");
  return ctx;
}

// Shows its children only to people with the permission. The server enforces every
// permission anyway; this keeps actions people can't take out of their way.
export function Can({ permission, any, children, fallback = null }: { permission?: Permission; any?: Permission[]; children: React.ReactNode; fallback?: React.ReactNode }) {
  const { can, canAny } = useWorkspaceContext();
  const allowed = permission ? can(permission) : any ? canAny(...any) : false;
  return <>{allowed ? children : fallback}</>;
}
