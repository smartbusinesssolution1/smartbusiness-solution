import React, { useState, useEffect } from 'react';
import { Trash2, Download, RefreshCw, Radio } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { DiagnosticBar } from './DiagnosticBar';
import { LogToolbar } from './LogToolbar';
import { LogTable } from './LogTable';
import { TraceInspectorModal } from './TraceInspectorModal';
import { fetchTelemetryLogs, MOCK_ERROR_LOGS } from '../../api/telemetry.api';
import type { ErrorLogRecord } from '../../types';
import { toast } from 'sonner';

export const TelemetryView: React.FC = () => {
  const [logs, setLogs] = useState<ErrorLogRecord[]>(MOCK_ERROR_LOGS);
  const [selectedService, setSelectedService] = useState('ALL');
  const [selectedLevel, setSelectedLevel] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLiveStream, setIsLiveStream] = useState(true);
  const [selectedLog, setSelectedLog] = useState<ErrorLogRecord | null>(null);
  const [isTraceModalOpen, setIsTraceModalOpen] = useState(false);

  useEffect(() => {
    fetchTelemetryLogs().then(setLogs);
  }, []);

  const filteredLogs = logs.filter((log) => {
    const matchService = selectedService === 'ALL' || log.service === selectedService;
    const matchLevel = selectedLevel === 'ALL' || log.severity === selectedLevel;

    const q = searchQuery.toLowerCase();
    const matchQuery =
      !q ||
      log.traceId.toLowerCase().includes(q) ||
      log.message.toLowerCase().includes(q) ||
      (log.tenantName && log.tenantName.toLowerCase().includes(q)) ||
      (log.tenantId && log.tenantId.toLowerCase().includes(q)) ||
      log.endpoint.toLowerCase().includes(q);

    return matchService && matchLevel && matchQuery;
  });

  const toggleLiveStream = () => {
    setIsLiveStream((prev) => {
      const next = !prev;
      if (next) {
        toast.success('Live error telemetry streaming resumed.');
      } else {
        toast.info('Live error telemetry streaming paused.');
      }
      return next;
    });
  };

  const handleRefresh = async () => {
    const updated = await fetchTelemetryLogs();
    setLogs(updated);
    toast.success('Telemetry event stream refreshed.');
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(filteredLogs, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `error-logs-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Filtered error log events exported as JSON.');
  };

  const clearLogs = () => {
    setLogs([]);
    toast.success('Developer error logs view cleared.');
  };

  const handleInspect = (log: ErrorLogRecord) => {
    setSelectedLog(log);
    setIsTraceModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Title Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-ink tracking-tight">
              Developer Error Logs & Diagnostics
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
              <span className="size-1.5 rounded-full bg-rose-500 animate-pulse" />
              Developer Debug Mode
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted">
            Live exception tracer, HTTP 5xx stack traces, and microservice telemetry across Check Printing and ClockIn-ClockOut.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant={isLiveStream ? 'primary' : 'secondary'}
            size="sm"
            onClick={toggleLiveStream}
            className={isLiveStream ? 'bg-emerald-600 hover:bg-emerald-700 shadow-button' : ''}
          >
            <Radio className="size-3.5 mr-1" />
            Live Stream: {isLiveStream ? 'ACTIVE' : 'PAUSED'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            icon={<RefreshCw className="size-3.5 text-muted" />}
          >
            Refresh
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportJson}
            icon={<Download className="size-3.5 text-muted" />}
          >
            Export JSON
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={clearLogs}
            icon={<Trash2 className="size-3.5 text-muted" />}
          >
            Clear
          </Button>
        </div>
      </div>

      {/* Top Diagnostic Health Metrics */}
      <DiagnosticBar />

      {/* Filter and Search Toolbar */}
      <LogToolbar
        selectedService={selectedService}
        onServiceChange={setSelectedService}
        selectedLevel={selectedLevel}
        onLevelChange={setSelectedLevel}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filteredCount={filteredLogs.length}
      />

      {/* Log Console Table */}
      <div className="bg-panel rounded-2xl border border-line shadow-card overflow-hidden">
        <LogTable logs={filteredLogs} onInspect={handleInspect} />
      </div>

      {/* Trace Inspector Modal */}
      <TraceInspectorModal
        log={selectedLog}
        isOpen={isTraceModalOpen}
        onClose={() => setIsTraceModalOpen(false)}
      />
    </div>
  );
};
