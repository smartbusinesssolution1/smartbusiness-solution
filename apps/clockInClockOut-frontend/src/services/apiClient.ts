import axios, { AxiosError } from 'axios';
import { notify } from '../context/NotificationContext';


export const PLATFORM_API_URL =
  import.meta.env.PROD ? '' : (import.meta.env.VITE_PLATFORM_API_URL || 'http://localhost:3001');
export const CLOCKIN_API_URL =
  import.meta.env.PROD ? '' : (import.meta.env.VITE_CLOCKIN_API_URL || import.meta.env.VITE_API_URL || 'http://localhost:3000');

function extractErrorMessage(data: any, fallback = 'Operation failed'): string {
  if (!data) return fallback;
  if (typeof data === 'string') return data;
  if (data.error) {
    if (typeof data.error === 'string') return data.error;
    if (data.error.originalMessage) return data.error.originalMessage;
    if (data.error.message) return data.error.message;
  }
  if (data.message) return data.message;
  return fallback;
}

// ─── Session ────────────────────────────────────────────────
const SESSION_FLAG_KEY = 'session_active';
const ACCESS_TOKEN_KEY = 'access_token';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function markSignedIn(accessToken?: string): void {
  try {
    localStorage.setItem(SESSION_FLAG_KEY, '1');
    if (accessToken) {
      localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    }
  } catch {
    // Storage unavailable
  }
}

export function markSignedOut(): void {
  try {
    localStorage.removeItem(SESSION_FLAG_KEY);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  } catch {
    // Storage unavailable
  }
}

// In-memory getters injected by Zustand store to avoid repeated synchronous disk I/O (localStorage) on every request
let getTenantId: (() => string | null | undefined) | null = null;
let getWorkspaceId: (() => string | null | undefined) | null = null;

export function setAuthGetters(
  tenantGetter: () => string | null | undefined,
  workspaceGetter: () => string | null | undefined
): void {
  getTenantId = tenantGetter;
  getWorkspaceId = workspaceGetter;
}

export function isSignedIn(): boolean {
  try {
    return localStorage.getItem(SESSION_FLAG_KEY) === '1';
  } catch {
    return false;
  }
}

export function isPublicAuthRoute(url: string): boolean {
  return (
    url.includes('/auth/login') ||
    url.includes('/auth/register') ||
    url.includes('/auth/refresh') ||
    url.includes('/auth/forgot-password') ||
    url.includes('/auth/reset-password') ||
    url.includes('/auth/invitations')
  );
}

// Central Axios instance for ClockInClockOut backend (Port 3000)
export const clockInApi = axios.create({
  baseURL: CLOCKIN_API_URL,
  withCredentials: true, // Send access_token cookie automatically
  headers: {
    'Content-Type': 'application/json',
  },
});

// Central Axios instance for Platform Auth API (Port 3001)
export const platformAuthApi = axios.create({
  baseURL: PLATFORM_API_URL,
  withCredentials: true, // Send cookies automatically
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach Authorization, X-Tenant-Id, and X-Workspace-Id headers
clockInApi.interceptors.request.use((config) => {
  const url = config.url || '';
  const isAuthRoute = isPublicAuthRoute(url);

  // Do not hit network for protected routes when signed out
  if (!isSignedIn() && !isAuthRoute) {
    return Promise.reject(new axios.CanceledError('Not signed in. Request aborted.'));
  }

  // Attach Bearer token if stored in localStorage
  const token = getStoredToken();
  if (token && !config.headers.get('Authorization')) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }

  // If sending FormData (file uploads), remove default Content-Type so the browser automatically sets the multipart boundary
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }

  const tenantId = getTenantId?.() || localStorage.getItem('active_tenant_id');
  if (tenantId && tenantId !== 'undefined' && tenantId !== 'null') {
    config.headers.set('X-Tenant-Id', tenantId);
  }
  const workspaceId = getWorkspaceId?.() || localStorage.getItem('active_workspace_id');
  if (workspaceId && workspaceId !== 'undefined' && workspaceId !== 'null') {
    config.headers.set('X-Workspace-Id', workspaceId);
  }
  return config;
});

// Request interceptor for platformAuthApi: attach Authorization and X-Tenant-Id header
platformAuthApi.interceptors.request.use((config) => {
  const url = config.url || '';
  const isAuthRoute = isPublicAuthRoute(url);

  // Do not hit network for protected routes when signed out
  if (!isSignedIn() && !isAuthRoute) {
    return Promise.reject(new axios.CanceledError('Not signed in. Request aborted.'));
  }

  // Attach Bearer token if stored in localStorage
  const token = getStoredToken();
  if (token && !config.headers.get('Authorization')) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }

  const tenantId = getTenantId?.() || localStorage.getItem('active_tenant_id');
  if (tenantId && tenantId !== 'undefined' && tenantId !== 'null') {
    config.headers.set('X-Tenant-Id', tenantId);
  }
  return config;
});

