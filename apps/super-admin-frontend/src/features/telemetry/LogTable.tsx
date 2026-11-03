import React from 'react';
import { formatDateTime } from '../../utils/formatDate';
import { copyToClipboard } from '../../utils/copyToClipboard';
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
  onInspect: (log: ErrorLogRecord) => void;
}

export const LogTable: React.FC<LogTableProps> = ({ logs, onInspect }) => {
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
      case 'face-recognition':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-primary-700 border border-blue-200">
            <RefreshCw className="size-3 stroke-[2.4] text-primary-600" />
            ClockIn-ClockOut
          </span>
        );
      case 'stripe-worker':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <CreditCard className="size-3 text-indigo-700" />
            Stripe Worker
          </span>
        );
      case 'prisma-database':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Database className="size-3 text-emerald-700" />
            Prisma Pool
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <ShieldCheck className="size-3 text-slate-700" />
            Platform API
          </span>
        );
    }
  };

  const handleCopyTrace = async (e: React.MouseEvent, traceId: string) => {
    e.stopPropagation();
    const ok = await copyToClipboard(traceId);
    if (ok) toast.success(`Trace ID ${traceId} copied to clipboard.`);
  };

  if (logs.length === 0) {
    return (
      <div className="py-16 text-center text-muted font-sans">
        <Terminal className="size-8 mx-auto text-slate-400 mb-2" />
        <p className="text-sm font-semibold text-ink">No error log events match your filters.</p>
        <p className="text-xs text-muted mt-1">Try broadening your service or severity criteria.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto max-h-[560px]">
      <table className="w-full text-left border-collapse text-xs">
        <thead className="sticky top-0 bg-subtle/80 backdrop-blur-xs border-b border-line text-muted uppercase text-[11px] font-bold font-mono tracking-wider z-10">
          <tr>
            <th className="py-3 px-4">Timestamp (UTC)</th>
            <th className="py-3 px-4">Severity / Code</th>
            <th className="py-3 px-4">Microservice</th>
            <th className="py-3 px-4">Endpoint / Action</th>
            <th className="py-3 px-4">Tenant Organization</th>
            <th className="py-3 px-4">Exception Message</th>
            <th className="py-3 px-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {logs.map((log) => (
            <tr
              key={log.traceId}
              onClick={() => onInspect(log)}
              className="hover:bg-subtle/60 transition group cursor-pointer"
            >
              {/* Timestamp & Trace ID */}
              <td className="py-3.5 px-4 whitespace-nowrap">
                <div className="text-ink font-bold font-mono">{formatDateTime(log.timestamp)}</div>
                <div className="flex items-center gap-1.5 text-[10px] text-muted font-mono mt-0.5">
                  <span className="truncate max-w-[100px]">{log.traceId}</span>
                  <button
                    type="button"
                    onClick={(e) => handleCopyTrace(e, log.traceId)}
                    className="hover:text-ink transition"
                    title="Copy Trace ID"
                  >
                    <Copy className="size-2.5" />
                  </button>
                </div>
              </td>

              {/* Severity & Status */}
              <td className="py-3.5 px-4 whitespace-nowrap">
                {getSeverityBadge(log.severity, log.httpStatus)}
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
  );
};
