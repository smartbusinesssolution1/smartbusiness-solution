import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsService } from '../../services/settingsService';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
} from '@mui/material';
import {
  Settings as SettingsIcon,
  MyLocation as LocationIcon,
  Schedule as ClockIcon,
  Business as CompanyIcon,
  Save as SaveIcon,
  HelpOutlined as InfoIcon,
} from '@mui/icons-material';

// Form validation schema
const schema = z.object({
  companyName: z.string().trim().min(2, 'Company Name is required'),
  officeName: z.string().trim().min(2, 'Office Name is required'),
  latitude: z.number().min(-90, 'Latitude must be between -90 and 90').max(90, 'Latitude must be between -90 and 90'),
  longitude: z.number().min(-180, 'Longitude must be between -180 and 180').max(180, 'Longitude must be between -180 and 180'),
  radius: z.number().min(10, 'Geofence radius must be at least 10 meters').max(10000, 'Geofence radius must not exceed 10,000 meters'),
  officeStartTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Please enter time in HH:mm format'),
  officeEndTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Please enter time in HH:mm format'),
});

type SettingsFormValues = z.infer<typeof schema>;

export const OrganizationSettingsPage: React.FC = () => {
  const theme = useTheme();
  const queryClient = useQueryClient();

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Fetch settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['adminSettings'],
    queryFn: () => settingsService.getSettings(),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      companyName: '',
      officeName: '',
      latitude: 0,
      longitude: 0,
      radius: 100,
      officeStartTime: '09:00',
      officeEndTime: '18:00',
    },
  });

  // Populate form values when data loaded
  useEffect(() => {
    if (settings) {
      reset({
        companyName: settings.companyName,
        officeName: settings.officeName,
        latitude: settings.latitude,
        longitude: settings.longitude,
        radius: settings.radius,
        officeStartTime: settings.officeStartTime,
        officeEndTime: settings.officeEndTime,
      });
    }
  }, [settings, reset]);

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: (data: SettingsFormValues) => settingsService.updateSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminSettings'] });
      setSnackbar({
        open: true,
        message: 'Organization configurations saved successfully!',
        severity: 'success',
      });
    },
    onError: (err: any) => {
      setSnackbar({
        open: true,
        message: err?.message || 'Failed to update configurations.',
        severity: 'error',
      });
    }
  });

  const onSubmit = (data: SettingsFormValues) => {
    updateMutation.mutate(data);
  };

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', width: '100%' }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          Organization Settings
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Configure corporate shift parameters, standard operating hours, and geofenced office limits.
        </Typography>
      </Box>

      {isLoading ? (
        <Card sx={{ borderRadius: 3 }}>
          <CardContent sx={{ p: 4 }}>
            <Skeleton variant="text" height={40} width="60%" sx={{ mb: 3 }} />
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Skeleton variant="rectangular" height={56} sx={{ borderRadius: 1 }} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Skeleton variant="rectangular" height={56} sx={{ borderRadius: 1 }} />
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)}>
          <Grid container spacing={3}>
            {/* Left Side: Parameters Form */}
            <Grid size={{ xs: 12, md: 8 }}>
              <Card sx={{ borderRadius: 3 }}>
                <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
                  {/* Company Profile */}
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CompanyIcon fontSize="small" />
                    1. Corporate Profiling
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 3, display: 'block' }}>
                    Establish business identities shown to employees across the application.
                  </Typography>

                  <Grid container spacing={2.5} sx={{ mb: 4 }}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        label="Company Corporate Name"
                        error={!!errors.companyName}
                        helperText={errors.companyName?.message}
                        disabled={updateMutation.isPending}
                        {...register('companyName')}
                      />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        label="Office Campus Name"
                        error={!!errors.officeName}
                        helperText={errors.officeName?.message}
                        disabled={updateMutation.isPending}
                        {...register('officeName')}
                      />
                    </Grid>
                  </Grid>

                  <Divider sx={{ my: 3 }} />

                  {/* Geofencing */}
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LocationIcon fontSize="small" />
                    2. Geographic Geofence & Proximity Range
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 3, display: 'block' }}>
                    Define the core campus coordinates and the physical radius within which clock-ins are permitted.
                  </Typography>

                  <Grid container spacing={2.5} sx={{ mb: 4 }}>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <TextField
                        fullWidth
                        type="number"
                        slotProps={{ htmlInput: { step: 'any' } }}
                        label="Office Latitude"
                        error={!!errors.latitude}
                        helperText={errors.latitude?.message}
                        disabled={updateMutation.isPending}
                        {...register('latitude', { valueAsNumber: true })}
                      />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 4 }}>
                      <TextField
                        fullWidth
                        type="number"
                        slotProps={{ htmlInput: { step: 'any' } }}
                        label="Office Longitude"
                        error={!!errors.longitude}
                        helperText={errors.longitude?.message}
                        disabled={updateMutation.isPending}
                        {...register('longitude', { valueAsNumber: true })}
                      />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 4 }}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Allowed Radius (Meters)"
                        error={!!errors.radius}
                        helperText={errors.radius?.message}
                        disabled={updateMutation.isPending}
                        {...register('radius', { valueAsNumber: true })}
                      />
                    </Grid>
                  </Grid>

                  <Divider sx={{ my: 3 }} />

                  {/* Shift Hours */}
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ClockIcon fontSize="small" />
                    3. Corporate Core Shift Standard
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 3, display: 'block' }}>
                    Establish default check-in and check-out parameters. Check-ins after 15 minutes of start time tag employees as "Late".
                  </Typography>

                  <Grid container spacing={2.5} sx={{ mb: 2 }}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        placeholder="09:00"
                        label="Office Start Time (HH:mm)"
                        error={!!errors.officeStartTime}
                        helperText={errors.officeStartTime?.message}
                        disabled={updateMutation.isPending}
                        {...register('officeStartTime')}
                      />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        placeholder="18:00"
                        label="Office End Time (HH:mm)"
                        error={!!errors.officeEndTime}
                        helperText={errors.officeEndTime?.message}
                        disabled={updateMutation.isPending}
                        {...register('officeEndTime')}
                      />
                    </Grid>
                  </Grid>

                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 4 }}>
                    <Button
                      type="submit"
                      variant="contained"
                      color="primary"
                      disabled={updateMutation.isPending}
                      startIcon={updateMutation.isPending ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                      sx={{ py: 1.25, px: 4 }}
                    >
                      {updateMutation.isPending ? 'Saving Settings...' : 'Save Configuration'}
                    </Button>
                  </Box>

                </CardContent>
              </Card>
            </Grid>

            {/* Right Side: Geofencing Technical Helper Info card */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Card sx={{ borderRadius: 3, mb: 3 }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <InfoIcon color="primary" sx={{ fontSize: 18 }} />
                    How Geofencing Works
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.6 }}>
                    ClockInClockOut evaluates mathematical coordinate proximity during Check-In. When an employee logs in, the platform calculates the exact geodesic distance between the browser's GPS coordinates and the specified <strong>Latitude/Longitude</strong> parameters.
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.6 }}>
                    If the calculated distance exceeds the configured <strong>Radius threshold</strong>, the system permits the log but tags it as a <strong>"Remote Check-In"</strong> with an audit flag.
                  </Typography>
                  
                  <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
                      HQ GEOFENCE COORDINATE
                    </Typography>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                      Lat: {settings?.latitude}
                    </Typography>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                      Lon: {settings?.longitude}
                    </Typography>
                    <Typography variant="caption" color="primary.main" sx={{ fontWeight: 700, display: 'block', mt: 1 }}>
                      Standard: Silicon Valley HQ (100m)
                    </Typography>
                  </Paper>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </form>
      )}

      {/* Snackbar notifications */}
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
