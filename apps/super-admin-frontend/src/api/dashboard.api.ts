import type { SystemOverview } from '../types';
import { apiClient } from './client';

export const MOCK_DASHBOARD_DATA: SystemOverview = {
  metrics: {
    mrrAmount: 142850.0,
    mrrGrowthMoM: 14.8,
    activeTenants: 1428,
    newTenantsThisMonth: 52,
    totalActiveUsers: 18942,
    activeWorkspacesCount: 3840,
    checksVolumeMtdUsd: 4892100.0,
    checksCountMtd: 34180,
    statesCoveredCount: 48,
  },
  revenueTrend: [
    { month: 'May', mrr: 82000, tenants: 890 },
    { month: 'Jun', mrr: 94000, tenants: 970 },
    { month: 'Jul', mrr: 108000, tenants: 1090 },
    { month: 'Aug', mrr: 115000, tenants: 1180 },
    { month: 'Sep', mrr: 126000, tenants: 1270 },
    { month: 'Oct', mrr: 134000, tenants: 1376 },
    { month: 'Nov', mrr: 142850, tenants: 1428 },
  ],
  productAdoption: [
    { product: 'Check Printing', percentage: 54, activeCount: 771, color: '#2563eb' },
    { product: 'Attendance & Face AI', percentage: 36, activeCount: 514, color: '#6366f1' },
    { product: 'AI RAG Chatbot', percentage: 10, activeCount: 143, color: '#a855f7' },
  ],
  recentActivity: [
    {
      id: 'act-1',
      tenantName: 'Apex Holdings LLC',
      location: 'Austin, TX',
      actionText: 'Upgraded to Business Plan ($299/mo) • Stripe ID: cus_O92k4a',
      timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      badgeType: 'UPGRADE',
    },
    {
      id: 'act-2',
      tenantName: 'Beacon Healthcare Group',
      location: 'Miami, FL',
      actionText: 'Printed 450 Payroll Checks ($284,500 total)',
      timestamp: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
      badgeType: 'CHECK_BATCH',
    },
    {
      id: 'act-3',
      tenantName: 'NextGen Logistics Inc',
      location: 'Chicago, IL',
      actionText: 'Enrolled 120 employees in Biometric Face Clock-In',
      timestamp: new Date(Date.now() - 42 * 60 * 1000).toISOString(),
      badgeType: 'ATTENDANCE_ENROLL',
    },
  ],
  servicesHealth: [
    {
      service: 'platform-api',
      port: 3000,
      status: 'HEALTHY',
      uptimePercent: 99.99,
      latencyMs: 11,
      lastCheckedAt: new Date().toISOString(),
    },
    {
      service: 'check-printing-backend',
      port: 3001,
      status: 'HEALTHY',
      uptimePercent: 100,
      latencyMs: 15,
      lastCheckedAt: new Date().toISOString(),
    },
    {
      service: 'clockInClockOut-backend',
      port: 3002,
      status: 'HEALTHY',
      uptimePercent: 99.98,
      latencyMs: 18,
      lastCheckedAt: new Date().toISOString(),
    },
    {
      service: 'face-recognition',
      port: 8000,
      status: 'HEALTHY',
      uptimePercent: 99.8,
      latencyMs: 42,
      lastCheckedAt: new Date().toISOString(),
    },
  ],
};

export async function fetchDashboardData(): Promise<SystemOverview> {
  try {
    return await apiClient<SystemOverview>('/api/v1/super-admin/dashboard');
  } catch {
    // Graceful offline mock fallback
    return MOCK_DASHBOARD_DATA;
  }
}
