import React, { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore, AuthState } from '../store/authStore';
export { useAuthStore } from '../store/authStore';
export type { AuthState };

// Re-export User, Tenant, Workspace types for convenience
export type { User, Tenant, Workspace } from '../types';

export interface AuthContextType {
  user: AuthState['user'];
  token: AuthState['token'];
  isLoading: AuthState['isLoading'];
  currentTenant: AuthState['currentTenant'];
  workspaces: AuthState['workspaces'];
  currentWorkspace: AuthState['currentWorkspace'];
  isSuperAdmin: AuthState['isSuperAdmin'];
  switchWorkspace: AuthState['switchWorkspace'];
  addWorkspace: AuthState['addWorkspace'];
  refreshWorkspaces: AuthState['refreshWorkspaces'];
  login: AuthState['login'];
  register: AuthState['register'];
  logout: () => Promise<void>;
  updateCurrentUserState: AuthState['updateCurrentUserState'];
  updateOrganizationAndWorkspace: AuthState['updateOrganizationAndWorkspace'];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Lightweight AuthProvider wrapper.
 * Initializes and restores the authenticated session once on mount,
 * and maintains backward-compatibility with existing component trees.
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const hasRestoredRef = useRef(false);

  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;
    useAuthStore.getState().restoreSession();
  }, []);

  return <>{children}</>;
};

/**
 * 100% backward-compatible `useAuth` hook backed by Zustand store.
 * Existing components receive identical state and signatures.
 * For optimal render isolation in high-frequency components,
 * use `useAuthStore(selector)` directly.
 */
export const useAuth = (): AuthContextType => {
  const store = useAuthStore();
  const queryClient = useQueryClient();

  return useMemo(
    () => ({
      user: store.user,
      token: store.token,
      isLoading: store.isLoading,
      currentTenant: store.currentTenant,
      workspaces: store.workspaces,
      currentWorkspace: store.currentWorkspace,
      isSuperAdmin: store.isSuperAdmin,
      switchWorkspace: store.switchWorkspace,
      addWorkspace: store.addWorkspace,
      refreshWorkspaces: store.refreshWorkspaces,
      login: store.login,
      register: store.register,
      logout: () => store.logout(queryClient),
      updateCurrentUserState: store.updateCurrentUserState,
      updateOrganizationAndWorkspace: store.updateOrganizationAndWorkspace,
    }),
    [store, queryClient]
  );
};

export default AuthContext;
