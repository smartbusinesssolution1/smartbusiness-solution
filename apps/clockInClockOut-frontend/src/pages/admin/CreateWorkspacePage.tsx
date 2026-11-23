import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { notify } from '../../context/NotificationContext';
import {
  Box,
  TextField,
  Button,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  ShieldOutlined as ShieldIcon,
  ArrowForward as ArrowForwardIcon,
  Apartment as ApartmentIcon,
} from '@mui/icons-material';
import { LogOut, ArrowLeft } from 'lucide-react';
import { AttendanceShowcase } from '../auth/components/AttendanceShowcase';

const inputSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '10px',
    bgcolor: '#FFFFFF',
    color: '#0F172A',
    fontSize: '0.9rem',
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    '& fieldset': {
      borderColor: '#E2E8F0',
      transition: 'border-color 0.2s ease-in-out',
    },
    '&:hover fieldset': {
      borderColor: '#CBD5E1',
    },
    '&.Mui-focused': {
      boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.15)',
    },
    '&.Mui-focused fieldset': {
      borderColor: '#2563EB',
    },
    '& input': {
      color: '#0F172A',
      '&::placeholder': {
        color: '#94A3B8',
        opacity: 1,
      },
      '&::-webkit-input-placeholder': {
        color: '#94A3B8',
        opacity: 1,
      },
      '&::-moz-placeholder': {
        color: '#94A3B8',
        opacity: 1,
      },
    },
  },
};

