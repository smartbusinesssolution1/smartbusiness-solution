import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { attendanceService } from '../../services/attendanceService';
import { settingsService } from '../../services/settingsService';
import { useGeolocation } from '../../hooks/useGeolocation';
import { AttendanceCameraDialog } from '../../components/AttendanceCameraDialog';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Avatar,
  Divider,
  Paper,
  CircularProgress,
  Snackbar,
  Alert,
  Chip,
  Skeleton,
  IconButton,
  useTheme,
  LinearProgress,
} from '@mui/material';
import {
  PlayArrow as CheckInIcon,
  Stop as CheckOutIcon,
  Schedule as ClockIcon,
  CheckCircle as PresentIcon,
  Warning as LateIcon,
  MyLocation as LocationIcon,
  HelpOutlined as UnknownIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import dayjs from 'dayjs';

export const EmployeeDashboard: React.FC = () => {
  const { user } = useAuth();
  const theme = useTheme();
  const queryClient = useQueryClient();

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const [simulatedCoords, setSimulatedCoords] = useState<{ latitude: number; longitude: number } | undefined>(undefined);
  const [usingGeo, setUsingGeo] = useState<boolean>(false);

  const { getPosition, loading: isLocating } = useGeolocation();
  const [cameraDialogOpen, setCameraDialogOpen] = useState<boolean>(false);
  const [currentCoords, setCurrentCoords] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);

  // Fetch metrics
  const { data: metrics, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['employeeDashboardMetrics', user?.employeeId],
    queryFn: () => attendanceService.getMyDashboardMetrics(user?.employeeId || ''),
    enabled: !!user?.employeeId,
  });

  // Check In Mutation
  const checkInMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      return attendanceService.checkIn(formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employeeDashboardMetrics', user?.employeeId] });
      queryClient.invalidateQueries({ queryKey: ['employeeAttendanceHistory', user?.employeeId] });
      setSnackbar({
        open: true,
        message: 'Attendance marked successfully.',
        severity: 'success',
      });
    },
    onError: (error: any) => {
      const serverError = error?.response?.data?.error || error?.message || 'Check-in failed.';
      setSnackbar({
        open: true,
        message: serverError,
        severity: 'error',
      });
    },
  });

  // Check Out Mutation
  const checkOutMutation = useMutation({
    mutationFn: () => attendanceService.checkOut(user?.employeeId || ''),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['employeeDashboardMetrics', user?.employeeId] });
      queryClient.invalidateQueries({ queryKey: ['employeeAttendanceHistory', user?.employeeId] });
      setSnackbar({
        open: true,
        message: `Check-out successful at ${dayjs(`${dayjs().format('YYYY-MM-DD')} ${data.checkOut}`).format('hh:mm A')}! Total hours: ${data.workingHours} hrs.`,
        severity: 'success',
      });
    },
    onError: (error: any) => {
      setSnackbar({
        open: true,
        message: error?.message || 'Check-out failed.',
        severity: 'error',
      });
    },
  });

  const triggerCheckIn = async () => {
    if (usingGeo) {
      try {
        // Request browser location permission via HTML5 Geolocation API
        const position = await getPosition();
        const coords = {
          latitude: position.latitude,
          longitude: position.longitude,
          accuracy: position.accuracy,
        };
        setSimulatedCoords(coords);
        setCurrentCoords(coords);
        // Open selfie capture dialog
        setCameraDialogOpen(true);
      } catch (err: any) {
        setSnackbar({
          open: true,
          message: err?.message || 'Location permission is required to check in.',
          severity: 'error',
        });
      }
    } else {
      try {
        // Use mock coordinates when real geofencing verification is disabled
        const settings = await settingsService.getSettings();
        const coords = {
          latitude: settings.latitude,
          longitude: settings.longitude,
          accuracy: 15,
        };
        setSimulatedCoords(coords);
        setCurrentCoords(coords);
        // Open selfie capture dialog
        setCameraDialogOpen(true);
      } catch (err: any) {
        setSnackbar({
          open: true,
          message: 'Failed to fetch office configuration settings from server.',
          severity: 'error',
        });
      }
    }
  };

  const handleCaptureSelfie = (selfieFile: File) => {
    if (!currentCoords) return;

    const formData = new FormData();
    formData.append('selfie', selfieFile);
    formData.append('latitude', String(currentCoords.latitude));
    formData.append('longitude', String(currentCoords.longitude));
    formData.append('accuracy', String(currentCoords.accuracy));
    formData.append('capturedAt', new Date().toISOString());
    formData.append('employeeId', user?.employeeId || '');
    formData.append('employeeName', user?.name || '');

    checkInMutation.mutate(formData);
  };

  const triggerCheckOut = () => {
    checkOutMutation.mutate();
  };

  // Get greeting text based on current hour
  const getGreeting = () => {
    const hr = dayjs().hour();
    if (hr < 12) return 'Good Morning';
    if (hr < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const isCheckedIn = !!metrics?.todayAttendance?.checkIn;
  const isCheckedOut = !!metrics?.todayAttendance?.checkOut;

  // Calculate circular progress percentage for working hours
  const workingHoursToday = metrics?.todayAttendance?.workingHours || 0;
  // If checked in but not checked out, calculate elapsed hours in real time
  const getElapsedHours = () => {
    if (isCheckedOut) return workingHoursToday;
    if (isCheckedIn && metrics?.todayAttendance?.checkIn) {
      const todayStr = dayjs().format('YYYY-MM-DD');
      const checkInTime = dayjs(`${todayStr} ${metrics.todayAttendance.checkIn}`, 'YYYY-MM-DD HH:mm:ss');
      const elapsed = parseFloat(dayjs().diff(checkInTime, 'hour', true).toFixed(2));
      return isNaN(elapsed) ? 0 : elapsed;
    }
    return 0;
  };

  const elapsedHours = parseFloat(getElapsedHours().toFixed(2));
  const workHoursPercentage = Math.min(100, Math.round((elapsedHours / 8) * 100));

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'present':
        return <Chip label="On Time" color="success" size="small" icon={<PresentIcon />} />;
      case 'late':
        return <Chip label="Late" color="warning" size="small" icon={<LateIcon />} />;
      case 'absent':
        return <Chip label="Absent" color="error" size="small" />;
      case 'auto_closed':
        return <Chip label="Auto-Closed" color="secondary" size="small" />;
      default:
        return <Chip label={status} size="small" />;
    }
  };

  return (
    <Box>
      {/* Header section */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            Employee Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Log your check-in, track hours, and monitor attendance metrics.
          </Typography>
        </Box>
        <IconButton onClick={() => refetch()} disabled={isLoading || isFetching} size="small" sx={{ border: `1px solid ${theme.palette.divider}` }}>
          <RefreshIcon />
        </IconButton>
      </Box>

      {/* Loading Skeletons */}
      {isLoading ? (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 8 }}>
            <Skeleton variant="rectangular" height={180} sx={{ borderRadius: 3, mb: 3 }} />
            <Skeleton variant="rectangular" height={260} sx={{ borderRadius: 3 }} />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Skeleton variant="rectangular" height={150} sx={{ borderRadius: 3, mb: 3 }} />
            <Skeleton variant="rectangular" height={280} sx={{ borderRadius: 3 }} />
          </Grid>
        </Grid>
      ) : (
        <Grid container spacing={3}>
          
          {/* Welcome Card & Action Section */}
          <Grid size={{ xs: 12, md: 8 }}>
            <Card sx={{ borderRadius: 3, mb: 3, position: 'relative', overflow: 'hidden' }}>
              <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, bgcolor: 'primary.main' }} />
              <CardContent sx={{ p: 4 }}>
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', gap: 3 }}>
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <Avatar
                      src={user?.avatarUrl}
                      alt={user?.name}
                      sx={{ width: 64, height: 64, border: `2px solid ${theme.palette.primary.main}` }}
                    />
                    <Box>
                      <Typography variant="h5" sx={{ fontWeight: 800 }}>
                        {getGreeting()}, {user?.name.split(' ')[0]}!
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                        {user?.designation} • {user?.department}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" component="span" sx={{ display: 'block', mt: 0.5 }}>
                        Corporate ID: <span style={{ fontWeight: 700 }}>{user?.employeeId}</span>
                      </Typography>
                    </Box>
                  </Box>

                  {/* Date & Time display */}
                  <Box sx={{ textAlign: { xs: 'left', sm: 'right' }, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
                      {dayjs().format('hh:mm A')}
                    </Typography>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {dayjs().format('dddd, MMMM D, YYYY')}
                    </Typography>
                  </Box>
                </Box>

                <Divider sx={{ my: 3 }} />

                {/* Main Clock Action */}
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 1 }}>
                  <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 1.5, mb: 1 }}>
                    SHIFT STATUS
                  </Typography>
                  
                  {isCheckedOut ? (
                    <Alert severity="success" icon={<PresentIcon />} sx={{ width: '100%', maxWidth: 450, borderRadius: 2, mb: 2 }}>
                      Shift completed successfully today. Thank you!
                    </Alert>
                  ) : isCheckedIn ? (
                    <Alert severity="info" icon={<ClockIcon />} sx={{ width: '100%', maxWidth: 450, borderRadius: 2, mb: 2 }}>
                      You are checked in and active. Keep up the great work!
                    </Alert>
                  ) : (
                    <Alert severity="warning" icon={<LateIcon />} sx={{ width: '100%', maxWidth: 450, borderRadius: 2, mb: 2 }}>
                      You have not checked in yet for today's shift.
                    </Alert>
                  )}

                  <Box sx={{ display: 'flex', gap: 2, width: '100%', maxWidth: 450, mt: 1 }}>
                    <Button
                      fullWidth
                      variant="contained"
                      color="primary"
                      size="large"
                      disabled={isCheckedIn || checkInMutation.isPending || isLocating}
                      startIcon={<CheckInIcon />}
                      onClick={triggerCheckIn}
                      sx={{ py: 1.5, borderRadius: 2, fontWeight: 700 }}
                    >
                      {checkInMutation.isPending || isLocating ? (
                        <CircularProgress size={24} color="inherit" />
                      ) : (
                        'Check In'
                      )}
                    </Button>

                    <Button
                      fullWidth
                      variant="contained"
                      color="secondary"
                      size="large"
                      disabled={!isCheckedIn || isCheckedOut || checkOutMutation.isPending}
                      startIcon={<CheckOutIcon />}
                      onClick={triggerCheckOut}
                      sx={{ py: 1.5, borderRadius: 2, fontWeight: 700 }}
                    >
                      {checkOutMutation.isPending ? <CircularProgress size={24} color="inherit" /> : 'Check Out'}
                    </Button>
                  </Box>
                  
                  {/* Geolocation confirmation switch */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
                    <input 
                      type="checkbox" 
                      id="geo-toggle" 
                      checked={usingGeo}
                      onChange={(e) => setUsingGeo(e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                    <label htmlFor="geo-toggle" style={{ fontSize: '0.75rem', color: theme.palette.text.secondary, cursor: 'pointer', fontWeight: 600 }}>
                      Confirm Geolocation coordinates on Check-In
                    </label>
                  </Box>

                  {metrics?.todayAttendance?.notes && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <LocationIcon sx={{ fontSize: 14, color: 'primary.main' }} />
                      GPS Note: {metrics.todayAttendance.notes}
                    </Typography>
                  )}
                </Box>
              </CardContent>
            </Card>

            {/* Recent Attendance Log list */}
            <Card sx={{ borderRadius: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2.5 }}>
                  Recent Attendance (Last 5 Days)
                </Typography>
                {metrics?.recentAttendance && metrics.recentAttendance.length > 0 ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {metrics.recentAttendance.map((record) => (
                      <Paper
                        key={record.id}
                        variant="outlined"
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: { xs: 'wrap', sm: 'nowrap' },
                          gap: 2,
                          borderColor: theme.palette.divider,
                        }}
                      >
                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                          <Paper
                            elevation={0}
                            sx={{
                              p: 1,
                              borderRadius: 2,
                              bgcolor: 'action.hover',
                              textAlign: 'center',
                              minWidth: 60,
                            }}
                          >
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: 'block' }}>
                              {dayjs(record.date).format('MMM')}
                            </Typography>
                            <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1 }}>
                              {dayjs(record.date).format('DD')}
                            </Typography>
                          </Paper>
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                              {dayjs(record.date).format('dddd')}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              In: {record.checkIn ? dayjs(`${record.date} ${record.checkIn}`).format('hh:mm A') : '--'} • Out: {record.checkOut ? dayjs(`${record.date} ${record.checkOut}`).format('hh:mm A') : '--'}
                            </Typography>
                          </Box>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, ml: { xs: 0, sm: 'auto' } }}>
                          <Box sx={{ textAlign: 'right' }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                              {record.workingHours ? `${record.workingHours} hrs` : '--'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              Logged Time
                            </Typography>
                          </Box>
                          {getStatusChip(record.status)}
                        </Box>
                      </Paper>
                    ))}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                    No recent attendance logs found.
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Side Panels - Today's Attendance & Working Hours summary */}
          <Grid size={{ xs: 12, md: 4 }}>
            {/* Today's Attendance Status Card */}
            <Card sx={{ borderRadius: 3, mb: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 700, mb: 2 }}>
                  TODAY'S RECORD
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ClockIcon color="action" />
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>Check In</Typography>
                    </Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      {metrics?.todayAttendance?.checkIn 
                        ? dayjs(`${dayjs().format('YYYY-MM-DD')} ${metrics.todayAttendance.checkIn}`).format('hh:mm A') 
                        : '--:--'}
                    </Typography>
                  </Box>

                  <Divider />

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ClockIcon color="action" />
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>Check Out</Typography>
                    </Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      {metrics?.todayAttendance?.checkOut 
                        ? dayjs(`${dayjs().format('YYYY-MM-DD')} ${metrics.todayAttendance.checkOut}`).format('hh:mm A') 
                        : '--:--'}
                    </Typography>
                  </Box>

                  <Divider />

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PresentIcon color="action" />
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>Status</Typography>
                    </Box>
                    {metrics?.todayAttendance?.status 
                      ? getStatusChip(metrics.todayAttendance.status) 
                      : <Chip label="Unreported" size="small" />}
                  </Box>
                </Box>
              </CardContent>
            </Card>

            {/* Working Hours Ring / Progress Card */}
            <Card sx={{ borderRadius: 3, mb: 3 }}>
              <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <Box sx={{ alignSelf: 'flex-start', width: '100%', mb: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 700, textAlign: 'left' }}>
                    SHIFT PROGRESS TODAY
                  </Typography>
                </Box>

                <Box sx={{ position: 'relative', display: 'inline-flex', my: 2 }}>
                  <CircularProgress
                    variant="determinate"
                    value={100}
                    size={120}
                    thickness={4}
                    sx={{ color: 'action.hover' }}
                  />
                  <CircularProgress
                    variant="determinate"
                    value={workHoursPercentage}
                    size={120}
                    thickness={4}
                    sx={{
                      color: elapsedHours >= 8 ? 'success.main' : 'primary.main',
                      position: 'absolute',
                      left: 0,
                    }}
                  />
                  <Box
                    sx={{
                      top: 0,
                      left: 0,
                      bottom: 0,
                      right: 0,
                      position: 'absolute',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1 }}>
                      {elapsedHours}h
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                      of 8.0 hrs
                    </Typography>
                  </Box>
                </Box>

                <Typography variant="body2" sx={{ fontWeight: 600, mt: 1 }}>
                  {workHoursPercentage}% Workday Tracked
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ px: 2, mt: 0.5 }}>
                  Active logging calculates actual elapsed duration since check-in.
                </Typography>
              </CardContent>
            </Card>

            {/* High-level Attendance statistics widget */}
            <Card sx={{ borderRadius: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 700, mb: 2.5 }}>
                  MONTHLY METRICS SUMMARY
                </Typography>
                
                <Grid container spacing={2}>
                  <Grid size={{ xs: 6 }}>
                    <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', borderRadius: 2 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                        ATTENDANCE RATE
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: 'primary.main' }}>
                        {metrics?.attendanceRate || 100}%
                      </Typography>
                    </Paper>
                  </Grid>

                  <Grid size={{ xs: 6 }}>
                    <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', borderRadius: 2 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                        TOTAL LATE DAYS
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: 'warning.main' }}>
                        {metrics?.totalLate || 0} d
                      </Typography>
                    </Paper>
                  </Grid>

                  <Grid size={{ xs: 12 }}>
                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                          TOTAL WORKING HOURS
                        </Typography>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: 'success.main' }}>
                          {metrics?.totalWorkingHours || 0} hrs
                        </Typography>
                      </Box>
                      <LinearProgress 
                        variant="determinate" 
                        value={Math.min(100, Math.round(((metrics?.totalWorkingHours || 0) / 160) * 100))} 
                        sx={{ height: 6, borderRadius: 3 }} 
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, fontSize: '0.7rem' }}>
                        Based on standard monthly threshold of 160 hours
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

        </Grid>
      )}

      {/* Snackbar notification */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
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

      <AttendanceCameraDialog
        open={cameraDialogOpen}
        onClose={() => setCameraDialogOpen(false)}
        employeeId={user?.employeeId || ''}
        employeeName={user?.name || ''}
        latitude={currentCoords?.latitude || null}
        longitude={currentCoords?.longitude || null}
        accuracy={currentCoords?.accuracy || null}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['employeeDashboardMetrics', user?.employeeId] });
          queryClient.invalidateQueries({ queryKey: ['employeeAttendanceHistory', user?.employeeId] });
          setSnackbar({
            open: true,
            message: 'Attendance marked successfully after matching face!',
            severity: 'success',
          });
        }}
      />
    </Box>
  );
};

export default EmployeeDashboard;
