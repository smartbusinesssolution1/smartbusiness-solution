import React from 'react';
import { SearchInput } from '../../components/common/SearchInput';
import { Card } from '../../components/common/Card';
import { Printer, RefreshCw, CreditCard } from 'lucide-react';

export interface LogToolbarProps {
  selectedService: string;
  onServiceChange: (service: string) => void;
  selectedLevel: string;
  onLevelChange: (level: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  filteredCount: number;
}

export const LogToolbar: React.FC<LogToolbarProps> = ({
  selectedService,
  onServiceChange,
  selectedLevel,
  onLevelChange,
  searchQuery,
  onSearchChange,
  filteredCount,
}) => {
  return (
    <Card padding="sm" className="space-y-3 shadow-card">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-2.5 items-center flex-1">
          {/* Service Selector */}
          <select
            value={selectedService}
            onChange={(e) => onServiceChange(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white text-ink font-semibold shadow-xs hover:border-slate-400 focus:ring-4 focus:ring-primary-500/15 focus:border-primary-600 focus:outline-none cursor-pointer transition-colors"
          >
            <option value="ALL">All Microservices</option>
            <option value="check-printing-backend">Check Printing (Backend)</option>
            <option value="clockInClockOut-backend">ClockIn-ClockOut (Attendance)</option>
            <option value="platform-api">Platform Auth & Gateway</option>
            <option value="stripe-worker">Stripe Webhooks & Billing</option>
            <option value="prisma-database">PostgreSQL / Prisma DB</option>
          </select>

          {/* Severity Selector */}
          <select
            value={selectedLevel}
            onChange={(e) => onLevelChange(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white text-ink font-semibold shadow-xs hover:border-slate-400 focus:ring-4 focus:ring-primary-500/15 focus:border-primary-600 focus:outline-none cursor-pointer transition-colors"
          >
            <option value="ALL">All Severity Levels</option>
            <option value="FATAL">FATAL (P0 Gateway Outages)</option>
            <option value="ERROR">ERROR (HTTP 5xx Server Failures)</option>
            <option value="WARN">WARN (HTTP 4xx / Client Failures)</option>
            <option value="INFO">INFO (Operational Audit Events)</option>
          </select>

          {/* Search Input */}
          <SearchInput
            placeholder="Search trace ID, endpoint, error, tenant..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            containerClassName="w-72"
          />
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-muted">
          <span>Showing <strong className="text-ink font-bold">{filteredCount}</strong> trace events</span>
        </div>
      </div>

      {/* Quick Filter Shortcut Pills */}
      <div className="flex items-center gap-2 pt-1 border-t border-line text-xs">
        <span className="text-[11px] font-bold text-muted uppercase font-mono mr-1">
          Quick Filters:
        </span>

        <button
          type="button"
          onClick={() => {
            onServiceChange('ALL');
            onLevelChange('ALL');
          }}
          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
            selectedService === 'ALL' && selectedLevel === 'ALL'
              ? 'bg-primary-600 text-white shadow-2xs font-bold'
              : 'bg-subtle text-ink-soft hover:bg-line'
          }`}
        >
          All Traces
        </button>

        <button
          type="button"
          onClick={() => onServiceChange('check-printing-backend')}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
            selectedService === 'check-printing-backend'
              ? 'bg-primary-600 text-white shadow-2xs font-bold'
              : 'bg-primary-50 text-primary-700 hover:bg-primary-100 border border-primary-200/60'
          }`}
        >
          <Printer className="size-3" /> Check Printing
        </button>

        <button
          type="button"
          onClick={() => onServiceChange('clockInClockOut-backend')}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
            selectedService === 'clockInClockOut-backend'
              ? 'bg-primary-600 text-white shadow-2xs font-bold'
              : 'bg-blue-50 text-primary-700 hover:bg-blue-100 border border-blue-200/60'
          }`}
        >
          <RefreshCw className="size-3 stroke-[2.4]" /> ClockIn-ClockOut
        </button>

        <button
          type="button"
          onClick={() => onLevelChange('ERROR')}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
            selectedLevel === 'ERROR'
              ? 'bg-rose-600 text-white shadow-2xs font-bold'
              : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/60'
          }`}
        >
          HTTP 5xx Errors
        </button>

        <button
          type="button"
          onClick={() => onServiceChange('stripe-worker')}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
            selectedService === 'stripe-worker'
              ? 'bg-indigo-600 text-white shadow-2xs font-bold'
              : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200/60'
          }`}
        >
          <CreditCard className="size-3" /> Stripe Webhooks
        </button>
      </div>
    </Card>
  );
};
