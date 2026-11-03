import type { ServiceHealthStatus } from './telemetry.types';

export interface DashboardMetrics {
  mrrAmount: number;
  mrrGrowthMoM: number;
  activeTenants: number;
  newTenantsThisMonth: number;
  totalActiveUsers: number;
  activeWorkspacesCount: number;
  checksVolumeMtdUsd: number;
  checksCountMtd: number;
  statesCoveredCount: number;
}

export interface RevenueDataPoint {
  month: string;
  mrr: number;
  tenants: number;
}

export interface ProductAdoptionRatio {
  product: string;
  percentage: number;
  activeCount: number;
  color: string;
}

export interface ActivityFeedItem {
  id: string;
  tenantName: string;
  location: string;
  actionText: string;
  timestamp: string;
  badgeType: 'UPGRADE' | 'CHECK_BATCH' | 'ATTENDANCE_ENROLL' | 'AUDIT';
}

export interface SystemOverview {
  metrics: DashboardMetrics;
  revenueTrend: RevenueDataPoint[];
  productAdoption: ProductAdoptionRatio[];
  recentActivity: ActivityFeedItem[];
  servicesHealth: ServiceHealthStatus[];
}
