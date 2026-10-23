import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Box,
  TextField,
  Button,
  Alert,
  InputAdornment,
} from '@mui/material';
import {
  ShieldOutlined as ShieldIcon,
  ArrowForward as ArrowForwardIcon,
  Apartment as ApartmentIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  AccessTime as AccessTimeIcon,
} from '@mui/icons-material';
import { WorkspaceShowcase } from './components/WorkspaceShowcase';
import { BrandLoader } from '../../components/BrandLoader';

// Zod validation schema
const registerSchema = z.object({
  companyName: z.string().trim().min(2, 'Company / Organization Name is required'),
  fullName: z.string().trim().min(2, 'Administrator Full Name is required'),
  email: z.string().trim().email('Please enter a valid work email address'),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

function format12h(timeStr: string): string {
  if (!timeStr || !timeStr.includes(':')) return timeStr;
  const [h, m] = timeStr.split(':');
  let hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12 || 12;
  return `${String(hour).padStart(2, '0')}:${m} ${ampm}`;
}

function calculateDuration(startStr: string, endStr: string): string {
  if (!startStr || !endStr) return '8';
  const [sh, sm] = startStr.split(':').map(Number);
  const [eh, em] = endStr.split(':').map(Number);
  let diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff < 0) diff += 24 * 60;
  const hours = (diff / 60).toFixed(diff % 60 === 0 ? 0 : 1);
  return hours;
}

export const RegisterPage: React.FC = () => {
  const { register: registerWorkspace } = useAuth();
  const navigate = useNavigate();

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Operating shift hours state
  const [startTime, setStartTime] = useState<string>('09:00');
  const [endTime, setEndTime] = useState<string>('17:00');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      companyName: '',
      fullName: '',
      email: '',
    },
  });

  // Live watched inputs for real-time showcase synchronization
  const watchedCompanyName = watch('companyName');
  const watchedFullName = watch('fullName');

  // Formatted duration badge
  const durationText = useMemo(() => {
    const hours = calculateDuration(startTime, endTime);
    return `${hours}h Standard Shift`;
  }, [startTime, endTime]);

  const onSubmit = async (data: RegisterFormValues) => {
    setError(null);
    setIsSubmitting(true);
    try {
      const defaultPolicy = `Standard Shift (${format12h(startTime)} - ${format12h(endTime)})`;
      const user = await registerWorkspace(
        data.companyName,
        data.fullName,
        data.email,
        defaultPolicy
      );
      if (user) {
        navigate('/admin/dashboard', { replace: true });
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to create workspace. Please verify your details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: '#F8FAFC',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Fullscreen centered BrandLoader overlay during submission */}
      {isSubmitting && (
        <BrandLoader fullScreen message="Deploying your organization workspace..." />
      )}

      {/* Main Split Screen Container */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] transition-all duration-300">

        {/* =================================================================== */}
        {/* COLUMN 1: CREATE WORKSPACE FORM (Left Side)                         */}
        {/* =================================================================== */}
        <section
          aria-labelledby="create-workspace-heading"
          className="flex flex-col justify-between px-6 py-6 sm:px-12 md:px-16 lg:px-20 bg-[#F8FAFC]"
        >
          {/* Top Clean Brand Header (Exact match to LoginPage.tsx) */}
          <header className="flex items-center py-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] border border-[#DBEAFE] flex items-center justify-center shadow-sm overflow-hidden">
                <img
                  src="/auth-icon.png"
                  alt="SmartBusiness"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold tracking-tight text-slate-900">
                    SmartBusiness
                  </span>
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

          {/* Center Create Workspace Card */}
          <div className="flex flex-1 items-center justify-center py-8">
            <div className="w-full max-w-[30.9rem]">
              <div
                className="rounded-2xl border border-slate-200 bg-white transition-all duration-300 overflow-hidden"
                style={{
                  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 20px 45px -20px rgba(37, 99, 235, 0.28)',
                }}
              >
                <div className="p-7 sm:p-9 flex flex-col gap-5">
                  {/* Card Header */}
                  <div className="flex flex-col gap-1.5">
                    <h1
                      id="create-workspace-heading"
                      className="text-2xl font-bold tracking-tight text-slate-900"
                    >
                      Create your Workspace
                    </h1>
                    <p className="text-sm text-slate-500 leading-relaxed">
                      Set up attendance registers, GPS boundaries, and standard shift hours.
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

                  {/* One-Step Form */}
                  <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">

                    {/* Organization / Company Name */}
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="companyName" className="text-xs font-semibold text-slate-700">
                        Company / Organization Name
                      </label>
                      <TextField
                        id="companyName"
                        fullWidth
                        placeholder="e.g. Apex Global Logistics"
                        variant="outlined"
                        error={!!errors.companyName}
                        helperText={errors.companyName?.message}
                        disabled={isSubmitting}
                        {...register('companyName')}
                        slotProps={{
                          input: {
                            startAdornment: (
                              <InputAdornment position="start">
                                <ApartmentIcon sx={{ fontSize: 18, color: '#94A3B8' }} />
                              </InputAdornment>
                            ),
                          },
                        }}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: '10px',
                            bgcolor: '#FFFFFF',
                            fontSize: '0.88rem',
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

                    {/* Administrator Name & Work Email (Side-by-Side) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="fullName" className="text-xs font-semibold text-slate-700">
                          Administrator Name
                        </label>
                        <TextField
                          id="fullName"
                          fullWidth
                          placeholder="Alex Morgan"
                          variant="outlined"
                          error={!!errors.fullName}
                          helperText={errors.fullName?.message}
                          disabled={isSubmitting}
                          {...register('fullName')}
                          slotProps={{
                            input: {
                              startAdornment: (
                                <InputAdornment position="start">
                                  <PersonIcon sx={{ fontSize: 17, color: '#94A3B8' }} />
                                </InputAdornment>
                              ),
                            },
                          }}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              borderRadius: '10px',
                              bgcolor: '#FFFFFF',
                              fontSize: '0.85rem',
                              fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              '& fieldset': {
                                borderColor: '#E2E8F0',
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

                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="email" className="text-xs font-semibold text-slate-700">
                          Work Email
                        </label>
                        <TextField
                          id="email"
                          type="email"
                          fullWidth
                          placeholder="name@company.com"
                          variant="outlined"
                          error={!!errors.email}
                          helperText={errors.email?.message}
                          disabled={isSubmitting}
                          {...register('email')}
                          slotProps={{
                            input: {
                              startAdornment: (
                                <InputAdornment position="start">
                                  <EmailIcon sx={{ fontSize: 17, color: '#94A3B8' }} />
                                </InputAdornment>
                              ),
                            },
                          }}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              borderRadius: '10px',
                              bgcolor: '#FFFFFF',
                              fontSize: '0.85rem',
                              fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              '& fieldset': {
                                borderColor: '#E2E8F0',
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
                    </div>

                    {/* Standard Shift Hours: Time Pickers ONLY */}
                    <div className="flex flex-col gap-2 pt-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-700">
                          Standard Shift Hours
                        </label>
                        <span className="text-[10px] font-mono font-bold text-[#2563EB] bg-[#EFF6FF] px-2 py-0.5 rounded border border-[#BFDBFE]">
                          {durationText}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {/* Start Time Picker Card */}
                        <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/70">
                          <div className="flex items-center justify-between mb-1.5">
                            <label
                              htmlFor="shiftStartTime"
                              className="text-[11px] font-semibold text-slate-600 flex items-center gap-1.5"
                            >
                              <AccessTimeIcon sx={{ fontSize: 15, color: '#2563EB' }} />
                              Start Time
                            </label>
                            <span className="font-mono text-[10px] font-bold text-[#2563EB] bg-blue-50 px-1.5 py-0.5 rounded">
                              {format12h(startTime)}
                            </span>
                          </div>
                          <input
                            type="time"
                            id="shiftStartTime"
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                            disabled={isSubmitting}
                            className="w-full bg-white border border-slate-200 rounded-lg py-1.5 px-2.5 text-xs font-mono font-bold text-slate-900 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/15 cursor-pointer"
                          />
                        </div>

                        {/* End Time Picker Card */}
                        <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/70">
                          <div className="flex items-center justify-between mb-1.5">
                            <label
                              htmlFor="shiftEndTime"
                              className="text-[11px] font-semibold text-slate-600 flex items-center gap-1.5"
                            >
                              <AccessTimeIcon sx={{ fontSize: 15, color: '#2563EB' }} />
                              End Time
                            </label>
                            <span className="font-mono text-[10px] font-bold text-[#2563EB] bg-blue-50 px-1.5 py-0.5 rounded">
                              {format12h(endTime)}
                            </span>
                          </div>
                          <input
                            type="time"
                            id="shiftEndTime"
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                            disabled={isSubmitting}
                            className="w-full bg-white border border-slate-200 rounded-lg py-1.5 px-2.5 text-xs font-mono font-bold text-slate-900 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/15 cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Submit Button */}
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
                        fontWeight: 700,
                        textTransform: 'none',
                        boxShadow: '0 4px 14px rgba(37, 99, 235, 0.28)',
                        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 1,
                        '&:hover': {
                          bgcolor: '#1D4ED8',
                          boxShadow: '0 8px 22px rgba(37, 99, 235, 0.38)',
                          transform: 'translateY(-1.5px)',
                        },
                        '&:active': {
                          transform: 'translateY(0.5px) scale(0.99)',
                        },
                        '& .button-arrow-icon': {
                          transition: 'transform 0.2s ease',
                        },
                        '&:hover .button-arrow-icon': {
                          transform: 'translateX(3px)',
                        },
                      }}
                    >
                      Create Workspace
                      <ArrowForwardIcon className="button-arrow-icon" sx={{ fontSize: 18 }} />
                    </Button>

                  </form>
                </div>

                {/* Card Footer (Exact match to LoginPage) */}
                <div className="rounded-b-2xl border-t border-slate-100 bg-slate-50/70 px-7 py-4 text-center text-xs text-slate-500 sm:px-9">
                  Already have an account?{' '}
                  <span
                    onClick={() => navigate('/login')}
                    className="font-semibold text-[#2563EB] hover:text-[#1D4ED8] cursor-pointer hover:underline transition"
                  >
                    Sign In
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Compliance Disclaimer (Exact match to LoginPage) */}
          <footer className="py-2 text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <ShieldIcon sx={{ fontSize: 14, color: '#94A3B8' }} />
              256-bit encrypted. Geofence locations, timestamps, and biometric records are tamper-proof and audit-ready.
            </span>
          </footer>
        </section>

        {/* =================================================================== */}
        {/* COLUMN 2: REAL-TIME WORKSPACE SHOWCASE (Right Side)                 */}
        {/* =================================================================== */}
        <WorkspaceShowcase
          companyName={watchedCompanyName}
          adminName={watchedFullName}
          startTime={startTime}
          endTime={endTime}
        />

      </main>
    </Box>
  );
};

export default RegisterPage;