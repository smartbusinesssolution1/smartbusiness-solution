import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAuthStore } from '../../store/authStore';
import { platformAuthApi } from '../../services/apiClient';
import { authService } from '../../services/authService';
import { notify } from '../../context/NotificationContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Checkbox,
  IconButton,
  InputAdornment,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  ShieldOutlined as ShieldIcon,
  ArrowForward as ArrowForwardIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';
import { AttendanceShowcase } from './components/AttendanceShowcase';

// Zod validation schema
const loginSchema = z.object({
  email: z.string().trim().email('Please enter a valid business email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [error, setError] = useState<string | null>(null);
  const [, setIsMemberBlocked] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [infoNotice, setInfoNotice] = useState<string | null>(null);

  // Self-service Forgot Password state
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setError(null);
    setIsMemberBlocked(false);
    setIsSubmitting(true);
    try {
      const user = await login(data.email, data.password, rememberDevice);
      if (user) {
        const storeWorkspaces = useAuthStore.getState().workspaces;
        if (!storeWorkspaces || storeWorkspaces.length === 0) {
          navigate('/admin/workspaces?create=true', { replace: true });
        } else {
          navigate('/admin/dashboard', { replace: true });
        }
      }
    } catch (err: any) {
      const msg = err?.message || 'Login failed. Please verify your credentials.';
      if (msg.includes('Mobile App') || msg.includes('Administrators and Managers')) {
        setIsMemberBlocked(true);
      }
      setError(msg);
      notify(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPasswordSubmit = async () => {
    if (!forgotPasswordEmail || !forgotPasswordEmail.includes('@')) {
      return;
    }
    setForgotPasswordLoading(true);
    try {
      await authService.forgotPassword(forgotPasswordEmail.trim());
      setForgotPasswordSuccess(true);
    } catch (err: any) {
      setInfoNotice(err?.message || 'Failed to dispatch reset email.');
      setForgotPasswordSuccess(true);
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] font-sans antialiased flex flex-col selection:bg-[#2563EB] selection:text-white">
      {/* Main Responsive Grid Layout (Unified #F8FAFC background across both columns) */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] transition-all duration-300">
        
        {/* =================================================================== */}
        {/* COLUMN 1: SIGN IN FORM COLUMN                                       */}
        {/* =================================================================== */}
        <section aria-labelledby="signin-heading" className="flex flex-col justify-between px-6 py-6 sm:px-12 md:px-16 lg:px-20 bg-[#F8FAFC]">
          
          {/* Top Clean Brand Header (Logo + SaaS Badge only, no header workspace link) */}
          <header className="flex items-center py-2">
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
                  Enterprise Attendance
                </span>
              </div>
            </div>
          </header>

          {/* Center Auth Card */}
          <div className="flex flex-1 items-center justify-center py-8">
            <div className="w-full max-w-[26.5rem]">
              <div
                className="rounded-2xl border border-slate-200 bg-white transition-all duration-300"
                style={{
                  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 20px 45px -20px rgba(37, 99, 235, 0.28)',
                }}
              >
                <div className="p-7 sm:p-9 flex flex-col gap-6">
                  
                  {/* Card Header (Clean: Title & User-Friendly Subtitle, NO Bank-Grade tag) */}
                  <div className="flex flex-col gap-1.5">
                    <h1 id="signin-heading" className="text-2xl font-bold tracking-tight text-slate-900">
                      Welcome back
                    </h1>
                    <p className="text-sm text-slate-500 leading-relaxed">
                      Sign in to manage shifts, review live clock-ins, and approve timesheets.
                    </p>
                  </div>

                  {/* Error Alert Display */}
                  {error && (
                    <Alert
                      severity="error"
                      sx={{
                        borderRadius: '12px',
                        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                        fontSize: '0.85rem',
                      }}
                    >
                      {error}
                    </Alert>
                  )}

                  {/* Form */}
                  <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
                    
                    {/* Work Email Field */}
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="email" className="text-xs font-semibold text-slate-700">
                        Work email
                      </label>
                      <TextField
                        id="email"
                        fullWidth
                        placeholder="name@company.com"
                        variant="outlined"
                        error={!!errors.email}
                        helperText={errors.email?.message}
                        disabled={isSubmitting}
                        {...register('email')}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: '10px',
                            bgcolor: '#FFFFFF',
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
                          },
                        }}
                      />
                    </div>

                    {/* Password Field Header Row */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <label htmlFor="password" className="text-xs font-semibold text-slate-700">
                          Password
                        </label>
                        <span
                          onClick={() => navigate('/forgot-password')}
                          className="text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8] cursor-pointer transition hover:underline"
                        >
                          Forgot password?
                        </span>
                      </div>
                      <TextField
                        id="password"
                        fullWidth
                        placeholder="••••••••••••"
                        type={showPassword ? 'text' : 'password'}
                        variant="outlined"
                        error={!!errors.password}
                        helperText={errors.password?.message}
                        disabled={isSubmitting}
                        {...register('password')}
                        slotProps={{
                          input: {
                            endAdornment: (
                              <InputAdornment position="end">
                                <IconButton
                                  aria-label="toggle password visibility"
                                  onClick={() => setShowPassword(!showPassword)}
                                  edge="end"
                                  disabled={isSubmitting}
                                  size="small"
                                  sx={{
                                    color: '#94A3B8',
                                    transition: 'color 0.2s ease',
                                    '&:hover': { color: '#475569' },
                                  }}
                                >
                                  {showPassword ? (
                                    <VisibilityOffIcon fontSize="small" />
                                  ) : (
                                    <VisibilityIcon fontSize="small" />
                                  )}
                                </IconButton>
                              </InputAdornment>
                            ),
                          },
                        }}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: '10px',
                            bgcolor: '#FFFFFF',
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
                          },
                        }}
                      />
                    </div>

                    {/* Remember Device Checkbox (Exact theme blue) */}
                    <div className="flex items-center gap-2 pt-1">
                      <Checkbox
                        checked={rememberDevice}
                        onChange={(e) => setRememberDevice(e.target.checked)}
                        size="small"
                        sx={{
                          p: 0.5,
                          color: '#CBD5E1',
                          '&.Mui-checked': {
                            color: '#2563EB',
                          },
                        }}
                      />
                      <span
                        onClick={() => setRememberDevice(!rememberDevice)}
                        className="text-xs text-slate-600 cursor-pointer select-none hover:text-slate-900 transition"
                      >
                        Remember this device for 30 days
                      </span>
                    </div>

                    {/* Submit Button (Strictly using current #2563EB theme) */}
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
                          Sign In
                          <ArrowForwardIcon className="button-arrow-icon" sx={{ fontSize: 18 }} />
                        </>
                      )}
                    </Button>
                  </form>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Compliance Disclaimer */}
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

      {/* Info Snackbar for notifications */}
      <Snackbar
        open={!!infoNotice}
        autoHideDuration={4000}
        onClose={() => setInfoNotice(null)}
        message={infoNotice}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />

      {/* Self-Service Forgot Password Dialog (With MUI slotProps fix) */}
      <Dialog
        open={forgotPasswordOpen}
        onClose={() => setForgotPasswordOpen(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              borderRadius: '16px',
              p: 1,
              fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            },
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, fontSize: '1.2rem', pb: 1 }}>
          Reset Account Password
        </DialogTitle>
        <DialogContent>
          {forgotPasswordSuccess ? (
            <Box sx={{ py: 2, textAlign: 'center' }}>
              <Typography sx={{ fontSize: '2rem', mb: 1 }}>📨</Typography>
              <Typography sx={{ fontWeight: 700, color: '#166534', mb: 1 }}>
                Password Reset Email Sent
              </Typography>
              <Typography sx={{ fontSize: '0.85rem', color: '#64748B' }}>
                If an account exists for <strong>{forgotPasswordEmail}</strong>, we have dispatched instructions with a 15-minute secure reset link.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ pt: 1 }}>
              <Typography sx={{ fontSize: '0.85rem', color: '#64748B', mb: 2 }}>
                Enter your registered corporate email address and we'll send a secure password reset link.
              </Typography>
              <TextField
                fullWidth
                label="Work Email"
                type="email"
                value={forgotPasswordEmail}
                onChange={(e) => setForgotPasswordEmail(e.target.value)}
                placeholder="name@company.com"
                disabled={forgotPasswordLoading}
                size="small"
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setForgotPasswordOpen(false)}
            color="inherit"
            disabled={forgotPasswordLoading}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            {forgotPasswordSuccess ? 'Close' : 'Cancel'}
          </Button>
          {!forgotPasswordSuccess && (
            <Button
              onClick={handleForgotPasswordSubmit}
              variant="contained"
              disabled={forgotPasswordLoading || !forgotPasswordEmail}
              sx={{
                bgcolor: '#2563EB',
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: '8px',
                '&:hover': { bgcolor: '#1D4ED8' },
              }}
            >
              {forgotPasswordLoading ? <CircularProgress size={20} color="inherit" /> : 'Send Reset Link'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default LoginPage;
