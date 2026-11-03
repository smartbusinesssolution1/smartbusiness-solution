import React, { useState, useEffect, useCallback } from 'react';
import { Trash2, Download, RefreshCw, Radio } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { TableSkeleton } from '../../components/common/LoadingState';
import { DiagnosticBar } from './DiagnosticBar';
import { LogToolbar } from './LogToolbar';
import { LogTable } from './LogTable';
import { TraceInspectorModal } from './TraceInspectorModal';
import { fetchTelemetryLogs } from '../../api/telemetry.api';
import type { ErrorLogRecord } from '../../types';
import { toast } from 'sonner';

export const TelemetryView: React.FC = () => {
  const [logs, setLogs] = useState<ErrorLogRecord[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [isLoading, setIsLoading] = useState(true);
  const [selectedService, setSelectedService] = useState('ALL');
  const [selectedLevel, setSelectedLevel] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLiveStream, setIsLiveStream] = useState(true);
  const [selectedLog, setSelectedLog] = useState<ErrorLogRecord | null>(null);
  const [isTraceModalOpen, setIsTraceModalOpen] = useState(false);

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetchTelemetryLogs({
        page: currentPage,
        pageSize,
        search: searchQuery.trim() || undefined,
        severity: selectedLevel !== 'ALL' ? selectedLevel : undefined,
        service: selectedService !== 'ALL' ? selectedService : undefined,
      });
      setLogs(res.items);
      setTotalLogs(res.pagination.total);
    } catch {
      toast.error('Failed to load telemetry logs from platform.');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, pageSize, searchQuery, selectedLevel, selectedService]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    setCurrentPage(1);
  };

  const handleServiceChange = (service: string) => {
    setSelectedService(service);
    setCurrentPage(1);
  };

  const handleLevelChange = (level: string) => {
    setSelectedLevel(level);
    setCurrentPage(1);
  };

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
    await loadLogs();
    toast.success('Telemetry event stream refreshed.');
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], {
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
    setTotalLogs(0);
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
            isLoading={isLoading}
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
        onServiceChange={handleServiceChange}
        selectedLevel={selectedLevel}
        onLevelChange={handleLevelChange}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        filteredCount={totalLogs}
      />

      {/* Log Console Table with Server-side Pagination */}
      <div className="bg-panel rounded-2xl border border-line shadow-card overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={pageSize > 10 ? 10 : pageSize} columns={6} />
        ) : (
          <LogTable
            logs={logs}
            total={totalLogs}
            currentPage={currentPage}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            onInspect={handleInspect}
          />
        )}
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
