import React, { useState } from 'react';
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
} from '@mui/icons-material';
import dayjs from 'dayjs';

export const AttendanceReport: React.FC = () => {
  const theme = useTheme();

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');

  // Pagination State
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Fetch all attendance logs
  const { data: allAttendance = [], isLoading } = useQuery({
    queryKey: ['adminAttendanceReports'],
    queryFn: () => attendanceService.getAllAttendance(),
  });

  const handlePageChange = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Filter logs
  const filteredRecords = allAttendance.filter((record) => {
    const matchesSearch =
      record.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.employeeId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || record.status === statusFilter;
    const matchesDate = !dateFilter || record.date === dateFilter;

    return matchesSearch && matchesStatus && matchesDate;
  });

  const paginatedRecords = filteredRecords.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  // High-level Calculations for Report Panel
  const totalShifts = filteredRecords.filter((r) => r.status !== 'absent').length;
  const lateCount = filteredRecords.filter((r) => r.status === 'late').length;
  const latePercentage = totalShifts > 0 ? Math.round((lateCount / totalShifts) * 100) : 0;
  
  const presentRecords = filteredRecords.filter((r) => r.status === 'present' || r.status === 'late');
  const averageHours = presentRecords.length > 0 
    ? parseFloat((presentRecords.reduce((sum, r) => sum + r.workingHours, 0) / presentRecords.length).toFixed(1))
    : 0;

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

  const handlePrint = () => {
    window.print();
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            Attendance Report
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Perform enterprise logs auditing, run compliance filters, and print reports.
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<PrintIcon />} onClick={handlePrint}>
          Print Audit Report
        </Button>
      </Box>

      {/* Metrics Summary row */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase' }}>
              Logged Shifts
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, color: 'primary.main' }}>
              {totalShifts} Shifts
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Count of non-absent reports matching active criteria
            </Typography>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, sm: 4 }}>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase' }}>
              Late Exception Rate
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, color: 'warning.main' }}>
              {latePercentage}%
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Ratio of late arrivals to total logs
            </Typography>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, sm: 4 }}>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase' }}>
              Average Shift Length
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, color: 'success.main' }}>
              {averageHours} hrs/day
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Averaged across standard clocked-in logs
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
                  <MenuItem value="auto_closed">Auto-Closed</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 4, md: 3 }}>
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
                  {filteredRecords.length > 0 ? (
                    paginatedRecords.map((record) => (
                      <TableRow
                        key={record.id}
                        sx={{
                          '&:last-child td, &:last-child th': { border: 0 },
                          '&:hover': { bgcolor: 'action.hover' },
                        }}
                      >
                        <TableCell sx={{ fontWeight: 700 }}>{record.date}</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: 'primary.main' }}>
                          {record.employeeId}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            {record.selfieUrl ? (
                              <Avatar 
                                src={record.selfieUrl} 
                                variant="rounded"
                                sx={{ width: 36, height: 36, cursor: 'pointer', border: '1px solid', borderColor: 'divider' }}
                                onClick={() => window.open(record.selfieUrl, '_blank')}
                                title="Click to view full-size selfie"
                              />
                            ) : (
                              <Avatar sx={{ width: 36, height: 36, fontSize: '0.875rem', fontWeight: 600 }}>
                                {record.employeeName.charAt(0)}
                              </Avatar>
                            )}
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {record.employeeName}
                            </Typography>
                          </Box>
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
              count={filteredRecords.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handlePageChange}
              onRowsPerPageChange={handleRowsPerPageChange}
              sx={{ borderTop: `1px solid ${theme.palette.divider}` }}
            />
          </Box>
        )}
      </Card>
    </Box>
  );
};

export default AttendanceReport;
