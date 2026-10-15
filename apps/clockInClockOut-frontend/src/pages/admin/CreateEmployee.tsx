import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { employeeService } from '../../services/employeeService';
import { settingsService } from '../../services/settingsService';
import { useAuth } from '../../context/AuthContext';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Grid,
  Divider,
  Snackbar,
  Alert,
  CircularProgress,
  useTheme,
  Avatar,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Paper,
  Chip,
  Skeleton,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Save as SaveIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Work as WorkIcon,
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon,
  Schedule as ClockIcon,
  Business as BusinessIcon,
  Tune as TuneIcon,
  InfoOutlined as InfoIcon,
  AccessTime as AccessTimeIcon,
  Badge as BadgeIcon,
} from '@mui/icons-material';
import { ShiftTimePicker } from '../../components/ShiftTimePicker';
import { DayWiseShiftPicker, DEFAULT_WEEKLY_SCHEDULE } from '../../components/DayWiseShiftPicker';
import { WeeklySchedule } from '../../types';
import { STANDARD_DEPARTMENTS } from '../../constants/departments';

// Helper for formatting HH:mm to 12-hour AM/PM
const formatTime12Hour = (time24?: string) => {
  if (!time24) return '';
  const [hourStr, minStr] = time24.split(':');
  const hour = parseInt(hourStr, 10);
  if (isNaN(hour)) return time24;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12.toString().padStart(2, '0')}:${minStr || '00'} ${ampm}`;
};

// Helper to calculate total duration between two times (HH:mm)
const calculateShiftDuration = (start?: string, end?: string) => {
  if (!start || !end) return null;
  const [h1, m1] = start.split(':').map(Number);
  const [h2, m2] = end.split(':').map(Number);
  if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return null;
  let totalMinutes = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (totalMinutes < 0) totalMinutes += 24 * 60; // handles overnight shift
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hours} hr${hours !== 1 ? 's' : ''}${mins > 0 ? ` ${mins} min${mins !== 1 ? 's' : ''}` : ''}`;
};

// Form Validation Schema
const schema = z.object({
  name: z.string().trim().min(3, 'Full Name must be at least 3 characters'),
  email: z.string().trim().email('Please enter a valid business email address'),
  phone: z.string().trim().min(5, 'Phone number must be at least 5 digits'),
  designation: z.string().trim().min(2, 'Designation is required'),
  department: z.string().trim().min(2, 'Department is required'),
  role: z.enum(['admin', 'employee']),
  status: z.enum(['active', 'inactive']),
  shiftType: z.enum(['general', 'custom']),
  shiftStartTime: z.string().optional(),
  shiftEndTime: z.string().optional(),
});

type EmployeeFormValues = z.infer<typeof schema>;

