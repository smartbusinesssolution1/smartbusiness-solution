import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  TextField,
  Button,
  Alert,
  CircularProgress,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import MarkEmailReadOutlinedIcon from '@mui/icons-material/MarkEmailReadOutlined';
import ShieldIcon from '@mui/icons-material/Shield';
import { authService } from '../../services/authService';
import { AttendanceShowcase } from './components/AttendanceShowcase';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setError('Please provide a valid work email address.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await authService.forgotPassword(email.trim());
      setIsSubmitted(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to request password reset link. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] font-sans antialiased flex flex-col selection:bg-[#2563EB] selection:text-white">
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] transition-all duration-300">
        
        {/* Left Form Column */}
        <section className="flex flex-col justify-between px-6 py-6 sm:px-12 md:px-16 lg:px-20 bg-[#F8FAFC]">
          {/* Brand Header */}
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
            <div className="w-full max-w-[26.5rem]">
              <div
                className="rounded-2xl border border-slate-200 bg-white transition-all duration-300"
                style={{
                  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 20px 45px -20px rgba(37, 99, 235, 0.28)',
                }}
              >
                <div className="p-7 sm:p-9 flex flex-col gap-6">
                  
                  {isSubmitted ? (
                    /* Success State */
                    <div className="flex flex-col items-center text-center gap-4 py-2">
                      <div className="w-14 h-14 rounded-2xl bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center text-[#2563EB]">
                        <MarkEmailReadOutlinedIcon sx={{ fontSize: 32 }} />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <h1 className="text-xl font-bold tracking-tight text-slate-900">
                          Check your inbox
                        </h1>
                        <p className="text-sm text-slate-500 leading-relaxed">
                          If an active account exists for <strong>{email}</strong>, we have dispatched instructions with a 15-minute secure password reset link.
                        </p>
                      </div>

                      <div className="w-full pt-4 flex flex-col gap-3">
                        <Button
                          component={Link}
                          to="/login"
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
                          Return to Sign In
                        </Button>
                        <Button
                          onClick={() => {
                            setIsSubmitted(false);
                            setEmail('');
                          }}
                          color="inherit"
                          sx={{ textTransform: 'none', fontSize: '0.85rem', color: '#64748B' }}
                        >
                          Try another email
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* Initial Form State */
                    <>
                      <div className="flex flex-col gap-1.5">
                        <div className="w-11 h-11 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center text-[#2563EB] mb-1">
                          <EmailOutlinedIcon sx={{ fontSize: 24 }} />
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                          Reset password
                        </h1>
                        <p className="text-sm text-slate-500 leading-relaxed">
                          Enter your registered work email and we&apos;ll send you a secure link to reset your account password.
                        </p>
                      </div>

                      {error && (
                        <Alert severity="error" sx={{ borderRadius: '12px', fontSize: '0.85rem' }}>
                          {error}
                        </Alert>
                      )}

                      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5">
                          <label htmlFor="email" className="text-xs font-semibold text-slate-700">
                            Work email
                          </label>
                          <TextField
                            id="email"
                            fullWidth
                            autoFocus
                            placeholder="name@company.com"
                            variant="outlined"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={isSubmitting}
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

                        <Button
                          type="submit"
                          variant="contained"
                          fullWidth
                          disabled={isSubmitting || !email.trim()}
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
                          {isSubmitting ? <CircularProgress size={20} color="inherit" /> : 'Send Reset Link'}
                        </Button>

                        <div className="flex justify-center pt-2">
                          <Link
                            to="/login"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
                          >
                            <ArrowBackRoundedIcon sx={{ fontSize: 16 }} />
                            Back to Sign In
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
              256-bit encrypted. Password reset links expire automatically in 15 minutes.
            </span>
          </footer>
        </section>

        {/* Right Column Showcase */}
        <AttendanceShowcase />
      </main>
    </div>
  );
};

export default ForgotPasswordPage;
