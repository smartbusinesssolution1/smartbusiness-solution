import React, { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  TextField,
  Button,
  Alert,
  CircularProgress,
  IconButton,
  InputAdornment,
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded';
import LockResetRoundedIcon from '@mui/icons-material/LockResetRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import ShieldIcon from '@mui/icons-material/Shield';
import { authService } from '../../services/authService';
import { AttendanceShowcase } from './components/AttendanceShowcase';

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Password Validation Rules (matches platform-api resetPasswordSchema)
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const isMatch = Boolean(password && confirmPassword && password === confirmPassword);

  const isValid = hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecial && isMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError('Invalid or missing password reset token.');
      return;
    }

    if (!isValid) {
      setError('Please satisfy all password complexity criteria.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await authService.resetPassword(token, password);
      setIsSuccess(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to reset password. The link may have expired or is invalid.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] font-sans antialiased flex flex-col selection:bg-[#2563EB] selection:text-white">
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] transition-all duration-300">
        
        {/* Left Form Column */}
        <section className="flex flex-col justify-between px-6 py-6 sm:px-12 md:px-16 lg:px-20 bg-[#F8FAFC]">
          {/* Header Brand */}
          <header className="flex items-center py-2">
            <Link to="/login" className="flex items-center gap-3 no-underline">
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
            </Link>
          </header>

          {/* Center Card */}
          <div className="flex flex-1 items-center justify-center py-8">
            <div className="w-full max-w-[27rem]">
              <div
                className="rounded-2xl border border-slate-200 bg-white transition-all duration-300"
                style={{
                  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 20px 45px -20px rgba(37, 99, 235, 0.28)',
                }}
              >
                <div className="p-7 sm:p-9 flex flex-col gap-6">
                  
                  {!token ? (
                    /* Missing Token Error State */
                    <div className="flex flex-col items-center text-center gap-4 py-2">
                      <div className="w-14 h-14 rounded-2xl bg-[#FEF2F2] border border-[#FECACA] flex items-center justify-center text-[#DC2626]">
                        <ErrorOutlineRoundedIcon sx={{ fontSize: 32 }} />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <h1 className="text-xl font-bold tracking-tight text-slate-900">
                          Invalid or Missing Token
                        </h1>
                        <p className="text-sm text-slate-500 leading-relaxed">
                          This password reset link is incomplete or damaged. Please request a new link from the forgot password screen.
                        </p>
                      </div>

                      <div className="w-full pt-4">
                        <Button
                          component={Link}
                          to="/forgot-password"
                          variant="contained"
                          fullWidth
                          sx={{
                            bgcolor: '#2563EB',
                            borderRadius: '10px',
                            py: 1.25,
                            fontWeight: 700,
                            textTransform: 'none',
                            fontSize: '0.9rem',
                            '&:hover': { bgcolor: '#1D4ED8' },
                          }}
                        >
                          Request New Link
                        </Button>
                      </div>
                    </div>
                  ) : isSuccess ? (
                    /* Success State */
                    <div className="flex flex-col items-center text-center gap-4 py-2">
                      <div className="w-14 h-14 rounded-2xl bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-center text-[#16A34A]">
                        <CheckCircleRoundedIcon sx={{ fontSize: 32 }} />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <h1 className="text-xl font-bold tracking-tight text-slate-900">
                          Password Reset Complete
                        </h1>
                        <p className="text-sm text-slate-500 leading-relaxed">
                          Your account password has been successfully updated. All previous active sessions have been securely terminated.
                        </p>
                      </div>

                      <div className="w-full pt-4">
                        <Button
                          onClick={() => navigate('/login', { replace: true })}
                          variant="contained"
                          fullWidth
                          sx={{
                            bgcolor: '#2563EB',
                            borderRadius: '10px',
                            py: 1.25,
                            fontWeight: 700,
                            textTransform: 'none',
                            fontSize: '0.9rem',
                            '&:hover': { bgcolor: '#1D4ED8' },
                          }}
                        >
                          Sign In with New Password
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* Reset Password Form */
                    <>
                      <div className="flex flex-col gap-1.5">
                        <div className="w-11 h-11 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center text-[#2563EB] mb-1">
                          <LockResetRoundedIcon sx={{ fontSize: 24 }} />
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                          Set new password
                        </h1>
                        <p className="text-sm text-slate-500 leading-relaxed">
                          Create a strong new password to regain access to your account.
                        </p>
                      </div>

                      {error && (
                        <Alert severity="error" sx={{ borderRadius: '12px', fontSize: '0.85rem' }}>
                          {error}
                        </Alert>
                      )}

                      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        {/* New Password */}
                        <div className="flex flex-col gap-1.5">
                          <label htmlFor="new-password" className="text-xs font-semibold text-slate-700">
                            New password
                          </label>
                          <TextField
                            id="new-password"
                            fullWidth
                            autoFocus
                            placeholder="••••••••••••"
                            type={showPassword ? 'text' : 'password'}
                            variant="outlined"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={isSubmitting}
                            slotProps={{
                              input: {
                                endAdornment: (
                                  <InputAdornment position="end">
                                    <IconButton
                                      size="small"
                                      onClick={() => setShowPassword(!showPassword)}
                                      edge="end"
                                    >
                                      {showPassword ? <VisibilityOff sx={{ fontSize: 18 }} /> : <Visibility sx={{ fontSize: 18 }} />}
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
                                '& fieldset': { borderColor: '#E2E8F0' },
                                '&:hover fieldset': { borderColor: '#CBD5E1' },
                                '&.Mui-focused fieldset': { borderColor: '#2563EB' },
                              },
                            }}
                          />
                        </div>

                        {/* Confirm Password */}
                        <div className="flex flex-col gap-1.5">
                          <label htmlFor="confirm-password" className="text-xs font-semibold text-slate-700">
                            Confirm new password
                          </label>
                          <TextField
                            id="confirm-password"
                            fullWidth
                            placeholder="••••••••••••"
                            type={showConfirmPassword ? 'text' : 'password'}
                            variant="outlined"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            disabled={isSubmitting}
                            slotProps={{
                              input: {
                                endAdornment: (
                                  <InputAdornment position="end">
                                    <IconButton
                                      size="small"
                                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                      edge="end"
                                    >
                                      {showConfirmPassword ? <VisibilityOff sx={{ fontSize: 18 }} /> : <Visibility sx={{ fontSize: 18 }} />}
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
                                '& fieldset': { borderColor: '#E2E8F0' },
                                '&:hover fieldset': { borderColor: '#CBD5E1' },
                                '&.Mui-focused fieldset': { borderColor: '#2563EB' },
                              },
                            }}
                          />
                        </div>

                        {/* Password Requirements Checklist */}
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex flex-col gap-1.5 text-xs">
                          <span className="font-semibold text-slate-600 mb-0.5">Password requirements:</span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            <span className={`inline-flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-600 font-medium' : 'text-slate-400'}`}>
                              {hasMinLength ? <CheckCircleRoundedIcon sx={{ fontSize: 13 }} /> : <RadioButtonUncheckedRoundedIcon sx={{ fontSize: 13 }} />}
                              At least 8 characters
                            </span>
                            <span className={`inline-flex items-center gap-1.5 ${hasUppercase ? 'text-emerald-600 font-medium' : 'text-slate-400'}`}>
                              {hasUppercase ? <CheckCircleRoundedIcon sx={{ fontSize: 13 }} /> : <RadioButtonUncheckedRoundedIcon sx={{ fontSize: 13 }} />}
                              1 uppercase letter
                            </span>
                            <span className={`inline-flex items-center gap-1.5 ${hasLowercase ? 'text-emerald-600 font-medium' : 'text-slate-400'}`}>
                              {hasLowercase ? <CheckCircleRoundedIcon sx={{ fontSize: 13 }} /> : <RadioButtonUncheckedRoundedIcon sx={{ fontSize: 13 }} />}
                              1 lowercase letter
                            </span>
                            <span className={`inline-flex items-center gap-1.5 ${hasNumber ? 'text-emerald-600 font-medium' : 'text-slate-400'}`}>
                              {hasNumber ? <CheckCircleRoundedIcon sx={{ fontSize: 13 }} /> : <RadioButtonUncheckedRoundedIcon sx={{ fontSize: 13 }} />}
                              1 number
                            </span>
                            <span className={`inline-flex items-center gap-1.5 ${hasSpecial ? 'text-emerald-600 font-medium' : 'text-slate-400'}`}>
                              {hasSpecial ? <CheckCircleRoundedIcon sx={{ fontSize: 13 }} /> : <RadioButtonUncheckedRoundedIcon sx={{ fontSize: 13 }} />}
                              1 special character
                            </span>
                            <span className={`inline-flex items-center gap-1.5 ${isMatch ? 'text-emerald-600 font-medium' : 'text-slate-400'}`}>
                              {isMatch ? <CheckCircleRoundedIcon sx={{ fontSize: 13 }} /> : <RadioButtonUncheckedRoundedIcon sx={{ fontSize: 13 }} />}
                              Passwords match
                            </span>
                          </div>
                        </div>

                        {/* Submit Button */}
                        <Button
                          type="submit"
                          variant="contained"
                          fullWidth
                          disabled={isSubmitting || !isValid}
                          sx={{
                            bgcolor: '#2563EB',
                            color: '#FFFFFF',
                            py: 1.25,
                            borderRadius: '10px',
                            fontWeight: 700,
                            fontSize: '0.9rem',
                            textTransform: 'none',
                            boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.25)',
                            '&:hover': { bgcolor: '#1D4ED8' },
                          }}
                        >
                          {isSubmitting ? <CircularProgress size={20} color="inherit" /> : 'Update Password'}
                        </Button>

                        <div className="flex justify-center pt-1">
                          <Link
                            to="/login"
                            className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
                          >
                            Cancel and return to Sign In
                          </Link>
                        </div>
                      </form>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer Disclaimer */}
          <footer className="py-2 text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <ShieldIcon sx={{ fontSize: 14, color: '#94A3B8' }} />
              256-bit encrypted. Updating your password immediately terminates active sessions across all devices.
            </span>
          </footer>
        </section>

        {/* Right Column Showcase */}
        <AttendanceShowcase />
      </main>
    </div>
  );
};

export default ResetPasswordPage;