export const CreateEmployee: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { currentTenant, isSuperAdmin } = useAuth();
  const isOwner = Boolean(currentTenant?.role === 'OWNER' || isSuperAdmin);

  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule>(DEFAULT_WEEKLY_SCHEDULE);

  // Fetch organization to display configured standard shift
  const { data: orgSettings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['adminSettings'],
    queryFn: () => settingsService.getSettings(),
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<EmployeeFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      designation: '',
      department: '',
      role: 'employee',
      status: 'active',
      shiftType: 'general',
      shiftStartTime: '09:00',
      shiftEndTime: '18:00',
    },
  });

  const watchShiftType = watch('shiftType');
  const watchStartTime = watch('shiftStartTime');
  const watchEndTime = watch('shiftEndTime');

  // Ensure "Standard Employee" and "Active" are explicitly selected by default on mount
  useEffect(() => {
    setValue('role', 'employee');
    setValue('status', 'active');
  }, [setValue]);

  // Sync default shift times from organization settings when loaded
  useEffect(() => {
    if (orgSettings?.officeStartTime || orgSettings?.officeEndTime) {
      const defaultStart = orgSettings.officeStartTime || '09:00';
      const defaultEnd = orgSettings.officeEndTime || '18:00';
      setValue('shiftStartTime', defaultStart);
      setValue('shiftEndTime', defaultEnd);
      setWeeklySchedule((prev) =>
        prev.map((item) => ({
          ...item,
          startTime: defaultStart,
          endTime: defaultEnd,
        }))
      );
    }
  }, [orgSettings, setValue]);

  // Create Mutation
  const mutation = useMutation({
    mutationFn: (formData: FormData) => employeeService.createEmployee(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminEmployees'] });
      queryClient.invalidateQueries({ queryKey: ['adminDashboardMetrics'] });
      navigate('/admin/employees');
    },
    onError: (err: any) => {
      setError(err?.message || 'Failed to register the new employee.');
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setFileError('Please select a valid image file (PNG/JPG/JPEG).');
        return;
      }
      setSelectedFile(file);
      setFileError(null);

      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const onSubmit = (data: EmployeeFormValues) => {
    setError(null);
    setFileError(null);

    if (!selectedFile) {
      setFileError('Corporate profile picture is mandatory for biometric face registration.');
      return;
    }

    if (data.role === 'admin' && !isOwner) {
      setError('Only organization owners can grant administrator privileges.');
      return;
    }

    const formData = new FormData();
    formData.append('name', data.name);
    formData.append('email', data.email);
    formData.append('phone', data.phone);
    formData.append('designation', data.designation);
    formData.append('department', data.department);
    formData.append('role', isOwner ? data.role : 'employee');
    formData.append('status', data.status);
    formData.append('avatar', selectedFile);

    // Shift Schedule
    formData.append('shiftType', data.shiftType);
    if (data.shiftType === 'custom') {
      formData.append('weeklySchedule', JSON.stringify(weeklySchedule));
    }

    mutation.mutate(formData);
  };

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto', width: '100%' }}>
      {/* Back button */}
      <Button
        startIcon={<BackIcon />}
        onClick={() => navigate('/admin/employees')}
        sx={{ mb: 2, color: 'text.secondary' }}
      >
        Back to Directory
      </Button>

      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          Onboard New Employee
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Register a new corporate identity, assign departments, roles, and setup baseline permissions.
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {/* Main Card Form */}
      <Card sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <Grid container spacing={3}>

              {/* Primary Personal Information Section */}
              <Grid size={{ xs: 12 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5, color: 'primary.main' }}>
                  1. Personal & Contact Information
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                  Baseline contact details of the incoming staff member.
                </Typography>
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="Full Name"
                  placeholder="e.g. Richard Hendricks"
                  error={!!errors.name}
                  helperText={errors.name?.message}
                  disabled={mutation.isPending}
                  {...register('name')}
                  slotProps={{
                    input: {
                      startAdornment: <PersonIcon sx={{ color: 'text.secondary', mr: 1 }} />,
                    },
                  }}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="Corporate Email Address"
                  placeholder="richard@checkpoint.io"
                  error={!!errors.email}
                  helperText={errors.email?.message}
                  disabled={mutation.isPending}
                  {...register('email')}
                  slotProps={{
                    input: {
                      startAdornment: <EmailIcon sx={{ color: 'text.secondary', mr: 1 }} />,
                    },
                  }}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="Contact Phone"
                  placeholder="+1 (555) 012-3456"
                  error={!!errors.phone}
                  helperText={errors.phone?.message}
                  disabled={mutation.isPending}
                  {...register('phone')}
                  slotProps={{
                    input: {
                      startAdornment: <PhoneIcon sx={{ color: 'text.secondary', mr: 1 }} />,
                    },
                  }}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <Box>
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    disabled={mutation.isPending}
                  />
                  <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                    <Avatar
                      src={previewUrl || undefined}
                      sx={{ width: 64, height: 64, border: '2px solid', borderColor: fileError ? 'error.main' : 'divider' }}
                    >
                      <PersonIcon sx={{ fontSize: 32 }} />
                    </Avatar>
                    <Box>
                      <Button
                        variant="outlined"
                        component="span"
                        size="small"
                        startIcon={<CloudUploadIcon />}
                        onClick={() => fileInputRef.current?.click()}
                        disabled={mutation.isPending}
                        sx={{ textTransform: 'none', borderRadius: 2 }}
                      >
                        Upload Profile Photo *
                      </Button>
                      {previewUrl && (
                        <Button
                          variant="text"
                          color="error"
                          size="small"
                          startIcon={<DeleteIcon />}
                          onClick={handleRemoveFile}
                          disabled={mutation.isPending}
                          sx={{ ml: 1, textTransform: 'none' }}
                        >
                          Remove
                        </Button>
                      )}
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        Supported formats: JPG, PNG, JPEG. Mandatory for Face Matching.
                      </Typography>
                    </Box>
                  </Box>
                  {fileError && (
                    <FormHelperText error sx={{ mt: 1, fontWeight: 500 }}>
                      {fileError}
                    </FormHelperText>
                  )}
                </Box>
              </Grid>

              <Grid size={{ xs: 12 }}>
                <Divider sx={{ my: 1 }} />
              </Grid>

              {/* Placement Section */}
              <Grid size={{ xs: 12 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5, color: 'primary.main' }}>
                  2. Organization Placement & Scope
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                  Departmental roles, titles, and system authorizations.
                </Typography>
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="Official Designation / Title"
                  placeholder="e.g. DevOps Lead"
                  error={!!errors.designation}
                  helperText={errors.designation?.message}
                  disabled={mutation.isPending}
                  {...register('designation')}
                  slotProps={{
                    input: {
                      startAdornment: <WorkIcon sx={{ color: 'text.secondary', mr: 1 }} />,
                    },
                  }}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth error={!!errors.department}>
                  <InputLabel id="dept-select-label">Department / Cost Center *</InputLabel>
                  <Controller
                    name="department"
                    control={control}
                    defaultValue=""
                    render={({ field }) => (
                      <Select
                        {...field}
                        value={field.value || ''}
                        labelId="dept-select-label"
                        id="dept-select"
                        label="Department / Cost Center *"
                        disabled={mutation.isPending}
                      >
                        {STANDARD_DEPARTMENTS.map((dept) => (
                          <MenuItem key={dept} value={dept}>
                            {dept}
                          </MenuItem>
                        ))}
                      </Select>
                    )}
                  />
                  {errors.department && (
                    <FormHelperText error>{errors.department.message}</FormHelperText>
                  )}
                </FormControl>
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth error={!!errors.role}>
                  <InputLabel id="role-select-label">Access Authorization Role</InputLabel>
                  <Controller
                    name="role"
                    control={control}
                    defaultValue="employee"
                    render={({ field }) => (
                      <Select
                        {...field}
                        value={field.value || 'employee'}
                        labelId="role-select-label"
                        id="role-select"
                        label="Access Authorization Role"
                        disabled={mutation.isPending}
                        readOnly={!isOwner}
                        inputProps={{ readOnly: !isOwner }}
                        sx={{
                          '& .MuiSelect-select': {
                            color: 'text.primary',
                            fontWeight: 600,
                          },
                        }}
                      >
                        <MenuItem value="employee">Standard Employee</MenuItem>
                        <MenuItem value="admin" disabled={!isOwner}>
                          Platform Administrator {!isOwner ? '(Requires Owner Access)' : ''}
                        </MenuItem>
                      </Select>
                    )}
                  />
                  {errors.role ? (
                    <FormHelperText>{errors.role.message}</FormHelperText>
                  ) : !isOwner ? (
                    <FormHelperText sx={{ color: 'text.secondary' }}>
                      Admins have access to create Standard Employees only.
                    </FormHelperText>
                  ) : null}
                </FormControl>
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth error={!!errors.status}>
                  <InputLabel id="status-select-label">Initial Employment Status</InputLabel>
                  <Controller
                    name="status"
                    control={control}
                    defaultValue="active"
                    render={({ field }) => (
                      <Select
                        {...field}
                        value={field.value || 'active'}
                        labelId="status-select-label"
                        id="status-select"
                        label="Initial Employment Status"
                        disabled={mutation.isPending}
                      >
                        <MenuItem value="active">Active Duty</MenuItem>
                        <MenuItem value="inactive">Suspended / Inactive</MenuItem>
                      </Select>
                    )}
                  />
                  {errors.status && <FormHelperText>{errors.status.message}</FormHelperText>}
                </FormControl>
              </Grid>

              <Grid size={{ xs: 12 }}>
                <Divider sx={{ my: 1 }} />
              </Grid>

              {/* 3. Shift & Working Schedule Configuration */}
              <Grid size={{ xs: 12 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ClockIcon fontSize="small" />
                  3. Shift & Working Schedule
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                  Assign the employee's work schedule. Choose between the organization's standard corporate hours or a personalized custom shift.
                </Typography>
              </Grid>

              {/* Shift Selector Buttons */}
              <Grid size={{ xs: 12 }}>
                <ToggleButtonGroup
                  value={watchShiftType}
                  exclusive
                  onChange={(_, val) => {
                    if (val) setValue('shiftType', val, { shouldValidate: true });
                  }}
                  fullWidth
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                    gap: 2,
                    '& .MuiToggleButtonGroup-grouped': {
                      border: (theme) => `1.5px solid ${theme.palette.divider} !important`,
                      borderRadius: '12px !important',
                      p: 2,
                      mx: 0,
                      justifyContent: 'flex-start',
                      textAlign: 'left',
                      transition: 'all 0.2s ease-in-out',
                      '&.Mui-selected': {
                        borderColor: (theme) => `${theme.palette.primary.main} !important`,
                        backgroundColor: (theme) =>
                          theme.palette.mode === 'dark' ? 'rgba(99, 102, 241, 0.12)' : 'rgba(99, 102, 241, 0.05)',
                        boxShadow: (theme) =>
                          theme.palette.mode === 'dark'
                            ? '0 4px 12px rgba(0, 0, 0, 0.3)'
                            : '0 4px 12px rgba(99, 102, 241, 0.1)',
                        '&:hover': {
                          backgroundColor: (theme) =>
                            theme.palette.mode === 'dark' ? 'rgba(99, 102, 241, 0.16)' : 'rgba(99, 102, 241, 0.08)',
                        },
                      },
                      '&:hover': {
                        borderColor: (theme) => theme.palette.text.secondary,
                      },
                    },
                  }}
                >
                  <ToggleButton value="general">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                      <Avatar
                        sx={{
                          width: 40,
                          height: 40,
                          bgcolor: watchShiftType === 'general' ? 'primary.main' : 'action.selected',
                          color: watchShiftType === 'general' ? 'primary.contrastText' : 'text.secondary',
                          transition: 'all 0.2s',
                        }}
                      >
                        <BusinessIcon fontSize="small" />
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.25 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: watchShiftType === 'general' ? 'primary.main' : 'text.primary' }}>
                            General Shift
                          </Typography>
                          {watchShiftType === 'general' && (
                            <Chip
                              label="Active"
                              size="small"
                              color="primary"
                              sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700 }}
                            />
                          )}
                        </Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          Inherit standard company hours
                        </Typography>
                      </Box>
                    </Box>
                  </ToggleButton>

                  <ToggleButton value="custom">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                      <Avatar
                        sx={{
                          width: 40,
                          height: 40,
                          bgcolor: watchShiftType === 'custom' ? 'primary.main' : 'action.selected',
                          color: watchShiftType === 'custom' ? 'primary.contrastText' : 'text.secondary',
                          transition: 'all 0.2s',
                        }}
                      >
                        <TuneIcon fontSize="small" />
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.25 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: watchShiftType === 'custom' ? 'primary.main' : 'text.primary' }}>
                            Custom Shift
                          </Typography>
                          {watchShiftType === 'custom' && (
                            <Chip
                              label="Active"
                              size="small"
                              color="primary"
                              sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700 }}
                            />
                          )}
                        </Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          Set custom start & end time
                        </Typography>
                      </Box>
                    </Box>
                  </ToggleButton>
                </ToggleButtonGroup>
              </Grid>

              {/* General Shift Selected Display */}
              {watchShiftType === 'general' && (
                <Grid size={{ xs: 12 }}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2.5,
                      borderRadius: 2.5,
                      border: '1.5px solid',
                      borderColor: 'divider',
                      bgcolor: (theme) =>
                        theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.015)',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <ClockIcon sx={{ color: 'primary.main', fontSize: 26 }} />
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                            Organization Configured Shift
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Standard operating hours defined in Organization
                          </Typography>
                        </Box>
                      </Box>

                      {isLoadingSettings ? (
                        <Skeleton variant="rounded" width={220} height={32} />
                      ) : (
                        <Chip
                          icon={<AccessTimeIcon sx={{ fontSize: 16 }} />}
                          label={`${formatTime12Hour(orgSettings?.officeStartTime || '09:00')} - ${formatTime12Hour(orgSettings?.officeEndTime || '18:00')} (${orgSettings?.officeStartTime || '09:00'} - ${orgSettings?.officeEndTime || '18:00'})`}
                          color="primary"
                          variant="outlined"
                          sx={{ fontWeight: 700, fontSize: '0.8rem', py: 0.5, px: 0.5 }}
                        />
                      )}
                    </Box>

                    <Divider sx={{ my: 1.5, borderStyle: 'dashed' }} />

                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                      <InfoIcon sx={{ fontSize: 18, color: 'text.secondary', mt: 0.2 }} />
                      <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                        This employee will automatically follow the company's baseline schedule (<strong>{formatTime12Hour(orgSettings?.officeStartTime || '09:00')} to {formatTime12Hour(orgSettings?.officeEndTime || '18:00')}</strong>). Late mark evaluation and daily attendance calculations will use these hours.
                      </Typography>
                    </Box>
                  </Paper>
                </Grid>
              )}

              {/* Custom Shift Selected: Day-Wise Shift Configuration */}
              {watchShiftType === 'custom' && (
                <Grid size={{ xs: 12 }}>
                  <DayWiseShiftPicker
                    value={weeklySchedule}
                    onChange={(newSched) => {
                      setWeeklySchedule(newSched);
                    }}
                    disabled={mutation.isPending}
                  />
                </Grid>
              )}

              <Grid size={{ xs: 12 }}>
                <Divider sx={{ my: 1 }} />
              </Grid>

              <Grid size={{ xs: 12 }} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                <Button
                  variant="outlined"
                  onClick={() => navigate('/admin/employees')}
                  disabled={mutation.isPending}
                  sx={{ py: 1.25, px: 3 }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  disabled={mutation.isPending}
                  startIcon={mutation.isPending ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                  sx={{ py: 1.25, px: 4 }}
                >
                  {mutation.isPending ? 'Onboarding...' : 'Onboard Employee'}
                </Button>
              </Grid>

            </Grid>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};

export default CreateEmployee;
