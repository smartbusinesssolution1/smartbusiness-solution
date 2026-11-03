import React from 'react';
import { Badge } from '../../components/common/Badge';
import { Printer, RefreshCw, Layers } from 'lucide-react';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatDate } from '../../utils/formatDate';
import { formatDuration, formatDurationShort } from '../../utils/formatDuration';
import type { SubscriptionRecord, SubscriptionStatus, ServiceType } from '../../types';

export interface SubscriptionTableProps {
  subscriptions: SubscriptionRecord[];
  statusFilter: string;
  serviceFilter: string;
  onManage: (sub: SubscriptionRecord) => void;
}

export const SubscriptionTable: React.FC<SubscriptionTableProps> = ({
  subscriptions,
  statusFilter,
  serviceFilter,
  onManage,
}) => {
  const filtered = subscriptions.filter((sub) => {
    const matchesStatus = statusFilter === 'ALL' || sub.status === statusFilter;
    const matchesService = serviceFilter === 'ALL' || sub.service === serviceFilter;
    return matchesStatus && matchesService;
  });

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
          <span className="inline-flex items-center gap-1 text-primary-700 font-semibold">
            <Printer className="size-3.5 text-primary-600" />
            Check Printing
          </span>
        );
      case 'CLOCK_IN_CLOCK_OUT':
        return (
          <span className="inline-flex items-center gap-1.5 text-primary-700 font-semibold">
            <RefreshCw className="size-3.5 text-primary-600 stroke-[2.4]" />
            ClockIn-ClockOut
          </span>
        );
      case 'BOTH':
        return (
          <span className="inline-flex items-center gap-1 text-purple-700 font-semibold">
            <Layers className="size-3.5 text-purple-600" />
            Both (Bundle)
          </span>
        );
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs text-ink-soft">
        <thead className="bg-subtle text-[11px] font-bold uppercase tracking-wider text-muted border-b border-line select-none">
          <tr>
            <th className="py-3 px-4">Organization / Tenant</th>
            <th className="py-3 px-4">Service</th>
            <th className="py-3 px-4">Plan Name</th>
            <th className="py-3 px-4">Duration</th>
            <th className="py-3 px-4">Amount</th>
            <th className="py-3 px-4">Stripe ID</th>
            <th className="py-3 px-4">Status</th>
            <th className="py-3 px-4">Renews At</th>
            <th className="py-3 px-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line font-medium">
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={9} className="py-8 text-center text-muted">
                No subscription records match the selected filters.
              </td>
            </tr>
          ) : (
            filtered.map((sub) => (
              <tr key={sub.id} className="hover:bg-subtle transition-colors">
                <td className="py-3.5 px-4">
                  <div className="font-bold text-ink">{sub.tenantName}</div>
                  <div className="text-[11px] text-muted">{sub.billingEmail}</div>
                </td>
                <td className="py-3.5 px-4">{getServiceBadge(sub.service)}</td>
                <td className="py-3.5 px-4 font-semibold text-ink">{sub.planName}</td>
                <td className="py-3.5 px-4">
                  <span className="inline-block text-[11px] font-mono px-2 py-0.5 rounded bg-subtle border border-line text-ink-soft font-semibold">
                    {formatDuration(sub.durationCount, sub.durationUnit)}
                  </span>
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
                <td className="py-3.5 px-4 text-right">
                  <button
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
  );
};
