import React from 'react';
import { formatDateTime } from '../../utils/formatDate';
import { copyToClipboard } from '../../utils/copyToClipboard';
import { Pagination } from '../../components/common/Pagination';
import {
  Printer,
  RefreshCw,
  CreditCard,
  ShieldCheck,
  Database,
  ExternalLink,
  Copy,
  Terminal,
} from 'lucide-react';
import type { ErrorLogRecord, LogSeverity } from '../../types';
import { toast } from 'sonner';

export interface LogTableProps {
  logs: ErrorLogRecord[];
  total?: number;
  currentPage?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  onInspect: (log: ErrorLogRecord) => void;
}

export const LogTable: React.FC<LogTableProps> = ({
  logs,
  total,
  currentPage = 1,
  pageSize = 10,
  onPageChange,
  onPageSizeChange,
  onInspect,
}) => {
  const getSeverityBadge = (severity: LogSeverity, httpStatus?: number) => {
    switch (severity) {
      case 'FATAL':
        return (
          <span className="inline-flex items-center gap-1 font-mono font-bold text-[10px] px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300">
            FATAL {httpStatus ? `[${httpStatus}]` : ''}
          </span>
        );
      case 'ERROR':
        return (
          <span className="inline-flex items-center gap-1 font-mono font-bold text-[10px] px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
            ERROR {httpStatus ? `[${httpStatus}]` : ''}
          </span>
        );
      case 'WARN':
        return (
          <span className="inline-flex items-center gap-1 font-mono font-bold text-[10px] px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
            WARN {httpStatus ? `[${httpStatus}]` : ''}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 font-mono font-bold text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
            INFO {httpStatus ? `[${httpStatus}]` : ''}
          </span>
        );
    }
  };

  const renderServiceBadge = (service: string) => {
    switch (service) {
      case 'check-printing-backend':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-primary-50 text-primary-700 border border-primary-200">
            <Printer className="size-3 text-primary-700" />
            Check Printing
          </span>
        );
      case 'clockInClockOut-backend':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <RefreshCw className="size-3 text-indigo-700" />
            Clock-In Backend
          </span>
        );
      case 'platform-api':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <ShieldCheck className="size-3 text-purple-700" />
            Platform API
          </span>
        );
      case 'prisma-database':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <Database className="size-3 text-amber-800" />
            Prisma Engine
          </span>
        );
      case 'stripe-billing':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CreditCard className="size-3 text-emerald-700" />
            Stripe Webhooks
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-subtle text-ink-soft border border-line">
            <Terminal className="size-3" />
            {service}
          </span>
        );
    }
  };

  const handleCopyTraceId = (e: React.MouseEvent, traceId: string) => {
    e.stopPropagation();
    copyToClipboard(traceId);
    toast.success(`Trace ID copied: ${traceId}`);
  };

  if (logs.length === 0) {
    return (
      <div className="py-16 text-center text-muted">
        <Terminal className="size-8 mx-auto mb-2 text-slate-300" />
        <h3 className="font-bold text-xs text-ink mb-1">No log events recorded</h3>
        <p className="text-xs text-muted max-w-sm mx-auto">
          No platform error logs match your query parameters. Try widening your severity level or clearing filters.
        </p>
      </div>
    );
  }

  const effectiveTotal = total ?? logs.length;

  return (
    <div className="flex flex-col">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-subtle/70 border-b border-line text-muted uppercase tracking-wider font-bold text-[11px] font-mono select-none">
              <th className="py-3 px-4">Severity & Timestamp</th>
              <th className="py-3 px-4">Trace ID</th>
              <th className="py-3 px-4">Microservice</th>
              <th className="py-3 px-4">Endpoint</th>
              <th className="py-3 px-4">Tenant / User</th>
              <th className="py-3 px-4">Error Message</th>
              <th className="py-3 px-4 text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {logs.map((log) => (
              <tr
                key={log.traceId}
                onClick={() => onInspect(log)}
                className="hover:bg-primary-50/20 transition-colors group cursor-pointer"
              >
                {/* Severity & Time */}
                <td className="py-3.5 px-4 whitespace-nowrap">
                  <div className="flex flex-col gap-1 items-start">
                    {getSeverityBadge(log.severity, log.httpStatus)}
                    <span className="font-mono text-[10px] text-muted">
                      {formatDateTime(log.timestamp)}
                    </span>
                  </div>
                </td>

                {/* Trace ID */}
                <td className="py-3.5 px-4 whitespace-nowrap font-mono">
                  <button
                    type="button"
                    onClick={(e) => handleCopyTraceId(e, log.traceId)}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-panel hover:bg-subtle border border-line text-ink-soft hover:text-primary-600 transition group/trace"
                    title="Copy Trace ID"
                  >
                    <span className="font-bold text-[11px]">{log.traceId}</span>
                    <Copy className="size-3 text-muted group-hover/trace:text-primary-600" />
                  </button>
                </td>

                {/* Service */}
                <td className="py-3.5 px-4 whitespace-nowrap">
                  {renderServiceBadge(log.service)}
                </td>

                {/* Endpoint */}
                <td className="py-3.5 px-4 whitespace-nowrap">
                  <span className="font-mono text-ink-soft bg-subtle px-2 py-0.5 rounded border border-line text-[11px] font-semibold">
                    {log.endpoint}
                  </span>
                </td>

                {/* Tenant */}
                <td className="py-3.5 px-4">
                  <div className="text-ink font-bold truncate max-w-[160px]">
                    {log.tenantName ?? log.tenantId ?? 'Global Platform'}
                  </div>
                  {log.userEmail && (
                    <div className="text-[11px] text-muted truncate max-w-[160px] font-mono">
                      {log.userEmail}
                    </div>
                  )}
                </td>

                {/* Message */}
                <td className="py-3.5 px-4">
                  <div className="text-ink-soft font-sans text-xs truncate max-w-sm group-hover:text-ink transition">
                    {log.message}
                  </div>
                </td>

                {/* Actions */}
                <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => onInspect(log)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-subtle text-ink-soft hover:text-ink font-semibold text-xs transition border border-slate-300 shadow-xs hover:border-slate-400 cursor-pointer"
                  >
                    <ExternalLink className="size-3" /> Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {effectiveTotal > 0 && onPageChange && (
        <Pagination
          currentPage={currentPage}
          totalItems={effectiveTotal}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </div>
  );
};
