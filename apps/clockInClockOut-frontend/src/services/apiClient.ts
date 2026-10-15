import axios, { AxiosError } from 'axios';
import { notify } from '../context/NotificationContext';

export const PLATFORM_API_URL = import.meta.env.VITE_PLATFORM_API_URL || 'http://localhost:3001';
export const CLOCKIN_API_URL = import.meta.env.VITE_CLOCKIN_API_URL || import.meta.env.VITE_API_URL || 'http://localhost:3000';

function extractErrorMessage(data: any, fallback = 'Operation failed'): string {
  if (!data) return fallback;
  if (typeof data === 'string') return data;
  if (data.error) {
    if (typeof data.error === 'string') return data.error;
    if (data.error.message) return data.error.message;
  }
  if (data.message) return data.message;
  return fallback;
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

// Request interceptor: attach Authorization, X-Tenant-Id and X-Workspace-Id headers
clockInApi.interceptors.request.use((config) => {
  const url = config.url || '';
  const isAuthRoute =
    url.includes('/auth/login') ||
    url.includes('/auth/register') ||
    url.includes('/auth/refresh');

  const token = localStorage.getItem('access_token');

  // Do not hit network for protected routes when logged out / token is missing
  if (!token && !isAuthRoute) {
    return Promise.reject(new axios.CanceledError('No access token available. Request aborted.'));
  }

  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  const tenantId = localStorage.getItem('active_tenant_id');
  if (tenantId && tenantId !== 'undefined' && tenantId !== 'null') {
    config.headers.set('X-Tenant-Id', tenantId);
  }
  const workspaceId = localStorage.getItem('active_workspace_id');
  if (workspaceId && workspaceId !== 'undefined' && workspaceId !== 'null') {
    config.headers.set('X-Workspace-Id', workspaceId);
  }
  return config;
});

// Request interceptor for platformAuthApi: attach Authorization and X-Tenant-Id headers
platformAuthApi.interceptors.request.use((config) => {
  const url = config.url || '';
  const isAuthRoute =
    url.includes('/auth/login') ||
    url.includes('/auth/register') ||
    url.includes('/auth/refresh');

  const token = localStorage.getItem('access_token');

  // Do not hit network for protected routes when logged out / token is missing
  if (!token && !isAuthRoute) {
    return Promise.reject(new axios.CanceledError('No access token available. Request aborted.'));
  }

  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  const tenantId = localStorage.getItem('active_tenant_id');
  if (tenantId && tenantId !== 'undefined' && tenantId !== 'null') {
    config.headers.set('X-Tenant-Id', tenantId);
  }
  return config;
});

// Response interceptor for ClockInApi: notify on error or success: false, silent token refresh on 401
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

    // Never intercept auth endpoints (login, register, refresh)
    const isAuthRoute =
      url.includes('/auth/login') ||
      url.includes('/auth/register') ||
      url.includes('/auth/refresh');

    if (error.response?.status === 401 && !originalRequest?._retry && !isAuthRoute) {
      originalRequest._retry = true;
      const currentToken = localStorage.getItem('access_token');

      // If no token was stored, don't attempt refresh loop
      if (currentToken) {
        try {
          // Silent token refresh via platform-api
          const refreshRes = await platformAuthApi.post('/api/v1/auth/refresh');
          const newAccessToken = refreshRes.data?.data?.tokens?.accessToken;
          if (newAccessToken) {
            localStorage.setItem('access_token', newAccessToken);
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
            // Retry the original request
            return clockInApi(originalRequest);
          }
        } catch (refreshErr) {
          // Session expired, redirect to login
          localStorage.removeItem('access_token');
          localStorage.removeItem('active_tenant_id');
          localStorage.removeItem('active_workspace_id');
          localStorage.removeItem('checkpoint_current_user');
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
          notify('Your session has expired. Please sign in again.', 'warning');
        }
      }
    }

    if (isAuthRoute) {
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

    // Skip toast on background refresh checks
    if (url.includes('/auth/refresh')) {
      return Promise.reject(error);
    }

    const msg = extractErrorMessage(error.response?.data, error.message || 'Authentication failed');
    notify(msg, 'error');
    return Promise.reject(error);
  }
);
