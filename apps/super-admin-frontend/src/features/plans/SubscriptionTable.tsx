import React from 'react';
import { Badge } from '../../components/common/Badge';
import { Pagination } from '../../components/common/Pagination';
import { Printer, RefreshCw, Layers } from 'lucide-react';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatDate } from '../../utils/formatDate';
import { formatDuration, formatDurationShort } from '../../utils/formatDuration';
import type { SubscriptionRecord, SubscriptionStatus, ServiceType } from '../../types';

export interface SubscriptionTableProps {
  subscriptions: SubscriptionRecord[];
  total: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onManage: (sub: SubscriptionRecord) => void;
}

export const SubscriptionTable: React.FC<SubscriptionTableProps> = ({
  subscriptions,
  total,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onManage,
}) => {
  const getStatusBadge = (status: SubscriptionStatus) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <Badge variant="emerald" dot>
            ACTIVE
          </Badge>
        );
      case 'TRIALING':
        return (
          <Badge variant="amber" dot>
            TRIALING
          </Badge>
        );
      case 'PAST_DUE':
        return (
          <Badge variant="rose" dot>
            PAST_DUE
          </Badge>
        );
      case 'CANCELED':
      case 'EXPIRED':
        return (
          <Badge variant="slate" dot>
            {status}
          </Badge>
        );
    }
  };

  const getServiceBadge = (service: ServiceType) => {
    switch (service) {
      case 'CHECK_PRINTING':
        return (
          <Badge variant="blue">
            <Printer className="size-3 mr-1" /> Check Printing
          </Badge>
        );
      case 'CLOCK_IN_CLOCK_OUT':
        return (
          <Badge variant="indigo">
            <RefreshCw className="size-3 mr-1" /> Clock-In
          </Badge>
        );
      case 'BOTH':
        return (
          <Badge variant="purple">
            <Layers className="size-3 mr-1" /> Both
          </Badge>
        );
    }
  };

  return (
    <div className="flex flex-col">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-subtle/70 border-b border-line text-muted uppercase tracking-wider font-bold text-[11px] font-mono select-none">
              <th className="py-3 px-4">Organization / Tenant</th>
              <th className="py-3 px-4">Subscribed Plan</th>
              <th className="py-3 px-4">Service</th>
              <th className="py-3 px-4">Amount</th>
              <th className="py-3 px-4">Stripe Customer</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Current Period End</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {subscriptions.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-muted">
                  No subscriptions match the selected criteria.
                </td>
              </tr>
            ) : (
              subscriptions.map((sub) => (
                <tr
                  key={sub.id}
                  className="hover:bg-primary-50/20 transition-colors group cursor-pointer"
                  onClick={() => onManage(sub)}
                >
                  <td className="py-3.5 px-4 font-bold text-ink">
                    <div className="flex flex-col">
                      <span>{sub.tenantName}</span>
                      <span className="text-[10px] text-muted font-normal font-mono">
                        {sub.billingEmail}
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-ink-soft">
                    {sub.planName}
                    <div className="text-[10px] text-muted font-normal">
                      {formatDuration(sub.durationCount, sub.durationUnit)} recurring
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    {getServiceBadge(sub.service)}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-ink font-mono">
                    {formatCurrency(sub.amount)}
                    <span className="text-[10px] text-muted font-normal">
                      /{formatDurationShort(sub.durationCount, sub.durationUnit)}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[11px] text-muted">
                    {sub.stripeCustomerId}
                  </td>
                  <td className="py-3.5 px-4">{getStatusBadge(sub.status)}</td>
                  <td className="py-3.5 px-4 text-muted font-mono text-[11px]">
                    {formatDate(sub.currentPeriodEndsAt)}
                  </td>
                  <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => onManage(sub)}
                      className="text-primary-600 hover:text-primary-800 font-bold hover:underline cursor-pointer"
                    >
                      Manage
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <Pagination
          currentPage={currentPage}
          totalItems={total}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </div>
  );
};
