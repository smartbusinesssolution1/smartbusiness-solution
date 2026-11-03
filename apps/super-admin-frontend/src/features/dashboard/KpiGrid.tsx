import React from 'react';
import { DollarSign, Building2, Users, FileCheck2 } from 'lucide-react';
import { MetricCard } from '../../components/common/MetricCard';
import { formatCurrency } from '../../utils/formatCurrency';
import type { DashboardMetrics } from '../../types';

export interface KpiGridProps {
  metrics: DashboardMetrics;
}

export const KpiGrid: React.FC<KpiGridProps> = ({ metrics }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="Total MRR (Stripe USD)"
        value={formatCurrency(metrics.mrrAmount)}
        changeText={`+${metrics.mrrGrowthMoM}%`}
        changeType="positive"
        subtext="vs last month ($124.4k)"
        icon={<DollarSign className="w-4 h-4" />}
        iconBgColor="bg-emerald-50 text-emerald-600"
      />

      <MetricCard
        title="Active Organizations"
        value={metrics.activeTenants.toLocaleString()}
        changeText={`+${metrics.newTenantsThisMonth}`}
        changeType="positive"
        subtext="new tenants this month"
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
        title="Checks Processed (MTD)"
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
