import { User, Tenant, Workspace } from '../types';
import { platformAuthApi, clockInApi } from './apiClient';
import { getSessionUser, setSessionUser, getUsers } from './mockDb';

export const ACTIVE_TENANT_STORAGE_KEY = 'active_tenant_id';
export const ACTIVE_WORKSPACE_STORAGE_KEY = 'active_workspace_id';
export const CURRENT_TENANT_STORAGE_KEY = 'checkpoint_tenant';
export const WORKSPACES_STORAGE_KEY = 'checkpoint_workspaces';

export const DEFAULT_TENANT: Tenant = {
  id: '10000000-0000-0000-0000-000000000001',
  name: 'Green Acres Landscaping LLC',
  role: 'OWNER',
  status: 'ACTIVE',
  billingEmail: 'billing@greenacres.com',
};

export const DEFAULT_WORKSPACES: Workspace[] = [
  {
    id: '30000000-0000-0000-0000-000000000001',
    tenantId: '10000000-0000-0000-0000-000000000001',
    name: 'Main Headquarters (HQ)',
    address: '124 Industrial Pkwy',
    city: 'Austin',
    state: 'TX',
    zipCode: '78745',
    phone: '(512) 555-0100',
    isDefault: true,
    employeeCount: 24,
  },
  {
    id: '30000000-0000-0000-0000-000000000002',
    tenantId: '10000000-0000-0000-0000-000000000001',
    name: 'North Branch & Operations',
    address: '450 Research Blvd, Ste 200',
    city: 'Round Rock',
    state: 'TX',
    zipCode: '78664',
    phone: '(512) 555-0210',
    isDefault: false,
    employeeCount: 14,
  },
  {
    id: '30000000-0000-0000-0000-000000000003',
    tenantId: '10000000-0000-0000-0000-000000000001',
    name: 'South Logistics & Warehouse',
    address: '920 Congress Ave, Bay 4',
    city: 'San Marcos',
    state: 'TX',
    zipCode: '78666',
    phone: '(512) 555-0340',
    isDefault: false,
    employeeCount: 8,
  },
];

export interface LoginResponse {
  user: User;
  token: string;
  tenant: Tenant;
  workspaces: Workspace[];
  currentWorkspace: Workspace;
}

let inFlightWorkspacesPromise: Promise<Workspace[]> | null = null;

