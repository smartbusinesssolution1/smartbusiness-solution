import React from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Copy, Terminal } from 'lucide-react';
import { copyToClipboard } from '../../utils/copyToClipboard';
import type { ErrorLogRecord } from '../../types';
import { toast } from 'sonner';

export interface TraceInspectorModalProps {
  log: ErrorLogRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

export const TraceInspectorModal: React.FC<TraceInspectorModalProps> = ({
  log,
  isOpen,
  onClose,
}) => {
  if (!log) return null;

  const handleCopyTraceId = async () => {
    const ok = await copyToClipboard(log.traceId);
    if (ok) toast.success(`Trace ID ${log.traceId} copied to clipboard.`);
  };

  const handleCopyStack = async () => {
    if (!log.stackTrace) return;
    const ok = await copyToClipboard(log.stackTrace);
    if (ok) toast.success('Stack trace copied to clipboard.');
  };

  const handleCopyCurl = async () => {
    const method = log.endpoint.split(' ')[0] || 'POST';
    const path = log.endpoint.split(' ')[1] || log.endpoint;
    const curlCommand = `curl -X ${method} "https://api.smartbusiness.us${path}" \\
  -H "Content-Type: application/json" \\
  -H "X-Trace-Id: ${log.traceId}" \\
  -H "X-Tenant-Id: ${log.tenantId ?? ''}" \\
  -d '${JSON.stringify(log.payload ?? {}, null, 2)}'`;

    const success = await copyToClipboard(curlCommand);
    if (success) toast.success('Reproduce cURL command copied to clipboard!');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Trace Inspector: ${log.traceId}`}
      subtitle={`Origin Microservice: ${log.service}`}
      maxWidth="3xl"
      footer={
        <div className="w-full flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyCurl}
            icon={<Copy className="size-3.5 text-muted" />}
          >
            Copy as cURL
          </Button>

          <Button variant="primary" size="sm" onClick={onClose}>
            Dismiss Inspector
          </Button>
        </div>
      }
    >
      <div className="space-y-4 font-mono text-xs">
        {/* Error Overview Box */}
        <div className="p-4 bg-rose-50/70 border border-rose-200/90 rounded-xl space-y-2.5 text-rose-950">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rose-200/80 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300">
                {log.severity} {log.httpStatus ? `HTTP ${log.httpStatus}` : ''}
              </span>
              <span className="text-ink font-bold">{log.endpoint}</span>
            </div>

            <button
              type="button"
              onClick={handleCopyTraceId}
              className="text-[11px] text-primary-700 hover:text-primary-800 font-bold flex items-center gap-1 transition cursor-pointer"
            >
              <Copy className="size-3" /> Copy Trace ID
            </button>
          </div>

          <div className="text-rose-900 font-sans text-xs font-semibold leading-relaxed">
            {log.message}
          </div>
        </div>

        {/* Stack Trace */}
        {log.stackTrace && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-muted uppercase font-bold flex items-center gap-1.5">
                <Terminal className="size-3 text-muted" />
                Exception Stack Trace
              </span>
              <button
                type="button"
                onClick={handleCopyStack}
                className="text-[11px] text-primary-700 hover:text-primary-800 font-bold flex items-center gap-1 transition cursor-pointer"
              >
                <Copy className="size-3" /> Copy Stack Trace
              </button>
            </div>
            <pre className="p-3.5 bg-canvas border border-line rounded-xl text-ink-soft overflow-x-auto text-[11px] leading-relaxed max-h-48 font-mono">
              {log.stackTrace}
            </pre>
          </div>
        )}

        {/* Request Payload JSON */}
        {log.payload && (
          <div>
            <span className="text-[11px] text-muted uppercase font-bold block mb-1.5">
              Request Parameters & Payload
            </span>
            <pre className="p-3 bg-canvas border border-line rounded-xl text-ink-soft overflow-x-auto text-[11px] leading-relaxed max-h-36 font-mono">
              {JSON.stringify(log.payload, null, 2)}
            </pre>
          </div>
        )}

        {/* Tenant & User Context Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-ink">
          <div className="p-3 bg-canvas rounded-xl border border-line space-y-1">
            <span className="text-[10px] text-muted uppercase font-bold block">
              Tenant Organization Scope
            </span>
            <div className="text-xs font-bold text-ink">
              {log.tenantName ?? 'Global Platform Scope'}
            </div>
            <div className="text-[11px] text-muted font-mono">
              Tenant ID: {log.tenantId ?? 'N/A'}
            </div>
          </div>

          <div className="p-3 bg-canvas rounded-xl border border-line space-y-1">
            <span className="text-[10px] text-muted uppercase font-bold block">
              User Identity Context
            </span>
            <div className="text-xs font-bold text-ink">
              {log.userEmail ?? 'Unauthenticated / System Worker'}
            </div>
            <div className="text-[11px] text-muted font-mono">
              User ID: {log.userId ?? 'None'}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
