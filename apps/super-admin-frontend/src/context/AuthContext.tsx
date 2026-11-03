import React, { createContext, useContext, useState } from 'react';

export type SuperAdminRole = 'SUPER_ADMIN' | 'DEV_SUPER_ADMIN';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: SuperAdminRole;
}

export interface AuthContextType {
  isAuthenticated: boolean;
  user: AdminUser | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'sb_super_admin_session';
const TOKEN_STORAGE_KEY = 'sb_super_admin_token';
const USER_STORAGE_KEY = 'sb_super_admin_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const saved = localStorage.getItem(AUTH_STORAGE_KEY);
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    return saved === 'true' && Boolean(token);
  });

  const [user, setUser] = useState<AdminUser | null>(() => {
    try {
      const savedUser = localStorage.getItem(USER_STORAGE_KEY);
      if (savedUser) {
        return JSON.parse(savedUser) as AdminUser;
      }
    } catch {
      // JSON parse error
    }
    return null;
  });

  const login = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!email || !password) {
      return { success: false, error: 'Please enter both your administrator email and password.' };
    }

    const cleanEmail = email.trim().toLowerCase();

    try {
      const res = await fetch('/api/v1/super-admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: cleanEmail, password }),
      });

      const data = await res.json().catch(() => null);

      // Strictly require data.success === true and res.ok
      if (res.ok && data?.success === true && data?.data) {
        const adminUser: AdminUser = {
          id: data.data.user.id,
          name: data.data.user.name,
          email: data.data.user.email,
          role: data.data.user.role as SuperAdminRole,
        };

        if (data.data.token) {
          localStorage.setItem(TOKEN_STORAGE_KEY, data.data.token);
        }
        localStorage.setItem(AUTH_STORAGE_KEY, 'true');
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(adminUser));

        setIsAuthenticated(true);
        setUser(adminUser);
        return { success: true };
      }

      // If backend responded with success: false or HTTP error
      const extractedError =
        (typeof data?.error === 'string' && data.error) ||
        (data?.error?.message && String(data.error.message)) ||
        (data?.message && String(data.message)) ||
        `Login failed (${res.status} ${res.statusText})`;

      // Ensure state stays unauthenticated
      setIsAuthenticated(false);
      setUser(null);
      localStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(USER_STORAGE_KEY);

      return {
        success: false,
        error: extractedError,
      };
    } catch (err: unknown) {
      const networkError =
        err instanceof Error ? err.message : 'Unable to connect to authentication server.';

      setIsAuthenticated(false);
      setUser(null);
      localStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(USER_STORAGE_KEY);

      return {
        success: false,
        error: networkError,
      };
    }
  };

  const logout = () => {
    fetch('/api/v1/super-admin/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    setIsAuthenticated(false);
    setUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
