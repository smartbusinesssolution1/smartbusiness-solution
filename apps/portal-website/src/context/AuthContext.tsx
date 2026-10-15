import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { apiFetch } from "../lib/api";

export interface User {
  id: string;
  fullName: string;
  email: string;
}

export interface TenantInfo {
  tenantId: string;
  tenantName: string;
  role: string;
  status: string;
}

export interface AuthContextType {
  user: User | null;
  tenants: TenantInfo[];
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [tenants, setTenants] = useState<TenantInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const isPrivilegedTenant = (tenantsList?: TenantInfo[]) => {
    if (!tenantsList || tenantsList.length === 0) return false;
    return tenantsList.some(
      (t) => t.role?.toUpperCase() === "OWNER" || t.role?.toUpperCase() === "ADMIN"
    );
  };

  const fetchCurrentUser = useCallback(async () => {
    try {
      const data = await apiFetch<{ user: User; tenants: TenantInfo[] }>("/api/v1/auth/me");
      if (data?.user && isPrivilegedTenant(data.tenants)) {
        setUser(data.user);
        setTenants(data.tenants || []);
      } else {
        setUser(null);
        setTenants([]);
      }
    } catch {
      setUser(null);
      setTenants([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  const login = async (email: string, password: string) => {
    const data = await apiFetch<{ user: User; tenants: TenantInfo[] }>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    if (data?.user) {
      const isPrivileged = isPrivilegedTenant(data.tenants);
      if (!isPrivileged) {
        await apiFetch("/api/v1/auth/logout", { method: "POST" }).catch(() => {});
        setUser(null);
        setTenants([]);
        throw new Error(
          "Access Restricted: The Web Portal is exclusively for Administrators and Managers. Members must use the SmartBusiness Mobile App."
        );
      }

      setUser(data.user);
      setTenants(data.tenants || []);
    }
  };

  const logout = async () => {
    try {
      await apiFetch("/api/v1/auth/logout", {
        method: "POST",
      });
    } finally {
      setUser(null);
      setTenants([]);
    }
  };

  return (
    <AuthContext.Provider value={{ user, tenants, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
