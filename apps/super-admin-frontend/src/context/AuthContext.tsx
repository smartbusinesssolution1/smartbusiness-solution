import React, { createContext, useContext, useState } from 'react';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'SUPER_ADMIN';
}

export interface AuthContextType {
  isAuthenticated: boolean;
  user: AdminUser | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'sb_super_admin_session';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const saved = localStorage.getItem(AUTH_STORAGE_KEY);
    return saved !== null ? saved === 'true' : true; // Default logged in for seamless demo
  });

  const [user, setUser] = useState<AdminUser | null>(() => {
    return {
      id: 'usr_root_001',
      name: 'Super Administrator',
      email: 'root@smartbusiness.us',
      role: 'SUPER_ADMIN',
    };
  });

  const login = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    // Artificial latency for smooth feedback
    await new Promise((res) => setTimeout(res, 400));

    if (!email || !password) {
      return { success: false, error: 'Please enter both your administrator email and password.' };
    }

    if (!email.includes('@')) {
      return { success: false, error: 'Please enter a valid administrative email address.' };
    }

    setIsAuthenticated(true);
    localStorage.setItem(AUTH_STORAGE_KEY, 'true');
    setUser({
      id: 'usr_root_001',
      name: email.startsWith('root') ? 'Super Administrator' : 'Administrator',
      email: email.trim(),
      role: 'SUPER_ADMIN',
    });

    return { success: true };
  };

  const logout = () => {
    setIsAuthenticated(false);
    localStorage.setItem(AUTH_STORAGE_KEY, 'false');
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
