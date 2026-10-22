import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { attendanceService } from '../../services/attendanceService';
import { ExportAuditReportModal } from '../../components/ExportAuditReportModal';
import { AttendanceAuditDrawer } from '../../components/AttendanceAuditDrawer';
import { AttendanceRecord } from '../../types';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Chip,
  Skeleton,
  useTheme,
  Avatar,
  Alert,
  Tooltip,
  TableSortLabel,
  LinearProgress,
  CircularProgress,
} from '@mui/material';
import {
  FilterList as FilterIcon,
  CheckCircle as OnTimeIcon,
  Warning as LateIcon,
  Cancel as AbsentIcon,
  Autorenew as AutoClosedIcon,
  Search as SearchIcon,
  FileDownload as DownloadIcon,
  EventNote as ReportIcon,
  Refresh as RefreshIcon,
  InfoOutlined as InfoIcon,
} from '@mui/icons-material';
import dayjs from 'dayjs';
import { useAuth } from '../../context/AuthContext';
import { getAvatarUrl } from '../../utils/imageUrl';
import { useDebounce } from '../../hooks/useDebounce';

export const AttendanceReport: React.FC = () => {
  const theme = useTheme();
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

  // Export Modal State (only opens when clicking Export button)
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Side Drawer State for detailed punch logs
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Pagination State (0-indexed for MUI TablePagination)
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Fetch attendance report with dynamic server-side filters & pagination
  const {
    data: reportData,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['adminAttendanceReports', activeWorkspaceId, page, rowsPerPage, debouncedSearch.trim(), statusFilter, dateFilter],
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
  React.useEffect(() => {
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

  // Time-wise and column sorting state (default: Check-In time descending)
  const [sortField, setSortField] = useState<'checkIn' | 'checkOut' | 'employeeName' | 'workingHours' | 'date'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleRequestSort = (property: 'checkIn' | 'checkOut' | 'employeeName' | 'workingHours' | 'date') => {
    const isAsc = sortField === property && sortOrder === 'asc';
    setSortOrder(isAsc ? 'desc' : 'asc');
    setSortField(property);
  };

  const sortedRecords = React.useMemo(() => {
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
  const summary = reportData?.summary || {
    totalShifts: 0,
    lateCount: 0,
    latePercentage: 0,
    averageWorkingHours: 0,
    absentCount: 0,
  };

  const handlePageChange = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'present':
        return <Chip label="On Time" color="success" size="small" icon={<OnTimeIcon />} />;
      case 'late':
        return <Chip label="Late Check-In" color="warning" size="small" icon={<LateIcon />} />;
      case 'absent':
        return <Chip label="Absent" color="error" size="small" icon={<AbsentIcon />} />;
      case 'half_day':
        return <Chip label="Half Day" color="info" size="small" />;
      case 'auto_closed':
        return <Chip label="Auto-Closed" color="secondary" size="small" icon={<AutoClosedIcon />} />;
      default:
        return <Chip label={status} size="small" />;
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              Attendance Report
            </Typography>
            {reportData?.isLive && (
              <Chip
                label="🟢 Live Database"
                color="success"
                size="small"
                variant="outlined"
                sx={{ fontWeight: 700, fontSize: '0.72rem' }}
              />
            )}
          </Box>
          <Typography variant="body2" color="text.secondary">
            Perform enterprise logs auditing, inspect real-time punch records, and view attendance status.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => refetch()}>
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={() => setIsExportModalOpen(true)}
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
          >
            Export Report
          </Button>
        </Box>
      </Box>

      {/* Backend Error Notice */}
      {!isLoading && reportData && !reportData.isLive && reportData.errorMessage && (
        <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
          {reportData.errorMessage}
        </Alert>
      )}

      {/* Critical Server Error Alert */}
      {isError && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
          Failed to communicate with attendance services. Please verify backend server is online at port 3000.
        </Alert>
      )}

      {/* Metrics Summary row */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Paper
            variant="outlined"
            onClick={() => {
              setStatusFilter('all');
              setPage(0);
            }}
            sx={{
              p: 2.25,
              borderRadius: 3,
              display: 'flex',
              flexDirection: 'column',
              gap: 0.5,
              cursor: 'pointer',
              borderColor: statusFilter === 'all' ? 'primary.main' : undefined,
              bgcolor: statusFilter === 'all' ? 'rgba(59, 130, 246, 0.04)' : 'background.paper',
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                borderColor: 'primary.main',
                boxShadow: 2,
              },
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase' }}>
              Logged Shifts
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, color: 'primary.main' }}>
              {summary.totalShifts} Shifts
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Total active clock-ins
            </Typography>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Paper
            variant="outlined"
            onClick={() => {
              setStatusFilter(statusFilter === 'late' ? 'all' : 'late');
              setPage(0);
            }}
            sx={{
              p: 2.25,
              borderRadius: 3,
              display: 'flex',
              flexDirection: 'column',
              gap: 0.5,
              cursor: 'pointer',
              borderColor: statusFilter === 'late' ? 'warning.main' : undefined,
              bgcolor: statusFilter === 'late' ? 'rgba(245, 158, 11, 0.08)' : 'background.paper',
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                borderColor: 'warning.main',
                boxShadow: 2,
              },
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase' }}>
              Late Arrivals
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, color: 'warning.main' }}>
              {summary.lateCount} ({summary.latePercentage}%)
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {statusFilter === 'late' ? 'Click to show all logs' : 'Click to filter late check-ins'}
            </Typography>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Paper
            variant="outlined"
            onClick={() => {
              setStatusFilter(statusFilter === 'absent' ? 'all' : 'absent');
              setPage(0);
            }}
            sx={{
              p: 2.25,
              borderRadius: 3,
              display: 'flex',
              flexDirection: 'column',
              gap: 0.5,
              cursor: 'pointer',
              borderColor: statusFilter === 'absent' ? 'error.main' : undefined,
              bgcolor: statusFilter === 'absent' ? 'rgba(239, 68, 68, 0.08)' : 'background.paper',
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                borderColor: 'error.main',
                boxShadow: 2,
              },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase' }}>
                Absent Personnel
              </Typography>
              <Chip
                label={statusFilter === 'absent' ? 'Filtering' : 'View Absences'}
                size="small"
                color="error"
                variant={statusFilter === 'absent' ? 'filled' : 'outlined'}
                sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }}
              />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: 'error.main' }}>
              {summary.absentCount ?? 0} Absent
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {statusFilter === 'absent' ? 'Click to show all logs' : 'Click to filter absent records'}
            </Typography>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 3, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase' }}>
              Average Shift Length
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, color: 'success.main' }}>
              {summary.averageWorkingHours} hrs/day
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Averaged across completed logs
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Filters Card */}
      <Card sx={{ borderRadius: 3, mb: 3 }}>
        <CardContent sx={{ p: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <FilterIcon color="primary" sx={{ fontSize: 20 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Audit Parameters & Filtering
            </Typography>
          </Box>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                fullWidth
                size="small"
                label="Search Employee"
                placeholder="Name or corporate ID..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(0);
                }}
                slotProps={{
                  input: {
                    startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1, fontSize: 20 }} />,
                  },
                }}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 4, md: 3 }}>
              <FormControl fullWidth size="small">
                <InputLabel id="status-filter-label">Log Status</InputLabel>
                <Select
                  labelId="status-filter-label"
                  id="status-filter"
                  value={statusFilter}
                  label="Log Status"
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(0);
                  }}
                >
                  <MenuItem value="all">All Statuses</MenuItem>
                  <MenuItem value="present">On Time</MenuItem>
                  <MenuItem value="late">Late Arrival</MenuItem>
                  <MenuItem value="absent">Absent</MenuItem>
                  <MenuItem value="half_day">Half Day</MenuItem>
                  <MenuItem value="auto_closed">Auto-Closed</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 4, md: 4 }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label="Specific Date"
                  value={dateFilter}
                  onChange={(e) => {
                    setDateFilter(e.target.value);
                    setPage(0);
                  }}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                {dateFilter ? (
                  <Button
                    size="small"
                    variant="text"
                    color="inherit"
                    onClick={() => {
                      setDateFilter('');
                      setPage(0);
                    }}
                    sx={{ minWidth: 'auto', px: 1, textTransform: 'none', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                  >
                    Clear
                  </Button>
                ) : (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      setDateFilter(dayjs().format('YYYY-MM-DD'));
                      setPage(0);
                    }}
                    sx={{ whiteSpace: 'nowrap', textTransform: 'none', fontWeight: 600, fontSize: '0.75rem', py: 0.8 }}
                  >
                    Today
                  </Button>
                )}
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Reports Table Card */}
      <Card sx={{ borderRadius: 3, position: 'relative', overflow: 'hidden' }}>
        {/* Top Progress Bar when fetching in background (pagination, filtering, refetch) */}
        {isFetching && (
          <LinearProgress
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 3,
              zIndex: 10,
            }}
          />
        )}

        {isLoading ? (
          <Box sx={{ p: 3 }}>
            <Skeleton variant="rectangular" height={50} sx={{ mb: 1, borderRadius: 1 }} />
            <Skeleton variant="rectangular" height={40} sx={{ mb: 1, borderRadius: 1 }} />
            <Skeleton variant="rectangular" height={40} sx={{ mb: 1, borderRadius: 1 }} />
            <Skeleton variant="rectangular" height={40} sx={{ mb: 1, borderRadius: 1 }} />
          </Box>
        ) : (
          <Box sx={{ position: 'relative' }}>
            {/* Overlay Loader when paginating or fetching next page */}
            {isFetching && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  bgcolor: (theme) =>
                    theme.palette.mode === 'dark'
                      ? 'rgba(18, 18, 18, 0.65)'
                      : 'rgba(255, 255, 255, 0.72)',
                  backdropFilter: 'blur(1px)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1.5,
                  zIndex: 4,
                  pointerEvents: 'auto',
                }}
              >
                <CircularProgress size={36} thickness={4} />
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                  Loading attendance records...
                </Typography>
              </Box>
            )}

            <TableContainer
              component={Paper}
              elevation={0}
              sx={{
                borderRadius: 0,
                opacity: isFetching ? 0.45 : 1,
                transition: 'opacity 0.2s ease-in-out',
                pointerEvents: isFetching ? 'none' : 'auto',
              }}
            >
              <Table sx={{ minWidth: 650 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>
                      <TableSortLabel
                        active={sortField === 'date'}
                        direction={sortField === 'date' ? sortOrder : 'asc'}
                        onClick={() => handleRequestSort('date')}
                      >
                        Date
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>Employee ID</TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={sortField === 'employeeName'}
                        direction={sortField === 'employeeName' ? sortOrder : 'asc'}
                        onClick={() => handleRequestSort('employeeName')}
                      >
                        Employee Name
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={sortField === 'checkIn'}
                        direction={sortField === 'checkIn' ? sortOrder : 'desc'}
                        onClick={() => handleRequestSort('checkIn')}
                        sx={{ fontWeight: 800 }}
                      >
                        Check-In
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={sortField === 'checkOut'}
                        direction={sortField === 'checkOut' ? sortOrder : 'desc'}
                        onClick={() => handleRequestSort('checkOut')}
                      >
                        Check-Out
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">
                      <TableSortLabel
                        active={sortField === 'workingHours'}
                        direction={sortField === 'workingHours' ? sortOrder : 'desc'}
                        onClick={() => handleRequestSort('workingHours')}
                      >
                        Working Hours
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>Audit Note</TableCell>
                    <TableCell align="center">Logs & Info</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedRecords.length > 0 ? (
                    sortedRecords.map((record) => {
                      const isAbsent = record.status === 'absent';
                      const hasLogs = Boolean(
                        (record.sessions && record.sessions.length > 0) ||
                        (record.totalSessions && record.totalSessions > 0) ||
                        record.checkIn
                      );
                      return (
                        <TableRow
                          key={record.id}
                          sx={{
                            bgcolor: isAbsent ? 'rgba(239, 68, 68, 0.04)' : 'inherit',
                            '&:last-child td, &:last-child th': { border: 0 },
                            '&:hover': {
                              bgcolor: isAbsent ? 'rgba(239, 68, 68, 0.09)' : 'action.hover',
                            },
                          }}
                        >
                          <TableCell sx={{ fontWeight: 700 }}>{record.date}</TableCell>
                          <TableCell sx={{ fontWeight: 700, color: isAbsent ? 'error.main' : 'primary.main' }}>
                            {record.employeeId}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <Avatar
                                src={getAvatarUrl(record.avatarUrl)}
                                sx={{
                                  width: 36,
                                  height: 36,
                                  fontSize: '0.875rem',
                                  fontWeight: 700,
                                  bgcolor: isAbsent ? theme.palette.error.main : theme.palette.primary.main,
                                }}
                              >
                                {record.employeeName ? record.employeeName.charAt(0).toUpperCase() : 'E'}
                              </Avatar>
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  {record.employeeName}
                                </Typography>
                                {isAbsent && (
                                  <Typography
                                    variant="caption"
                                    sx={{ color: 'error.main', fontWeight: 600, display: 'block', lineHeight: 1 }}
                                  >
                                    Absent Log
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>
                            {record.checkIn ? (
                              dayjs(`${record.date}T${record.checkIn}`).isValid()
                                ? dayjs(`${record.date}T${record.checkIn}`).format('hh:mm A')
                                : record.checkIn
                            ) : isAbsent ? (
                              <Typography
                                variant="body2"
                                sx={{ color: 'error.main', fontSize: '0.8rem', fontStyle: 'italic', fontWeight: 600 }}
                              >
                                No Check-In
                              </Typography>
                            ) : (
                              '--'
                            )}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>
                            {record.checkOut ? (
                              dayjs(`${record.date}T${record.checkOut}`).isValid()
                                ? dayjs(`${record.date}T${record.checkOut}`).format('hh:mm A')
                                : record.checkOut
                            ) : record.checkIn ? (
                              <span style={{ fontStyle: 'italic', color: theme.palette.text.secondary }}>
                                Active Shift
                              </span>
                            ) : isAbsent ? (
                              <Typography
                                variant="body2"
                                sx={{ color: 'error.main', fontSize: '0.8rem', fontStyle: 'italic', fontWeight: 600 }}
                              >
                                No Check-Out
                              </Typography>
                            ) : (
                              '--'
                            )}
                          </TableCell>
                          <TableCell>{getStatusChip(record.status)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>
                            {record.workingHours && Number(record.workingHours) > 0 ? (
                              `${record.workingHours} hrs`
                            ) : isAbsent ? (
                              <Typography variant="body2" sx={{ color: 'text.disabled', fontWeight: 600 }}>
                                0 hrs
                              </Typography>
                            ) : (
                              '--'
                            )}
                          </TableCell>
                          <TableCell
                            sx={{
                              color: isAbsent ? 'error.dark' : 'text.secondary',
                              fontSize: '0.75rem',
                              fontWeight: 500,
                              maxWidth: 220,
                            }}
                          >
                            {record.notes || '--'}
                          </TableCell>
                          <TableCell align="center">
                            <Tooltip title={hasLogs ? 'View Detailed Punch Logs' : 'No logs for absent employee'}>
                              <span>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="primary"
                                  disabled={!hasLogs}
                                  startIcon={<InfoIcon sx={{ fontSize: 16 }} />}
                                  onClick={() => {
                                    setSelectedRecord(record);
                                    setIsDrawerOpen(true);
                                  }}
                                  sx={{
                                    textTransform: 'none',
                                    fontWeight: 700,
                                    fontSize: '0.75rem',
                                    borderRadius: 2,
                                    py: 0.35,
                                    px: 1.2,
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {record.totalSessions && record.totalSessions > 1
                                    ? `${record.totalSessions} Logs`
                                    : 'Logs'}
                                </Button>
                              </span>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={9} align="center" sx={{ py: 6 }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                          <ReportIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 1 }}>
                            No Auditable Logs Found
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            There are no recorded shifts matching the current criteria.
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Pagination */}
            <TablePagination
              rowsPerPageOptions={[5, 10, 25, 50]}
              component="div"
              count={totalCount}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handlePageChange}
              onRowsPerPageChange={handleRowsPerPageChange}
              disabled={isFetching}
              sx={{ borderTop: `1px solid ${theme.palette.divider}` }}
            />
          </Box>
        )}
      </Card>

      {/* Side Drawer: Detailed Punch Logs & Face Biometrics for Employee */}
      <AttendanceAuditDrawer
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        record={selectedRecord}
      />

      {/* Export Audit Report Modal - Only triggers file generation when user explicitly clicks Download */}
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
    </Box>
  );
};

export default AttendanceReport;
