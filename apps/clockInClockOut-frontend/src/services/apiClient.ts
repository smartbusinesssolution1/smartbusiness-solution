import axios, { AxiosError } from 'axios';

export const PLATFORM_API_URL = import.meta.env.VITE_PLATFORM_API_URL || 'http://localhost:3001';
export const CLOCKIN_API_URL = import.meta.env.VITE_CLOCKIN_API_URL || import.meta.env.VITE_API_URL || 'http://localhost:3000';

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
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  const tenantId = localStorage.getItem('active_tenant_id');
  if (tenantId) {
    config.headers.set('X-Tenant-Id', tenantId);
  }
  const workspaceId = localStorage.getItem('active_workspace_id');
  if (workspaceId) {
    config.headers.set('X-Workspace-Id', workspaceId);
  }
  return config;
});

// Request interceptor for platformAuthApi: attach Authorization and X-Tenant-Id headers
platformAuthApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  const tenantId = localStorage.getItem('active_tenant_id');
  if (tenantId) {
    config.headers.set('X-Tenant-Id', tenantId);
  }
  return config;
});

// Response interceptor: silent token refresh on 401
clockInApi.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as any;
    if (error.response?.status === 401 && !originalRequest?._retry) {
      originalRequest._retry = true;
      try {
        // Silent token refresh via platform-api
        const refreshRes = await platformAuthApi.post('/api/v1/auth/refresh');
        const newAccessToken = refreshRes.data?.data?.tokens?.accessToken;
        if (newAccessToken) {
          localStorage.setItem('access_token', newAccessToken);
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
        }
        // Retry the original request
        return clockInApi(originalRequest);
      } catch (refreshErr) {
        // Session expired, redirect to login
        localStorage.removeItem('access_token');
        localStorage.removeItem('active_tenant_id');
        localStorage.removeItem('active_workspace_id');
        localStorage.removeItem('checkpoint_current_user');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshErr);
      }
    }
    return Promise.reject(error);
  }
);

