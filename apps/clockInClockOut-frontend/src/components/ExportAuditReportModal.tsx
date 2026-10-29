import React, { useState } from 'react';
import {
  FileSpreadsheet,
  FileText,
  FileDown,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Filter,
} from 'lucide-react';
import { attendanceService, ExportReportParams } from '../services/attendanceService';
import { clockInApi, CLOCKIN_API_URL } from '../services/apiClient';
import dayjs from 'dayjs';
import { cn } from '../lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  Button,
  Badge,
} from './ui';

export interface ExportAuditReportModalProps {
  open: boolean;
  onClose: () => void;
  currentFilters: {
    search?: string;
    status?: string;
    date?: string;
    workspaceId?: string;
  };
  totalCount: number;
}

type ExportFormat = 'xlsx' | 'csv' | 'pdf';

interface FormatOption {
  id: ExportFormat;
  title: string;
  extension: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  bgLight: string;
  borderClass: string;
  activeBorder: string;
}

const FORMAT_OPTIONS: FormatOption[] = [
  {
    id: 'xlsx',
    title: 'Microsoft Excel',
    extension: '.xlsx',
    description: 'Formatted workbook with headers, auto-width columns, and shift summary statistics.',
    icon: FileSpreadsheet,
    accentColor: 'text-emerald-600',
    bgLight: 'bg-emerald-50/60',
    borderClass: 'border-emerald-200',
    activeBorder: 'border-emerald-500 ring-2 ring-emerald-500/20',
  },
  {
    id: 'csv',
    title: 'Comma Separated Values',
    extension: '.csv',
    description: 'Universal raw tabular dataset with UTF-8 BOM, compatible with Google Sheets & BI tools.',
    icon: FileText,
    accentColor: 'text-blue-600',
    bgLight: 'bg-blue-50/60',
    borderClass: 'border-blue-200',
    activeBorder: 'border-blue-500 ring-2 ring-blue-500/20',
  },
  {
    id: 'pdf',
    title: 'Portable Document Format',
    extension: '.pdf',
    description: 'Executive landscape document styled for printing, corporate compliance, and archiving.',
    icon: FileDown,
    accentColor: 'text-rose-600',
    bgLight: 'bg-rose-50/60',
    borderClass: 'border-rose-200',
    activeBorder: 'border-rose-500 ring-2 ring-rose-500/20',
  },
];

