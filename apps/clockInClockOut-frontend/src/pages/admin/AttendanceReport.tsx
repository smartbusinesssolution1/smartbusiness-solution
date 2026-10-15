import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { attendanceService } from '../../services/attendanceService';
import { ExportAuditReportModal } from '../../components/ExportAuditReportModal';
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
} from '@mui/material';
import {
  FilterList as FilterIcon,
  CheckCircle as OnTimeIcon,
  Warning as LateIcon,
  Cancel as AbsentIcon,
  Autorenew as AutoClosedIcon,
  Search as SearchIcon,
  FileDownload as PrintIcon,
  EventNote as ReportIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import dayjs from 'dayjs';
import { useAuth } from '../../context/AuthContext';
import { getAvatarUrl } from '../../utils/imageUrl';

export const AttendanceReport: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { currentWorkspace, workspaces } = useAuth();

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
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState(() => dayjs().format('YYYY-MM-DD'));

  // Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Pagination State (0-indexed for MUI TablePagination)
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Fetch attendance report with dynamic server-side filters & pagination
  const {
    data: reportData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['adminAttendanceReports', activeWorkspaceId, page, rowsPerPage, searchTerm, statusFilter, dateFilter],
    queryFn: () =>
      attendanceService.getAdminAttendanceReport({
        page: page + 1,
        limit: rowsPerPage,
        search: searchTerm.trim() || undefined,
        status: statusFilter,
        date: dateFilter || undefined,
        workspaceId: activeWorkspaceId || undefined,
      }),
  });

  const records = reportData?.items || [];
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

  const handleOpenExport = () => {
    setIsExportModalOpen(true);
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
            {reportData && (
              <Chip
                label={reportData.isLive ? '🟢 Live Database' : '🟡 Demo Mode'}
                color={reportData.isLive ? 'success' : 'default'}
                size="small"
                variant="outlined"
                sx={{ fontWeight: 700, fontSize: '0.72rem' }}
              />
            )}
          </Box>
          <Typography variant="body2" color="text.secondary">
            Perform enterprise logs auditing, run compliance filters, and print reports.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => refetch()}>
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<PrintIcon />}
            onClick={handleOpenExport}
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
          >
            Print / Export Audit Report
          </Button>
        </Box>
      </Box>

      {/* Fallback / Demo Mode Notice */}
      {!isLoading && reportData && !reportData.isLive && (
        <Alert
          severity="info"
          sx={{ mb: 3, borderRadius: 2 }}
          action={
            <Button
              color="primary"
              size="small"
              variant="contained"
              onClick={() => navigate('/login')}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Log In as Maria (Admin)
            </Button>
          }
        >
          Currently displaying local fallback records ({reportData.errorMessage || 'Admin session required'}).
          Sign in with <strong>maria@greenacres.com</strong> to query real-time attendance directly from PostgreSQL.
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
      <Card sx={{ borderRadius: 3 }}>
        {isLoading ? (
          <Box sx={{ p: 3 }}>
            <Skeleton variant="rectangular" height={50} sx={{ mb: 1, borderRadius: 1 }} />
            <Skeleton variant="rectangular" height={40} sx={{ mb: 1, borderRadius: 1 }} />
            <Skeleton variant="rectangular" height={40} sx={{ mb: 1, borderRadius: 1 }} />
            <Skeleton variant="rectangular" height={40} sx={{ mb: 1, borderRadius: 1 }} />
          </Box>
        ) : (
          <Box>
            <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 0 }}>
              <Table sx={{ minWidth: 650 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Employee ID</TableCell>
                    <TableCell>Employee Name</TableCell>
                    <TableCell>Check-In</TableCell>
                    <TableCell>Check-Out</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Working Hours</TableCell>
                    <TableCell>Audit Note</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {records.length > 0 ? (
                    records.map((record) => {
                      const isAbsent = record.status === 'absent';
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
                            {isAbsent ? (
                              <Typography
                                variant="body2"
                                sx={{ color: 'error.main', fontSize: '0.8rem', fontStyle: 'italic', fontWeight: 600 }}
                              >
                                No Check-In
                              </Typography>
                            ) : record.checkIn ? (
                              dayjs(`${record.date}T${record.checkIn}`).isValid()
                                ? dayjs(`${record.date}T${record.checkIn}`).format('hh:mm A')
                                : record.checkIn
                            ) : (
                              '--'
                            )}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>
                            {isAbsent ? (
                              <Typography
                                variant="body2"
                                sx={{ color: 'error.main', fontSize: '0.8rem', fontStyle: 'italic', fontWeight: 600 }}
                              >
                                No Check-Out
                              </Typography>
                            ) : record.checkOut ? (
                              dayjs(`${record.date}T${record.checkOut}`).isValid()
                                ? dayjs(`${record.date}T${record.checkOut}`).format('hh:mm A')
                                : record.checkOut
                            ) : record.checkIn ? (
                              <span style={{ fontStyle: 'italic', color: theme.palette.text.secondary }}>
                                Active Shift
                              </span>
                            ) : (
                              '--'
                            )}
                          </TableCell>
                          <TableCell>{getStatusChip(record.status)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>
                            {isAbsent ? (
                              <Typography variant="body2" sx={{ color: 'text.disabled', fontWeight: 600 }}>
                                0 hrs
                              </Typography>
                            ) : record.workingHours ? (
                              `${record.workingHours} hrs`
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
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
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
              sx={{ borderTop: `1px solid ${theme.palette.divider}` }}
            />
          </Box>
        )}
      </Card>

      {/* Export / Print Audit Report Modal */}
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
