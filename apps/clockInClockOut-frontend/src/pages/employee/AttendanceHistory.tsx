import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { attendanceService } from '../../services/attendanceService';
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
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Skeleton,
  useTheme,
  Button,
} from '@mui/material';
import {
  History as HistoryIcon,
  CheckCircle as OnTimeIcon,
  Warning as LateIcon,
  Cancel as AbsentIcon,
  Autorenew as AutoClosedIcon,
  FilterList as FilterIcon,
  FileDownload as ExportIcon,
} from '@mui/icons-material';
import dayjs from 'dayjs';

export const AttendanceHistory: React.FC = () => {
  const { user } = useAuth();
  const theme = useTheme();

  // Filter States
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  
  // Pagination States
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const { data: attendanceList = [], isLoading } = useQuery({
    queryKey: ['employeeAttendanceHistory', user?.employeeId],
    queryFn: () => attendanceService.getMyAttendance(user?.employeeId || ''),
    enabled: !!user?.employeeId,
  });

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Get dynamic unique months from data for the dropdown filter
  const uniqueMonths = Array.from(
    new Set(attendanceList.map((record) => dayjs(record.date).format('YYYY-MM')))
  ).sort((a, b) => b.localeCompare(a));

  // Filter logic
  const filteredRecords = attendanceList.filter((record) => {
    const matchesStatus = statusFilter === 'all' || record.status === statusFilter;
    const matchesMonth = monthFilter === 'all' || record.date.startsWith(monthFilter);
    return matchesStatus && matchesMonth;
  });

  const paginatedRecords = filteredRecords.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'present':
        return <Chip label="On Time" color="success" size="small" icon={<OnTimeIcon />} />;
      case 'late':
        return <Chip label="Late Check-In" color="warning" size="small" icon={<LateIcon />} />;
      case 'absent':
        return <Chip label="Absent" color="error" size="small" icon={<AbsentIcon />} />;
      case 'auto_closed':
        return <Chip label="Auto-Closed" color="secondary" size="small" icon={<AutoClosedIcon />} />;
      default:
        return <Chip label={status} size="small" />;
    }
  };

  // Simple print handler for reports
  const handlePrint = () => {
    window.print();
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            Attendance History
          </Typography>
          <Typography variant="body2" color="text.secondary">
            View, filter, and audit your complete historical attendance record.
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<ExportIcon />} onClick={handlePrint}>
          Print Ledger
        </Button>
      </Box>

      {/* Filters Card */}
      <Card sx={{ borderRadius: 3, mb: 3 }}>
        <CardContent sx={{ p: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <FilterIcon color="primary" sx={{ fontSize: 20 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Filter Records
            </Typography>
          </Box>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <FormControl fullWidth size="small">
                <InputLabel id="status-filter-label">Attendance Status</InputLabel>
                <Select
                  labelId="status-filter-label"
                  id="status-filter"
                  value={statusFilter}
                  label="Attendance Status"
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(0);
                  }}
                >
                  <MenuItem value="all">All Statuses</MenuItem>
                  <MenuItem value="present">On Time</MenuItem>
                  <MenuItem value="late">Late Check-In</MenuItem>
                  <MenuItem value="absent">Absent</MenuItem>
                  <MenuItem value="auto_closed">Auto-Closed</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <FormControl fullWidth size="small">
                <InputLabel id="month-filter-label">Month</InputLabel>
                <Select
                  labelId="month-filter-label"
                  id="month-filter"
                  value={monthFilter}
                  label="Month"
                  onChange={(e) => {
                    setMonthFilter(e.target.value);
                    setPage(0);
                  }}
                >
                  <MenuItem value="all">All Months</MenuItem>
                  {uniqueMonths.map((m) => (
                    <MenuItem key={m} value={m}>
                      {dayjs(m).format('MMMM YYYY')}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Table Card */}
      <Card sx={{ borderRadius: 3 }}>
        {isLoading ? (
          <Box sx={{ p: 3 }}>
            <Skeleton variant="rectangular" height={50} sx={{ mb: 1, borderRadius: 1 }} />
            <Skeleton variant="rectangular" height={40} sx={{ mb: 1, borderRadius: 1 }} />
            <Skeleton variant="rectangular" height={40} sx={{ mb: 1, borderRadius: 1 }} />
            <Skeleton variant="rectangular" height={40} sx={{ mb: 1, borderRadius: 1 }} />
            <Skeleton variant="rectangular" height={40} sx={{ mb: 1, borderRadius: 1 }} />
          </Box>
        ) : (
          <Box>
            <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 0 }}>
              <Table sx={{ minWidth: 650 }} aria-label="attendance history table">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Day</TableCell>
                    <TableCell>Check-In</TableCell>
                    <TableCell>Check-Out</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Hours Logged</TableCell>
                    <TableCell>Audit Notes</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredRecords.length > 0 ? (
                    paginatedRecords.map((record) => (
                      <TableRow
                        key={record.id}
                        sx={{
                          '&:last-child td, &:last-child th': { border: 0 },
                          '&:hover': { bgcolor: 'action.hover' },
                        }}
                      >
                        <TableCell sx={{ fontWeight: 700 }}>
                          {dayjs(record.date).format('YYYY-MM-DD')}
                        </TableCell>
                        <TableCell sx={{ color: 'text.secondary', fontWeight: 500 }}>
                          {dayjs(record.date).format('dddd')}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>
                          {record.checkIn 
                            ? dayjs(`${record.date} ${record.checkIn}`).format('hh:mm A') 
                            : '--'}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>
                          {record.checkOut 
                            ? dayjs(`${record.date} ${record.checkOut}`).format('hh:mm A') 
                            : record.checkIn ? <span style={{ fontStyle: 'italic', color: theme.palette.text.secondary }}>Active Shift</span> : '--'}
                        </TableCell>
                        <TableCell>{getStatusChip(record.status)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                          {record.workingHours ? `${record.workingHours} hrs` : '--'}
                        </TableCell>
                        <TableCell sx={{ color: 'text.secondary', fontSize: '0.75rem', fontWeight: 500, maxWidth: 220 }}>
                          {record.notes || '--'}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                          <HistoryIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 1 }}>
                            No Records Found
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            There are no attendance matching the current filters.
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
              rowsPerPageOptions={[5, 10, 25]}
              component="div"
              count={filteredRecords.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              sx={{ borderTop: `1px solid ${theme.palette.divider}` }}
            />
          </Box>
        )}
      </Card>
    </Box>
  );
};

export default AttendanceHistory;
