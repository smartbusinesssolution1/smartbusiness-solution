import React from 'react';
import { DollarSign, Building2, Users, FileCheck2 } from 'lucide-react';
import { MetricCard } from '../../components/common/MetricCard';
import { formatCurrency } from '../../utils/formatCurrency';
import type { DashboardMetrics } from '../../types';

export interface KpiGridProps {
  metrics: DashboardMetrics;
  timeRange?: '30d' | 'quarter' | 'ytd';
}

export const KpiGrid: React.FC<KpiGridProps> = ({ metrics, timeRange = '30d' }) => {
  const mrrSubtext =
    timeRange === 'quarter'
      ? 'vs last quarter ($103.2k)'
      : timeRange === 'ytd'
        ? 'vs start of year ($78.2k)'
        : 'vs last month ($124.4k)';

  const tenantsSubtext =
    timeRange === 'quarter'
      ? 'new tenants this quarter'
      : timeRange === 'ytd'
        ? 'new tenants year-to-date'
        : 'new tenants this month';

  const checksTitle =
    timeRange === 'quarter'
      ? 'Checks Processed (QTD)'
      : timeRange === 'ytd'
        ? 'Checks Processed (YTD)'
        : 'Checks Processed (MTD)';

  const mrrGrowthSuffix =
    timeRange === 'quarter' ? 'QoQ' : timeRange === 'ytd' ? 'YTD' : 'MoM';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="Total MRR (Stripe USD)"
        value={formatCurrency(metrics.mrrAmount)}
        changeText={`+${metrics.mrrGrowthMoM}% ${mrrGrowthSuffix}`}
        changeType="positive"
        subtext={mrrSubtext}
        icon={<DollarSign className="w-4 h-4" />}
        iconBgColor="bg-emerald-50 text-emerald-600"
      />

      <MetricCard
        title="Active Organizations"
        value={metrics.activeTenants.toLocaleString()}
        changeText={`+${metrics.newTenantsThisMonth}`}
        changeType="positive"
        subtext={tenantsSubtext}
        icon={<Building2 className="w-4 h-4" />}
        iconBgColor="bg-blue-50 text-blue-600"
      />

      <MetricCard
        title="Total Active Users"
        value={metrics.totalActiveUsers.toLocaleString()}
        changeText={`${metrics.activeWorkspacesCount.toLocaleString()} ws`}
        changeType="positive"
        subtext="across client workspaces"
        icon={<Users className="w-4 h-4" />}
        iconBgColor="bg-indigo-50 text-indigo-600"
      />

      <MetricCard
        title={checksTitle}
        value={formatCurrency(metrics.checksVolumeMtdUsd, { compact: true })}
        changeText={`${metrics.checksCountMtd.toLocaleString()} checks`}
        changeType="neutral"
        subtext={`across ${metrics.statesCoveredCount} US states`}
        icon={<FileCheck2 className="w-4 h-4" />}
        iconBgColor="bg-sky-50 text-sky-600"
      />
    </div>
  );
};
