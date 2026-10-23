import { create } from 'zustand';
import { User, Tenant, Workspace } from '../types';
import { authService } from '../services/authService';
import { isSignedIn, setAuthGetters } from '../services/apiClient';
import { getSessionUser } from '../services/mockDb';
import type { QueryClient } from '@tanstack/react-query';

export interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  currentTenant: Tenant | null;
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  isSuperAdmin: boolean;

  // Actions
  switchWorkspace: (workspaceId: string) => Promise<Workspace>;
  addWorkspace: (name: string, details?: Partial<Workspace>) => Promise<Workspace>;
  refreshWorkspaces: () => Promise<void>;
  login: (email: string, password?: string) => Promise<User>;
  register: (companyName: string, fullName: string, email: string, defaultPolicy?: string) => Promise<User>;
  logout: (queryClient?: QueryClient) => Promise<void>;
  updateCurrentUserState: (updatedUser: User) => void;
  restoreSession: () => Promise<void>;
}

const computeIsSuperAdmin = (tenant: Tenant | null, user: User | null): boolean => {
  return Boolean(
    tenant?.role === 'OWNER' ||
    user?.role === 'super_admin' ||
    user?.isSuperAdmin === true
  );
};

const getInitialState = () => {
  const cachedUser = isSignedIn() ? getSessionUser() : null;
  const currentTenant = authService.getCurrentTenant();
  const workspaces = authService.getWorkspaces();
  const currentWorkspace = authService.getActiveWorkspace();

  return {
    user: cachedUser,
    token: cachedUser ? 'session-cookie-active' : null,
    isLoading: !cachedUser && isSignedIn(),
    currentTenant,
    workspaces,
    currentWorkspace,
    isSuperAdmin: computeIsSuperAdmin(currentTenant, cachedUser),
  };
};

export const useAuthStore = create<AuthState>((set, get) => ({
  ...getInitialState(),

  switchWorkspace: async (workspaceId: string): Promise<Workspace> => {
    try {
      const switched = authService.switchWorkspace(workspaceId);
      set({
        currentWorkspace: switched,
        workspaces: authService.getWorkspaces(),
      });
      // Broadcast event so any listeners (metrics/reports) can refresh
      window.dispatchEvent(new CustomEvent('workspace-switched', { detail: switched }));
      return switched;
    } catch (err) {
      console.error('Failed to switch workspace:', err);
      throw err;
    }
  },

  addWorkspace: async (name: string, details?: Partial<Workspace>): Promise<Workspace> => {
    try {
      const newWs = await authService.addWorkspace(name, details);
      set({ currentWorkspace: newWs });
      await get().refreshWorkspaces();
      return newWs;
    } catch (err) {
      console.error('Failed to add workspace:', err);
      throw err;
    }
  },

  refreshWorkspaces: async (): Promise<void> => {
    const list = await authService.fetchWorkspaces();
    const active = authService.getActiveWorkspace();
    const tenant = authService.getCurrentTenant();
    set({
      currentTenant: tenant,
      workspaces: list,
      currentWorkspace: active,
      isSuperAdmin: computeIsSuperAdmin(tenant, get().user),
    });
  },

  login: async (email: string, password?: string): Promise<User> => {
    set({ isLoading: true });
    try {
      const response = await authService.login(email, password);
      const liveWorkspaces = await authService.fetchWorkspaces();
      const currentWorkspace = authService.getActiveWorkspace();
      const tenant = response.tenant;
      const user = response.user;

      set({
        user,
        token: response.token,
        currentTenant: tenant,
        workspaces: liveWorkspaces.length > 0 ? liveWorkspaces : response.workspaces,
        currentWorkspace,
        isSuperAdmin: computeIsSuperAdmin(tenant, user),
        isLoading: false,
      });

      return user;
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  register: async (
    companyName: string,
    fullName: string,
    email: string,
    defaultPolicy?: string
  ): Promise<User> => {
    set({ isLoading: true });
    try {
      const response = await authService.register(companyName, fullName, email, defaultPolicy);
      const tenant = response.tenant;
      const user = response.user;

      set({
        user,
        token: response.token,
        currentTenant: tenant,
        workspaces: response.workspaces,
        currentWorkspace: response.currentWorkspace,
        isSuperAdmin: computeIsSuperAdmin(tenant, user),
        isLoading: false,
      });

      return user;
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  logout: async (queryClient?: QueryClient): Promise<void> => {
    set({ isLoading: true });
    try {
      if (queryClient) {
        queryClient.cancelQueries();
        queryClient.clear();
      }
      await authService.logout();
      set({
        user: null,
        token: null,
        currentTenant: null,
        currentWorkspace: null,
        isSuperAdmin: false,
        isLoading: false,
      });
    } catch (err) {
      console.error('Failed to log out:', err);
      set({ isLoading: false });
    }
  },

  updateCurrentUserState: (updatedUser: User): void => {
    const tenant = get().currentTenant;
    set({
      user: updatedUser,
      isSuperAdmin: computeIsSuperAdmin(tenant, updatedUser),
    });
  },

  restoreSession: async (): Promise<void> => {
    if (!isSignedIn()) {
      set({ isLoading: false });
      return;
    }

    try {
      const [currentUser, liveWorkspaces] = await Promise.all([
        authService.getCurrentUser(),
        authService.fetchWorkspaces(),
      ]);

      if (currentUser) {
        const tenant = authService.getCurrentTenant();
        const active = authService.getActiveWorkspace();
        set({
          user: currentUser,
          token: 'session-cookie-active',
          currentTenant: tenant,
          workspaces: liveWorkspaces,
          currentWorkspace: active,
          isSuperAdmin: computeIsSuperAdmin(tenant, currentUser),
          isLoading: false,
        });
      } else {
        set({ user: null, token: null, isLoading: false });
      }
    } catch (err) {
      console.error('Failed to restore authentication session:', err);
      set({ isLoading: false });
    }
  },
}));

// Register in-memory getters for fast, non-blocking axios request interceptors
setAuthGetters(
  () => useAuthStore.getState().currentTenant?.id || null,
  () => useAuthStore.getState().currentWorkspace?.id || null
);

// 100% backward-compatible hook for existing components
export const useAuth = () => useAuthStore();
export default useAuthStore;
