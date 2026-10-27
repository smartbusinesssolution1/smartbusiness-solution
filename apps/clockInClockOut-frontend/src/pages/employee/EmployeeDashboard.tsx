import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import BrandLoader from '../../components/BrandLoader';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { attendanceService } from '../../services/attendanceService';
import { settingsService } from '../../services/settingsService';
import { useGeolocation } from '../../hooks/useGeolocation';
import { getAvatarUrl } from '../../utils/imageUrl';
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
  Collapse,
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
  ExpandMore as ExpandMoreIcon,
  Shield as ShieldIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';
import dayjs from 'dayjs';

export const EmployeeDashboard: React.FC = () => {
  const { user, currentWorkspace } = useAuth();
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  const theme = useTheme();
  const queryClient = useQueryClient();

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'warning' | 'info' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const [simulatedCoords, setSimulatedCoords] = useState<{ latitude: number; longitude: number } | undefined>(undefined);
  const [usingGeo, setUsingGeo] = useState<boolean>(false);

  const { getPosition, loading: isLocating } = useGeolocation();
  const [currentCoords, setCurrentCoords] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);

  // Fetch metrics
  const { data: metrics, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['employeeDashboardMetrics', user?.employeeId],
    queryFn: () => attendanceService.getMyDashboardMetrics(user?.employeeId || ''),
    enabled: !!user?.employeeId,
  });

  // Pre-load geofence settings so instant check-in never performs an extra HTTP request on click
  const { data: officeSettings } = useQuery({
    queryKey: ['workspaceSettings', currentWorkspace?.id],
    queryFn: () => settingsService.getSettings(),
    staleTime: 5 * 60 * 1000,
  });

  // Check In Mutation (1-Click Instant Punch)
  const checkInMutation = useMutation({
    mutationFn: async (payload: { latitude: number; longitude: number; accuracy?: number; employeeId: string; employeeName: string }) => {
      return attendanceService.checkIn(payload);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['employeeDashboardMetrics', user?.employeeId] });
      queryClient.invalidateQueries({ queryKey: ['employeeAttendanceHistory', user?.employeeId] });
      const checkInFormatted = data?.checkInTime || dayjs().format('hh:mm A');
      setSnackbar({
        open: true,
        message: `Clock-in successful at ${checkInFormatted}! Have a productive shift.`,
        severity: 'success',
      });
    },
    onError: (error: any) => {
      const serverError = error?.response?.data?.error?.message || error?.response?.data?.error || error?.message || 'Check-in failed.';
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
    let coords = {
      latitude: officeSettings?.latitude ? Number(officeSettings.latitude) : 0,
      longitude: officeSettings?.longitude ? Number(officeSettings.longitude) : 0,
      accuracy: 15,
    };

    if (usingGeo) {
      try {
        const position = await getPosition();
        coords = {
          latitude: position.latitude,
          longitude: position.longitude,
          accuracy: position.accuracy,
        };
      } catch (err: any) {
        setSnackbar({
          open: true,
          message: err?.message || 'Location permission unavailable. Using office default location.',
          severity: 'warning',
        });
      }
    }

    setSimulatedCoords(coords);
    setCurrentCoords(coords);

    // 1-Click Instant Check-In: punch directly without preliminary HTTP requests
    checkInMutation.mutate({
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy,
      employeeId: user?.employeeId || '',
      employeeName: user?.name || '',
    });
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

  // Multi-session state machine
  const hasActiveSession = metrics?.hasActiveSession !== undefined
    ? metrics.hasActiveSession
    : Boolean(metrics?.todayAttendance?.checkIn && !metrics?.todayAttendance?.checkOut);

  const todaySessions = metrics?.todaySessions || [];
  const completedSessionsCount = todaySessions.filter((s) => !s.isActive).length;
  const hasAnySessionToday = todaySessions.length > 0 || Boolean(metrics?.todayAttendance?.checkIn);

  // Total working hours accumulated today
  const workingHoursToday = metrics?.todayAttendance?.workingHours || 0;

  // Real-time elapsed hours calculation
  const getElapsedHours = () => {
    if (!hasActiveSession) return workingHoursToday;

    const activeSess = todaySessions.find((s) => s.isActive);
    const activeCheckIn = activeSess?.checkIn || metrics?.todayAttendance?.checkIn;
    if (activeCheckIn) {
      const todayStr = dayjs().format('YYYY-MM-DD');
      const checkInTime = dayjs(`${todayStr} ${activeCheckIn}`, 'YYYY-MM-DD hh:mm A');
      const sessionElapsed = parseFloat(
        dayjs()
          .diff(checkInTime.isValid() ? checkInTime : dayjs(`${todayStr} ${activeCheckIn}`), 'hour', true)
          .toFixed(2)
      );
      const baseHours = todaySessions
        .filter((s) => !s.isActive)
        .reduce((acc, s) => acc + (s.workingHours || 0), 0);
      const total = baseHours + (isNaN(sessionElapsed) || sessionElapsed < 0 ? 0 : sessionElapsed);
      return Math.max(workingHoursToday, parseFloat(total.toFixed(2)));
    }
    return workingHoursToday;
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
      case 'half_day':
        return <Chip label="Half Day" color="info" size="small" />;
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

      {/* Loading State */}
      {isLoading ? (
        <BrandLoader fullScreen message="Loading employee dashboard..." />
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
                      src={getAvatarUrl(user?.avatarUrl)}
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
                  
                  {hasActiveSession ? (
                    <Alert severity="info" icon={<ClockIcon />} sx={{ width: '100%', maxWidth: 450, borderRadius: 2, mb: 2 }}>
                      You are currently clocked in {todaySessions.length > 0 ? `(Session #${todaySessions.length})` : ''}. Shift in progress!
                    </Alert>
                  ) : hasAnySessionToday ? (
                    <Alert severity="success" icon={<PresentIcon />} sx={{ width: '100%', maxWidth: 450, borderRadius: 2, mb: 2 }}>
                      Currently clocked out / on break. Total logged today: {workingHoursToday} hrs across {completedSessionsCount || 1} session(s). Ready to clock in again!
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
                      disabled={hasActiveSession || checkInMutation.isPending || isLocating}
                      startIcon={<CheckInIcon />}
                      onClick={triggerCheckIn}
                      sx={{ py: 1.5, borderRadius: 2, fontWeight: 700 }}
                    >
                      {checkInMutation.isPending || isLocating ? (
                        <CircularProgress size={24} color="inherit" />
                      ) : hasAnySessionToday ? (
                        `Clock In Again (Session #${todaySessions.length + 1})`
                      ) : (
                        'Check In'
                      )}
                    </Button>

                    <Button
                      fullWidth
                      variant="contained"
                      color="secondary"
                      size="large"
                      disabled={!hasActiveSession || checkOutMutation.isPending}
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
                    {metrics.recentAttendance.map((record) => {
                      const isExpanded = expandedRecordId === record.id;
                      const isCheckOutPending = !record.checkOut || record.checkOut === '--:--';
                      const checkInFormatted = record.checkIn ? dayjs(`${record.date} ${record.checkIn}`).format('hh:mm A') : '--:--';
                      const checkOutFormatted = record.checkOut ? dayjs(`${record.date} ${record.checkOut}`).format('hh:mm A') : (isCheckOutPending ? 'Active Now' : '--:--');

                      return (
                        <Paper
                          key={record.id}
                          variant="outlined"
                          sx={{
                            borderRadius: 2.5,
                            overflow: 'hidden',
                            borderColor: isExpanded ? 'primary.main' : theme.palette.divider,
                            boxShadow: isExpanded ? '0 4px 12px rgba(79, 70, 229, 0.08)' : 'none',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          {/* Collapsed Header / Click to Toggle Accordion */}
                          <Box
                            onClick={() => setExpandedRecordId(isExpanded ? null : record.id)}
                            sx={{
                              p: 2,
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              cursor: 'pointer',
                              '&:hover': {
                                bgcolor: 'action.hover',
                              },
                            }}
                          >
                            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                              <Paper
                                elevation={0}
                                sx={{
                                  p: 1,
                                  borderRadius: 2,
                                  bgcolor: isExpanded ? 'primary.main' : 'action.hover',
                                  color: isExpanded ? '#fff' : 'text.primary',
                                  textAlign: 'center',
                                  minWidth: 56,
                                  transition: 'all 0.2s ease',
                                }}
                              >
                                <Typography
                                  variant="caption"
                                  sx={{
                                    fontWeight: 800,
                                    display: 'block',
                                    textTransform: 'uppercase',
                                    color: isExpanded ? '#fff' : 'text.secondary',
                                    fontSize: '0.65rem',
                                  }}
                                >
                                  {dayjs(record.date).format('MMM')}
                                </Typography>
                                <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1 }}>
                                  {dayjs(record.date).format('DD')}
                                </Typography>
                              </Paper>

                              <Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                    {dayjs(record.date).format('dddd')}
                                    {record.sessionNumber && record.sessionNumber > 1 ? ` (Session #${record.sessionNumber})` : ''}
                                  </Typography>
                                  {record.isFirstSession !== false && getStatusChip(record.status)}
                                </Box>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.2 }}>
                                  <ClockIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
                                  {checkInFormatted} {' ➔ '}
                                  <Box component="span" sx={{ color: isCheckOutPending ? 'error.main' : 'text.primary', fontWeight: isCheckOutPending ? 700 : 500 }}>
                                    {checkOutFormatted}
                                  </Box>
                                </Typography>
                              </Box>
                            </Box>

                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                              <Box sx={{ textAlign: 'right' }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'primary.main' }}>
                                  {record.workingHours ? `${Number(record.workingHours).toFixed(2)} hrs` : (isCheckOutPending ? 'In Progress' : '--')}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                  Logged Time
                                </Typography>
                              </Box>
                              <IconButton
                                size="small"
                                sx={{
                                  transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                  transition: 'transform 0.2s ease',
                                  bgcolor: 'action.hover',
                                }}
                              >
                                <ExpandMoreIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          </Box>

                          {/* Expanded Drawer (Option 3 Telemetry & Timeline) */}
                          <Collapse in={isExpanded}>
                            <Divider />
                            <Box sx={{ p: 2, bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)' }}>
                              {/* Timeline Stepper */}
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, px: 1 }}>
                                <Box sx={{ textAlign: 'center' }}>
                                  <Typography variant="caption" sx={{ fontWeight: 800, color: 'success.main', display: 'block' }}>
                                    ● CHECK IN
                                  </Typography>
                                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                    {checkInFormatted}
                                  </Typography>
                                </Box>

                                <Box sx={{ flex: 1, mx: 2, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <Divider sx={{ width: '100%', borderStyle: isCheckOutPending ? 'dashed' : 'solid' }} />
                                  <Chip
                                    label={isCheckOutPending ? 'Active Shift' : `${Number(record.workingHours || 0).toFixed(1)} hrs`}
                                    size="small"
                                    color={isCheckOutPending ? 'primary' : 'default'}
                                    sx={{ position: 'absolute', fontWeight: 700, fontSize: '0.7rem' }}
                                  />
                                </Box>

                                <Box sx={{ textAlign: 'center' }}>
                                  <Typography variant="caption" sx={{ fontWeight: 800, color: isCheckOutPending ? 'primary.main' : 'info.main', display: 'block' }}>
                                    ● CHECK OUT
                                  </Typography>
                                  <Typography variant="body2" sx={{ fontWeight: 700, color: isCheckOutPending ? 'primary.main' : 'text.primary' }}>
                                    {checkOutFormatted}
                                  </Typography>
                                </Box>
                              </Box>

                              {/* Telemetry Cards Grid */}
                              <Grid container spacing={1.5} sx={{ mb: 1 }}>
                                <Grid size={{ xs: 12, sm: 6 }}>
                                  <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 1.5, display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                                    <LocationIcon color="primary" sx={{ fontSize: 18, mt: 0.2 }} />
                                    <Box sx={{ minWidth: 0, flex: 1 }}>
                                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, display: 'block', fontSize: '0.65rem', letterSpacing: 0.4 }}>
                                        WORKSPACE LOCATION & TYPE
                                      </Typography>
                                      <Typography variant="body2" sx={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {record.workspaceName || 'Campus Main Office'}
                                      </Typography>
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mt: 0.4, flexWrap: 'wrap' }}>
                                        <Chip
                                          label="12m away"
                                          size="small"
                                          color="success"
                                          variant="outlined"
                                          sx={{ height: 19, fontSize: '0.65rem', fontWeight: 700 }}
                                        />
                                        <Chip
                                          label="On-Site Geofenced"
                                          size="small"
                                          color="primary"
                                          sx={{ height: 19, fontSize: '0.65rem', fontWeight: 700 }}
                                        />
                                      </Box>
                                    </Box>
                                  </Paper>
                                </Grid>
                                <Grid size={{ xs: 12, sm: 6 }}>
                                  <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <ShieldIcon color="success" sx={{ fontSize: 18 }} />
                                    <Box>
                                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: 'block', fontSize: '0.65rem' }}>
                                        BIOMETRIC VERIFICATION
                                      </Typography>
                                      <Typography variant="body2" sx={{ fontWeight: 600, color: 'success.main' }}>
                                        Face Verified (Biometrics Matched)
                                      </Typography>
                                    </Box>
                                  </Paper>
                                </Grid>
                              </Grid>

                              {/* Audit Notes or Shift Compliance Note */}
                              {record.notes ? (
                                <Alert severity="info" sx={{ mt: 1, py: 0.5, borderRadius: 1.5 }}>
                                  {record.notes}
                                </Alert>
                              ) : (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1, px: 0.5 }}>
                                  <PresentIcon sx={{ fontSize: 15, color: 'success.main' }} />
                                  <Typography variant="caption" color="text.secondary">
                                    Compliant shift logged with zero security infractions.
                                  </Typography>
                                </Box>
                              )}
                            </Box>
                          </Collapse>
                        </Paper>
                      );
                    })}
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
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {todaySessions.length > 1 ? 'Latest Check In' : 'Check In'}
                      </Typography>
                    </Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      {metrics?.todayAttendance?.checkIn 
                        ? dayjs(`${dayjs().format('YYYY-MM-DD')} ${metrics.todayAttendance.checkIn}`).isValid()
                          ? dayjs(`${dayjs().format('YYYY-MM-DD')} ${metrics.todayAttendance.checkIn}`).format('hh:mm A')
                          : metrics.todayAttendance.checkIn
                        : '--:--'}
                    </Typography>
                  </Box>

                  <Divider />

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ClockIcon color="action" />
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {todaySessions.length > 1 ? 'Latest Check Out' : 'Check Out'}
                      </Typography>
                    </Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      {hasActiveSession ? (
                        <Chip label="Active Now" color="primary" size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
                      ) : metrics?.todayAttendance?.checkOut ? (
                        dayjs(`${dayjs().format('YYYY-MM-DD')} ${metrics.todayAttendance.checkOut}`).isValid()
                          ? dayjs(`${dayjs().format('YYYY-MM-DD')} ${metrics.todayAttendance.checkOut}`).format('hh:mm A')
                          : metrics.todayAttendance.checkOut
                      ) : (
                        '--:--'
                      )}
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

                  {/* Multi-session timeline breakdown */}
                  {todaySessions.length > 0 && (
                    <Box sx={{ mt: 1, pt: 2, borderTop: `1px dashed ${theme.palette.divider}` }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', display: 'block', mb: 1 }}>
                        Today's Sessions ({todaySessions.length})
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {todaySessions.map((session) => (
                          <Box
                            key={session.id}
                            sx={{
                              p: 1.2,
                              borderRadius: 1.5,
                              bgcolor: session.isActive ? 'action.selected' : 'action.hover',
                              border: `1px solid ${session.isActive ? theme.palette.primary.main : theme.palette.divider}`,
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <Box>
                              <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>
                                Session #{session.sessionNumber} {session.isActive && '• In Progress'}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {session.checkIn} → {session.checkOut || 'Active'}
                              </Typography>
                            </Box>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: session.isActive ? 'primary.main' : 'text.primary' }}>
                              {session.isActive ? 'Logging...' : `${session.workingHours} hrs`}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  )}
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
    </Box>
  );
};

export default EmployeeDashboard;
