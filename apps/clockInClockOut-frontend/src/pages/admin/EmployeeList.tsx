import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { employeeService } from '../../services/employeeService';
import { User } from '../../types';
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
  IconButton,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Snackbar,
  Alert,
  Avatar,
  Chip,
  Skeleton,
  useTheme,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  FilterList as FilterIcon,
  Cancel as CancelIcon,
  CheckCircle as ActiveIcon,
  Person as PersonIcon,
} from '@mui/icons-material';

export const EmployeeList: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const queryClient = useQueryClient();

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Deletion Dialog State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<User | null>(null);

  // Snackbars
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Fetch employees
  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['adminEmployees'],
    queryFn: () => employeeService.getEmployees(),
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => employeeService.deleteEmployee(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminEmployees'] });
      queryClient.invalidateQueries({ queryKey: ['adminDashboardMetrics'] });
      setSnackbar({
        open: true,
        message: 'Employee record deleted successfully.',
        severity: 'success',
      });
      setDeleteDialogOpen(false);
    },
    onError: (err: any) => {
      setSnackbar({
        open: true,
        message: err?.message || 'Failed to delete employee.',
        severity: 'error',
      });
      setDeleteDialogOpen(false);
    }
  });

  const handleDeleteClick = (employee: User) => {
    setSelectedEmployee(employee);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (selectedEmployee) {
      deleteMutation.mutate(selectedEmployee.id);
    }
  };

  const handlePageChange = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Extract unique departments for filtering
  const departments = Array.from(new Set(employees.map((e) => e.department))).filter(Boolean);

  // Filtering Logic
  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = deptFilter === 'all' || emp.department === deptFilter;
    const matchesStatus = statusFilter === 'all' || emp.status === statusFilter;
    return matchesSearch && matchesDept && matchesStatus;
  });

  const paginatedEmployees = filteredEmployees.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            Employee Directory
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage corporate personnel accounts, review corporate identities, and update status.
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => navigate('/admin/employees/new')}
          sx={{ borderRadius: 2, py: 1, px: 2.5 }}
        >
          Add Employee
        </Button>
      </Box>

      {/* Filters */}
      <Card sx={{ borderRadius: 3, mb: 3 }}>
        <CardContent sx={{ p: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <FilterIcon color="primary" sx={{ fontSize: 20 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Search & Filter Directory
            </Typography>
          </Box>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                fullWidth
                size="small"
                label="Search employees..."
                placeholder="ID, name, email..."
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
                <InputLabel id="dept-filter-label">Department</InputLabel>
                <Select
                  labelId="dept-filter-label"
                  id="dept-filter"
                  value={deptFilter}
                  label="Department"
                  onChange={(e) => {
                    setDeptFilter(e.target.value);
                    setPage(0);
                  }}
                >
                  <MenuItem value="all">All Departments</MenuItem>
                  {departments.map((d) => (
                    <MenuItem key={d} value={d}>
                      {d}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 4, md: 3 }}>
              <FormControl fullWidth size="small">
                <InputLabel id="status-filter-label">Status</InputLabel>
                <Select
                  labelId="status-filter-label"
                  id="status-filter"
                  value={statusFilter}
                  label="Status"
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(0);
                  }}
                >
                  <MenuItem value="all">All Statuses</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
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
          </Box>
        ) : (
          <Box>
            <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 0 }}>
              <Table sx={{ minWidth: 650 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Employee ID</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Phone</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredEmployees.length > 0 ? (
                    paginatedEmployees.map((emp) => (
                      <TableRow
                        key={emp.id}
                        sx={{
                          '&:last-child td, &:last-child th': { border: 0 },
                          '&:hover': { bgcolor: 'action.hover' },
                        }}
                      >
                        <TableCell sx={{ fontWeight: 700, color: 'primary.main' }}>
                          {emp.employeeId}
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Avatar src={emp.avatarUrl} alt={emp.name} sx={{ width: 32, height: 32 }} />
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                {emp.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                                {emp.designation} • {emp.department}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ fontWeight: 500 }}>{emp.email}</TableCell>
                        <TableCell sx={{ color: 'text.secondary', fontWeight: 500 }}>{emp.phone || '--'}</TableCell>
                        <TableCell>
                          <Chip
                            label={emp.role}
                            size="small"
                            variant="outlined"
                            sx={{
                              textTransform: 'capitalize',
                              fontWeight: 600,
                              borderColor: emp.role === 'admin' ? theme.palette.secondary.main : theme.palette.divider,
                              color: emp.role === 'admin' ? theme.palette.secondary.main : theme.palette.text.primary,
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={emp.status === 'active' ? 'Active' : 'Inactive'}
                            size="small"
                            color={emp.status === 'active' ? 'success' : 'default'}
                            icon={emp.status === 'active' ? <ActiveIcon /> : <CancelIcon />}
                            sx={{ fontWeight: 700 }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                            <Tooltip title="Edit Profile">
                              <IconButton
                                size="small"
                                onClick={() => navigate(`/admin/employees/edit/${emp.id}`)}
                                color="primary"
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            
                            <Tooltip title="Delete Employee">
                              <span>
                                <IconButton
                                  size="small"
                                  onClick={() => handleDeleteClick(emp)}
                                  color="error"
                                  disabled={emp.role === 'admin'} // Cannot delete self or admin
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                          <PersonIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 1 }}>
                            No Employees Found
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Try adjusting your search filters or add a new personnel record.
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
              count={filteredEmployees.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handlePageChange}
              onRowsPerPageChange={handleRowsPerPageChange}
              sx={{ borderTop: `1px solid ${theme.palette.divider}` }}
            />
          </Box>
        )}
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
        slotProps={{ paper: { sx: { borderRadius: 3, p: 1 } } }}
      >
        <DialogTitle id="alert-dialog-title" sx={{ fontWeight: 700 }}>
          {"Confirm Record Deletion"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            Are you sure you want to permanently delete the profile of{' '}
            <strong style={{ color: theme.palette.text.primary }}>{selectedEmployee?.name}</strong> (ID: {selectedEmployee?.employeeId})? This action will remove all historical logs and cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={confirmDelete}
            color="error"
            variant="contained"
            disabled={deleteMutation.isPending}
            startIcon={deleteMutation.isPending && <CircularProgress size={16} color="inherit" />}
          >
            {deleteMutation.isPending ? 'Deleting...' : 'Delete Employee'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar Feedbacks */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%', borderRadius: 2 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default EmployeeList;
