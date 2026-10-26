import { User, Tenant, Workspace } from '../types';
import { platformAuthApi, clockInApi, isSignedIn, markSignedIn, markSignedOut, refreshSession } from './apiClient';
import { getSessionUser, setSessionUser, getUsers } from './mockDb';

export const ACTIVE_TENANT_STORAGE_KEY = 'active_tenant_id';
export const ACTIVE_WORKSPACE_STORAGE_KEY = 'active_workspace_id';
export const CURRENT_TENANT_STORAGE_KEY = 'checkpoint_tenant';
export const WORKSPACES_STORAGE_KEY = 'checkpoint_workspaces';

export interface LoginResponse {
  user: User;
  token: string;
  tenant: Tenant | null;
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
}

let inFlightWorkspacesPromise: Promise<Workspace[]> | null = null;
let inFlightCurrentUserPromise: Promise<User | null> | null = null;

export const authService = {
  /**
   * Get the current active company / tenant
   */
  getCurrentTenant(): Tenant | null {
    try {
      const stored = localStorage.getItem(CURRENT_TENANT_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // Fallback
    }
    return null;
  },

  /**
   * Persist current company / tenant
   */
  setCurrentTenant(tenant: Tenant): void {
    try {
      localStorage.setItem(CURRENT_TENANT_STORAGE_KEY, JSON.stringify(tenant));
      localStorage.setItem(ACTIVE_TENANT_STORAGE_KEY, tenant.id);
    } catch {
      // Storage unavailable
    }
  },

  /**
   * Retrieve all workspaces / branches for the current tenant
   */
  getWorkspaces(): Workspace[] {
    try {
      const stored = localStorage.getItem(WORKSPACES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Fallback
    }
    return [];
  },

  /**
   * Fetch live workspaces from backend for the active tenant (deduplicated)
   */
  async fetchWorkspaces(): Promise<Workspace[]> {
    if (!isSignedIn()) {
      return this.getWorkspaces();
    }

    if (inFlightWorkspacesPromise) {
      return inFlightWorkspacesPromise;
    }

    inFlightWorkspacesPromise = (async () => {
      try {
        const res = await clockInApi.get('/api/v1/workspaces');
        if (res.data?.success && Array.isArray(res.data.data)) {
          const currentTenant = this.getCurrentTenant();
          const defaultRole = (currentTenant?.role || 'MEMBER').toUpperCase();
          const fetchedList: Workspace[] = res.data.data.map((item: any, idx: number) => {
            const rawRole = (item.role || item.userRole || (defaultRole === 'OWNER' ? 'OWNER' : 'EMPLOYEE')).toUpperCase();
            return {
              id: item.id,
              tenantId: item.tenantId,
              name: item.name || item.businessName || 'Workspace',
              address: item.address || item.addressLine1 || '',
              city: item.city || '',
              state: item.state || '',
              zipCode: item.zipCode || '',
              phone: item.phone || '',
              isDefault: item.isDefault ?? idx === 0,
              employeeCount: item.employeeCount ?? 0,
              role: rawRole,
              userRole: rawRole,
              createdAt: item.createdAt,
            };
          });
          this.setWorkspaces(fetchedList);
          return fetchedList;
        }
      } catch (err) {
        console.warn('Could not fetch live workspaces from backend, using local/cached fallback:', err);
      } finally {
        inFlightWorkspacesPromise = null;
      }
      return this.getWorkspaces();
    })();

    return inFlightWorkspacesPromise;
  },

  /**
   * Persist workspaces to local storage
   */
  setWorkspaces(workspaces: Workspace[]): void {
    try {
      localStorage.setItem(WORKSPACES_STORAGE_KEY, JSON.stringify(workspaces));
    } catch {
      // Storage unavailable
    }
  },

  /**
   * Resolve currently active workspace
   */
  getActiveWorkspace(): Workspace | null {
    const list = this.getWorkspaces();
    const adminWorkspaces = list.filter((w) => {
      const r = (w.role || w.userRole || '').toUpperCase();
      return r === 'ADMIN' || r === 'OWNER';
    });
    const pool = adminWorkspaces.length > 0 ? adminWorkspaces : list;

    const activeId = localStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY);
    if (activeId) {
      const found = pool.find((w) => w.id === activeId);
      if (found) return found;
    }
    const defaultWorkspace = pool.find((w) => w.isDefault) || pool[0] || null;
    if (defaultWorkspace) {
      localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, defaultWorkspace.id);
    }
    return defaultWorkspace;
  },

  /**
   * Switch the active workspace / branch under the current tenant
   */
  switchWorkspace(workspaceId: string): Workspace {
    const list = this.getWorkspaces();
    const target = list.find((w) => w.id === workspaceId);
    if (!target) {
      throw new Error('Workspace not found.');
    }
    localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, target.id);
    return target;
  },

  /**
   * Add a new workspace / branch under the current tenant via backend API
   */
  async addWorkspace(name: string, details?: Partial<Workspace>): Promise<Workspace> {
    const currentTenant = this.getCurrentTenant();
    const payload = {
      businessName: name,
      addressLine1: details?.address || '',
      addressLine2: '',
      city: details?.city || '',
      state: (details?.state || '').toUpperCase(),
      zipCode: details?.zipCode || '',
      phone: details?.phone || '',
    };

    try {
      const res = await clockInApi.post('/api/v1/workspaces', payload);
      if (res.data?.success && res.data.data) {
        const item = res.data.data;
        const defaultRole = (currentTenant?.role || 'ADMIN').toUpperCase();
        const role = (item.role || item.userRole || defaultRole).toUpperCase();
        const newWs: Workspace = {
          id: item.id,
          tenantId: item.tenantId || currentTenant?.id || '',
          name: item.name || item.businessName,
          address: item.address || item.addressLine1 || payload.addressLine1,
          city: item.city || payload.city,
          state: item.state || payload.state,
          zipCode: item.zipCode || payload.zipCode,
          phone: item.phone || payload.phone,
          isDefault: false,
          employeeCount: item.employeeCount ?? 1,
          role,
          userRole: role,
          createdAt: item.createdAt || new Date().toISOString(),
        };

        const list = [newWs, ...this.getWorkspaces().filter((w) => w.id !== newWs.id)];
        this.setWorkspaces(list);
        this.switchWorkspace(newWs.id);
        return newWs;
      }
    } catch (err) {
      console.error('Failed to create workspace on backend:', err);
      throw err;
    }

    throw new Error('Failed to create workspace.');
  },

  /**
   * Log in via Centralized platform-api (Port 3001)
   */
  async login(email: string, password = 'Password1!', rememberDevice = false): Promise<LoginResponse> {
    try {
      const loginRes = await platformAuthApi.post('/api/v1/auth/login', {
        email,
        password,
        rememberDevice,
      });

      const { user: authUser, tenants: rawTenants } = loginRes.data.data;

      // The session is in httpOnly cookies set by platform-api; only remember that we signed in.
      markSignedIn();

      if (!rawTenants || rawTenants.length === 0) {
        throw new Error('No organization membership found for this user account.');
      }

      // Prioritize an organization where the user has administrative privileges (OWNER or ADMIN)
      const privilegedTenant = rawTenants.find((t: any) => {
        const r = (t.role || '').toUpperCase();
        return r === 'OWNER' || r === 'ADMIN';
      });

      // Business Rule: Members (Employees) are NOT allowed to log into the Web Admin Panel.
      // They must use the dedicated SmartBusiness Mobile Application.
      if (!privilegedTenant) {
        // End the server session immediately so session cookies do not linger
        await platformAuthApi.post('/api/v1/auth/logout').catch(() => { });
        markSignedOut();
        localStorage.removeItem(ACTIVE_TENANT_STORAGE_KEY);
        localStorage.removeItem(ACTIVE_WORKSPACE_STORAGE_KEY);
        localStorage.removeItem(CURRENT_TENANT_STORAGE_KEY);
        localStorage.removeItem(WORKSPACES_STORAGE_KEY);
        throw new Error(
          'Access Restricted: The Clock-In Web Console is exclusively for Administrators and Managers. Employees must use the SmartBusiness Mobile App to clock in and out.'
        );
      }

      const activeRawTenant = privilegedTenant;
      const tenantRole = (activeRawTenant.role || 'ADMIN').toUpperCase();

      const tenant: Tenant = {
        id: activeRawTenant.tenantId || activeRawTenant.id,
        name: activeRawTenant.tenantName || activeRawTenant.name || 'Organization',
        role: tenantRole as any,
        status: (activeRawTenant.status || 'ACTIVE').toUpperCase() as any,
      };

      this.setCurrentTenant(tenant);

      // Workspaces belonging to this tenant
      let workspaces: Workspace[] = [];
      try {
        workspaces = await this.fetchWorkspaces();
      } catch (wsErr) {
        console.warn('Could not fetch live workspaces during login:', wsErr);
        workspaces = this.getWorkspaces().filter((w) => w.tenantId === tenant.id);
      }

      this.setWorkspaces(workspaces);
      const currentWorkspace = this.getActiveWorkspace();

      // Fetch employee badge profile if available
      let employeeProfile: any = null;
      try {
        const empRes = await clockInApi.get('/api/v1/employees/me');
        employeeProfile = empRes.data.data;
      } catch (empErr) {
        // Silently use account credentials
      }

      const user: User = {
        id: authUser.id,
        employeeId: employeeProfile?.employeeCode || '',
        name: authUser.fullName,
        email: authUser.email,
        phone: employeeProfile?.phone || authUser.phone || '',
        role: 'admin',
        status: 'active',
        designation: employeeProfile?.designation || 'Administrator',
        department: employeeProfile?.department || 'Management',
        joinedDate: authUser.createdAt ? authUser.createdAt.split('T')[0] : new Date().toISOString().split('T')[0],
        avatarUrl: employeeProfile?.biometricPhotoUrl || authUser.avatarUrl || '',
      };

      setSessionUser(user);

      return {
        user,
        token: 'session-cookie-active',
        tenant,
        workspaces,
        currentWorkspace,
      };
    } catch (error: any) {
      const errorObj = error.response?.data?.error;
      const errorMsg =
        (typeof errorObj === 'object' ? errorObj?.message : errorObj) ||
        error.response?.data?.message ||
        error.message ||
        'Invalid credentials. Please verify your email and password.';
      throw new Error(errorMsg);
    }
  },

  /**
   * Register a new company workspace
   */
  async register(
    companyName: string,
    fullName: string,
    email: string,
    defaultPolicy?: string
  ): Promise<LoginResponse> {
    try {
      const res = await platformAuthApi.post('/api/v1/auth/register', {
        companyName,
        fullName,
        email,
        password: 'Password1!',
      });

      const { user: authUser, tenants: rawTenants } = res.data.data;
      markSignedIn();

      const privilegedTenant = (rawTenants || []).find((t: any) => {
        const r = (t.role || '').toUpperCase();
        return r === 'OWNER' || r === 'ADMIN';
      }) || (rawTenants && rawTenants[0]);

      const tenantId = privilegedTenant?.tenantId || privilegedTenant?.id || '';
      const tenant: Tenant = {
        id: tenantId,
        name: privilegedTenant?.tenantName || privilegedTenant?.name || companyName,
        role: (privilegedTenant?.role || 'OWNER').toUpperCase() as any,
        status: (privilegedTenant?.status || 'ACTIVE').toUpperCase() as any,
        billingEmail: email,
      };

      this.setCurrentTenant(tenant);
      if (tenant.id) {
        localStorage.setItem(ACTIVE_TENANT_STORAGE_KEY, tenant.id);
      }

      let workspaces: Workspace[] = [];
      try {
        workspaces = await this.fetchWorkspaces();
      } catch (wsErr) {
        console.warn('Could not fetch live workspaces during register:', wsErr);
      }

      const currentWorkspace = workspaces.find((w) => w.isDefault) || workspaces[0] || null;
      this.setWorkspaces(workspaces);
      if (currentWorkspace) {
        localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, currentWorkspace.id);
      } else {
        localStorage.removeItem(ACTIVE_WORKSPACE_STORAGE_KEY);
      }

      const user: User = {
        id: authUser.id,
        employeeId: '',
        name: authUser.fullName || fullName,
        email: authUser.email || email,
        phone: authUser.phone || '',
        role: 'admin',
        status: 'active',
        designation: 'Workspace Administrator',
        department: 'Management',
        joinedDate: authUser.createdAt ? authUser.createdAt.split('T')[0] : new Date().toISOString().split('T')[0],
        avatarUrl: authUser.avatarUrl || '',
      };

      setSessionUser(user);

      return {
        user,
        token: 'session-cookie-active',
        tenant,
        workspaces,
        currentWorkspace,
      };
    } catch (error: any) {
      const errorObj = error.response?.data?.error;
      const errorMsg =
        (typeof errorObj === 'object' ? errorObj?.message : errorObj) ||
        error.response?.data?.message ||
        error.message ||
        'Registration failed. Please check your information and try again.';
      throw new Error(errorMsg);
    }
  },

  /**
   * Request password reset link (dispatched via platform-api)
   */
  async forgotPassword(email: string): Promise<string> {
    try {
      const res = await platformAuthApi.post('/api/v1/auth/forgot-password', {
        email,
        redirectUrl: window.location.origin,
      });
      return res.data?.data?.message || res.data?.message || 'If an account exists, instructions have been sent.';
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        err.message ||
        'Failed to request password reset.';
      throw new Error(errorMsg);
    }
  },

  /**
   * Complete password reset using secure token (via platform-api)
   */
  async resetPassword(token: string, password: string): Promise<string> {
    try {
      const res = await platformAuthApi.post('/api/v1/auth/reset-password', { token, password });
      return res.data?.data?.message || res.data?.message || 'Your password has been changed successfully.';
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        err.message ||
        'Failed to reset password. The link may have expired or is invalid.';
      throw new Error(errorMsg);
    }
  },

  /**
   * Log out and clear session
   */
  async logout(): Promise<void> {
    try {
      await platformAuthApi.post('/api/v1/auth/logout').catch(() => { });
    } catch (err) {
      console.warn('Logout API error:', err);
    } finally {
      markSignedOut();
      localStorage.removeItem(ACTIVE_TENANT_STORAGE_KEY);
      localStorage.removeItem(ACTIVE_WORKSPACE_STORAGE_KEY);
      localStorage.removeItem(CURRENT_TENANT_STORAGE_KEY);
      localStorage.removeItem(WORKSPACES_STORAGE_KEY);
      setSessionUser(null);
    }
  },

  /**
   * Get current session user (deduplicated)
   */
  async getCurrentUser(): Promise<User | null> {
    if (!isSignedIn()) {
      return null;
    }

    if (inFlightCurrentUserPromise) {
      return inFlightCurrentUserPromise;
    }

    inFlightCurrentUserPromise = (async () => {
      try {
        let meRes;
        try {
          meRes = await platformAuthApi.get('/api/v1/auth/me');
        } catch (meErr: any) {
          // The 15-minute access cookie may have expired: renew it once, then ask again.
          if (meErr?.response?.status !== 401 || !(await refreshSession())) throw meErr;
          meRes = await platformAuthApi.get('/api/v1/auth/me');
        }
        const authUser = meRes.data.data?.user;
        const rawTenants = meRes.data.data?.tenants;

        if (authUser) {
          const privilegedTenant = (rawTenants || []).find((t: any) => {
            const r = (t.role || '').toUpperCase();
            return r === 'OWNER' || r === 'ADMIN';
          });

          // Business Rule: Members (Employees) are NOT allowed to log into the Web Admin Panel.
          // They must use the dedicated SmartBusiness Mobile Application.
          if (!privilegedTenant) {
            markSignedOut();
            localStorage.removeItem(ACTIVE_TENANT_STORAGE_KEY);
            localStorage.removeItem(ACTIVE_WORKSPACE_STORAGE_KEY);
            localStorage.removeItem(CURRENT_TENANT_STORAGE_KEY);
            localStorage.removeItem(WORKSPACES_STORAGE_KEY);
            setSessionUser(null);
            return null;
          }

          const tenantRole = (privilegedTenant.role || 'ADMIN').toUpperCase();
          const tenant: Tenant = {
            id: privilegedTenant.tenantId || privilegedTenant.id,
            name: privilegedTenant.tenantName || privilegedTenant.name || 'Organization',
            role: tenantRole as any,
            status: (privilegedTenant.status || 'ACTIVE').toUpperCase() as any,
          };
          this.setCurrentTenant(tenant);
          localStorage.setItem(ACTIVE_TENANT_STORAGE_KEY, tenant.id);

          let workspaces: Workspace[] = [];
          try {
            workspaces = await this.fetchWorkspaces();
          } catch (wsErr) {
            console.warn('Could not fetch live workspaces during getCurrentUser:', wsErr);
            workspaces = this.getWorkspaces().filter((w) => w.tenantId === tenant.id);
          }
          this.setWorkspaces(workspaces);

          const currentWorkspace = this.getActiveWorkspace();

          let employeeProfile: any = null;
          try {
            const empRes = await clockInApi.get('/api/v1/employees/me');
            employeeProfile = empRes.data.data;
          } catch (empErr) {
            // Silently use account credentials
          }

          const existingUser = getSessionUser();
          const user: User = {
            id: authUser.id,
            employeeId: employeeProfile?.employeeCode || existingUser?.employeeId || '',
            name: authUser.fullName || existingUser?.name || 'Administrator',
            email: authUser.email,
            phone: employeeProfile?.phone || (existingUser && existingUser.id === authUser.id && existingUser.phone) || authUser.phone || '',
            role: 'admin',
            status: 'active',
            designation: employeeProfile?.designation || existingUser?.designation || 'Administrator',
            department: employeeProfile?.department || existingUser?.department || 'Management',
            joinedDate: authUser.createdAt ? authUser.createdAt.split('T')[0] : existingUser?.joinedDate || new Date().toISOString().split('T')[0],
            avatarUrl: employeeProfile?.biometricPhotoUrl || existingUser?.avatarUrl || authUser.avatarUrl || '',
          };

          setSessionUser(user);
          return user;
        }
      } catch (err: any) {
        // The server says the session is over (signed out elsewhere, deactivated, expired):
        // never keep showing a cached user as signed in.
        if (err?.response?.status === 401) {
          markSignedOut();
          localStorage.removeItem(ACTIVE_TENANT_STORAGE_KEY);
          localStorage.removeItem(ACTIVE_WORKSPACE_STORAGE_KEY);
          localStorage.removeItem(CURRENT_TENANT_STORAGE_KEY);
          localStorage.removeItem(WORKSPACES_STORAGE_KEY);
          setSessionUser(null);
          return null;
        }
        console.warn('Session verification failed on backend:', err);
      } finally {
        inFlightCurrentUserPromise = null;
      }

      return getSessionUser();
    })();

    return inFlightCurrentUserPromise;
  },
};

export default authService;
