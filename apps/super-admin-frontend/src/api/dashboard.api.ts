import type { SystemOverview } from '../types';
import { apiClient } from './client';

export type DashboardTimeRange = '30d' | 'quarter' | 'ytd';

export async function fetchDashboardData(
  timeRange: DashboardTimeRange = '30d'
): Promise<SystemOverview> {
  return await apiClient<SystemOverview>('/api/v1/super-admin/dashboard', {
    params: { timeRange },
  });
}