export const ExportAuditReportModal: React.FC<ExportAuditReportModalProps> = ({
  open,
  onClose,
  currentFilters,
  totalCount,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('xlsx');
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ filename: string; totalRecords: number } | null>(null);

  const handleClose = () => {
    if (isExporting) return;
    setError(null);
    setSuccessInfo(null);
    onClose();
  };

  const handleDownload = async () => {
    setError(null);
    setSuccessInfo(null);
    setIsExporting(true);

    try {
      const payload: ExportReportParams = {
        format: selectedFormat,
        search: currentFilters.search || undefined,
        status: currentFilters.status && currentFilters.status !== 'all' ? currentFilters.status : undefined,
        date: currentFilters.date || undefined,
        workspaceId: currentFilters.workspaceId || undefined,
      };

      const result = await attendanceService.exportAuditReport(payload);

      // Trigger automatic file download via blob for direct save dialog
      let fileUrl = result.downloadUrl;
      if (fileUrl.startsWith('/')) {
        fileUrl = `${CLOCKIN_API_URL}${fileUrl}`;
      }

      try {
        const fileResponse = await clockInApi.get(result.downloadUrl, { responseType: 'blob' });
        const blobUrl = window.URL.createObjectURL(new Blob([fileResponse.data]));
        const link = document.createElement('a');
        link.href = blobUrl;
        link.setAttribute('download', result.filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => window.URL.revokeObjectURL(blobUrl), 2000);
      } catch {
        const link = document.createElement('a');
        link.href = fileUrl;
        link.setAttribute('download', result.filename);
        link.setAttribute('target', '_blank');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      setSuccessInfo({
        filename: result.filename,
        totalRecords: result.totalRecords,
      });

      // Auto-close after brief confirmation
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (err: any) {
      console.error('Export report error:', err);
      setError(err?.response?.data?.error?.message || err?.message || 'Failed to generate report file.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-lg p-0">
        <DialogHeader
          title="Export Audit Ledger"
          description="Download filtered attendance records for corporate payroll, audits, and compliance."
          icon={<Download className="size-4 text-primary-600" />}
        />

        <div className="flex flex-col gap-4 px-6 py-3">
          {/* Active Scope Summary Banner */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-line bg-subtle/70 p-3 text-xs">
            <span className="font-mono text-[0.6875rem] font-medium uppercase tracking-wider text-muted flex items-center gap-1">
              <Filter className="size-3 text-faint" /> Scope:
            </span>
            <Badge variant="brand" className="font-mono text-[0.6875rem]">
              {totalCount} matching logs
            </Badge>
            {currentFilters.status && currentFilters.status !== 'all' && (
              <Badge variant="outline" className="font-mono text-[0.6875rem] uppercase">
                Status: {currentFilters.status}
              </Badge>
            )}
            {currentFilters.date && (
              <Badge variant="outline" className="font-mono text-[0.6875rem]">
                Date: {dayjs(currentFilters.date).isValid() ? dayjs(currentFilters.date).format('DD MMM YYYY') : currentFilters.date}
              </Badge>
            )}
            {currentFilters.search && (
              <Badge variant="outline" className="font-mono text-[0.6875rem] max-w-[150px] truncate">
                Search: &quot;{currentFilters.search}&quot;
              </Badge>
            )}
          </div>

          {/* Feedback Alerts */}
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/70 p-3 text-xs text-rose-700">
              <AlertCircle className="size-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {successInfo && (
            <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-700">
              <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-emerald-600" />
              <div>
                <p className="font-semibold">Report generated successfully ({successInfo.totalRecords} records).</p>
                <p className="text-emerald-600/80">Downloading file {successInfo.filename}...</p>
              </div>
            </div>
          )}

          {/* File Format Selection Cards */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-ink">Choose Output Format</span>
            {FORMAT_OPTIONS.map((opt) => {
              const isSelected = selectedFormat === opt.id;
              const Icon = opt.icon;
              return (
                <button
                  type="button"
                  key={opt.id}
                  disabled={isExporting}
                  onClick={() => setSelectedFormat(opt.id)}
                  className={cn(
                    'group relative flex w-full items-center gap-3.5 rounded-xl border p-3.5 text-left transition-all duration-150',
                    isSelected
                      ? `${opt.activeBorder} ${opt.bgLight}`
                      : 'border-line bg-canvas hover:border-line-strong hover:bg-subtle/50',
                    isExporting && 'pointer-events-none opacity-60'
                  )}
                >
                  {/* Radio ring */}
                  <div
                    className={cn(
                      'flex size-4 shrink-0 items-center justify-center rounded-full border transition-all',
                      isSelected ? 'border-primary-600 bg-primary-600' : 'border-line-strong bg-canvas'
                    )}
                  >
                    {isSelected && <span className="size-1.5 rounded-full bg-white" />}
                  </div>

                  {/* Icon box */}
                  <div
                    className={cn(
                      'flex size-10 shrink-0 items-center justify-center rounded-lg border bg-white shadow-xs',
                      opt.borderClass
                    )}
                  >
                    <Icon className={cn('size-5', opt.accentColor)} />
                  </div>

                  {/* Description */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-ink">{opt.title}</span>
                      <span
                        className={cn(
                          'rounded-md border px-1.5 py-0.5 font-mono text-[0.625rem] font-semibold bg-white',
                          opt.borderClass,
                          opt.accentColor
                        )}
                      >
                        {opt.extension}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[0.6875rem] leading-relaxed text-muted">{opt.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <DialogFooter className="mt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClose}
            disabled={isExporting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="brand"
            size="sm"
            onClick={handleDownload}
            disabled={isExporting}
            className="gap-2"
          >
            {isExporting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Generating {selectedFormat.toUpperCase()}...</span>
              </>
            ) : (
              <>
                <Download className="size-3.5" />
                <span>Download {selectedFormat.toUpperCase()}</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ExportAuditReportModal;
