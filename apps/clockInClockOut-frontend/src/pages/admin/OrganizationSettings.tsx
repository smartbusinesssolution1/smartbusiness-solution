import React, { useEffect, useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Building2,
  Building,
  MapPin,
  Crosshair,
  Compass,
  Clock,
  Save,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  Info,
  Sparkles,
  RotateCcw,
  Check,
  X,
} from 'lucide-react';

import { settingsService } from '../../services/settingsService';
import { useAuth } from '../../context/AuthContext';
import { ShiftTimePicker } from '../../components/ShiftTimePicker';
import { cn } from '../../lib/utils';
import {
  Button,
  Card,
  Badge,
  Input,
  Label,
  Separator,
  Tooltip,
} from '../../components/ui';

// Form validation schema matching backend UpdateGeofenceSchema
const schema = z.object({
  corporateName: z.string().trim().min(1, 'Organization name is required'),
  workspaceName: z.string().trim().optional(),
  latitude: z
    .union([z.number(), z.nan()])
    .refine((val) => typeof val === 'number' && !isNaN(val), 'Latitude is required')
    .pipe(
      z
        .number()
        .min(-90, 'Latitude must be between -90 and 90')
        .max(90, 'Latitude must be between -90 and 90')
    ),
  longitude: z
    .union([z.number(), z.nan()])
    .refine((val) => typeof val === 'number' && !isNaN(val), 'Longitude is required')
    .pipe(
      z
        .number()
        .min(-180, 'Longitude must be between -180 and 180')
        .max(180, 'Longitude must be between -180 and 180')
    ),
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    user,
    currentTenant,
    workspaces,
    currentWorkspace,
    isSuperAdmin,
    updateOrganizationAndWorkspace,
  } = useAuth();

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

  // Feedback toast state
  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const showToast = (message: string, severity: 'success' | 'error' = 'success') => {
    setToast({ open: true, message, severity });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, open: false }));
    }, 4500);
  };

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

  // HTML5 Live Geolocation detector
  const handleDetectLiveLocation = (isAuto = false) => {
    if (!navigator.geolocation) {
      if (!isAuto) {
        showToast('Geolocation is not supported by your browser.', 'error');
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

        showToast(
          isAuto
            ? `No saved coordinates found. Auto-detected your location (Accuracy: ±${acc}m)`
            : `Live coordinates captured (Accuracy: ±${acc}m)`,
          'success'
        );
      },
      (err) => {
        setIsDetectingGps(false);
        if (!isAuto) {
          showToast(`Location access denied: ${err.message}`, 'error');
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Populate form values when data is loaded or workspace switches
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
          localStorage.setItem(
            'geofence_configured_' + (activeWorkspaceId || currentTenant?.id || ''),
            'true'
          );
        }
      }

      if (g?.defaultShiftStartTime && g?.defaultShiftEndTime) {
        if (activeWorkspaceId) {
          localStorage.setItem(
            'shifts_configured_' + (activeWorkspaceId || currentTenant?.id || ''),
            'true'
          );
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
  }, [
    settingsData,
    reset,
    activeWorkspaceId,
    isValidWorkspaceId,
    currentTenant?.name,
    currentTenant?.id,
    activeWs?.name,
  ]);

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
    onSuccess: (_res, variables) => {
      setHasUnsavedAutoGps(false);
      updateOrganizationAndWorkspace(variables.corporateName, variables.workspaceName);
      queryClient.invalidateQueries({ queryKey: ['adminGeofence'] });
      queryClient.invalidateQueries({ queryKey: ['adminSettings'] });
      queryClient.invalidateQueries({ queryKey: ['adminDashboardMetrics'] });

      if (activeWorkspaceId) {
        localStorage.setItem(
          'geofence_configured_' + (activeWorkspaceId || currentTenant?.id || ''),
          'true'
        );
        localStorage.setItem(
          'shifts_configured_' + (activeWorkspaceId || currentTenant?.id || ''),
          'true'
        );
      }

      showToast('Organization and workspace settings saved successfully!', 'success');
    },
    onError: (err: any) => {
      showToast(
        err?.response?.data?.error?.message || err?.message || 'Failed to save settings.',
        'error'
      );
    },
  });

  const onSubmit = (data: SettingsFormValues) => {
    if (!isValidWorkspaceId) {
      showToast('Please select an office campus workspace first.', 'error');
      return;
    }
    updateMutation.mutate(data);
  };

  const isConfigured = Boolean(settingsData?.isConfigured);

  // Format 12-hour display helper
  const format12h = (time24?: string) => {
    if (!time24 || !time24.includes(':')) return time24 || '--';
    const [hStr, mStr] = time24.split(':');
    const h = parseInt(hStr, 10);
    if (isNaN(h)) return time24;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12.toString().padStart(2, '0')}:${mStr || '00'} ${ampm}`;
  };

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto w-full">
      {/* ── 1. Page Header ── */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="eyebrow">GEOFENCE & SHIFT GOVERNANCE</span>
            <div className="flex items-center gap-3">
              <h1 className="text-[1.625rem] sm:text-[1.75rem] font-semibold tracking-[-0.02em] leading-tight text-ink">
                Organization Settings
              </h1>
              {activeWs?.name && (
                <Badge variant="brand" className="gap-1 font-mono text-[0.6875rem]">
                  <Building className="size-3" />
                  <span>{activeWs.name}</span>
                </Badge>
              )}
            </div>
            <p className="max-w-2xl text-sm leading-relaxed text-muted">
              Configure physical office boundaries, GPS check-in perimeters, and standard shift hours
              {activeWs?.name ? (
                <>
                  {' for '}
                  <strong className="text-ink font-semibold">{activeWs.name}</strong>
                </>
              ) : null}
              .
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={() => handleDetectLiveLocation(false)}
              disabled={isDetectingGps || updateMutation.isPending}
              className="gap-1.5"
            >
              {isDetectingGps ? (
                <Loader2 className="size-4 animate-spin text-primary-600" />
              ) : (
                <Crosshair className="size-4 text-primary-600" />
              )}
              <span>{isDetectingGps ? 'Detecting GPS...' : 'Use My Live GPS'}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ── 2. No Active Workspace Warning Banner ── */}
      {(!isValidWorkspaceId || (workspaces && workspaces.length === 0)) && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50/70 p-4 text-xs text-sky-800">
          <div className="flex items-start gap-3">
            <Building2 className="size-5 shrink-0 text-sky-600 mt-0.5" />
            <div>
              <p className="font-semibold text-ink">No Active Workspace Found</p>
              <p className="text-muted leading-relaxed mt-0.5">
                To configure geographic perimeters and shift rules, start by selecting or creating your primary workspace location.
              </p>
            </div>
          </div>
          <Button
            variant="brand"
            size="sm"
            onClick={() => navigate('/workspace/select')}
          >
            Create Workspace
          </Button>
        </div>
      )}

      {/* ── 3. Unsaved Live GPS Alert Banner ── */}
      {hasUnsavedAutoGps && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50/80 p-3.5 text-xs text-amber-900 shadow-xs">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="size-4 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <p className="font-bold text-amber-950">Unsaved Live Location Captured</p>
              <p className="text-amber-800 leading-relaxed">
                Coordinates were captured from your current location, but haven&apos;t been committed to the server yet.
              </p>
            </div>
          </div>
          <Button
            variant="brand"
            size="sm"
            onClick={handleSubmit(onSubmit)}
            disabled={updateMutation.isPending}
            className="gap-1.5 h-8 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white"
          >
            {updateMutation.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Save className="size-3.5" />
            )}
            <span>Save Location</span>
          </Button>
        </div>
      )}

      {/* ── 4. Main Two-Column Layout ── */}
      {isLoading ? (
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center justify-center gap-3">
            <Loader2 className="size-7 animate-spin text-primary-600" />
            <p className="font-mono text-xs text-muted">Loading organization settings...</p>
          </div>
        </Card>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
            {/* Left Column (8 cols): Form Parameters */}
            <div className="flex flex-col gap-5 lg:col-span-8">
              {/* 1. Corporate & Campus Scope Card */}
              <Card className="p-5 flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-primary-600 font-semibold text-sm">
                    <Building2 className="size-4" />
                    <span>1. Corporate & Campus Scope</span>
                  </div>
                  <p className="text-xs text-muted leading-relaxed">
                    Corporate tenant and physical site context associated with this geofence.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Parent Corporate Organization */}
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="corporateName" className="text-xs font-medium text-ink">
                      Parent Corporate Organization
                    </Label>
                    <div className="relative">
                      <Building2 className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-faint" />
                      <input
                        id="corporateName"
                        type="text"
                        readOnly={!isSuperAdmin}
                        disabled={updateMutation.isPending}
                        className={cn(
                          'h-9 w-full rounded-lg border border-line pl-9 pr-3 text-xs text-ink transition-colors',
                          !isSuperAdmin
                            ? 'bg-subtle/70 cursor-not-allowed text-muted'
                            : 'bg-canvas focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400',
                          errors.corporateName && 'border-rose-400 focus:border-rose-400 focus:ring-rose-400'
                        )}
                        {...register('corporateName')}
                      />
                    </div>
                    <span className="font-mono text-[0.625rem] text-muted">
                      {errors.corporateName?.message ||
                        (isSuperAdmin
                          ? 'Corporate entity name (Editable by Super Admin)'
                          : 'Corporate entity (Tenant level)')}
                    </span>
                  </div>

                  {/* Active Campus / Site */}
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="workspaceName" className="text-xs font-medium text-ink">
                      Active Campus / Site
                    </Label>
                    <div className="relative">
                      <Building className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-faint" />
                      <input
                        id="workspaceName"
                        type="text"
                        readOnly={!isSuperAdmin || !activeWs}
                        disabled={updateMutation.isPending || !activeWs}
                        placeholder={activeWs ? 'e.g. Main Campus' : 'No workspace created yet'}
                        className={cn(
                          'h-9 w-full rounded-lg border border-line pl-9 pr-3 text-xs text-ink transition-colors',
                          !isSuperAdmin || !activeWs
                            ? 'bg-subtle/70 cursor-not-allowed text-muted'
                            : 'bg-canvas focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400',
                          errors.workspaceName && 'border-rose-400 focus:border-rose-400 focus:ring-rose-400'
                        )}
                        {...register('workspaceName')}
                      />
                    </div>
                    <span className="font-mono text-[0.625rem] text-muted">
                      {errors.workspaceName?.message ||
                        (activeWs
                          ? isSuperAdmin
                            ? 'Campus / Branch name (Editable by Super Admin)'
                            : activeWs.address || 'Physical site configured in workspace switcher'
                          : 'No active workspace')}
                    </span>
                  </div>
                </div>
              </Card>

              {/* 2. Geographic Perimeter & Radius Card */}
              <Card className="p-5 flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-primary-600 font-semibold text-sm">
                      <MapPin className="size-4" />
                      <span>2. Geographic Perimeter & Radius</span>
                    </div>
                    <p className="text-xs text-muted leading-relaxed">
                      Coordinates define the center of this campus. Mobile punches must fall within the allowed radius.
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleDetectLiveLocation(false)}
                    disabled={isDetectingGps || updateMutation.isPending}
                    className="gap-1.5 text-xs h-7"
                  >
                    {isDetectingGps ? (
                      <Loader2 className="size-3 animate-spin text-primary-600" />
                    ) : (
                      <Crosshair className="size-3 text-primary-600" />
                    )}
                    <span>{isDetectingGps ? 'Detecting...' : 'Detect GPS'}</span>
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Center Latitude */}
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="latitude" className="text-xs font-medium text-ink">
                      Center Latitude
                    </Label>
                    <input
                      id="latitude"
                      type="number"
                      step="any"
                      placeholder="e.g. 19.0760"
                      disabled={updateMutation.isPending}
                      className={cn(
                        'h-9 w-full rounded-lg border border-line bg-canvas px-3 font-mono text-xs text-ink transition-colors focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400',
                        errors.latitude && 'border-rose-400 focus:border-rose-400 focus:ring-rose-400'
                      )}
                      {...register('latitude', { valueAsNumber: true })}
                    />
                    <span className="font-mono text-[0.625rem] text-muted">
                      {errors.latitude?.message || 'Decimal degrees (-90 to +90)'}
                    </span>
                  </div>

                  {/* Center Longitude */}
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="longitude" className="text-xs font-medium text-ink">
                      Center Longitude
                    </Label>
                    <input
                      id="longitude"
                      type="number"
                      step="any"
                      placeholder="e.g. 72.8777"
                      disabled={updateMutation.isPending}
                      className={cn(
                        'h-9 w-full rounded-lg border border-line bg-canvas px-3 font-mono text-xs text-ink transition-colors focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400',
                        errors.longitude && 'border-rose-400 focus:border-rose-400 focus:ring-rose-400'
                      )}
                      {...register('longitude', { valueAsNumber: true })}
                    />
                    <span className="font-mono text-[0.625rem] text-muted">
                      {errors.longitude?.message || 'Decimal degrees (-180 to +180)'}
                    </span>
                  </div>

                  {/* Permitted Radius */}
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="radiusMeters" className="text-xs font-medium text-ink">
                      Permitted Radius (Meters)
                    </Label>
                    <div className="relative">
                      <input
                        id="radiusMeters"
                        type="number"
                        placeholder="100"
                        disabled={updateMutation.isPending}
                        className={cn(
                          'h-9 w-full rounded-lg border border-line bg-canvas pl-3 pr-16 font-mono text-xs text-ink transition-colors focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400',
                          errors.radiusMeters && 'border-rose-400 focus:border-rose-400 focus:ring-rose-400'
                        )}
                        {...register('radiusMeters', { valueAsNumber: true })}
                      />
                      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 font-mono text-[0.6875rem] font-semibold text-muted">
                        meters
                      </span>
                    </div>
                    <span className="font-mono text-[0.625rem] text-muted">
                      {errors.radiusMeters?.message || 'Standard perimeter (e.g. 100m, 150m)'}
                    </span>
                  </div>

                  {/* Late Punch Grace Window */}
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="graceMinutes" className="text-xs font-medium text-ink">
                      Late Punch Grace Window
                    </Label>
                    <div className="relative">
                      <input
                        id="graceMinutes"
                        type="number"
                        placeholder="15"
                        disabled={updateMutation.isPending}
                        className={cn(
                          'h-9 w-full rounded-lg border border-line bg-canvas pl-3 pr-14 font-mono text-xs text-ink transition-colors focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400',
                          errors.graceMinutes && 'border-rose-400 focus:border-rose-400 focus:ring-rose-400'
                        )}
                        {...register('graceMinutes', { valueAsNumber: true })}
                      />
                      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 font-mono text-[0.6875rem] font-semibold text-muted">
                        mins
                      </span>
                    </div>
                    <span className="font-mono text-[0.625rem] text-muted">
                      {errors.graceMinutes?.message || 'Minutes allowed past shift start before marked Late'}
                    </span>
                  </div>
                </div>
              </Card>

              {/* 3. Workspace Default Shift Hours Card */}
              <Card className="p-5 flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-primary-600 font-semibold text-sm">
                    <Clock className="size-4" />
                    <span>3. Workspace Default Shift Hours</span>
                  </div>
                  <p className="text-xs text-muted leading-relaxed">
                    Baseline office schedule. Employees clocking in after start time + grace period will be tagged as &quot;Late&quot;.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <ShiftTimePicker
                    label="Default Shift Start Time"
                    value={watchedValues.defaultShiftStartTime || '09:00'}
                    onChange={(val) => setValue('defaultShiftStartTime', val, { shouldValidate: true })}
                    error={!!errors.defaultShiftStartTime}
                    helperText={errors.defaultShiftStartTime?.message || 'Expected morning clock-in time'}
                    disabled={updateMutation.isPending}
                  />

                  <ShiftTimePicker
                    label="Default Shift End Time"
                    value={watchedValues.defaultShiftEndTime || '18:00'}
                    onChange={(val) => setValue('defaultShiftEndTime', val, { shouldValidate: true })}
                    error={!!errors.defaultShiftEndTime}
                    helperText={errors.defaultShiftEndTime?.message || 'Expected evening clock-out time'}
                    disabled={updateMutation.isPending}
                  />
                </div>
              </Card>

              {/* Submit Button Bar */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="submit"
                  variant="brand"
                  size="default"
                  disabled={updateMutation.isPending || !isValidWorkspaceId}
                  className="gap-2 px-6 shadow-sm"
                >
                  {updateMutation.isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>Saving Settings...</span>
                    </>
                  ) : (
                    <>
                      <Save className="size-4" />
                      <span>Save Organization Settings</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Right Column (4 cols): Live Status & Haversine Info */}
            <div className="flex flex-col gap-5 lg:col-span-4">
              {/* Card 1: Campus Geofence Status */}
              <Card className="p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="eyebrow">CAMPUS GEOFENCE STATUS</span>
                  <Badge
                    variant={
                      hasUnsavedAutoGps
                        ? 'warning'
                        : isConfigured
                        ? 'success'
                        : 'outline'
                    }
                    className="font-mono text-[0.6875rem] font-bold"
                  >
                    {hasUnsavedAutoGps ? (
                      'Unsaved (Live GPS)'
                    ) : isConfigured ? (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="size-3" /> Configured
                      </span>
                    ) : (
                      'Needs Setup'
                    )}
                  </Badge>
                </div>

                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-ink">
                    {activeWs?.name || 'No workspace selected'}
                  </span>
                  <span className="text-xs text-muted leading-tight mt-0.5">
                    {activeWs?.address || 'No campus address configured'}
                  </span>
                </div>

                {/* Active GPS Perimeter Preview Box */}
                <div className="rounded-xl border border-line bg-subtle/50 p-3.5 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[0.625rem] font-bold uppercase tracking-wider text-muted">
                      ACTIVE GPS PERIMETER
                    </span>
                    {hasUnsavedAutoGps && (
                      <Badge variant="warning" className="font-mono text-[0.625rem] px-1.5 py-0">
                        Pending Save
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-col gap-1 font-mono text-xs">
                    <div className="flex justify-between items-center text-ink">
                      <span className="text-muted">Latitude:</span>
                      <strong className="num">
                        {typeof watchedValues.latitude === 'number' && !isNaN(watchedValues.latitude)
                          ? watchedValues.latitude
                          : '—'}
                      </strong>
                    </div>
                    <div className="flex justify-between items-center text-ink">
                      <span className="text-muted">Longitude:</span>
                      <strong className="num">
                        {typeof watchedValues.longitude === 'number' && !isNaN(watchedValues.longitude)
                          ? watchedValues.longitude
                          : '—'}
                      </strong>
                    </div>
                  </div>

                  <div className="border-t border-line mt-1 pt-2 flex items-center justify-between font-mono text-xs">
                    <span className="text-primary-700 font-medium">Radius:</span>
                    <strong className="text-primary-700 font-bold num">
                      {watchedValues.radiusMeters || 100} meters
                    </strong>
                  </div>
                </div>

                {/* Standard Shift Window Preview Box */}
                <div className="rounded-xl border border-line bg-subtle/50 p-3.5 flex flex-col gap-1.5">
                  <span className="font-mono text-[0.625rem] font-bold uppercase tracking-wider text-muted">
                    STANDARD SHIFT WINDOW
                  </span>
                  <div className="font-mono text-xs font-semibold text-ink">
                    {format12h(watchedValues.defaultShiftStartTime || '09:00')} —{' '}
                    {format12h(watchedValues.defaultShiftEndTime || '18:00')}
                  </div>
                  <span className="font-mono text-[0.6875rem] text-muted">
                    Late Grace: <strong>{watchedValues.graceMinutes || 15} minutes</strong>
                  </span>
                </div>

                {gpsAccuracy && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50/60 border border-emerald-200 rounded-lg p-2 font-mono">
                    <Crosshair className="size-3.5 text-emerald-600 shrink-0" />
                    <span>Last GPS detection accuracy: ±{gpsAccuracy}m</span>
                  </div>
                )}
              </Card>

              {/* Card 2: Haversine Proximity Engine Info */}
              <Card className="p-5 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-primary-600 font-semibold text-sm">
                  <Compass className="size-4" />
                  <span>Haversine Proximity Engine</span>
                </div>

                <p className="text-xs text-muted leading-relaxed">
                  During check-in, the mobile app transmits the device&apos;s live GPS coordinates. The backend evaluates great-circle geodesic distance using the <strong className="text-ink">Haversine Formula</strong> against these office coordinates.
                </p>

                <p className="text-xs text-muted leading-relaxed">
                  Employees within <strong className="text-ink font-mono">{watchedValues.radiusMeters || 100} meters</strong> proceed to facial recognition. Punches beyond this perimeter trigger an out-of-bounds warning.
                </p>

                <div className="flex items-center gap-2 border-t border-line pt-3 mt-1 text-[0.6875rem] text-muted font-mono">
                  <ShieldCheck className="size-3.5 text-emerald-600 shrink-0" />
                  <span>Geodesic great-circle math active</span>
                </div>
              </Card>
            </div>
          </div>
        </form>
      )}

      {/* Floating Toast Notification */}
      {toast.open && (
        <div
          className={cn(
            'fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl border p-3.5 text-xs font-medium shadow-pop animate-in slide-in-from-bottom-3',
            toast.severity === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-rose-200 bg-rose-50 text-rose-900'
          )}
        >
          {toast.severity === 'success' ? (
            <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="size-4 text-rose-600 shrink-0" />
          )}
          <span>{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast((prev) => ({ ...prev, open: false }))}
            className="ml-2 rounded p-0.5 hover:bg-black/5"
          >
            <X className="size-3" />
          </button>
        </div>
      )}
    </div>
  );
};

export default OrganizationSettingsPage;