export const authService = {
  /**
   * Get the current active company / tenant
   */
  getCurrentTenant(): Tenant {
    try {
      const stored = localStorage.getItem(CURRENT_TENANT_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // Fallback
    }
    return DEFAULT_TENANT;
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
    return DEFAULT_WORKSPACES;
  },

  /**
   * Fetch live workspaces from backend for the active tenant (deduplicated)
   */
  async fetchWorkspaces(): Promise<Workspace[]> {
    if (inFlightWorkspacesPromise) {
      return inFlightWorkspacesPromise;
    }

    inFlightWorkspacesPromise = (async () => {
      try {
        const res = await clockInApi.get('/api/v1/workspaces');
        if (res.data?.success && Array.isArray(res.data.data) && res.data.data.length > 0) {
          const fetchedList: Workspace[] = res.data.data.map((item: any, idx: number) => ({
            id: item.id,
            tenantId: item.tenantId,
            name: item.name || item.businessName,
            address: item.address || item.addressLine1 || '',
            city: item.city || '',
            state: item.state || '',
            zipCode: item.zipCode || '',
            phone: item.phone || '',
            isDefault: item.isDefault ?? idx === 0,
            employeeCount: item.employeeCount ?? 0,
            createdAt: item.createdAt,
          }));
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
  getActiveWorkspace(): Workspace {
    const list = this.getWorkspaces();
    const activeId = localStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY);
    if (activeId) {
      const found = list.find((w) => w.id === activeId);
      if (found) return found;
    }
    const defaultWorkspace = list.find((w) => w.isDefault) || list[0] || DEFAULT_WORKSPACES[0];
    localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, defaultWorkspace.id);
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
      addressLine1: details?.address || '100 Business Pkwy',
      addressLine2: '',
      city: details?.city || 'Austin',
      state: (details?.state || 'TX').toUpperCase(),
      zipCode: details?.zipCode || '78701',
      phone: details?.phone || '',
    };

    try {
      const res = await clockInApi.post('/api/v1/workspaces', payload);
      if (res.data?.success && res.data.data) {
        const item = res.data.data;
        const newWs: Workspace = {
          id: item.id,
          tenantId: item.tenantId || currentTenant.id,
          name: item.name || item.businessName,
          address: item.address || item.addressLine1 || payload.addressLine1,
          city: item.city || payload.city,
          state: item.state || payload.state,
          zipCode: item.zipCode || payload.zipCode,
          phone: item.phone || payload.phone,
          isDefault: false,
          employeeCount: item.employeeCount ?? 1,
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
  async login(email: string, password = 'Password1!'): Promise<LoginResponse> {
    try {
      let loginRes;
      try {
        loginRes = await clockInApi.post('/api/v1/auth/login', { email, password });
      } catch {
        loginRes = await platformAuthApi.post('/api/v1/auth/login', { email, password });
      }

      const { user: authUser, tenants: rawTenants, tokens } = loginRes.data.data;

      if (tokens?.accessToken) {
        localStorage.setItem('access_token', tokens.accessToken);
      }

      const activeRawTenant = rawTenants?.[0];
      if (!activeRawTenant) {
        throw new Error('No organization membership found for this user account.');
      }

      const tenantRole = (activeRawTenant.role || 'MEMBER').toUpperCase();
      const isPrivileged = tenantRole === 'OWNER' || tenantRole === 'ADMIN';

      if (!isPrivileged) {
        localStorage.removeItem('access_token');
        localStorage.removeItem(ACTIVE_TENANT_STORAGE_KEY);
        localStorage.removeItem(ACTIVE_WORKSPACE_STORAGE_KEY);
        throw new Error(
          'Access Restricted: The Clock-In/Clock-Out Web Console is exclusively for Administrators and Managers. Employees must use the SmartBusiness Mobile App to clock in and out.'
        );
      }

      const tenant: Tenant = {
        id: activeRawTenant.tenantId || activeRawTenant.id,
        name: activeRawTenant.tenantName || activeRawTenant.name || 'Green Acres Landscaping LLC',
        role: tenantRole as any,
        status: (activeRawTenant.status || 'ACTIVE').toUpperCase() as any,
      };

      this.setCurrentTenant(tenant);

      // Workspaces belonging to this tenant
      const workspaces = this.getWorkspaces().map((w) => ({
        ...w,
        tenantId: tenant.id,
      }));
      this.setWorkspaces(workspaces);

      const currentWorkspace = this.getActiveWorkspace();
      localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, currentWorkspace.id);

      // Fetch employee badge profile if available
      let employeeProfile: any = null;
      try {
        const empRes = await clockInApi.get('/api/v1/employees/me');
        employeeProfile = empRes.data.data;
      } catch (empErr) {
        console.warn('Could not fetch employee profile, using fallback details:', empErr);
      }


      const user: User = {
        id: authUser.id,
        employeeId: employeeProfile?.employeeCode || 'EMP-GA001',
        name: authUser.fullName,
        email: authUser.email,
        phone: '+1 (555) 019-2834',
        role: 'admin',
        status: 'active',
        designation: employeeProfile?.designation || 'Operations Manager',
        department: employeeProfile?.department || 'Operations',
        joinedDate: '2024-01-15',
        avatarUrl: employeeProfile?.biometricPhotoUrl || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
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
      console.warn('API login failed or unavailable, checking mock fallback:', error?.message);

      if (error?.message?.includes('Access Restricted')) {
        throw error;
      }

      const mockUsers = getUsers();
      const matchedMock = mockUsers.find(
        (u) => u.email.toLowerCase() === email.toLowerCase()
      );

      if (matchedMock) {
        if (matchedMock.role !== 'admin') {
          throw new Error(
            'Access Restricted: The Clock-In/Clock-Out Web Console is exclusively for Administrators and Managers. Employees must use the SmartBusiness Mobile App to clock in and out.'
          );
        }
        const tenant = this.getCurrentTenant();
        const workspaces = this.getWorkspaces();
        const currentWorkspace = this.getActiveWorkspace();

        localStorage.setItem(ACTIVE_TENANT_STORAGE_KEY, tenant.id);
        localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, currentWorkspace.id);
        setSessionUser(matchedMock);

        return {
          user: matchedMock,
          token: 'mock-session-active',
          tenant,
          workspaces,
          currentWorkspace,
        };
      }

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
    const tenant: Tenant = {
      id: 't_' + Date.now(),
      name: companyName,
      role: 'OWNER',
      status: 'ACTIVE',
      billingEmail: email,
    };

    const initialWorkspace: Workspace = {
      id: 'ws_' + Date.now(),
      tenantId: tenant.id,
      name: 'Main Headquarters (HQ)',
      address: '100 Enterprise Way',
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
      phone: '(512) 555-0100',
      isDefault: true,
      employeeCount: 1,
      createdAt: new Date().toISOString(),
    };

    const workspaces = [
      initialWorkspace,
      {
        id: 'ws_branch_' + Date.now(),
        tenantId: tenant.id,
        name: 'North Branch Office',
        address: '500 Technology Dr',
        city: 'Round Rock',
        state: 'TX',
        zipCode: '78664',
        phone: '(512) 555-0200',
        isDefault: false,
        employeeCount: 0,
        createdAt: new Date().toISOString(),
      },
    ];

    try {
      let res;
      try {
        res = await clockInApi.post('/api/v1/auth/register', {
          companyName,
          fullName,
          email,
          password: 'Password1!',
        });
      } catch {
        res = await platformAuthApi.post('/api/v1/auth/register', {
          companyName,
          fullName,
          email,
          password: 'Password1!',
        });
      }

      const { user: authUser, tokens } = res.data.data;
      if (tokens?.accessToken) {
        localStorage.setItem('access_token', tokens.accessToken);
      }
      this.setCurrentTenant(tenant);
      this.setWorkspaces(workspaces);
      localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, initialWorkspace.id);

      const user: User = {
        id: authUser.id,
        employeeId: 'EMP-GA001',
        name: authUser.fullName,
        email: authUser.email,
        phone: '+1 (555) 019-2834',
        role: 'admin',
        status: 'active',
        designation: 'Operations Director',
        department: 'Operations',
        joinedDate: new Date().toISOString().split('T')[0],
        avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
      };

      setSessionUser(user);
      return {
        user,
        token: 'session-cookie-active',
        tenant,
        workspaces,
        currentWorkspace: initialWorkspace,
      };
    } catch (error: any) {
      console.warn('API register failed, falling back to mock registration:', error?.message);

      const user: User = {
        id: 'usr_' + Date.now(),
        employeeId: 'EMP-GA001',
        name: fullName,
        email,
        phone: '+1 (555) 019-2834',
        role: 'admin',
        status: 'active',
        designation: 'Workspace Administrator',
        department: 'Management',
        joinedDate: new Date().toISOString().split('T')[0],
        avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
      };

      this.setCurrentTenant(tenant);
      this.setWorkspaces(workspaces);
      localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, initialWorkspace.id);
      setSessionUser(user);

      return {
        user,
        token: 'mock-session-active',
        tenant,
        workspaces,
        currentWorkspace: initialWorkspace,
      };
    }
  },

  /**
   * Log out and clear session
   */
  async logout(): Promise<void> {
    try {
      await clockInApi.post('/api/v1/auth/logout').catch(() => {});
      await platformAuthApi.post('/api/v1/auth/logout').catch(() => {});
    } catch (err) {
      console.warn('Logout API error:', err);
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem(ACTIVE_TENANT_STORAGE_KEY);
      localStorage.removeItem(ACTIVE_WORKSPACE_STORAGE_KEY);
      setSessionUser(null);
    }
  },

  /**
   * Get current session user
   */
  async getCurrentUser(): Promise<User | null> {
    try {
      let meRes;
      try {
        meRes = await clockInApi.get('/api/v1/auth/me');
      } catch {
        meRes = await platformAuthApi.get('/api/v1/auth/me');
      }
      const authUser = meRes.data.data?.user;
      const rawTenants = meRes.data.data?.tenants;


      if (authUser) {
        if (rawTenants && rawTenants.length > 0) {
          const raw = rawTenants[0];
          const tenant: Tenant = {
            id: raw.tenantId || raw.id,
            name: raw.tenantName || raw.name || 'Green Acres Landscaping LLC',
            role: (raw.role || 'MEMBER').toUpperCase() as any,
            status: (raw.status || 'ACTIVE').toUpperCase() as any,
          };
          this.setCurrentTenant(tenant);
        }

        const tenant = this.getCurrentTenant();
        const tenantRole = tenant.role || 'MEMBER';
        const isPrivileged = tenantRole === 'OWNER' || tenantRole === 'ADMIN';

        if (!isPrivileged) {
          localStorage.removeItem(ACTIVE_TENANT_STORAGE_KEY);
          localStorage.removeItem(ACTIVE_WORKSPACE_STORAGE_KEY);
          setSessionUser(null);
          return null;
        }

        localStorage.setItem(ACTIVE_TENANT_STORAGE_KEY, tenant.id);
        const currentWorkspace = this.getActiveWorkspace();
        localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, currentWorkspace.id);

        let employeeProfile: any = null;
        try {
          const empRes = await clockInApi.get('/api/v1/employees/me');
          employeeProfile = empRes.data.data;
        } catch (empErr) {
          console.warn('Could not fetch employee profile on session restore:', empErr);
        }

        const existingUser = getSessionUser();
        const user: User = {
          id: authUser.id,
          employeeId: employeeProfile?.employeeCode || existingUser?.employeeId || 'EMP-GA001',
          name: authUser.fullName || existingUser?.name || 'Admin',
          email: authUser.email,
          phone: (existingUser && existingUser.id === authUser.id && existingUser.phone) ? existingUser.phone : '+1 (555) 019-2834',
          role: 'admin',
          status: 'active',
          designation: employeeProfile?.designation || existingUser?.designation || 'Operations Manager',
          department: employeeProfile?.department || existingUser?.department || 'Operations',
          joinedDate: existingUser?.joinedDate || '2024-01-15',
          avatarUrl: employeeProfile?.biometricPhotoUrl || existingUser?.avatarUrl || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
        };

        setSessionUser(user);
        return user;
      }
    } catch {
      // Session cookie absent or network error, fallback to cached session user
    }

    return getSessionUser();
  },
};

export default authService;
