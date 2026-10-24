import React, { useEffect, useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { settingsService } from '../../services/settingsService';
import BrandLoader from '../../components/BrandLoader';
import { useAuth } from '../../context/AuthContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ShiftTimePicker } from '../../components/ShiftTimePicker';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  Divider,
  Paper,
  Snackbar,
  Alert,
  CircularProgress,
  Skeleton,
  useTheme,
  Chip,
  InputAdornment,
  Tooltip,
} from '@mui/material';
import {
  MyLocation as LocationIcon,
  Schedule as ClockIcon,
  Business as CompanyIcon,
  Save as SaveIcon,
  HelpOutlined as InfoIcon,
  CheckCircleRounded as CheckCircleIcon,
  WarningAmberRounded as WarningIcon,
  GpsFixed as GpsFixedIcon,
  ApartmentRounded as CampusIcon,
} from '@mui/icons-material';

// Form validation schema matching backend UpdateGeofenceSchema
const schema = z.object({
  corporateName: z.string().trim().min(1, 'Organization name is required'),
  workspaceName: z.string().trim().optional(),
  latitude: z
    .union([z.number(), z.nan()])
    .refine((val) => typeof val === 'number' && !isNaN(val), 'Latitude is required')
    .pipe(z.number().min(-90, 'Latitude must be between -90 and 90').max(90, 'Latitude must be between -90 and 90')),
  longitude: z
    .union([z.number(), z.nan()])
    .refine((val) => typeof val === 'number' && !isNaN(val), 'Longitude is required')
    .pipe(z.number().min(-180, 'Longitude must be between -180 and 180').max(180, 'Longitude must be between -180 and 180')),
  radiusMeters: z
    .number({ message: 'Radius is required' })
    .min(10, 'Geofence radius must be at least 10 meters')
    .max(10000, 'Geofence radius must not exceed 10,000 meters'),
  graceMinutes: z
    .number({ message: 'Grace minutes is required' })
    .int('Must be an integer')
    .min(0, 'Cannot be negative')
    .max(120, 'Max 120 minutes'),
  defaultShiftStartTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be in HH:mm 24-hr format (e.g. 09:00)'),
  defaultShiftEndTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be in HH:mm 24-hr format (e.g. 18:00)'),
});

type SettingsFormValues = z.infer<typeof schema>;

