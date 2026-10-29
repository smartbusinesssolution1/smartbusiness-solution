import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { settingsService } from '../services/settingsService';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Box,
  Typography,
  LinearProgress,
  ButtonBase,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Grid,
  Alert,
  Tooltip,
  Collapse,
} from '@mui/material';
import {
  AssignmentTurnedIn as ChecklistIcon,
  Domain as WorkspaceIcon,
  LocationOn as GeofenceIcon,
  Schedule as ShiftIcon,
  PersonAdd as AddStaffIcon,
  AccountCircle as ProfilePhotoIcon,
  CheckCircle as CompletedIcon,
  ArrowForward as ArrowForwardIcon,
  Close as CloseIcon,
  Check as CheckIcon,
  Add as AddIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

interface OnboardingChecklistWidgetProps {
  totalEmployeesCount?: number;
  hasGeofenceConfigured?: boolean;
  hasShiftConfigured?: boolean;
  hasAvatarUploaded?: boolean;
}

export const OnboardingChecklistWidget: React.FC<OnboardingChecklistWidgetProps> = ({
  totalEmployeesCount = 0,
  hasGeofenceConfigured = false,
  hasShiftConfigured = false,
  hasAvatarUploaded = false,
}) => {
  const navigate = useNavigate();
  const { user, currentTenant, workspaces, currentWorkspace, addWorkspace, switchWorkspace } = useAuth();

  const cleanId = (id?: string | null): string => {
    if (!id || id === 'undefined' || id === 'null' || id.trim() === '') return '';
    return id.trim();
  };

  const activeWorkspaceId =
    cleanId(currentWorkspace?.id) ||
    cleanId(localStorage.getItem('active_workspace_id')) ||
    cleanId(workspaces?.[0]?.id) ||
    '';

  const { data: geofenceSettings } = useQuery({
    queryKey: ['adminGeofence', activeWorkspaceId],
    queryFn: () => settingsService.getGeofence(activeWorkspaceId),
    enabled: Boolean(activeWorkspaceId),
    staleTime: 30_000,
  });

  const tenantId = currentTenant?.id || 'default_tenant';
  const dismissStorageKey = `checkpoint_onboarding_dismissed_${tenantId}`;
  const sessionDismissKey = `checkpoint_onboarding_dismissed_session_${tenantId}`;

  // Session-only dismissal: only hides for current session when user explicitly presses close.
  // NEVER permanently hides unless 100% complete.
  const [isSessionDismissed, setIsSessionDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(sessionDismissKey) === 'true';
    } catch {
      return false;
    }
  });

  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  // Modal State for Step 1 (Create Workspace)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [wsName, setWsName] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [isSubmittingWs, setIsSubmittingWs] = useState(false);
  const [wsError, setWsError] = useState<string | null>(null);

  // Derive step completion states
  const isStep1Done = Boolean(workspaces && workspaces.length > 0);
  const isStep2Done = Boolean(
    hasGeofenceConfigured ||
    (geofenceSettings?.isConfigured &&
      geofenceSettings?.geofence &&
      (Number(geofenceSettings.geofence.latitude) !== 0 || Number(geofenceSettings.geofence.longitude) !== 0)) ||
    (activeWorkspaceId && localStorage.getItem(`geofence_configured_${activeWorkspaceId}`) === 'true') ||
    (tenantId && localStorage.getItem(`geofence_configured_${tenantId}`) === 'true')
  );
  const isStep3Done = Boolean(
    hasShiftConfigured ||
    (geofenceSettings?.isConfigured &&
      Boolean(geofenceSettings.geofence?.defaultShiftStartTime) &&
      Boolean(geofenceSettings.geofence?.defaultShiftEndTime)) ||
    (activeWorkspaceId && localStorage.getItem(`shifts_configured_${activeWorkspaceId}`) === 'true') ||
    (tenantId && localStorage.getItem(`shifts_configured_${tenantId}`) === 'true')
  );
  const isStep4Done = Boolean(totalEmployeesCount > 0);
  const isAvatarDone = Boolean(
    hasAvatarUploaded ||
    (user?.avatarUrl && user.avatarUrl.trim() !== '' && !user.avatarUrl.includes('placeholder')) ||
    (user?.id && localStorage.getItem(`avatar_uploaded_${user.id}`) === 'true')
  );

  const steps = useMemo(() => [
    {
      id: 1,
      title: 'Create First Workspace',
      desc: 'Set up physical location / HQ',
      isCompleted: isStep1Done,
      icon: <WorkspaceIcon sx={{ fontSize: 18 }} />,
      actionText: isStep1Done ? 'Done' : 'Create',
      onClick: () => {
        if (!isStep1Done) {
          setIsCreateModalOpen(true);
        } else {
          navigate('/workspace/select');
        }
      },
    },
    {
      id: 2,
      title: 'Configure GPS Geofence',
      desc: 'Enforce on-site punch radius',
      isCompleted: isStep2Done,
      icon: <GeofenceIcon sx={{ fontSize: 18 }} />,
      actionText: isStep2Done ? 'Done' : 'Setup',
      onClick: () => {
        navigate('/admin/settings');
      },
    },
    {
      id: 3,
      title: 'Define Shift Policies',
      desc: 'Office hours & grace period',
      isCompleted: isStep3Done,
      icon: <ShiftIcon sx={{ fontSize: 18 }} />,
      actionText: isStep3Done ? 'Done' : 'Edit',
      onClick: () => {
        navigate('/admin/settings');
      },
    },
    {
      id: 4,
      title: 'Register Staff Members',
      desc: 'Add employee badge codes',
      isCompleted: isStep4Done,
      icon: <AddStaffIcon sx={{ fontSize: 18 }} />,
      actionText: isStep4Done ? 'Done' : 'Add',
      onClick: () => {
        navigate('/admin/employees/new');
      },
    },
    {
      id: 5,
      title: 'Upload Profile Photo',
      desc: 'Add administrator avatar photo',
      isCompleted: isAvatarDone,
      icon: <ProfilePhotoIcon sx={{ fontSize: 18 }} />,
      actionText: isAvatarDone ? 'Done' : 'Upload',
      onClick: () => {
        navigate('/admin/profile');
      },
    },
  ], [isStep1Done, isStep2Done, isStep3Done, isStep4Done, isAvatarDone, navigate]);

  const completedCount = steps.filter((s) => s.isCompleted).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);
  const isAllComplete = completedCount === steps.length;

  // Automatically dismiss permanently only when 100% complete.
  // If not 100% complete, ensure localStorage does NOT permanently hide it!
  useEffect(() => {
    try {
      if (isAllComplete) {
        localStorage.setItem(dismissStorageKey, 'true');
      } else {
        localStorage.removeItem(dismissStorageKey);
        localStorage.removeItem('checkpoint_onboarding_dismissed');
      }
    } catch {
      // Storage unavailable
    }
  }, [isAllComplete, dismissStorageKey]);

  const handleDismiss = () => {
    if (isAllComplete) {
      try {
        localStorage.setItem(dismissStorageKey, 'true');
      } catch {}
    } else {
      // Only dismiss for this session; will reappear after logout/login or via "Show Checklist"
      setIsSessionDismissed(true);
      try {
        sessionStorage.setItem(sessionDismissKey, 'true');
      } catch {}
    }
  };

  const handleReopen = () => {
    setIsSessionDismissed(false);
    try {
      sessionStorage.removeItem(sessionDismissKey);
    } catch {}
  };

  const handleCreateWorkspaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wsName.trim()) {
      setWsError('Workspace name is required (e.g. Main Headquarters).');
      return;
    }

    if (zipCode.trim() && !/^\d{5}(-\d{4})?$/.test(zipCode.trim())) {
      setWsError('ZIP code must be 5 digits (e.g. 78701) or ZIP+4 (e.g. 78701-1234).');
      return;
    }

    setWsError(null);
    setIsSubmittingWs(true);

    try {
      const created = await addWorkspace(wsName.trim(), {
        address: addressLine.trim(),
        city: city.trim(),
        state: state.trim().toUpperCase(),
        zipCode: zipCode.trim(),
      });
      await switchWorkspace(created.id);
      setIsCreateModalOpen(false);
      setWsName('');
      setAddressLine('');
      setCity('');
      setState('');
      setZipCode('');
    } catch (err: any) {
      setWsError(err?.message || 'Failed to create workspace. Please try again.');
    } finally {
      setIsSubmittingWs(false);
    }
  };

  // If 100% complete, permanently remove from view
  if (isAllComplete) {
    return null;
  }

  // If dismissed for current session, show compact banner so admin can easily reopen
  if (isSessionDismissed) {
    return (
      <Card
        sx={{
          borderRadius: 3,
          border: (t) => `1px dashed ${t.palette.divider}`,
          p: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          bgcolor: 'background.paper',
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 26,
              height: 26,
              borderRadius: 1.5,
              bgcolor: 'primary.light',
              color: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ChecklistIcon sx={{ fontSize: 16 }} />
          </Box>
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.primary', display: 'block', lineHeight: 1.2 }}>
              Tenant Onboarding Guide ({progressPercent}%)
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.68rem', fontWeight: 500 }}>
              {completedCount} of {steps.length} milestones complete • Visible until 100%
            </Typography>
          </Box>
        </Box>
        <Button
          size="small"
          variant="outlined"
          onClick={handleReopen}
          sx={{
            fontSize: '0.72rem',
            fontWeight: 700,
            textTransform: 'none',
            py: 0.35,
            px: 1.25,
            borderRadius: 1.5,
          }}
        >
          Show Checklist
        </Button>
      </Card>
    );
  }

  return (
    <>
      <Card
        sx={{
          borderRadius: 3,
          border: (t) => `1px solid ${t.palette.divider}`,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          p: 2.5,
          position: 'relative',
        }}
      >
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: 2,
                bgcolor: 'primary.light',
                color: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ChecklistIcon sx={{ fontSize: 18 }} />
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'text.primary', lineHeight: 1.2 }}>
                Tenant Onboarding Guide
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                {completedCount} of {steps.length} milestones complete
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Chip
              label={`${progressPercent}%`}
              size="small"
              sx={{
                fontWeight: 800,
                fontSize: '0.72rem',
                height: 22,
                bgcolor: isAllComplete ? '#ecfdf5' : 'primary.light',
                color: isAllComplete ? '#059669' : 'primary.main',
                border: (t) => `1px solid ${isAllComplete ? '#a7f3d0' : t.palette.primary.light}`,
              }}
            />
            <Tooltip title={isCollapsed ? 'Expand Steps' : 'Collapse Steps'}>
              <IconButton size="small" onClick={() => setIsCollapsed(!isCollapsed)} sx={{ color: 'text.disabled', p: 0.5 }}>
                {isCollapsed ? <ExpandMoreIcon sx={{ fontSize: 18 }} /> : <ExpandLessIcon sx={{ fontSize: 18 }} />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Minimize for this session (will reappear on next login until 100% complete)">
              <IconButton size="small" onClick={handleDismiss} sx={{ color: 'text.disabled', p: 0.5 }}>
                <CloseIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Progress Bar */}
        <Box sx={{ width: '100%', mb: 2 }}>
          <LinearProgress
            variant="determinate"
            value={progressPercent}
            sx={{
              height: 6,
              borderRadius: 3,
              bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : '#f1f5f9'),
              '& .MuiLinearProgress-bar': {
                borderRadius: 3,
                bgcolor: isAllComplete ? '#059669' : 'primary.main',
              },
            }}
          />
        </Box>

        {/* Steps List */}
        <Collapse in={!isCollapsed}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          {steps.map((step) => {
            const isNextStep = !step.isCompleted && (step.id === 1 || steps[step.id - 2]?.isCompleted);

            return (
              <ButtonBase
                key={step.id}
                id={`checklist-step-${step.id}`}
                onClick={step.onClick}
                sx={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  p: 1.25,
                  borderRadius: 2,
                  bgcolor: step.isCompleted
                    ? 'background.default'
                    : isNextStep
                    ? (t) => (t.palette.mode === 'dark' ? 'rgba(37,99,235,0.1)' : '#eff6ff')
                    : 'background.paper',
                  border: (t) =>
                    `1px solid ${
                      step.isCompleted
                        ? t.palette.divider
                        : isNextStep
                        ? t.palette.primary.main
                        : t.palette.divider
                    }`,
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    borderColor: 'primary.main',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                  <Box
                    sx={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: step.isCompleted
                        ? '#ecfdf5'
                        : isNextStep
                        ? 'primary.main'
                        : 'action.hover',
                      color: step.isCompleted
                        ? '#059669'
                        : isNextStep
                        ? '#ffffff'
                        : 'text.secondary',
                      flexShrink: 0,
                    }}
                  >
                    {step.isCompleted ? (
                      <CheckIcon sx={{ fontSize: 16 }} />
                    ) : (
                      <Typography variant="caption" sx={{ fontWeight: 800, fontSize: '0.72rem' }}>
                        {step.id}
                      </Typography>
                    )}
                  </Box>

                  <Box>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        lineHeight: 1.2,
                        textDecoration: step.isCompleted ? 'line-through' : 'none',
                        color: step.isCompleted ? 'text.secondary' : 'text.primary',
                      }}
                    >
                      {step.title}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        display: 'block',
                        color: 'text.secondary',
                        fontSize: '0.7rem',
                        fontWeight: 500,
                      }}
                    >
                      {step.desc}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 700,
                      fontSize: '0.72rem',
                      color: step.isCompleted
                        ? '#059669'
                        : isNextStep
                        ? 'primary.main'
                        : 'text.secondary',
                    }}
                  >
                    {step.actionText}
                  </Typography>
                  {!step.isCompleted && (
                    <ArrowForwardIcon sx={{ fontSize: 14, color: isNextStep ? 'primary.main' : 'text.disabled' }} />
                  )}
                </Box>
              </ButtonBase>
            );
          })}
          </Box>
        </Collapse>
      </Card>

      {/* Modal Dialog for Step 1: Create Workspace */}
      <Dialog
        open={isCreateModalOpen}
        onClose={() => !isSubmittingWs && setIsCreateModalOpen(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              borderRadius: 3,
              p: 1,
            },
          },
        }}
      >
        <form onSubmit={handleCreateWorkspaceSubmit}>
          <DialogTitle sx={{ pb: 1, pt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 2,
                bgcolor: 'primary.light',
                color: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <WorkspaceIcon sx={{ fontSize: 20 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, fontSize: '1.05rem', lineHeight: 1.2 }}>
                Create Primary Workspace
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Step 1 of Onboarding Checklist
              </Typography>
            </Box>
          </DialogTitle>

          <DialogContent sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: '0.82rem' }}>
              Workspaces represent physical office branches, warehouses, or sites. Attendance logs and geofences anchor to this location.
            </Typography>

            {wsError && (
              <Alert severity="error" sx={{ mb: 2, fontSize: '0.8rem' }}>
                {wsError}
              </Alert>
            )}

            <Grid container spacing={2}>
              <Grid size={{ xs: 12 }}>
                <TextField
                  label="Workspace / Branch Name"
                  placeholder="e.g. Main Headquarters (HQ)"
                  fullWidth
                  size="small"
                  required
                  value={wsName}
                  onChange={(e) => setWsName(e.target.value)}
                  autoFocus
                />
              </Grid>

              <Grid size={{ xs: 12 }}>
                <TextField
                  label="Physical Street Address"
                  placeholder="e.g. 100 Enterprise Way"
                  fullWidth
                  size="small"
                  value={addressLine}
                  onChange={(e) => setAddressLine(e.target.value)}
                />
              </Grid>

              <Grid size={{ xs: 5 }}>
                <TextField
                  label="City"
                  placeholder="City"
                  fullWidth
                  size="small"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </Grid>

              <Grid size={{ xs: 3 }}>
                <TextField
                  label="State"
                  placeholder="TX"
                  fullWidth
                  size="small"
                  slotProps={{ htmlInput: { maxLength: 2, style: { textTransform: 'uppercase' } } }}
                  value={state}
                  onChange={(e) => setState(e.target.value.toUpperCase())}
                />
              </Grid>

              <Grid size={{ xs: 4 }}>
                <TextField
                  label="ZIP Code"
                  placeholder="78701"
                  fullWidth
                  size="small"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                />
              </Grid>
            </Grid>
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 2, pt: 1 }}>
            <Button
              onClick={() => setIsCreateModalOpen(false)}
              disabled={isSubmittingWs}
              sx={{ textTransform: 'none', fontWeight: 600, color: 'text.secondary' }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={isSubmittingWs}
              startIcon={<AddIcon />}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: 2,
                px: 2.5,
              }}
            >
              {isSubmittingWs ? 'Creating...' : 'Create Workspace'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
};

export default OnboardingChecklistWidget;