// Renews the session once; concurrent callers share the same attempt.
let refreshInFlight: Promise<boolean> | null = null;

export function refreshSession(): Promise<boolean> {
  refreshInFlight ??= platformAuthApi
    .post('/api/v1/auth/refresh')
    .then((res) => {
      const token = res.data?.data?.accessToken || res.data?.data?.tokens?.accessToken;
      if (token) {
        try {
          localStorage.setItem(ACCESS_TOKEN_KEY, token);
        } catch {
          // Storage unavailable
        }
      }
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

// Response interceptor for ClockInApi: notify on error or success: false, silent session refresh on 401
clockInApi.interceptors.response.use(
  (response) => {
    if (response.data && response.data.success === false) {
      const msg = extractErrorMessage(response.data);
      notify(msg, 'error');
    }
    return response;
  },
  async (error: AxiosError) => {
    // If request was canceled/blocked due to missing token, reject silently without notification
    if (axios.isCancel(error) || (error as any)?.name === 'CanceledError') {
      return Promise.reject(error);
    }

    const originalRequest = error.config as any;
    const url = originalRequest?.url || '';

    // BUG-04: Suppress error toast on optional employee profile lookup (/api/v1/employees/me)
    if (url.includes('/api/v1/employees/me') && error.response?.status === 404) {
      return Promise.reject(error);
    }

    // Never intercept auth endpoints (login, register, refresh)
    const isAuthRoute = isPublicAuthRoute(url);

    // BUG-08: Check if 401 was due to missing tenant header rather than expired JWT session
    const errorData = error.response?.data as any;
    const errorMsg = typeof errorData === 'string' ? errorData : (errorData?.message || errorData?.error?.message || '');
    const isTenantHeaderError = errorMsg.includes('Tenant') || errorMsg.includes('X-Tenant-Id');

    if (error.response?.status === 401 && !originalRequest?._retry && !isAuthRoute && !isTenantHeaderError) {
      originalRequest._retry = true;

      // Only a signed-in session can be renewed; otherwise there is nothing to refresh
      if (isSignedIn()) {
        // Silent session refresh via platform-api: new token, then retry original request
        if (await refreshSession()) {
          const newToken = getStoredToken();
          if (newToken && originalRequest) {
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
          }
          return clockInApi(originalRequest);
        }
        // Session expired, redirect to login
        markSignedOut();
        localStorage.removeItem('active_tenant_id');
        localStorage.removeItem('active_workspace_id');
        localStorage.removeItem('checkpoint_current_user');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        notify('Your session has expired. Please sign in again.', 'warning');
      }
    }

    if (isAuthRoute) {
      return Promise.reject(error);
    }

    const isSubscriptionError =
      error.response?.status === 403 &&
      (errorMsg.toLowerCase().includes('subscription') ||
        errorMsg.toLowerCase().includes('active subscription'));

    if (isSubscriptionError) {
      if (window.location.pathname !== '/subscription-expired') {
        window.location.href = '/subscription-expired';
      }
      return Promise.reject(error);
    }

    if (isTenantHeaderError) {
      notify('Organization / Tenant identifier is required for this operation.', 'warning');
      return Promise.reject(error);
    }

    const msg = extractErrorMessage(error.response?.data, error.message || 'Request failed');
    notify(msg, 'error');
    return Promise.reject(error);
  }
);

// Response interceptor for platformAuthApi: notify on error or success: false
platformAuthApi.interceptors.response.use(
  (response) => {
    if (response.data && response.data.success === false) {
      const msg = extractErrorMessage(response.data);
      notify(msg, 'error');
    }
    return response;
  },
  (error: AxiosError) => {
    // If request was canceled/blocked due to missing token, reject silently without notification
    if (axios.isCancel(error) || (error as any)?.name === 'CanceledError') {
      return Promise.reject(error);
    }

    const originalRequest = error.config as any;
    const url = originalRequest?.url || '';

    // Skip toast on background refresh checks or initial session check
    if (url.includes('/auth/refresh') || url.includes('/auth/me')) {
      return Promise.reject(error);
    }

    const msg = extractErrorMessage(error.response?.data, error.message || 'Authentication failed');
    notify(msg, 'error');
    return Promise.reject(error);
  }
);
