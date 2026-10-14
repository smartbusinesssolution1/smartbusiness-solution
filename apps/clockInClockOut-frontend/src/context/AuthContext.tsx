import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, Tenant, Workspace } from '../types';
import { authService } from '../services/authService';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  currentTenant: Tenant | null;
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  switchWorkspace: (workspaceId: string) => Promise<Workspace>;
  addWorkspace: (name: string, details?: Partial<Workspace>) => Promise<Workspace>;
  refreshWorkspaces: () => Promise<void>;
  login: (email: string, password?: string) => Promise<User>;
  register: (companyName: string, fullName: string, email: string, defaultPolicy?: string) => Promise<User>;
  logout: () => Promise<void>;
  updateCurrentUserState: (updatedUser: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(() => authService.getCurrentTenant());
  const [workspaces, setWorkspaces] = useState<Workspace[]>(() => authService.getWorkspaces());
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(() => authService.getActiveWorkspace());

  const refreshWorkspaces = useCallback(async () => {
    const tenant = authService.getCurrentTenant();
    setCurrentTenant(tenant);
    const list = await authService.fetchWorkspaces();
    const active = authService.getActiveWorkspace();
    setWorkspaces(list);
    setCurrentWorkspace(active);
  }, []);

  useEffect(() => {
    async function restoreSession() {
      try {
        const currentUser = await authService.getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
          setToken(`mock-jwt-token-for-${currentUser.id}`);
        }
        await refreshWorkspaces();
      } catch (err) {
        console.error('Failed to restore authentication session:', err);
      } finally {
        setIsLoading(false);
      }
    }
    restoreSession();
  }, [refreshWorkspaces]);


  const switchWorkspace = async (workspaceId: string): Promise<Workspace> => {
    try {
      const switched = authService.switchWorkspace(workspaceId);
      setCurrentWorkspace(switched);
      setWorkspaces(authService.getWorkspaces());
      // Broadcast event so any listeners (metrics/reports) can refresh
      window.dispatchEvent(new CustomEvent('workspace-switched', { detail: switched }));
      return switched;
    } catch (err) {
      console.error('Failed to switch workspace:', err);
      throw err;
    }
  };

  const addWorkspace = async (name: string, details?: Partial<Workspace>): Promise<Workspace> => {
    try {
      const newWs = authService.addWorkspace(name, details);
      setCurrentWorkspace(newWs);
      setWorkspaces(authService.getWorkspaces());
      return newWs;
    } catch (err) {
      console.error('Failed to add workspace:', err);
      throw err;
    }
  };

  const login = async (email: string, password?: string): Promise<User> => {
    setIsLoading(true);
    try {
      const response = await authService.login(email, password);
      setUser(response.user);
      setToken(response.token);
      setCurrentTenant(response.tenant);
      const liveWorkspaces = await authService.fetchWorkspaces();
      setWorkspaces(liveWorkspaces.length > 0 ? liveWorkspaces : response.workspaces);
      setCurrentWorkspace(authService.getActiveWorkspace());
      return response.user;
    } catch (err) {
      throw err;
    } finally {
      setIsLoading(false);
    }
  };


  const register = async (
    companyName: string,
    fullName: string,
    email: string,
    defaultPolicy?: string
  ): Promise<User> => {
    setIsLoading(true);
    try {
      const response = await authService.register(companyName, fullName, email, defaultPolicy);
      setUser(response.user);
      setToken(response.token);
      setCurrentTenant(response.tenant);
      setWorkspaces(response.workspaces);
      setCurrentWorkspace(response.currentWorkspace);
      return response.user;
    } catch (err) {
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await authService.logout();
      setUser(null);
      setToken(null);
      refreshWorkspaces();
    } catch (err) {
      console.error('Failed to log out:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const updateCurrentUserState = (updatedUser: User) => {
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        currentTenant,
        workspaces,
        currentWorkspace,
        switchWorkspace,
        addWorkspace,
        refreshWorkspaces,
        login,
        register,
        logout,
        updateCurrentUserState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
