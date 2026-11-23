import React, { useState, useEffect, useCallback } from 'react';
import { RotateCw, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { DashboardSkeleton, EmptyState } from '../../components/common/LoadingState';
import { KpiGrid } from './KpiGrid';
import { RevenueChart } from './RevenueChart';
import { ProductAdoptionChart } from './ProductAdoptionChart';
import { RecentActivityFeed } from './RecentActivityFeed';
import { BusinessHealthOverview } from './BusinessHealthOverview';
import { fetchDashboardData, type DashboardTimeRange } from '../../api/dashboard.api';
import type { SystemOverview } from '../../types';
import { toast } from 'sonner';

export interface DashboardViewProps {
  onNavigateToUsers?: () => void;
  onNavigateToPayments?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigateToUsers,
  onNavigateToPayments,
}) => {
  const [data, setData] = useState<SystemOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<DashboardTimeRange>('30d');

  const loadData = useCallback(async (isManualRefresh = false) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetchDashboardData(timeRange);
      setData(res);
      if (isManualRefresh) {
        toast.success('Business revenue and tenant statistics refreshed.');
      }
    } catch {
      setLoadError('Failed to load dashboard metrics from platform services.');
      toast.error('Failed to sync latest statistics.');
    } finally {
      setIsLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  return (
    <div className="space-y-6">
      {/* Title Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-1">
        <div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">
            Executive Business Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-muted">
            Revenue growth, customer acquisition, product usage, and subscription health.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-panel border border-line rounded-[var(--radius-control)] p-1 flex shadow-2xs text-xs font-semibold">
            <button
              onClick={() => setTimeRange('30d')}
              className={`px-3 py-1 rounded-[var(--radius-control)] transition-all cursor-pointer ${
                timeRange === '30d' ? 'bg-ink text-white font-bold shadow-2xs' : 'text-muted hover:text-ink'
              }`}
            >
              30 Days
            </button>
            <button
              onClick={() => setTimeRange('quarter')}
              className={`px-3 py-1 rounded-[var(--radius-control)] transition-all cursor-pointer ${
                timeRange === 'quarter'
                  ? 'bg-ink text-white font-bold shadow-2xs'
                  : 'text-muted hover:text-ink'
              }`}
            >
              Quarter
            </button>
            <button
              onClick={() => setTimeRange('ytd')}
              className={`px-3 py-1 rounded-[var(--radius-control)] transition-all cursor-pointer ${
                timeRange === 'ytd' ? 'bg-ink text-white font-bold shadow-2xs' : 'text-muted hover:text-ink'
              }`}
            >
              YTD
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            isLoading={isLoading && Boolean(data)}
            icon={<RotateCw className="size-3.5 text-muted" />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && !data && <DashboardSkeleton />}

      {/* Error State */}
      {!isLoading && !data && (
        <EmptyState
          icon={<AlertCircle className="size-8 text-rose-500" />}
          title="Unable to load dashboard data"
          description={loadError || 'An error occurred while connecting to the platform services.'}
          action={
            <Button variant="primary" size="sm" onClick={() => loadData(true)}>
              <RefreshCw className="size-3.5 mr-1.5" /> Retry Connection
            </Button>
          }
        />
      )}

      {/* Real Live Dashboard Content */}
      {data && (
        <>
          {/* Top 4 Business KPI Metrics */}
          <KpiGrid metrics={data.metrics} timeRange={timeRange} />

          {/* Analytical Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <RevenueChart data={data.revenueTrend} timeRange={timeRange} />
            <ProductAdoptionChart products={data.productAdoption} />
          </div>

          {/* Business Activity & Conversion Funnel Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RecentActivityFeed
              activities={data.recentActivity}
              onViewAllTenants={onNavigateToUsers}
            />
            <BusinessHealthOverview
              onViewExpiringTrials={onNavigateToPayments}
            />
          </div>
        </>
      )}
    </div>
  );
};