export const CreateWorkspacePage: React.FC = () => {
  const navigate = useNavigate();
  const { currentTenant, isSuperAdmin, workspaces, addWorkspace, logout, user } = useAuth();

  const isOwner = Boolean(currentTenant?.role === 'OWNER' || isSuperAdmin);
  const companyName = currentTenant?.name || 'Organization';
  const hasExistingWorkspaces = Boolean(workspaces && workspaces.length > 0);

  // Form State
  const [name, setName] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      navigate('/login');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!name.trim()) {
      errors.name = 'Workspace / Branch name is required';
    }
    if (!addressLine1.trim()) {
      errors.addressLine1 = 'Street address is required';
    }
    if (!city.trim()) {
      errors.city = 'City is required';
    }
    const cleanState = state.trim().toUpperCase();
    if (!cleanState || !/^[A-Za-z]{2}$/.test(cleanState)) {
      errors.state = 'State must be a 2-letter code (e.g. TX, CA)';
    }
    const cleanZip = zipCode.trim();
    if (!cleanZip) {
      errors.zipCode = 'ZIP code is required';
    } else if (!/^\d{5}(-\d{4})?$/.test(cleanZip)) {
      errors.zipCode = 'ZIP code must be 5 digits (e.g. 78701) or ZIP+4';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setGeneralError(null);
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
      notify(`Created branch "${created.name}"!`, 'success');
      navigate('/admin/dashboard', { replace: true });
    } catch (err: any) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        err?.message ||
        'Failed to create workspace';
      setGeneralError(msg);
      notify(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{ colorScheme: 'light' }}
      className="min-h-screen bg-[#F8FAFC] text-[#0F172A] font-sans antialiased flex flex-col selection:bg-[#2563EB] selection:text-white"
    >
      {/* Top Clean Brand Header - Spanning Full Width of Screen */}
      <header className="w-full px-6 py-4 sm:px-10 lg:px-12 flex items-center justify-between border-b border-slate-200/60 bg-[#F8FAFC]/80 backdrop-blur-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] border border-[#DBEAFE] flex items-center justify-center shadow-sm overflow-hidden">
            <img src="/auth-icon.png" alt="SmartBusiness" className="w-full h-full object-contain" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-slate-900">SmartBusiness</span>
              <span className="px-2 py-0.5 text-[10px] font-semibold text-[#2563EB] bg-[#EFF6FF] border border-[#BFDBFE] rounded-full">
                Clock-In Clock-Out SaaS
              </span>
            </div>
            <span className="font-mono text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
              {hasExistingWorkspaces ? 'Multi-Site Architecture' : 'Workspace Setup'}
            </span>
          </div>
        </div>

        {/* Right side user info & sign out at the far right end of the screen */}
        <div className="flex items-center gap-3 text-xs">
          {user?.email && (
            <span className="hidden sm:inline font-mono text-slate-500">{user.email}</span>
          )}
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-600 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition shadow-xs cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign out</span>
          </button>
        </div>
      </header>

      {/* Main Responsive Grid Layout */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] transition-all duration-300">

        {/* =================================================================== */}
        {/* COLUMN 1: FORM COLUMN                                              */}
        {/* =================================================================== */}
        <section aria-labelledby="workspace-heading" className="flex flex-col justify-between px-6 py-6 sm:px-12 md:px-16 lg:px-20 bg-[#F8FAFC]">

          {/* Center Card */}
          <div className="flex flex-1 items-center justify-center py-8">
            <div className="w-full max-w-[28.5rem]">
              {!isOwner ? (
                /* Non-owner access restriction card */
                <div
                  className="rounded-2xl border border-slate-200 bg-white transition-all duration-300"
                  style={{
                    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 20px 45px -20px rgba(37, 99, 235, 0.28)',
                  }}
                >
                  <div className="p-7 sm:p-9 flex flex-col items-center text-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500">
                      <ApartmentIcon sx={{ fontSize: 28, color: '#2563EB' }} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                        You're not in a workspace yet
                      </h1>
                      <p className="text-sm text-slate-500 leading-relaxed">
                        Only the company owner or an organization administrator can create workspaces in{' '}
                        <strong className="text-slate-800">{companyName}</strong>. Ask them to add you to a branch workspace.
                      </p>
                    </div>
                    <Button
                      variant="outlined"
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                      sx={{
                        mt: 2,
                        textTransform: 'none',
                        borderRadius: '10px',
                        borderColor: '#CBD5E1',
                        color: '#475569',
                        fontWeight: 600,
                        '&:hover': {
                          borderColor: '#94A3B8',
                          bgcolor: '#F1F5F9',
                        },
                      }}
                    >
                      Sign out of account
                    </Button>
                  </div>
                </div>
              ) : (
                /* Owner Workspace Creation Card */
                <div
                  className="rounded-2xl border border-slate-200 bg-white transition-all duration-300"
                  style={{
                    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 20px 45px -20px rgba(37, 99, 235, 0.28)',
                  }}
                >
                  <div className="p-7 sm:p-9 flex flex-col gap-6">

                    {/* Card Header */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#2563EB]">
                          {hasExistingWorkspaces ? 'Branch Location' : 'Step 1 of 1 · Primary Branch'}
                        </span>
                        {hasExistingWorkspaces && (
                          <button
                            type="button"
                            onClick={() => navigate('/admin/workspaces')}
                            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition cursor-pointer"
                          >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            Back
                          </button>
                        )}
                      </div>
                      <h1 id="workspace-heading" className="text-2xl font-bold tracking-tight text-slate-900">
                        {hasExistingWorkspaces ? 'Create new branch workspace' : 'Create your workspace'}
                      </h1>
                      <p className="text-sm text-slate-500 leading-relaxed">
                        {hasExistingWorkspaces
                          ? `Add a new physical office location, warehouse, or campus under ${companyName}.`
                          : `Welcome to ${companyName}! Set up your branch location to begin tracking attendance, shifts, and staff.`}
                      </p>
                    </div>

                    {/* General Error Alert */}
                    {generalError && (
                      <Alert
                        severity="error"
                        sx={{
                          borderRadius: '12px',
                          fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                          fontSize: '0.85rem',
                        }}
                      >
                        {generalError}
                      </Alert>
                    )}

                    {/* Creation Form */}
                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">

                      {/* Workspace / Branch Name */}
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="ws-name" className="text-xs font-semibold text-slate-700">
                          Workspace / Branch Name *
                        </label>
                        <TextField
                          id="ws-name"
                          fullWidth
                          placeholder="e.g. Austin Regional Branch"
                          variant="outlined"
                          value={name}
                          onChange={(e) => {
                            setName(e.target.value);
                            if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: '' }));
                          }}
                          error={!!formErrors.name}
                          helperText={formErrors.name}
                          disabled={isSubmitting}
                          autoFocus
                          sx={inputSx}
                        />
                      </div>

                      {/* Street Address */}
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="ws-address" className="text-xs font-semibold text-slate-700">
                          Street Address *
                        </label>
                        <TextField
                          id="ws-address"
                          fullWidth
                          placeholder="e.g. 500 Enterprise Way, Suite 200"
                          variant="outlined"
                          value={addressLine1}
                          onChange={(e) => {
                            setAddressLine1(e.target.value);
                            if (formErrors.addressLine1) setFormErrors((prev) => ({ ...prev, addressLine1: '' }));
                          }}
                          error={!!formErrors.addressLine1}
                          helperText={formErrors.addressLine1}
                          disabled={isSubmitting}
                          sx={inputSx}
                        />
                      </div>

                      {/* City, State, ZIP in Responsive Grid */}
                      <div className="grid grid-cols-12 gap-3">
                        <div className="col-span-12 sm:col-span-6 flex flex-col gap-1.5">
                          <label htmlFor="ws-city" className="text-xs font-semibold text-slate-700">
                            City *
                          </label>
                          <TextField
                            id="ws-city"
                            fullWidth
                            placeholder="e.g. Austin"
                            variant="outlined"
                            value={city}
                            onChange={(e) => {
                              setCity(e.target.value);
                              if (formErrors.city) setFormErrors((prev) => ({ ...prev, city: '' }));
                            }}
                            error={!!formErrors.city}
                            helperText={formErrors.city}
                            disabled={isSubmitting}
                            sx={inputSx}
                          />
                        </div>

                        <div className="col-span-6 sm:col-span-3 flex flex-col gap-1.5">
                          <label htmlFor="ws-state" className="text-xs font-semibold text-slate-700">
                            State *
                          </label>
                          <TextField
                            id="ws-state"
                            fullWidth
                            placeholder="TX"
                            variant="outlined"
                            value={state}
                            onChange={(e) => {
                              const clean = e.target.value.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase();
                              setState(clean);
                              if (formErrors.state) setFormErrors((prev) => ({ ...prev, state: '' }));
                            }}
                            error={!!formErrors.state}
                            helperText={formErrors.state}
                            disabled={isSubmitting}
                            slotProps={{
                              input: {
                                inputProps: { maxLength: 2, style: { textTransform: 'uppercase', fontFamily: 'monospace' } },
                              },
                            }}
                            sx={inputSx}
                          />
                        </div>

                        <div className="col-span-6 sm:col-span-3 flex flex-col gap-1.5">
                          <label htmlFor="ws-zip" className="text-xs font-semibold text-slate-700">
                            ZIP *
                          </label>
                          <TextField
                            id="ws-zip"
                            fullWidth
                            placeholder="78701"
                            variant="outlined"
                            value={zipCode}
                            onChange={(e) => {
                              const sanitized = e.target.value.replace(/[^\d-]/g, '').slice(0, 10);
                              setZipCode(sanitized);
                              if (formErrors.zipCode) setFormErrors((prev) => ({ ...prev, zipCode: '' }));
                            }}
                            error={!!formErrors.zipCode}
                            helperText={formErrors.zipCode}
                            disabled={isSubmitting}
                            slotProps={{
                              input: {
                                inputProps: { maxLength: 10, fontFamily: 'monospace' },
                              },
                            }}
                            sx={inputSx}
                          />
                        </div>
                      </div>

                      {/* Feature pill notes */}
                      <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 flex items-center justify-between text-[11px] text-slate-600">
                        <span className="font-medium text-slate-700">Includes in branch:</span>
                        <span>100m Geofence</span>
                        <span>•</span>
                        <span>Live Face ID Check</span>
                        <span>•</span>
                        <span>Shift Roster</span>
                      </div>

                      {/* Submit Button (Identical to LoginPage) */}
                      <Button
                        fullWidth
                        size="large"
                        type="submit"
                        variant="contained"
                        disabled={isSubmitting}
                        sx={{
                          mt: 1,
                          py: 1.6,
                          borderRadius: '12px',
                          bgcolor: '#2563EB',
                          color: '#FFFFFF',
                          fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                          fontSize: '0.93rem',
                          fontWeight: 600,
                          textTransform: 'none',
                          boxShadow: '0 4px 14px 0 rgba(37, 99, 235, 0.28)',
                          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                          '&:hover': {
                            bgcolor: '#1D4ED8',
                            transform: 'translateY(-1.5px)',
                            boxShadow: '0 8px 22px 0 rgba(37, 99, 235, 0.38)',
                            '& .button-arrow-icon': {
                              transform: 'translateX(4px)',
                            },
                          },
                          '&:active': {
                            transform: 'translateY(0.5px) scale(0.99)',
                          },
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 1,
                          '& .button-arrow-icon': {
                            transition: 'transform 0.2s ease',
                          },
                        }}
                      >
                        {isSubmitting ? (
                          <CircularProgress size={22} color="inherit" />
                        ) : (
                          <>
                            {hasExistingWorkspaces ? 'Create Branch Workspace' : 'Create Workspace & Continue'}
                            <ArrowForwardIcon className="button-arrow-icon" sx={{ fontSize: 18 }} />
                          </>
                        )}
                      </Button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Security / Compliance Disclaimer (Identical to LoginPage) */}
          <footer className="py-2 text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <ShieldIcon sx={{ fontSize: 14, color: '#94A3B8' }} />
              256-bit encrypted. Geofence locations, timestamps, and biometric records are tamper-proof and audit-ready.
            </span>
          </footer>

        </section>

        {/* =================================================================== */}
        {/* COLUMN 2: REAL-TIME ATTENDANCE SHOWCASE WIDGET                      */}
        {/* =================================================================== */}
        <AttendanceShowcase />

      </main>
    </div>
  );
};

export default CreateWorkspacePage;
