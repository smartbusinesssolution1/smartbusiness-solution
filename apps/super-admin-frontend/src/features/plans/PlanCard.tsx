import React from 'react';
import { Printer, RefreshCw, Layers, CheckCircle2, Edit2, Trash2 } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatDuration, formatDurationShort } from '../../utils/formatDuration';
import type { PlanConfig, ServiceType } from '../../types';

export interface PlanCardProps {
  plan: PlanConfig;
  onEdit: (plan: PlanConfig) => void;
  onDelete: (planId: string) => void;
}

export const PlanCard: React.FC<PlanCardProps> = ({ plan, onEdit, onDelete }) => {
  const getServiceBadge = (service: ServiceType) => {
    switch (service) {
      case 'CHECK_PRINTING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-primary-50 text-primary-700 border border-primary-200">
            <Printer className="size-3.5 text-primary-600" />
            Check Printing
          </span>
        );
      case 'CLOCK_IN_CLOCK_OUT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-blue-50 text-primary-700 border border-blue-200">
            <RefreshCw className="size-3.5 text-primary-600 stroke-[2.4]" />
            ClockIn-ClockOut
          </span>
        );
      case 'BOTH':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <Layers className="size-3.5 text-purple-600" />
            Both (Full Suite)
          </span>
        );
    }
  };

  const isBoth = plan.service === 'BOTH';

  return (
    <Card
      className={`relative flex flex-col justify-between transition-all hover:shadow-card hover:border-line-hover ${
        isBoth ? 'ring-2 ring-primary-600/30' : ''
      }`}
    >
      <div>
        {/* Header: Service Badge + Status */}
        <div className="flex items-center justify-between gap-2 mb-3">
          {getServiceBadge(plan.service)}
          <Badge variant={plan.status === 'ACTIVE' ? 'emerald' : 'slate'} dot>
            {plan.status}
          </Badge>
        </div>

        {/* Plan Name & Duration */}
        <div className="mb-2">
          <h3 className="text-base font-bold text-ink tracking-tight">{plan.name}</h3>
          <span className="inline-block text-[11px] font-mono font-semibold uppercase tracking-wider text-muted mt-0.5">
            {formatDuration(plan.durationCount, plan.durationUnit)}
          </span>
        </div>

        {/* Price */}
        <div className="text-3xl font-black text-ink mb-3">
          {formatCurrency(plan.price)}{' '}
          <span className="text-xs font-normal text-muted">
            /{formatDurationShort(plan.durationCount, plan.durationUnit)}
          </span>
        </div>

        {/* Full Access Guarantee */}
        <div className="bg-subtle border border-line rounded-lg p-2.5 mb-4">
          <div className="flex items-center gap-1.5 text-xs font-bold text-ink">
            <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
            <span>Full Unrestricted Access</span>
          </div>
          <p className="text-[11px] text-muted mt-1 leading-normal">
            {plan.service === 'CHECK_PRINTING' &&
              'Complete Check Printing access: unlimited checks, templates, bank accounts, and print queues.'}
            {plan.service === 'CLOCK_IN_CLOCK_OUT' &&
              'Complete Attendance suite: unlimited employees, biometric facial recognition, shifts, and kiosk.'}
            {plan.service === 'BOTH' &&
              'Full access to both Check Printing & ClockIn-ClockOut attendance suite with all features enabled.'}
          </p>
        </div>
      </div>

      {/* Footer: Active Tenants & Actions */}
      <div className="pt-3 border-t border-line flex items-center justify-between text-xs">
        <span className="text-muted">
          Active Orgs:{' '}
          <strong className="text-ink font-mono font-bold">{plan.activeTenantsCount}</strong>
        </span>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onEdit(plan)}
            className="p-1 text-muted hover:text-primary-600 hover:bg-subtle rounded transition-colors cursor-pointer"
            title="Edit Plan"
          >
            <Edit2 className="size-3.5" />
          </button>
          <button
            onClick={() => onDelete(plan.id)}
            className="p-1 text-muted hover:text-rose-600 hover:bg-subtle rounded transition-colors cursor-pointer"
            title="Delete Plan"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
    </Card>
  );
};