export const OrganizationSettingsPage: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, currentTenant, workspaces, currentWorkspace, isSuperAdmin, updateOrganizationAndWorkspace } = useAuth();

  // Helper to sanitize workspace ID
  const cleanId = (id?: string | null): string => {
    if (!id || id === 'undefined' || id === 'null' || id.trim() === '') return '';
    return id.trim();
  };

  // Derive active workspace directly from the active workspace in the top header
  const activeWorkspaceId =
    cleanId(currentWorkspace?.id) ||
    cleanId(localStorage.getItem('active_workspace_id')) ||
    cleanId(workspaces?.[0]?.id) ||
    '';

  const isValidWorkspaceId = Boolean(activeWorkspaceId);
  const activeWs = workspaces?.find((w) => w.id === activeWorkspaceId) || currentWorkspace;

  // GPS detection state
  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);

  // Track if current coordinates were auto-detected / live-captured but not yet saved in DB
  const [hasUnsavedAutoGps, setHasUnsavedAutoGps] = useState(false);

  // Ref to prevent repeat auto-detection loops per workspace
  const autoGpsAttemptedRef = useRef<string | null>(null);

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Fetch geofence settings for the active workspace
  const { data: settingsData, isLoading } = useQuery({
    queryKey: ['adminGeofence', activeWorkspaceId],
    queryFn: () => settingsService.getGeofence(activeWorkspaceId),
    enabled: Boolean(user && isValidWorkspaceId),
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      corporateName: currentTenant?.name || '',
      workspaceName: activeWs?.name || '',
      latitude: '' as any,
      longitude: '' as any,
      radiusMeters: 100,
      graceMinutes: 15,
      defaultShiftStartTime: '09:00',
      defaultShiftEndTime: '18:00',
    },
  });

  const watchedValues = watch();

  // HTML5 Live Geolocation detector (supports manual click or automatic fallback)
  const handleDetectLiveLocation = (isAuto = false) => {
    if (!navigator.geolocation) {
      if (!isAuto) {
        setSnackbar({
          open: true,
          message: 'Geolocation is not supported by your browser.',
          severity: 'error',
        });
      }
      return;
    }

    setIsDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = parseFloat(position.coords.latitude.toFixed(6));
        const lon = parseFloat(position.coords.longitude.toFixed(6));
        const acc = Math.round(position.coords.accuracy);

        setValue('latitude', lat, { shouldValidate: true });
        setValue('longitude', lon, { shouldValidate: true });
        setGpsAccuracy(acc);
        setIsDetectingGps(false);
        setHasUnsavedAutoGps(true);

        setSnackbar({
          open: true,
          message: isAuto
            ? `No saved coordinates found. Auto-detected your current location (Accuracy: ±${acc}m)`
            : `Live coordinates captured (Accuracy: ±${acc}m)`,
          severity: 'success',
        });
      },
      (err) => {
        setIsDetectingGps(false);
        if (!isAuto) {
          setSnackbar({
            open: true,
            message: `Location access denied: ${err.message}`,
            severity: 'error',
          });
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Populate form values when data is loaded or workspace switches in top header
  useEffect(() => {
    if (settingsData) {
      const g = settingsData.geofence;
      const hasValidCoords =
        settingsData.isConfigured &&
        g?.latitude != null &&
        g?.longitude != null &&
        !(Number(g.latitude) === 0 && Number(g.longitude) === 0);

      reset({
        corporateName: settingsData.corporateName || currentTenant?.name || '',
        workspaceName: settingsData.workspaceName || activeWs?.name || '',
        latitude: hasValidCoords ? Number(g.latitude) : ('' as any),
        longitude: hasValidCoords ? Number(g.longitude) : ('' as any),
        radiusMeters: g?.radiusMeters ?? 100,
        graceMinutes: g?.graceMinutes ?? 15,
        defaultShiftStartTime: g?.defaultShiftStartTime ?? '09:00',
        defaultShiftEndTime: g?.defaultShiftEndTime ?? '18:00',
      });

      if (hasValidCoords) {
        setHasUnsavedAutoGps(false);
        if (activeWorkspaceId) {
          localStorage.setItem('geofence_configured_' + (activeWorkspaceId || currentTenant?.id || ''), 'true');
        }
        if (currentTenant?.id) {
          localStorage.setItem('geofence_configured_' + (activeWorkspaceId || currentTenant?.id || ''), 'true');
        }
      }

      if (g?.defaultShiftStartTime && g?.defaultShiftEndTime) {
        if (activeWorkspaceId) {
          localStorage.setItem('shifts_configured_' + (activeWorkspaceId || currentTenant?.id || ''), 'true');
        }
        if (currentTenant?.id) {
          localStorage.setItem('shifts_configured_' + (activeWorkspaceId || currentTenant?.id || ''), 'true');
        }
      }
    } else if (!isValidWorkspaceId) {
      reset({
        corporateName: currentTenant?.name || '',
        workspaceName: '',
        latitude: '' as any,
        longitude: '' as any,
        radiusMeters: 100,
        graceMinutes: 15,
        defaultShiftStartTime: '09:00',
        defaultShiftEndTime: '18:00',
      });
    }
  }, [settingsData, reset, activeWorkspaceId, isValidWorkspaceId, currentTenant?.name, currentTenant?.id, activeWs?.name]);

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: (data: SettingsFormValues) =>
      settingsService.updateGeofence(activeWorkspaceId, {
        corporateName: data.corporateName,
        organizationName: data.corporateName,
        workspaceName: data.workspaceName,
        latitude: Number(data.latitude),
        longitude: Number(data.longitude),
        radiusMeters: data.radiusMeters,
        graceMinutes: data.graceMinutes,
        defaultShiftStartTime: data.defaultShiftStartTime,
        defaultShiftEndTime: data.defaultShiftEndTime,
      }),
    onSuccess: (res, variables) => {
      setHasUnsavedAutoGps(false);
      updateOrganizationAndWorkspace(variables.corporateName, variables.workspaceName);
      queryClient.invalidateQueries({ queryKey: ['adminGeofence'] });
      queryClient.invalidateQueries({ queryKey: ['adminSettings'] });
      queryClient.invalidateQueries({ queryKey: ['adminDashboardMetrics'] });

      if (activeWorkspaceId) {
        localStorage.setItem('geofence_configured_' + (activeWorkspaceId || currentTenant?.id || ''), 'true');
        localStorage.setItem('shifts_configured_' + (activeWorkspaceId || currentTenant?.id || ''), 'true');
      }
      if (currentTenant?.id) {
        localStorage.setItem('geofence_configured_' + (activeWorkspaceId || currentTenant?.id || ''), 'true');
        localStorage.setItem('shifts_configured_' + (activeWorkspaceId || currentTenant?.id || ''), 'true');
      }

      setSnackbar({
        open: true,
        message: 'Organization and workspace settings saved successfully!',
        severity: 'success',
      });
    },
    onError: (err: any) => {
      setSnackbar({
        open: true,
        message: err?.response?.data?.error?.message || err?.message || 'Failed to save settings.',
        severity: 'error',
      });
    },
  });

  const onSubmit = (data: SettingsFormValues) => {
    if (!isValidWorkspaceId) {
      setSnackbar({
        open: true,
        message: 'Please select an office campus workspace first.',
        severity: 'error',
      });
      return;
    }
    updateMutation.mutate(data);
  };

  const isConfigured = Boolean(settingsData?.isConfigured);

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', width: '100%' }}>
      {/* Page Header */}
      <Box sx={{ mb: 3.5 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          Organization
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Configure physical office boundaries, GPS check-in perimeters, and standard shift hours
          {activeWs?.name ? (
            <>
              {' for '}
              <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
                {activeWs.name}
              </Box>
            </>
          ) : ''}
          .
        </Typography>
      </Box>

      {/* 0 Workspace Notice Banner */}
      {(!isValidWorkspaceId || (workspaces && workspaces.length === 0)) && (
        <Alert
          severity="info"
          icon={<CampusIcon sx={{ fontSize: 20 }} />}
          sx={{ mb: 3, borderRadius: 2.5 }}
          action={
            <Button
              color="primary"
              variant="contained"
              size="small"
              onClick={() => navigate('/workspace/select')}
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
            >
              Create Workspace
            </Button>
          }
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            No Active Workspace Found
          </Typography>
          <Typography variant="caption" color="text.secondary">
            To configure geographic perimeters and shift rules, start by creating your primary workspace location.
          </Typography>
        </Alert>
      )}

      {isLoading ? (
        <Card sx={{ borderRadius: 3 }}>
          <BrandLoader fullScreen message="Loading organization settings..." />
        </Card>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)}>
          <Grid container spacing={3}>
            {/* Left Side: Parameters Form */}
            <Grid size={{ xs: 12, md: 8 }}>
              <Card sx={{ borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                <CardContent sx={{ p: { xs: 3, sm: 4 } }}>

                  {/* 1. Identity & Campus Hierarchy */}
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CompanyIcon fontSize="small" />
                    1. Corporate & Campus Scope
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 2.5, display: 'block' }}>
                    Corporate tenant and physical site context associated with this geofence.
                  </Typography>

                  <Grid container spacing={2} sx={{ mb: 3.5 }}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        label="Parent Corporate Organization"
                        error={!!errors.corporateName}
                        helperText={
                          errors.corporateName?.message ||
                          (isSuperAdmin
                            ? 'Corporate entity name (Editable by Super Admin)'
                            : 'Corporate entity (Tenant level)')
                        }
                        variant={isSuperAdmin ? 'outlined' : 'filled'}
                        size="small"
                        disabled={updateMutation.isPending}
                        slotProps={{
                          input: {
                            readOnly: !isSuperAdmin,
                            startAdornment: (
                              <InputAdornment position="start">
                                <CompanyIcon fontSize="small" color={isSuperAdmin ? 'primary' : 'action'} />
                              </InputAdornment>
                            ),
                          },
                        }}
                        {...register('corporateName')}
                      />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        label="Active Campus / Site"
                        placeholder={activeWs ? 'e.g. Main Branch' : 'No workspace created yet'}
                        error={!!errors.workspaceName}
                        helperText={
                          errors.workspaceName?.message ||
                          (activeWs
                            ? isSuperAdmin
                              ? 'Campus / Branch name (Editable by Super Admin)'
                              : activeWs.address || 'Physical site configured in the top navigation bar'
                            : '')
                        }
                        variant={isSuperAdmin && activeWs ? 'outlined' : 'filled'}
                        size="small"
                        disabled={updateMutation.isPending || !activeWs}
                        slotProps={{
                          input: {
                            readOnly: !isSuperAdmin || !activeWs,
                            startAdornment: (
                              <InputAdornment position="start">
                                <CampusIcon fontSize="small" color={activeWs ? (isSuperAdmin ? 'primary' : 'action') : 'disabled'} />
                              </InputAdornment>
                            ),
                          },
                        }}
                        {...register('workspaceName')}
                      />
                    </Grid>
                  </Grid>

                  <Divider sx={{ my: 3 }} />

                  {/* 2. Geofencing Coordinates & Radius */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LocationIcon fontSize="small" />
                      2. Geographic Perimeter & Radius
                    </Typography>

                    <Button
                      size="small"
                      variant="outlined"
                      color="secondary"
                      onClick={() => handleDetectLiveLocation(false)}
                      disabled={isDetectingGps || updateMutation.isPending}
                      startIcon={isDetectingGps ? <CircularProgress size={14} color="inherit" /> : <GpsFixedIcon fontSize="small" />}
                      sx={{ textTransform: 'none', borderRadius: 2 }}
                    >
                      {isDetectingGps ? 'Detecting GPS...' : 'Use My Live GPS'}
                    </Button>
                  </Box>

                  <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                    Coordinates define the center of this campus. Mobile punches must fall within the allowed radius.
                  </Typography>

                  {/* Unsaved Live/Auto-Detected GPS Warning Banner */}
                  {hasUnsavedAutoGps && (
                    <Alert
                      severity="warning"
                      variant="outlined"
                      icon={<WarningIcon fontSize="small" color="warning" />}
                      action={
                        <Button
                          color="warning"
                          size="small"
                          variant="contained"
                          onClick={handleSubmit(onSubmit)}
                          disabled={updateMutation.isPending}
                          startIcon={updateMutation.isPending ? <CircularProgress size={12} color="inherit" /> : <SaveIcon sx={{ fontSize: 13 }} />}
                          sx={{
                            fontWeight: 700,
                            textTransform: 'none',
                            fontSize: '0.75rem',
                            py: 0.4,
                            px: 1.25,
                            borderRadius: 1.5,
                          }}
                        >
                          {updateMutation.isPending ? 'Saving...' : 'Save Location'}
                        </Button>
                      }
                      sx={{
                        mb: 2.5,
                        borderRadius: 2,
                        py: 0.5,
                        px: 1.5,
                        borderWidth: 1.5,
                        bgcolor: (theme) =>
                          theme.palette.mode === 'dark' ? 'rgba(237, 108, 2, 0.1)' : '#fff8e1',
                        alignItems: 'center',
                      }}
                    >
                      <Box>
                        <Typography variant="caption" sx={{ fontWeight: 800, color: 'warning.dark', display: 'block', lineHeight: 1.3 }}>
                          Unsaved Live Location Detected
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.3 }}>
                          Coordinates were captured from your current location, but haven't been saved yet.
                        </Typography>
                      </Box>
                    </Alert>
                  )}

                  <Grid container spacing={2.5} sx={{ mb: 3.5 }}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        type="number"
                        slotProps={{ htmlInput: { step: 'any' } }}
                        label="Center Latitude"
                        placeholder="e.g. 19.0760"
                        error={!!errors.latitude}
                        helperText={errors.latitude?.message || 'Decimal degrees (-90 to +90)'}
                        disabled={updateMutation.isPending}
                        {...register('latitude', { valueAsNumber: true })}
                      />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        type="number"
                        slotProps={{ htmlInput: { step: 'any' } }}
                        label="Center Longitude"
                        placeholder="e.g. 72.8777"
                        error={!!errors.longitude}
                        helperText={errors.longitude?.message || 'Decimal degrees (-180 to +180)'}
                        disabled={updateMutation.isPending}
                        {...register('longitude', { valueAsNumber: true })}
                      />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Permitted Radius (Meters)"
                        error={!!errors.radiusMeters}
                        helperText={errors.radiusMeters?.message || 'Standard perimeter (e.g. 100m, 150m)'}
                        disabled={updateMutation.isPending}
                        {...register('radiusMeters', { valueAsNumber: true })}
                        slotProps={{
                          input: {
                            endAdornment: <InputAdornment position="end">meters</InputAdornment>,
                          },
                        }}
                      />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Late Punch Grace Window"
                        error={!!errors.graceMinutes}
                        helperText={errors.graceMinutes?.message || 'Minutes allowed past shift start before marked Late'}
                        disabled={updateMutation.isPending}
                        {...register('graceMinutes', { valueAsNumber: true })}
                        slotProps={{
                          input: {
                            endAdornment: <InputAdornment position="end">mins</InputAdornment>,
                          },
                        }}
                      />
                    </Grid>
                  </Grid>

                  <Divider sx={{ my: 3 }} />

                  {/* 3. Default Shift Standard Hours */}
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ClockIcon fontSize="small" />
                    3. Workspace Default Shift Hours
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 2.5, display: 'block' }}>
                    Baseline office schedule. Employees clocking in after start time + grace period will be tagged as "Late".
                  </Typography>

                  <Grid container spacing={2.5} sx={{ mb: 2 }}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <ShiftTimePicker
                        label="Default Shift Start Time"
                        value={watchedValues.defaultShiftStartTime || '09:00'}
                        onChange={(val) => setValue('defaultShiftStartTime', val, { shouldValidate: true })}
                        error={!!errors.defaultShiftStartTime}
                        helperText={errors.defaultShiftStartTime?.message || 'Expected morning clock-in time'}
                        disabled={updateMutation.isPending}
                      />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                      <ShiftTimePicker
                        label="Default Shift End Time"
                        value={watchedValues.defaultShiftEndTime || '18:00'}
                        onChange={(val) => setValue('defaultShiftEndTime', val, { shouldValidate: true })}
                        error={!!errors.defaultShiftEndTime}
                        helperText={errors.defaultShiftEndTime?.message || 'Expected evening clock-out time'}
                        disabled={updateMutation.isPending}
                      />
                    </Grid>
                  </Grid>

                  {/* Submit Button */}
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 4 }}>
                    <Button
                      type="submit"
                      variant="contained"
                      color="primary"
                      disabled={updateMutation.isPending}
                      startIcon={updateMutation.isPending ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                      sx={{ py: 1.25, px: 4, borderRadius: 2, fontWeight: 700 }}
                    >
                      {updateMutation.isPending ? 'Saving Settings...' : 'Save Organization'}
                    </Button>
                  </Box>

                </CardContent>
              </Card>
            </Grid>

            {/* Right Side: Campus Geofence Status Card */}
            <Grid size={{ xs: 12, md: 4 }}>
              {/* Geofence Status Badge Card */}
              <Card sx={{ borderRadius: 3, mb: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                      CAMPUS GEOFENCE STATUS
                    </Typography>
                    <Chip
                      size="small"
                      icon={hasUnsavedAutoGps ? <WarningIcon fontSize="small" /> : isConfigured ? <CheckCircleIcon fontSize="small" /> : <WarningIcon fontSize="small" />}
                      label={hasUnsavedAutoGps ? 'Unsaved (Live GPS)' : isConfigured ? 'Configured' : 'Needs Setup'}
                      color={hasUnsavedAutoGps ? 'warning' : isConfigured ? 'success' : 'default'}
                      sx={{ fontWeight: 700, borderRadius: 1.5 }}
                    />
                  </Box>

                  <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                    {activeWs?.name || 'No workspace selected'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                    {activeWs?.address || 'No campus address'}
                  </Typography>

                  <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 2, mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: 'block' }}>
                        ACTIVE GPS PERIMETER
                      </Typography>
                      {hasUnsavedAutoGps && (
                        <Chip
                          size="small"
                          label="Pending Save"
                          color="warning"
                          variant="filled"
                          sx={{ fontWeight: 700, fontSize: '0.68rem', height: 18 }}
                        />
                      )}
                    </Box>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      Lat: {typeof watchedValues.latitude === 'number' && !isNaN(watchedValues.latitude) ? watchedValues.latitude : '—'}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      Lon: {typeof watchedValues.longitude === 'number' && !isNaN(watchedValues.longitude) ? watchedValues.longitude : '—'}
                    </Typography>
                    <Typography variant="caption" color="primary.main" sx={{ fontWeight: 700, display: 'block', mt: 1 }}>
                      Perimeter Radius: {watchedValues.radiusMeters || 100} meters
                    </Typography>
                  </Paper>

                  <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
                      STANDARD SHIFT WINDOW
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {watchedValues.defaultShiftStartTime || '09:00'} — {watchedValues.defaultShiftEndTime || '18:00'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      Late Punch Grace: {watchedValues.graceMinutes || 15} minutes
                    </Typography>
                  </Paper>

                  {gpsAccuracy && (
                    <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <GpsFixedIcon color="success" sx={{ fontSize: 16 }} />
                      <Typography variant="caption" color="text.secondary">
                        Last live GPS detection accuracy: ±{gpsAccuracy}m
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>

              {/* Haversine Proximity Explanation Card */}
              <Card sx={{ borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <InfoIcon color="primary" sx={{ fontSize: 18 }} />
                    Haversine Proximity Engine
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.6, fontSize: '0.85rem' }}>
                    During check-in, the mobile app transmits the device's live GPS coordinates. The backend evaluates great-circle geodesic distance using the <strong>Haversine Formula</strong> against these office coordinates.
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6, fontSize: '0.85rem' }}>
                    Employees within <strong>{watchedValues.radiusMeters || 100} meters</strong> proceed to facial recognition. Punches beyond this perimeter trigger an out-of-bounds warning.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </form>
      )}

      {/* Snackbar notification */}
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

export default OrganizationSettingsPage;
