import React from 'react';
import { Card } from '../../components/common/Card';
import {
  TrendingUp,
  RefreshCw,
  FileCheck2,
  Clock,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { formatCurrency } from '../../utils/formatCurrency';

export interface BusinessHealthOverviewProps {
  onViewExpiringTrials?: () => void;
}

export const BusinessHealthOverview: React.FC<BusinessHealthOverviewProps> = ({
  onViewExpiringTrials,
}) => {
  return (
    <Card className="flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-ink">Business Performance & Retention</h2>
            <p className="text-xs text-muted">Customer conversion, retention, and billing health.</p>
          </div>
          <span className="px-2.5 py-1 text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-full font-mono flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-emerald-500" /> Net Retention 108.4%
          </span>
        </div>

        {/* 3 Core Business Metrics Grid */}
        <div className="grid grid-cols-3 gap-2.5 mb-4 text-center">
          <div className="p-3 rounded-[var(--radius-control)] bg-subtle/80 border border-line">
            <div className="text-[10px] text-muted font-mono uppercase font-bold">Annual Run Rate (ARR)</div>
            <div className="text-base font-black text-ink mt-0.5">{formatCurrency(1714200, { compact: true })}</div>
            <div className="text-[10px] text-emerald-700 font-bold mt-0.5 flex items-center justify-center gap-0.5">
              <TrendingUp className="size-2.5" /> +14.8% YoY
            </div>
          </div>

          <div className="p-3 rounded-[var(--radius-control)] bg-subtle/80 border border-line">
            <div className="text-[10px] text-muted font-mono uppercase font-bold">Trial Conversion</div>
            <div className="text-base font-black text-ink mt-0.5">34.2%</div>
            <div className="text-[10px] text-emerald-700 font-bold mt-0.5 font-mono">+4.1% MoM</div>
          </div>

          <div className="p-3 rounded-[var(--radius-control)] bg-subtle/80 border border-line">
            <div className="text-[10px] text-muted font-mono uppercase font-bold">Customer Churn</div>
            <div className="text-base font-black text-ink mt-0.5">0.8%</div>
            <div className="text-[10px] text-muted font-medium mt-0.5 font-mono">Industry Low</div>
          </div>
        </div>

        {/* Product Value Delivered (Client Impact) */}
        <div className="space-y-2 border-t border-line pt-3 text-xs">
          <div className="flex items-center justify-between py-1">
            <span className="font-medium text-ink-soft flex items-center gap-2">
              <FileCheck2 className="size-3.5 text-primary-600" />
              <span>Check Disbursements Issued</span>
            </span>
            <span className="font-bold text-ink font-mono">$4,892,100 (34,180 checks)</span>
          </div>

          <div className="flex items-center justify-between py-1">
            <span className="font-medium text-ink-soft flex items-center gap-2">
              <RefreshCw className="size-3.5 text-primary-600 stroke-[2.4]" />
              <span>Employee Shifts Clocked</span>
            </span>
            <span className="font-bold text-ink font-mono">142,500 shifts verified</span>
          </div>

          <div className="flex items-center justify-between py-1">
            <span className="font-medium text-ink-soft flex items-center gap-2">
              <Sparkles className="size-3.5 text-purple-600" />
              <span>AI Support Queries Handled</span>
            </span>
            <span className="font-bold text-ink font-mono">8,420 resolved automatically</span>
          </div>
        </div>
      </div>

      {/* Actionable Trial Expirations Banner */}
      <div className="mt-4 p-3 bg-brand-50 border border-brand-200/80 rounded-[var(--radius-control)] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Clock className="size-4 text-primary-600 shrink-0" />
          <div>
            <div className="text-xs font-bold text-ink">12 Trials Expiring in Next 7 Days</div>
            <div className="text-[11px] text-muted">Estimated pipeline value: $1,788/mo MRR</div>
          </div>
        </div>

        {onViewExpiringTrials && (
          <button
            onClick={onViewExpiringTrials}
            className="text-xs font-bold text-primary-700 hover:text-primary-800 flex items-center gap-1 cursor-pointer"
          >
            Review <ArrowRight className="size-3" />
          </button>
        )}
      </div>
    </Card>
  );
};
