import React, { useState, useEffect } from 'react';

import {
  Box,
  Typography,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Snackbar,
  Alert,
  useTheme,
  alpha,
  Grid,
  CircularProgress,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ApartmentRoundedIcon from '@mui/icons-material/ApartmentRounded';
import { useAuth } from '../../context/AuthContext';
import { Workspace } from '../../types';

export const WorkspaceSelectPage: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { currentTenant, workspaces, currentWorkspace, switchWorkspace, addWorkspace, refreshWorkspaces } = useAuth();

  useEffect(() => {
    if (!workspaces || workspaces.length === 0) {
      refreshWorkspaces();
    }
  }, [workspaces?.length, refreshWorkspaces]);


  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string; severity: 'success' | 'error' | 'info' } | null>(null);

  const companyName = currentTenant?.name || 'Green Acres Landscaping LLC';

  const handleSelectWorkspace = async (ws: Workspace) => {
    try {
      await switchWorkspace(ws.id);
      setToast({ message: `Active workspace: ${ws.name}`, severity: 'success' });
      setTimeout(() => {
        navigate('/admin/dashboard');
      }, 350);
    } catch {
      setToast({ message: 'Failed to switch workspace', severity: 'error' });
    }
  };

  const handleOpenAddModal = () => {
    setName('');
    setAddressLine1('');
    setCity('');
    setState('');
    setZipCode('');
    setFormErrors({});
    setIsAddModalOpen(true);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!name.trim()) {
      errors.name = 'Workspace name is required';
    }
    if (!addressLine1.trim()) {
      errors.addressLine1 = 'Street address is required';
    }
    if (!city.trim()) {
      errors.city = 'City is required';
    }
    const cleanState = state.trim().toUpperCase();
    if (!cleanState || !/^[A-Za-z]{2}$/.test(cleanState)) {
      errors.state = 'State must be a 2-letter code (e.g. TX)';
    }
    const cleanZip = zipCode.trim();
    if (!cleanZip || !/^\d{5}(-\d{4})?$/.test(cleanZip)) {
      errors.zipCode = 'ZIP code must be 5 digits (e.g. 78701)';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await addWorkspace(name.trim(), {
        address: addressLine1.trim(),
        city: city.trim(),
        state: state.trim().toUpperCase(),
        zipCode: zipCode.trim(),
      });
      setIsAddModalOpen(false);
      setToast({ message: `Created workspace "${created.name}"!`, severity: 'success' });
      setTimeout(() => {
        navigate('/admin/dashboard');
      }, 400);
    } catch (err: any) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        err?.message ||
        'Failed to create workspace';
      setToast({ message: msg, severity: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: theme.palette.mode === 'light' ? '#F8FAFC' : '#0F172A',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        p: { xs: 2, sm: 3, lg: 4 },
      }}
    >
      {/* Top Navigation & Header Bar */}
      <Box
        sx={{
          maxWidth: 1040,
          mx: 'auto',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          py: 2,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* Back to Dashboard */}
          <IconButton
            onClick={() => navigate('/admin/dashboard')}
            sx={{
              p: 1.2,
              borderRadius: 2.5,
              color: 'text.secondary',
              '&:hover': {
                bgcolor: theme.palette.mode === 'light' ? '#E2E8F0' : alpha('#FFFFFF', 0.08),
                color: 'text.primary',
              },
            }}
            title="Return to Dashboard"
          >
            <ArrowBackRoundedIcon sx={{ fontSize: 22 }} />
          </IconButton>

          {/* Icon Badge */}
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2.75,
              bgcolor: theme.palette.primary.main,
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            }}
          >
            <ApartmentRoundedIcon sx={{ fontSize: 22 }} />
          </Box>

          {/* Title & Subtitle */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 800,
                  fontSize: { xs: '1rem', sm: '1.15rem' },
                  color: 'text.primary',
                  letterSpacing: '-0.02em',
                }}
              >
                ClockInClockOut Workspaces
              </Typography>
              <Box
                component="span"
                sx={{
                  px: 1.25,
                  py: 0.35,
                  borderRadius: 10,
                  bgcolor: theme.palette.mode === 'light' ? '#EEF2FF' : alpha(theme.palette.primary.main, 0.2),
                  color: theme.palette.mode === 'light' ? '#3730A3' : '#C7D2FE',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                }}
              >
                {workspaces.length} Branches
              </Box>
            </Box>
            <Typography
              variant="body2"
              sx={{
                fontSize: '0.78rem',
                color: 'text.secondary',
                mt: 0.25,
              }}
            >
              Manage employee attendance, geofences, and shifts per location under <strong>{companyName}</strong>.
            </Typography>
          </Box>
        </Box>

        {/* New Workspace Action Button */}
        <Button
          onClick={handleOpenAddModal}
          variant="contained"
          startIcon={<AddRoundedIcon />}
          sx={{
            borderRadius: 2.5,
            px: 2.5,
            py: 1,
            fontWeight: 700,
            fontSize: '0.82rem',
            textTransform: 'none',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          }}
        >
          New Workspace
        </Button>
      </Box>

      {/* Main Workspace Selection Body */}
      <Box
        sx={{
          maxWidth: 1040,
          mx: 'auto',
          width: '100%',
          my: { xs: 3, sm: 4 },
          flexGrow: 1,
        }}
      >
        <Box sx={{ mb: 3 }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 800,
              fontSize: '1.1rem',
              color: 'text.primary',
              letterSpacing: '-0.01em',
            }}
          >
            Select Active Workspace
          </Typography>
          <Typography
            variant="body2"
            sx={{
              fontSize: '0.8rem',
              color: 'text.secondary',
              mt: 0.3,
            }}
          >
            Click on a workspace to switch your active attendance register, check-in logs, and branch settings.
          </Typography>
        </Box>

        {/* 3-Column Responsive Cards Grid */}
        <Grid container spacing={2.5}>
          {workspaces.map((ws) => {
            const isSelected = ws.id === currentWorkspace?.id;
            return (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={ws.id}>
                <Box
                  onClick={() => handleSelectWorkspace(ws)}
                  sx={{
                    p: 2.75,
                    borderRadius: 3,
                    border: `1.5px solid ${
                      isSelected ? theme.palette.primary.main : theme.palette.divider
                    }`,
                    bgcolor: 'background.paper',
                    boxShadow: isSelected
                      ? theme.palette.mode === 'light'
                        ? '0 10px 15px -3px rgba(99, 102, 241, 0.15), 0 4px 6px -4px rgba(99, 102, 241, 0.1)'
                        : '0 10px 15px -3px rgba(0, 0, 0, 0.4)'
                      : theme.palette.mode === 'light'
                      ? '0 1px 3px 0 rgba(0, 0, 0, 0.04)'
                      : 'none',
                    outline: isSelected
                      ? `2px solid ${alpha(theme.palette.primary.main, 0.25)}`
                      : 'none',
                    transition: 'all 0.2s ease-in-out',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: 180,
                    gap: 2,
                    '&:hover': {
                      borderColor: theme.palette.primary.main,
                      transform: 'translateY(-2px)',
                      boxShadow:
                        theme.palette.mode === 'light'
                          ? '0 12px 20px -3px rgba(15, 23, 42, 0.08)'
                          : '0 12px 20px -3px rgba(0, 0, 0, 0.5)',
                    },
                  }}
                >
                  <Box>
                    {/* Top Row: Storefront Icon & Active Badge */}
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: 2.5,
                          bgcolor: isSelected
                            ? theme.palette.mode === 'light'
                              ? '#EEF2FF'
                              : alpha(theme.palette.primary.main, 0.25)
                            : theme.palette.mode === 'light'
                            ? '#F1F5F9'
                            : alpha(theme.palette.common.white, 0.06),
                          border: `1px solid ${
                            isSelected
                              ? theme.palette.mode === 'light'
                                ? '#C7D2FE'
                                : alpha(theme.palette.primary.main, 0.4)
                              : theme.palette.divider
                          }`,
                          color: isSelected ? theme.palette.primary.main : theme.palette.text.secondary,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <StorefrontRoundedIcon sx={{ fontSize: 22 }} />
                      </Box>

                      {isSelected && (
                        <Box
                          sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 0.5,
                            px: 1.25,
                            py: 0.4,
                            borderRadius: 10,
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            bgcolor: theme.palette.mode === 'light' ? '#EEF2FF' : alpha(theme.palette.primary.main, 0.2),
                            color: theme.palette.mode === 'light' ? '#3730A3' : '#C7D2FE',
                          }}
                        >
                          <CheckRoundedIcon sx={{ fontSize: 14 }} />
                          Active
                        </Box>
                      )}
                    </Box>

                    {/* Workspace Title */}
                    <Typography
                      variant="subtitle1"
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.98rem',
                        color: 'text.primary',
                        mt: 1.75,
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {ws.name}
                    </Typography>

                    {/* Address / Location Line */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5, color: 'text.secondary' }}>
                      <LocationOnOutlinedIcon sx={{ fontSize: 16, flexShrink: 0 }} />
                      <Typography
                        variant="caption"
                        sx={{
                          fontSize: '0.78rem',
                          color: 'text.secondary',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {ws.address ? `${ws.address}, ` : ''}{ws.city || 'Austin'}, {ws.state || 'TX'} {ws.zipCode || ''}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Card Footer */}
                  <Box
                    sx={{
                      pt: 1.5,
                      borderTop: `1px solid ${theme.palette.divider}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.75rem',
                    }}
                  >
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                      Geofence: <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>100m Active</Box>
                      {ws.employeeCount ? ` • ${ws.employeeCount} Staff` : ''}
                    </Typography>

                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        color: theme.palette.primary.main,
                        fontWeight: 700,
                        fontSize: '0.78rem',
                      }}
                    >
                      Launch
                      <ArrowForwardRoundedIcon sx={{ fontSize: 14 }} />
                    </Box>
                  </Box>
                </Box>
              </Grid>
            );
          })}
        </Grid>
      </Box>

      {/* Modal: "Add Workspace & Branch" */}
      <Dialog
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              borderRadius: 3.5,
              p: 1.5,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            },
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box
              sx={{
                width: 34,
                height: 34,
                borderRadius: 2,
                bgcolor: theme.palette.mode === 'light' ? '#EEF2FF' : alpha(theme.palette.primary.main, 0.2),
                color: theme.palette.primary.main,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <StorefrontRoundedIcon sx={{ fontSize: 18 }} />
            </Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, fontSize: '1.05rem', color: 'text.primary' }}>
              Add Workspace & Branch
            </Typography>
          </Box>
          <IconButton onClick={() => setIsAddModalOpen(false)} size="small" sx={{ color: 'text.secondary' }}>
            <CloseRoundedIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </DialogTitle>

        <form onSubmit={handleCreateWorkspace}>
          <DialogContent sx={{ pt: 1 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem', mb: 2 }}>
              Add a physical branch location, warehouse, or regional office under <strong>{companyName}</strong>.
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.primary', mb: 0.5, display: 'block' }}>
                  Workspace Name *
                </Typography>
                <TextField
                  autoFocus
                  required
                  placeholder="e.g. Northeast Regional Branch"
                  fullWidth
                  size="small"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: '' }));
                  }}
                  error={Boolean(formErrors.name)}
                  helperText={formErrors.name}
                  slotProps={{
                    input: { sx: { borderRadius: '10px', fontSize: '0.85rem' } },
                  }}
                />
              </Box>

              <Box>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.primary', mb: 0.5, display: 'block' }}>
                  Street Address *
                </Typography>
                <TextField
                  required
                  placeholder="e.g. 500 Enterprise Way"
                  fullWidth
                  size="small"
                  value={addressLine1}
                  onChange={(e) => {
                    setAddressLine1(e.target.value);
                    if (formErrors.addressLine1) setFormErrors((prev) => ({ ...prev, addressLine1: '' }));
                  }}
                  error={Boolean(formErrors.addressLine1)}
                  helperText={formErrors.addressLine1}
                  slotProps={{
                    input: { sx: { borderRadius: '10px', fontSize: '0.85rem' } },
                  }}
                />
              </Box>

              <Grid container spacing={1.5}>
                <Grid size={{ xs: 5 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.primary', mb: 0.5, display: 'block' }}>
                    City *
                  </Typography>
                  <TextField
                    required
                    placeholder="Austin"
                    fullWidth
                    size="small"
                    value={city}
                    onChange={(e) => {
                      setCity(e.target.value);
                      if (formErrors.city) setFormErrors((prev) => ({ ...prev, city: '' }));
                    }}
                    error={Boolean(formErrors.city)}
                    helperText={formErrors.city}
                    slotProps={{
                      input: { sx: { borderRadius: '10px', fontSize: '0.85rem' } },
                    }}
                  />
                </Grid>
                <Grid size={{ xs: 3 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.primary', mb: 0.5, display: 'block' }}>
                    State *
                  </Typography>
                  <TextField
                    required
                    placeholder="TX"
                    fullWidth
                    size="small"
                    value={state}
                    onChange={(e) => {
                      setState(e.target.value.toUpperCase());
                      if (formErrors.state) setFormErrors((prev) => ({ ...prev, state: '' }));
                    }}
                    error={Boolean(formErrors.state)}
                    helperText={formErrors.state}
                    slotProps={{
                      input: { sx: { borderRadius: '10px', fontSize: '0.85rem' } },
                      htmlInput: { maxLength: 2 },
                    }}
                  />
                </Grid>
                <Grid size={{ xs: 4 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.primary', mb: 0.5, display: 'block' }}>
                    Zip Code *
                  </Typography>
                  <TextField
                    required
                    placeholder="78701"
                    fullWidth
                    size="small"
                    value={zipCode}
                    onChange={(e) => {
                      setZipCode(e.target.value);
                      if (formErrors.zipCode) setFormErrors((prev) => ({ ...prev, zipCode: '' }));
                    }}
                    error={Boolean(formErrors.zipCode)}
                    helperText={formErrors.zipCode}
                    slotProps={{
                      input: { sx: { borderRadius: '10px', fontSize: '0.85rem' } },
                    }}
                  />
                </Grid>
              </Grid>
            </Box>
          </DialogContent>

          <Box sx={{ px: 3, pb: 3, pt: 1.5, display: 'flex', gap: 1.5 }}>
            <Button
              type="button"
              disabled={isSubmitting}
              onClick={() => setIsAddModalOpen(false)}
              sx={{
                flex: 1,
                py: 1.2,
                borderRadius: '10px',
                border: `1px solid ${theme.palette.divider}`,
                color: theme.palette.text.secondary,
                fontWeight: 600,
                fontSize: '0.82rem',
                textTransform: 'none',
                bgcolor: theme.palette.mode === 'light' ? '#FFFFFF' : alpha(theme.palette.common.white, 0.04),
                '&:hover': {
                  bgcolor: theme.palette.mode === 'light' ? '#F8FAFC' : alpha(theme.palette.common.white, 0.08),
                  borderColor: theme.palette.mode === 'light' ? '#CBD5E1' : '#475569',
                  color: theme.palette.text.primary,
                },
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={!name.trim() || isSubmitting}
              startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : null}
              sx={{
                flex: 1,
                py: 1.2,
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '0.82rem',
                textTransform: 'none',
                color: '#FFFFFF !important',
                bgcolor: `${theme.palette.primary.main} !important`,
                boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.25)',
                transition: 'all 0.15s ease-in-out',
                '&:hover': {
                  bgcolor: `${theme.palette.primary.dark} !important`,
                },
                '&.Mui-disabled': {
                  bgcolor: `${alpha(theme.palette.primary.main, 0.5)} !important`,
                  color: '#FFFFFF !important',
                  opacity: 0.65,
                  cursor: 'not-allowed',
                  boxShadow: 'none',
                },
              }}
            >
              {isSubmitting ? 'Creating...' : 'Create Workspace'}
            </Button>
          </Box>
        </form>
      </Dialog>

      {/* Toast Feedback */}
      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={3000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setToast(null)}
          severity={toast?.severity || 'info'}
          variant="filled"
          sx={{
            borderRadius: 2,
            fontWeight: 600,
            fontSize: '0.82rem',
            bgcolor: toast?.severity === 'error' ? '#EF4444' : '#0F172A',
            color: '#FFFFFF',
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)',
          }}
        >
          {toast?.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default WorkspaceSelectPage;
