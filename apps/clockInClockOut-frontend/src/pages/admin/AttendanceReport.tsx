import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  Clock,
  Search,
  RotateCcw,
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Filter,
  FileText,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Eye,
  X,
  Radio,
  Sparkles,
} from 'lucide-react';
import dayjs from 'dayjs';

import { attendanceService } from '../../services/attendanceService';
import { ExportAuditReportModal } from '../../components/ExportAuditReportModal';
import { AttendanceAuditDrawer } from '../../components/AttendanceAuditDrawer';
import { AttendanceRecord } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { getAvatarUrl } from '../../utils/imageUrl';
import { useDebounce } from '../../hooks/useDebounce';
import { cn } from '../../lib/utils';
import {
  Button,
  Card,
  Badge,
  Tooltip,
  Select,
  SelectItem,
  Input,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '../../components/ui';

type SortField = 'date' | 'employeeName' | 'checkIn' | 'checkOut' | 'workingHours';
type SortOrder = 'asc' | 'desc';

export const AttendanceReport: React.FC = () => {
  const { user, currentWorkspace, workspaces } = useAuth();

  const cleanId = (id?: string | null): string => {
    if (!id || id === 'undefined' || id === 'null' || id.trim() === '') return '';
    return id.trim();
  };

  const activeWorkspaceId =
    cleanId(currentWorkspace?.id) ||
    cleanId(localStorage.getItem('active_workspace_id')) ||
    cleanId(workspaces?.[0]?.id) ||
    '';

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 350);
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');

  // Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Side Drawer State for detailed punch logs
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Pagination State (0-indexed)
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Sorting State
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Fetch attendance report with dynamic server-side filters & pagination
  const {
    data: reportData,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useQuery({
    queryKey: [
      'adminAttendanceReports',
      activeWorkspaceId,
      page,
      rowsPerPage,
      debouncedSearch.trim(),
      statusFilter,
      dateFilter,
    ],
    queryFn: () =>
      attendanceService.getAdminAttendanceReport({
        page: page + 1,
        limit: rowsPerPage,
        search: debouncedSearch.trim() || undefined,
        status: statusFilter,
        date: dateFilter || undefined,
        workspaceId: activeWorkspaceId || undefined,
      }),
    enabled: Boolean(user && activeWorkspaceId),
    placeholderData: (previousData) => previousData,
    staleTime: 30_000,
    gcTime: 300_000,
  });

  const queryClient = useQueryClient();

  // Background-prefetch adjacent pages so page navigation is instantaneous (<1ms)
  useEffect(() => {
    if (!user || !activeWorkspaceId || !reportData?.pagination) return;
    const totalPages = reportData.pagination.totalPages;

    // Prefetch Next Page
    if (page + 1 < totalPages) {
      queryClient.prefetchQuery({
        queryKey: [
          'adminAttendanceReports',
          activeWorkspaceId,
          page + 1,
          rowsPerPage,
          debouncedSearch.trim(),
          statusFilter,
          dateFilter,
        ],
        queryFn: () =>
          attendanceService.getAdminAttendanceReport({
            page: page + 2,
            limit: rowsPerPage,
            search: debouncedSearch.trim() || undefined,
            status: statusFilter,
            date: dateFilter || undefined,
            workspaceId: activeWorkspaceId || undefined,
          }),
        staleTime: 30_000,
      });
    }

    // Prefetch Previous Page
    if (page > 0) {
      queryClient.prefetchQuery({
        queryKey: [
          'adminAttendanceReports',
          activeWorkspaceId,
          page - 1,
          rowsPerPage,
          debouncedSearch.trim(),
          statusFilter,
          dateFilter,
        ],
        queryFn: () =>
          attendanceService.getAdminAttendanceReport({
            page: page,
            limit: rowsPerPage,
            search: debouncedSearch.trim() || undefined,
            status: statusFilter,
            date: dateFilter || undefined,
            workspaceId: activeWorkspaceId || undefined,
          }),
        staleTime: 30_000,
      });
    }
  }, [
    page,
    rowsPerPage,
    debouncedSearch,
    statusFilter,
    dateFilter,
    activeWorkspaceId,
    reportData?.pagination,
    user,
    queryClient,
  ]);

  const records = reportData?.items || [];

  const handleRequestSort = (property: SortField) => {
    const isAsc = sortField === property && sortOrder === 'asc';
    setSortOrder(isAsc ? 'desc' : 'asc');
    setSortField(property);
  };

  const sortedRecords = useMemo(() => {
    const items = [...records];
    items.sort((a, b) => {
      if (sortField === 'date') {
        const dateA = a.date || '';
        const dateB = b.date || '';
        if (dateB !== dateA) {
          return sortOrder === 'asc' ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA);
        }
        if (!a.checkIn && b.checkIn) return 1;
        if (a.checkIn && !b.checkIn) return -1;
        if (!a.checkIn && !b.checkIn) return 0;
        return (b.checkIn || '').localeCompare(a.checkIn || '');
      }
      if (sortField === 'checkIn') {
        const dateA = a.date || '';
        const dateB = b.date || '';
        if (dateB !== dateA) return dateB.localeCompare(dateA);

        if (!a.checkIn && b.checkIn) return 1;
        if (a.checkIn && !b.checkIn) return -1;
        if (!a.checkIn && !b.checkIn) return 0;
        return sortOrder === 'asc'
          ? (a.checkIn || '').localeCompare(b.checkIn || '')
          : (b.checkIn || '').localeCompare(a.checkIn || '');
      }
      if (sortField === 'checkOut') {
        const dateA = a.date || '';
        const dateB = b.date || '';
        if (dateB !== dateA) return dateB.localeCompare(dateA);

        if (!a.checkOut && b.checkOut) return 1;
        if (a.checkOut && !b.checkOut) return -1;
        if (!a.checkOut && !b.checkOut) return 0;
        return sortOrder === 'asc'
          ? (a.checkOut || '').localeCompare(b.checkOut || '')
          : (b.checkOut || '').localeCompare(a.checkOut || '');
      }
      if (sortField === 'employeeName') {
        return sortOrder === 'asc'
          ? (a.employeeName || '').localeCompare(b.employeeName || '')
          : (b.employeeName || '').localeCompare(a.employeeName || '');
      }
      if (sortField === 'workingHours') {
        const hA = a.workingHours || 0;
        const hB = b.workingHours || 0;
        return sortOrder === 'asc' ? hA - hB : hB - hA;
      }
      return 0;
    });
    return items;
  }, [records, sortField, sortOrder]);

  const totalCount = reportData?.pagination?.total || 0;
  const totalPages = reportData?.pagination?.totalPages || Math.ceil(totalCount / rowsPerPage) || 1;

  const summary = reportData?.summary || {
    totalShifts: 0,
    lateCount: 0,
    latePercentage: 0,
    averageWorkingHours: 0,
    absentCount: 0,
  };

  const isFiltered = Boolean(searchTerm.trim() || statusFilter !== 'all' || dateFilter);

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setDateFilter('');
    setPage(0);
  };

  const renderStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'present':
        return (
          <Badge variant="success" className="gap-1 font-mono text-[0.6875rem]">
            <CheckCircle2 className="size-3 text-emerald-600" />
            <span>On Time</span>
          </Badge>
        );
      case 'late':
        return (
          <Badge variant="warning" className="gap-1 font-mono text-[0.6875rem]">
            <AlertTriangle className="size-3 text-amber-600" />
            <span>Late Arrival</span>
          </Badge>
        );
      case 'absent':
        return (
          <Badge variant="destructive" className="gap-1 font-mono text-[0.6875rem]">
            <XCircle className="size-3" />
            <span>Absent</span>
          </Badge>
        );
      case 'half_day':
        return (
          <Badge
            variant="outline"
            className="border-sky-300 bg-sky-50 text-sky-700 font-mono text-[0.6875rem]"
          >
            Half Day
          </Badge>
        );
      case 'auto_closed':
        return (
          <Badge
            variant="outline"
            className="gap-1 border-purple-300 bg-purple-50 text-purple-700 font-mono text-[0.6875rem]"
          >
            <RefreshCw className="size-3 text-purple-600" />
            <span>Auto-Closed</span>
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="font-mono text-[0.6875rem] capitalize">
            {status || 'Unknown'}
          </Badge>
        );
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="size-3 text-faint opacity-50 transition-opacity group-hover:opacity-100" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="size-3 text-primary-600" />
    ) : (
      <ArrowDown className="size-3 text-primary-600" />
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ── 1. Page Header ── */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="eyebrow">ATTENDANCE AUDIT LEDGER</span>
            <div className="flex items-center gap-3">
              <h1 className="text-[1.625rem] sm:text-[1.75rem] font-semibold tracking-[-0.02em] leading-tight text-ink">
                Attendance Reports
              </h1>
              {reportData?.isLive && (
                <Badge
                  variant="outline"
                  className="gap-1.5 border-emerald-300 bg-emerald-50/70 text-emerald-700 font-mono text-[0.6875rem]"
                >
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Live Database</span>
                </Badge>
              )}
            </div>
            <p className="max-w-2xl text-sm leading-relaxed text-muted">
              Audit corporate attendance records, inspect real-time punch timestamps, track biometric verification, and export compliance files.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="outline"
              size="default"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-1.5"
            >
              <RotateCcw className={cn('size-3.5', isFetching && 'animate-spin text-primary-600')} />
              <span>Refresh</span>
            </Button>
            <Button
              variant="brand"
              size="default"
              onClick={() => setIsExportModalOpen(true)}
              className="gap-1.5 shadow-sm"
            >
              <Download className="size-4" />
              <span>Export Report</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ── 2. Error / Notice Alerts ── */}
      {!isLoading && reportData && !reportData.isLive && reportData.errorMessage && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-800">
          <AlertTriangle className="size-4 shrink-0 text-amber-600 mt-0.5" />
          <div className="leading-relaxed">{reportData.errorMessage}</div>
        </div>
      )}

      {isError && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50/70 p-3.5 text-xs text-rose-800">
          <XCircle className="size-4 shrink-0 text-rose-600 mt-0.5" />
          <div className="leading-relaxed">
            Failed to communicate with attendance services. Please verify backend server is online at port 3000.
          </div>
        </div>
      )}

      {/* ── 3. Four Metric Stat Strip ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Total Logged Shifts */}
        <Card
          onClick={() => {
            setStatusFilter('all');
            setPage(0);
          }}
          className={cn(
            'p-3.5 flex flex-col gap-1 cursor-pointer transition-all duration-150',
            statusFilter === 'all'
              ? 'border-primary-500/80 bg-primary-50/20 ring-1 ring-primary-500/20'
              : 'hover:border-line-strong hover:bg-subtle/50'
          )}
        >
          <span className="text-[0.75rem] font-medium text-muted">Total Shifts</span>
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-2xl font-semibold text-ink num">
              {summary.totalShifts}
            </span>
            <span className="font-mono text-xs text-muted">shifts</span>
          </div>
          <span className="text-[0.6875rem] text-faint">
            {statusFilter === 'all' ? 'Active view (All logs)' : 'Click to show all logs'}
          </span>
        </Card>

        {/* Late Arrivals */}
        <Card
          onClick={() => {
            setStatusFilter(statusFilter === 'late' ? 'all' : 'late');
            setPage(0);
          }}
          className={cn(
            'p-3.5 flex flex-col gap-1 cursor-pointer transition-all duration-150',
            statusFilter === 'late'
              ? 'border-amber-500/80 bg-amber-50/30 ring-1 ring-amber-500/20'
              : 'hover:border-line-strong hover:bg-subtle/50'
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[0.75rem] font-medium text-muted">Late Arrivals</span>
            <Badge variant="warning" className="font-mono text-[0.625rem] px-1.5 py-0">
              {summary.latePercentage}%
            </Badge>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-2xl font-semibold text-amber-600 num">
              {summary.lateCount}
            </span>
            <span className="font-mono text-xs text-amber-700/80">records</span>
          </div>
          <span className="text-[0.6875rem] text-faint">
            {statusFilter === 'late' ? 'Filtering late check-ins' : 'Click to filter late'}
          </span>
        </Card>

        {/* Absent Personnel */}
        <Card
          onClick={() => {
            setStatusFilter(statusFilter === 'absent' ? 'all' : 'absent');
            setPage(0);
          }}
          className={cn(
            'p-3.5 flex flex-col gap-1 cursor-pointer transition-all duration-150',
            statusFilter === 'absent'
              ? 'border-rose-500/80 bg-rose-50/30 ring-1 ring-rose-500/20'
              : 'hover:border-line-strong hover:bg-subtle/50'
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[0.75rem] font-medium text-muted">Absent Personnel</span>
            <Badge
              variant="destructive"
              className={cn(
                'font-mono text-[0.625rem] px-1.5 py-0',
                statusFilter === 'absent' && 'ring-1 ring-rose-400'
              )}
            >
              {statusFilter === 'absent' ? 'Filtering' : 'Absences'}
            </Badge>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-2xl font-semibold text-rose-600 num">
              {summary.absentCount ?? 0}
            </span>
            <span className="font-mono text-xs text-rose-700/80">absent</span>
          </div>
          <span className="text-[0.6875rem] text-faint">
            {statusFilter === 'absent' ? 'Filtering absent logs' : 'Click to filter absences'}
          </span>
        </Card>

        {/* Average Working Hours */}
        <Card className="p-3.5 flex flex-col gap-1">
          <span className="text-[0.75rem] font-medium text-muted">Avg Shift Length</span>
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-2xl font-semibold text-emerald-600 num">
              {summary.averageWorkingHours}
            </span>
            <span className="font-mono text-xs text-emerald-700/80">hrs/day</span>
          </div>
          <span className="text-[0.6875rem] text-faint">Averaged across completed shifts</span>
        </Card>
      </div>

      {/* ── 4. Filter Toolbar ── */}
      <Card className="p-3.5">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-12 items-center">
          {/* Search box */}
          <div className="sm:col-span-5">
            <Input
              type="text"
              placeholder="Search by employee name or code..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(0);
              }}
              leading={<Search className="size-3.5" />}
              trailing={
                searchTerm ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setPage(0);
                    }}
                    className="cursor-pointer rounded p-0.5 text-faint hover:text-ink"
                  >
                    <X className="size-3.5" />
                  </button>
                ) : undefined
              }
              className="h-9 text-xs"
            />
          </div>

          {/* Log Status dropdown using shadcn Select */}
          <div className="sm:col-span-3">
            <Select
              value={statusFilter}
              onValueChange={(val) => {
                setStatusFilter(val);
                setPage(0);
              }}
            >
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="present">On Time</SelectItem>
              <SelectItem value="late">Late Arrival</SelectItem>
              <SelectItem value="absent">Absent</SelectItem>
              <SelectItem value="half_day">Half Day</SelectItem>
              <SelectItem value="auto_closed">Auto-Closed</SelectItem>
            </Select>
          </div>

          {/* Specific Date input with Today / Clear quick buttons */}
          <div className="sm:col-span-4 flex items-center gap-1.5">
            <div className="relative flex-1">
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value);
                  setPage(0);
                }}
                className="h-9 w-full rounded-lg border border-line bg-canvas px-3 text-xs text-ink focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
              />
            </div>

            {dateFilter ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDateFilter('');
                  setPage(0);
                }}
                className="h-9 px-2 text-xs text-muted hover:text-ink"
              >
                Clear
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDateFilter(dayjs().format('YYYY-MM-DD'));
                  setPage(0);
                }}
                className="h-9 px-2.5 text-xs font-medium"
              >
                Today
              </Button>
            )}
          </div>
        </div>

        {isFiltered && (
          <div className="flex items-center justify-between border-t border-line mt-3 pt-2.5 text-xs text-muted">
            <div className="flex items-center gap-2">
              <span className="flex size-1.5 rounded-full bg-primary-600" />
              <span>Active filters applied</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="h-6 gap-1 px-2 text-xs text-muted hover:text-ink"
            >
              <RotateCcw className="size-3" />
              Reset filters
            </Button>
          </div>
        )}
      </Card>

      {/* ── 5. Attendance Ledger Table Card ── */}
      <Card className="relative overflow-hidden">
        {/* Subtle top indicator when fetching */}
        {isFetching && (
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary-500 animate-pulse z-10" />
        )}

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-line bg-subtle/50 text-faint">
                {/* Date */}
                <th className="py-3 px-4 font-mono font-medium tracking-wider uppercase text-[0.6875rem]">
                  <button
                    type="button"
                    onClick={() => handleRequestSort('date')}
                    className="group inline-flex items-center gap-1.5 hover:text-ink transition-colors"
                  >
                    <span>Date</span>
                    {renderSortIcon('date')}
                  </button>
                </th>

                {/* Employee ID */}
                <th className="py-3 px-4 font-mono font-medium tracking-wider uppercase text-[0.6875rem]">
                  Employee ID
                </th>

                {/* Employee Name */}
                <th className="py-3 px-4 font-mono font-medium tracking-wider uppercase text-[0.6875rem]">
                  <button
                    type="button"
                    onClick={() => handleRequestSort('employeeName')}
                    className="group inline-flex items-center gap-1.5 hover:text-ink transition-colors"
                  >
                    <span>Employee</span>
                    {renderSortIcon('employeeName')}
                  </button>
                </th>

                {/* Check In */}
                <th className="py-3 px-4 font-mono font-medium tracking-wider uppercase text-[0.6875rem]">
                  <button
                    type="button"
                    onClick={() => handleRequestSort('checkIn')}
                    className="group inline-flex items-center gap-1.5 hover:text-ink transition-colors"
                  >
                    <span>Check-In</span>
                    {renderSortIcon('checkIn')}
                  </button>
                </th>

                {/* Check Out */}
                <th className="py-3 px-4 font-mono font-medium tracking-wider uppercase text-[0.6875rem]">
                  <button
                    type="button"
                    onClick={() => handleRequestSort('checkOut')}
                    className="group inline-flex items-center gap-1.5 hover:text-ink transition-colors"
                  >
                    <span>Check-Out</span>
                    {renderSortIcon('checkOut')}
                  </button>
                </th>

                {/* Status */}
                <th className="py-3 px-4 font-mono font-medium tracking-wider uppercase text-[0.6875rem]">
                  Status
                </th>

                {/* Working Hours */}
                <th className="py-3 px-4 text-right font-mono font-medium tracking-wider uppercase text-[0.6875rem]">
                  <button
                    type="button"
                    onClick={() => handleRequestSort('workingHours')}
                    className="group inline-flex items-center gap-1.5 hover:text-ink transition-colors ml-auto"
                  >
                    <span>Duration</span>
                    {renderSortIcon('workingHours')}
                  </button>
                </th>

                {/* Audit Note */}
                <th className="py-3 px-4 font-mono font-medium tracking-wider uppercase text-[0.6875rem]">
                  Audit Note
                </th>

                {/* Action */}
                <th className="py-3 px-4 text-center font-mono font-medium tracking-wider uppercase text-[0.6875rem]">
                  Telemetry Logs
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-line">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="size-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
                      <span className="font-mono text-xs text-muted">Retrieving attendance logs...</span>
                    </div>
                  </td>
                </tr>
              ) : sortedRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-14 text-center">
                    <div className="dot-grid mx-auto max-w-sm rounded-xl border border-dashed border-line-strong p-6 text-center">
                      <div className="mx-auto flex size-10 items-center justify-center rounded-xl border border-primary-100 bg-panel text-primary-600 shadow-xs">
                        <FileText className="size-5" />
                      </div>
                      <p className="mt-3 font-semibold text-ink">No Auditable Logs Found</p>
                      <p className="mt-1 text-xs text-muted leading-relaxed">
                        There are no recorded shifts matching the current filters. Adjust your search or change the date range.
                      </p>
                      {isFiltered && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleResetFilters}
                          className="mt-4 gap-1.5 text-xs"
                        >
                          <RotateCcw className="size-3" />
                          <span>Clear All Filters</span>
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                sortedRecords.map((record) => {
                  const isAbsent = record.status === 'absent';
                  const hasLogs = Boolean(
                    (record.sessions && record.sessions.length > 0) ||
                      (record.totalSessions && record.totalSessions > 0) ||
                      record.checkIn
                  );

                  return (
                    <tr
                      key={record.id}
                      className={cn(
                        'transition-colors duration-100',
                        isAbsent ? 'bg-rose-50/20 hover:bg-rose-50/40' : 'hover:bg-subtle/60'
                      )}
                    >
                      {/* Date */}
                      <td className="py-3.5 px-4 font-mono font-medium text-ink">
                        {record.date ? dayjs(record.date).format('DD MMM YYYY') : '--'}
                      </td>

                      {/* Employee ID */}
                      <td className="py-3.5 px-4">
                        <span
                          className={cn(
                            'font-mono text-xs px-1.5 py-0.5 rounded border',
                            isAbsent
                              ? 'border-rose-200 bg-rose-50 text-rose-700 font-semibold'
                              : 'border-line bg-subtle text-ink-soft'
                          )}
                        >
                          {record.employeeId}
                        </span>
                      </td>

                      {/* Employee Name */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          {record.avatarUrl ? (
                            <img
                              src={getAvatarUrl(record.avatarUrl)}
                              alt={record.employeeName}
                              className="size-8 rounded-full border border-line object-cover"
                            />
                          ) : (
                            <div
                              className={cn(
                                'flex size-8 shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold text-white shadow-xs',
                                isAbsent ? 'bg-rose-500' : 'bg-primary-600'
                              )}
                            >
                              {record.employeeName ? record.employeeName.charAt(0).toUpperCase() : 'E'}
                            </div>
                          )}
                          <div className="min-w-0">
                            <span className="font-medium text-ink block truncate">
                              {record.employeeName}
                            </span>
                            {isAbsent && (
                              <span className="font-mono text-[0.625rem] text-rose-600 font-semibold uppercase">
                                Absent Day
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Check-In */}
                      <td className="py-3.5 px-4 font-mono">
                        {record.checkIn ? (
                          <span className="font-medium text-ink">
                            {dayjs(`${record.date}T${record.checkIn}`).isValid()
                              ? dayjs(`${record.date}T${record.checkIn}`).format('hh:mm A')
                              : record.checkIn}
                          </span>
                        ) : isAbsent ? (
                          <span className="italic text-rose-600 font-medium">No Check-In</span>
                        ) : (
                          <span className="text-muted">--</span>
                        )}
                      </td>

                      {/* Check-Out */}
                      <td className="py-3.5 px-4 font-mono">
                        {record.checkOut ? (
                          <span className="font-medium text-ink">
                            {dayjs(`${record.date}T${record.checkOut}`).isValid()
                              ? dayjs(`${record.date}T${record.checkOut}`).format('hh:mm A')
                              : record.checkOut}
                          </span>
                        ) : record.checkIn ? (
                          <span className="inline-flex items-center gap-1 font-sans text-xs font-medium text-primary-600 italic">
                            <span className="size-1.5 rounded-full bg-primary-600 animate-pulse" />
                            Active Shift
                          </span>
                        ) : isAbsent ? (
                          <span className="italic text-rose-600 font-medium">No Check-Out</span>
                        ) : (
                          <span className="text-muted">--</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">{renderStatusBadge(record.status)}</td>

                      {/* Working Hours */}
                      <td className="py-3.5 px-4 text-right font-mono">
                        {record.workingHours && Number(record.workingHours) > 0 ? (
                          <span className="font-semibold text-ink num">
                            {Number(record.workingHours).toFixed(1)} hrs
                          </span>
                        ) : isAbsent ? (
                          <span className="font-mono text-faint">0 hrs</span>
                        ) : (
                          <span className="text-muted">--</span>
                        )}
                      </td>

                      {/* Audit Note */}
                      <td className="py-3.5 px-4 max-w-[200px] truncate text-muted text-xs">
                        {record.notes ? (
                          <span title={record.notes}>{record.notes}</span>
                        ) : (
                          <span className="text-faint font-mono text-[0.6875rem]">--</span>
                        )}
                      </td>

                      {/* Action Button */}
                      <td className="py-3.5 px-4 text-center">
                        <Tooltip
                          content={
                            hasLogs
                              ? 'Inspect detailed biometric & punch timeline'
                              : 'No punch logs available for absent record'
                          }
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!hasLogs}
                            onClick={() => {
                              setSelectedRecord(record);
                              setIsDrawerOpen(true);
                            }}
                            className="h-7 gap-1 px-2.5 text-xs font-medium hover:border-primary-400 hover:text-primary-600"
                          >
                            <Eye className="size-3 text-primary-600" />
                            <span>
                              {record.totalSessions && record.totalSessions > 1
                                ? `${record.totalSessions} Logs`
                                : 'Logs'}
                            </span>
                          </Button>
                        </Tooltip>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── 6. Pagination Footer ── */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 bg-subtle/30">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-muted">
              Showing <strong className="text-ink">{records.length > 0 ? page * rowsPerPage + 1 : 0}</strong> to{' '}
              <strong className="text-ink">
                {Math.min((page + 1) * rowsPerPage, totalCount)}
              </strong>{' '}
              of <strong className="text-ink">{totalCount}</strong> logs
            </span>

            {/* Rows per page selector using shadcn Select */}
            <div className="flex items-center gap-1.5 border-l border-line pl-3">
              <span className="font-mono text-xs text-faint">Per page:</span>
              <div className="w-18">
                <Select
                  value={String(rowsPerPage)}
                  onValueChange={(val) => {
                    setRowsPerPage(parseInt(val, 10));
                    setPage(0);
                  }}
                  size="sm"
                >
                  {[5, 10, 25, 50].map((pageSize) => (
                    <SelectItem key={pageSize} value={String(pageSize)}>
                      {pageSize}
                    </SelectItem>
                  ))}
                </Select>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0 || isFetching}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="h-7 px-2 text-xs"
            >
              <ChevronLeft className="size-3.5" />
              <span className="hidden sm:inline">Prev</span>
            </Button>

            <span className="font-mono text-xs text-muted px-2">
              Page <strong className="text-ink">{page + 1}</strong> of{' '}
              <strong className="text-ink">{totalPages}</strong>
            </span>

            <Button
              variant="outline"
              size="sm"
              disabled={page + 1 >= totalPages || isFetching}
              onClick={() => setPage((p) => p + 1)}
              className="h-7 px-2 text-xs"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </Card>

      {/* ── 7. Detailed Biometric & Punch Telemetry Drawer ── */}
      <AttendanceAuditDrawer
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        record={selectedRecord}
      />

      {/* ── 8. Export Audit Modal ── */}
      <ExportAuditReportModal
        open={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        currentFilters={{
          search: searchTerm.trim() || undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          date: dateFilter || undefined,
          workspaceId: activeWorkspaceId || undefined,
        }}
        totalCount={totalCount}
      />
    </div>
  );
};

export default AttendanceReport;
