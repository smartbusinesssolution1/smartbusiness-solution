import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Download,
  Calendar,
  FileSpreadsheet,
  Building2,
  Clock,
  CheckCircle2,
  Loader2,
  DollarSign,
  AlertCircle,
  Filter,
  Search,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  Button,
  Input,
  Label,
  Badge,
} from '../ui';
import { leaveService, PayrollExportResult } from '../../services/leave.service';
import { notify } from '../../context/NotificationContext';
import dayjs from 'dayjs';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
}

export const PayrollExportModal: React.FC<Props> = ({
  open,
  onOpenChange,
  workspaceId,
}) => {
  // Default to current month or past 14 days
  const [startDate, setStartDate] = useState<string>(
    dayjs().startOf('month').format('YYYY-MM-DD')
  );
  const [endDate, setEndDate] = useState<string>(
    dayjs().endOf('month').format('YYYY-MM-DD')
  );
  const [department, setDepartment] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Departments
  const { data: departments = [] } = useQuery({
    queryKey: ['leaveDepartments', workspaceId],
    queryFn: () => leaveService.listDepartments(workspaceId),
    enabled: Boolean(open && workspaceId),
  });

  // Query preview data
  const {
    data: previewData,
    isLoading: isPreviewLoading,
    refetch,
  } = useQuery({
    queryKey: ['payrollExportPreview', workspaceId, startDate, endDate, department],
    queryFn: () =>
      leaveService.getPayrollExport(startDate, endDate, workspaceId, department),
    enabled: Boolean(open && workspaceId && startDate && endDate),
  });

  // Filtered rows for client search
  const filteredRows = useMemo(() => {
    if (!previewData?.rows) return [];
    if (!searchQuery.trim()) return previewData.rows;
    const q = searchQuery.toLowerCase();
    return previewData.rows.filter(
      (r) =>
        r.fullName.toLowerCase().includes(q) ||
        r.employeeCode.toLowerCase().includes(q) ||
        r.department.toLowerCase().includes(q)
    );
  }, [previewData, searchQuery]);

  // Column totals calculation
  const tableTotals = useMemo(() => {
    if (!filteredRows.length) return null;
    return filteredRows.reduce(
      (acc, r) => ({
        regular: acc.regular + r.regularHours,
        overtime: acc.overtime + r.overtimeHours,
        vacation: acc.vacation + r.vacationHours,
        sick: acc.sick + r.sickHours,
        pto: acc.pto + r.ptoHours,
        other: acc.other + r.otherPaidHours,
        totalPaid: acc.totalPaid + r.totalPaidHours,
        unpaid: acc.unpaid + r.unpaidHours,
      }),
      { regular: 0, overtime: 0, vacation: 0, sick: 0, pto: 0, other: 0, totalPaid: 0, unpaid: 0 }
    );
  }, [filteredRows]);

  const handleDownloadCsv = async () => {
    setIsExporting(true);
    try {
      await leaveService.downloadPayrollCsv(
        startDate,
        endDate,
        workspaceId,
        department
      );
      notify('Hours export CSV downloaded successfully!', 'success');
    } catch (err: any) {
      notify(err.response?.data?.message || 'Failed to download hours CSV', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const currentPreset = useMemo(() => {
    const curMonthStart = dayjs().startOf('month').format('YYYY-MM-DD');
    const curMonthEnd = dayjs().endOf('month').format('YYYY-MM-DD');
    if (startDate === curMonthStart && endDate === curMonthEnd) return 'current_month';

    const priorMonthStart = dayjs().subtract(1, 'month').startOf('month').format('YYYY-MM-DD');
    const priorMonthEnd = dayjs().subtract(1, 'month').endOf('month').format('YYYY-MM-DD');
    if (startDate === priorMonthStart && endDate === priorMonthEnd) return 'prior_month';

    const biweeklyStart = dayjs().subtract(13, 'day').format('YYYY-MM-DD');
    const today = dayjs().format('YYYY-MM-DD');
    if (startDate === biweeklyStart && endDate === today) return 'biweekly';

    return 'custom';
  }, [startDate, endDate]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col p-0 overflow-hidden bg-panel border-line shadow-2xl rounded-2xl">
        {/* Header */}
        <div className="px-6 py-5 border-b border-line bg-subtle/40 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="size-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-xs">
              <FileSpreadsheet className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-ink tracking-tight">
                  Timecard & Leave Hours Export
                </h2>
                <Badge variant="outline" className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/5">
                  CSV Spreadsheet
                </Badge>
              </div>
              <p className="text-xs text-muted mt-0.5">
                Export aggregate employee hours: worked regular time, daily overtime, and leave categories
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted bg-panel px-3 py-1.5 rounded-lg border border-line">
            <ShieldCheck className="size-3.5 text-emerald-500" />
            <span>Time & Attendance Ledger</span>
          </div>
        </div>

        {/* Body */}
        <DialogBody className="p-6 overflow-y-auto space-y-5">
          {/* Filter Configuration Card */}
          <div className="p-4 rounded-xl border border-line bg-subtle/30 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Filter className="size-4 text-primary-600 dark:text-primary-400" />
                <span className="text-xs font-semibold text-ink">Pay Period & Department Parameters</span>
              </div>

              {/* Quick Preset Chips */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-muted mr-1">Presets:</span>
                <button
                  type="button"
                  onClick={() => {
                    setStartDate(dayjs().startOf('month').format('YYYY-MM-DD'));
                    setEndDate(dayjs().endOf('month').format('YYYY-MM-DD'));
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                    currentPreset === 'current_month'
                      ? 'bg-primary-600 text-white shadow-xs'
                      : 'bg-panel border border-line text-ink-soft hover:bg-subtle hover:text-ink'
                  }`}
                >
                  Current Month
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStartDate(dayjs().subtract(1, 'month').startOf('month').format('YYYY-MM-DD'));
                    setEndDate(dayjs().subtract(1, 'month').endOf('month').format('YYYY-MM-DD'));
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                    currentPreset === 'prior_month'
                      ? 'bg-primary-600 text-white shadow-xs'
                      : 'bg-panel border border-line text-ink-soft hover:bg-subtle hover:text-ink'
                  }`}
                >
                  Prior Month
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStartDate(dayjs().subtract(13, 'day').format('YYYY-MM-DD'));
                    setEndDate(dayjs().format('YYYY-MM-DD'));
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                    currentPreset === 'biweekly'
                      ? 'bg-primary-600 text-white shadow-xs'
                      : 'bg-panel border border-line text-ink-soft hover:bg-subtle hover:text-ink'
                  }`}
                >
                  Last 14 Days (Biweekly)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-medium text-ink-soft">Pay Period Start</Label>
                <div className="relative mt-1">
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium text-ink-soft">Pay Period End</Label>
                <div className="relative mt-1">
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium text-ink-soft">Department Scope</Label>
                <div className="relative mt-1">
                  <select
                    className="w-full h-9 px-3 text-xs bg-panel border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 text-ink appearance-none pr-8 cursor-pointer"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                  >
                    <option value="ALL">All Departments (Entire Company)</option>
                    {departments.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted">
                    <Building2 className="size-3.5" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* KPI Summary Cards */}
          {previewData && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-xl border border-line bg-panel shadow-xs relative overflow-hidden group">
                <div className="flex items-center justify-between text-muted">
                  <span className="text-[11px] font-semibold uppercase tracking-wider">Regular Hours</span>
                  <Clock className="size-4 text-primary-500" />
                </div>
                <div className="text-2xl font-bold text-ink mt-1.5 tabular-nums">
                  {previewData.summary.totalRegularHours.toFixed(1)}
                  <span className="text-xs font-normal text-muted ml-1">hrs</span>
                </div>
                <div className="text-[11px] text-muted mt-1">Standard shift time (≤8h/day)</div>
              </div>

              <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 shadow-xs relative overflow-hidden">
                <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
                  <span className="text-[11px] font-semibold uppercase tracking-wider">Overtime (1.5x)</span>
                  <AlertCircle className="size-4" />
                </div>
                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1.5 tabular-nums">
                  {previewData.summary.totalOvertimeHours.toFixed(1)}
                  <span className="text-xs font-normal opacity-75 ml-1">hrs</span>
                </div>
                <div className="text-[11px] text-muted mt-1">Daily (&gt;8h) & weekly (&gt;40h)</div>
              </div>

              <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 shadow-xs relative overflow-hidden">
                <div className="flex items-center justify-between text-blue-600 dark:text-blue-400">
                  <span className="text-[11px] font-semibold uppercase tracking-wider">Paid Leave Hours</span>
                  <Calendar className="size-4" />
                </div>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1.5 tabular-nums">
                  {previewData.summary.totalPaidLeaveHours.toFixed(1)}
                  <span className="text-xs font-normal opacity-75 ml-1">hrs</span>
                </div>
                <div className="text-[11px] text-muted mt-1">PTO, Sick Leave & Vacation</div>
              </div>

              <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 shadow-xs relative overflow-hidden">
                <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                  <span className="text-[11px] font-semibold uppercase tracking-wider">Total Recorded Hours</span>
                  <CheckCircle2 className="size-4" />
                </div>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1.5 tabular-nums">
                  {previewData.summary.totalPaidHours.toFixed(1)}
                  <span className="text-xs font-normal opacity-75 ml-1">hrs</span>
                </div>
                <div className="text-[11px] text-muted mt-1">Across {previewData.summary.totalEmployees} active staff</div>
              </div>
            </div>
          )}

          {/* Interactive Preview Table Card */}
          <div className="rounded-xl border border-line overflow-hidden bg-panel shadow-xs">
            {/* Table Action Toolbar */}
            <div className="px-4 py-3 border-b border-line bg-subtle/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-ink">
                  Ledger Breakdown Preview
                </span>
                <span className="text-[11px] text-muted">
                  ({startDate} to {endDate})
                </span>
                <Badge variant="outline" className="text-[11px] ml-1">
                  {filteredRows.length} {filteredRows.length === 1 ? 'employee' : 'employees'}
                </Badge>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted pointer-events-none" />
                <Input
                  type="text"
                  placeholder="Filter by name, ID, or dept..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-xs bg-panel"
                />
              </div>
            </div>

            {isPreviewLoading ? (
              <div className="py-14 flex flex-col items-center justify-center gap-2.5 text-muted">
                <Loader2 className="size-6 animate-spin text-primary-600" />
                <span className="text-xs">Computing payroll records & leave balances...</span>
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="py-14 text-center text-xs text-muted">
                No active employee attendance or leave records found for this period.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-subtle/70 text-ink-soft font-semibold border-b border-line sticky top-0 z-10 backdrop-blur-xs">
                    <tr>
                      <th className="py-2.5 px-4 font-medium">Employee</th>
                      <th className="py-2.5 px-3 font-medium">Department</th>
                      <th className="py-2.5 px-3 text-right font-medium">Regular</th>
                      <th className="py-2.5 px-3 text-right font-medium">Overtime</th>
                      <th className="py-2.5 px-3 text-right font-medium">Vacation</th>
                      <th className="py-2.5 px-3 text-right font-medium">Sick Leave</th>
                      <th className="py-2.5 px-3 text-right font-medium">PTO</th>
                      <th className="py-2.5 px-3 text-right font-medium">Other Paid</th>
                      <th className="py-2.5 px-4 text-right font-semibold text-ink">Total Hours</th>
                      <th className="py-2.5 px-3 text-right font-medium text-muted">Unpaid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {filteredRows.map((row) => (
                      <tr key={row.employeeId} className="hover:bg-subtle/40 transition-colors">
                        <td className="py-2.5 px-4">
                          <div className="font-medium text-ink">{row.fullName}</div>
                          <div className="text-[11px] font-mono text-muted">{row.employeeCode}</div>
                        </td>
                        <td className="py-2.5 px-3 text-muted">
                          <span className="inline-block px-2 py-0.5 rounded-md bg-subtle text-[11px]">
                            {row.department}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-ink">
                          {row.regularHours.toFixed(1)}h
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          {row.overtimeHours > 0 ? (
                            <span className="text-amber-600 dark:text-amber-400 font-medium">
                              {row.overtimeHours.toFixed(1)}h
                            </span>
                          ) : (
                            <span className="text-muted/60">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          {row.vacationHours > 0 ? (
                            <span className="text-blue-600 dark:text-blue-400">
                              {row.vacationHours.toFixed(1)}h
                            </span>
                          ) : (
                            <span className="text-muted/60">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          {row.sickHours > 0 ? (
                            <span className="text-purple-600 dark:text-purple-400">
                              {row.sickHours.toFixed(1)}h
                            </span>
                          ) : (
                            <span className="text-muted/60">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          {row.ptoHours > 0 ? (
                            <span className="text-indigo-600 dark:text-indigo-400">
                              {row.ptoHours.toFixed(1)}h
                            </span>
                          ) : (
                            <span className="text-muted/60">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-muted">
                          {row.otherPaidHours > 0 ? `${row.otherPaidHours.toFixed(1)}h` : '-'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-ink">
                          {row.totalPaidHours.toFixed(1)}h
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-muted">
                          {row.unpaidHours > 0 ? `${row.unpaidHours.toFixed(1)}h` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>

                  {tableTotals && (
                    <tfoot className="bg-subtle/80 font-semibold border-t-2 border-line text-ink sticky bottom-0 z-10 backdrop-blur-xs">
                      <tr>
                        <td colSpan={2} className="py-2.5 px-4 text-xs">
                          TOTAL ({filteredRows.length} STAFF)
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          {tableTotals.regular.toFixed(1)}h
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-amber-600 dark:text-amber-400">
                          {tableTotals.overtime.toFixed(1)}h
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-blue-600 dark:text-blue-400">
                          {tableTotals.vacation.toFixed(1)}h
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-purple-600 dark:text-purple-400">
                          {tableTotals.sick.toFixed(1)}h
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-indigo-600 dark:text-indigo-400">
                          {tableTotals.pto.toFixed(1)}h
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-muted">
                          {tableTotals.other.toFixed(1)}h
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                          {tableTotals.totalPaid.toFixed(1)}h
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-muted">
                          {tableTotals.unpaid.toFixed(1)}h
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        </DialogBody>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t border-line bg-subtle/20 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-muted">
            <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
            <span>Exports individual employee worked hours, overtime, and leave hours</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button
              variant="brand"
              size="sm"
              onClick={handleDownloadCsv}
              disabled={isExporting || isPreviewLoading || !previewData?.rows.length}
              className="shadow-theme-btn"
            >
              {isExporting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  Generating CSV...
                </>
              ) : (
                <>
                  <Download className="size-3.5 mr-1.5" />
                  Download Hours CSV
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
