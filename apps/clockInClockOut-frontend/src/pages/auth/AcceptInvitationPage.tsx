import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TextField, Button, Alert, CircularProgress, IconButton, InputAdornment } from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import MarkEmailReadRoundedIcon from '@mui/icons-material/MarkEmailReadRounded';
import ShieldIcon from '@mui/icons-material/Shield';
import { authService, type InvitationView } from '../../services/authService';
import { clearLinkToken, useLinkToken } from '../../hooks/useLinkToken';
import { AttendanceShowcase } from './components/AttendanceShowcase';

// The page an employee's invitation email links to (/accept-invitation#token=...).
// The admin never chooses or sees a password: the employee confirms their name and chooses
// their own here, once. Then they sign in on the Clock-In app (or the web) as usual.
// Someone who already has an account doesn't need this: they just sign in.

const primaryButtonSx = {
  bgcolor: '#2563EB',
  color: '#FFFFFF',
  py: 1.25,
  borderRadius: '10px',
  fontWeight: 700,
  fontSize: '0.9rem',
  textTransform: 'none',
  boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.25)',
  '&:hover': { bgcolor: '#1D4ED8' },
} as const;

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '10px',
    bgcolor: '#FFFFFF',
    fontSize: '0.9rem',
    '& fieldset': { borderColor: '#E2E8F0' },
    '&:hover fieldset': { borderColor: '#CBD5E1' },
    '&.Mui-focused fieldset': { borderColor: '#2563EB' },
  },
} as const;

function Rule({ met, children }: { met: boolean; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${met ? 'text-emerald-600 font-medium' : 'text-slate-400'}`}>
      {met ? <CheckCircleRoundedIcon sx={{ fontSize: 13 }} /> : <RadioButtonUncheckedRoundedIcon sx={{ fontSize: 13 }} />}
      {children}
    </span>
  );
}

function StateCard({ tone, icon, title, children }: { tone: 'error' | 'success' | 'info'; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  const tones = {
    error: 'bg-[#FEF2F2] border-[#FECACA] text-[#DC2626]',
    success: 'bg-[#F0FDF4] border-[#BBF7D0] text-[#16A34A]',
    info: 'bg-[#EFF6FF] border-[#BFDBFE] text-[#2563EB]',
  };
  return (
    <div className="flex flex-col items-center text-center gap-4 py-2">
      <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center ${tones[tone]}`}>{icon}</div>
      <h1 className="text-xl font-bold tracking-tight text-slate-900">{title}</h1>
      {children}
    </div>
  );
}

export const AcceptInvitationPage: React.FC = () => {
  // From "#token=" (or "?token=" in older emails), then taken out of the address bar.
  const token = useLinkToken('invitation');

  const [invitation, setInvitation] = useState<InvitationView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(token));

  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    authService
      .inspectInvitation(token)
      .then((view) => {
        if (cancelled) return;
        setInvitation(view);
        setFullName(view.fullName);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        // An expired or replaced invitation won't work later either: don't keep it.
        clearLinkToken('invitation');
        setLoadError(err.message);
      })
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [token]);

  // The same rules platform-api enforces (acceptInvitationSchema uses the sign-up password rules).
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const isMatch = Boolean(password && confirmPassword && password === confirmPassword);
  const isValid = Boolean(fullName.trim()) && hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecial && isMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) {
      setError('Please enter your name and a password that meets every rule.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await authService.acceptInvitation(token, fullName.trim(), password);
      clearLinkToken('invitation');
      setIsDone(true);
    } catch (err: any) {
      setError(err?.message || 'Could not finish setting up your account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  let content: React.ReactNode;
  if (!token) {
    content = (
      <StateCard tone="error" icon={<ErrorOutlineRoundedIcon sx={{ fontSize: 32 }} />} title="This invitation link is incomplete">
        <p className="text-sm text-slate-500 leading-relaxed">
          Open the link from your invitation email again, or ask your administrator to send a new invitation.
        </p>
      </StateCard>
    );
  } else if (isLoading) {
    content = (
      <div className="flex justify-center py-10" aria-busy="true">
        <CircularProgress size={28} />
      </div>
    );
  } else if (loadError || !invitation) {
    content = (
      <StateCard tone="error" icon={<ErrorOutlineRoundedIcon sx={{ fontSize: 32 }} />} title="This invitation can't be used">
        <p className="text-sm text-slate-500 leading-relaxed">{loadError ?? 'This invitation link is invalid.'}</p>
        <p className="text-xs text-slate-400">Ask your administrator to send you a new invitation.</p>
      </StateCard>
    );
  } else if (isDone || invitation.accountReady) {
    content = (
      <StateCard
        tone={isDone ? 'success' : 'info'}
        icon={isDone ? <CheckCircleRoundedIcon sx={{ fontSize: 32 }} /> : <MarkEmailReadRoundedIcon sx={{ fontSize: 32 }} />}
        title={isDone ? "You're all set" : `You already have access to ${invitation.workspaceName}`}
      >
        <p className="text-sm text-slate-500 leading-relaxed">
          {isDone ? 'Your password is saved. ' : 'Your account is already set up. '}
          Open the <strong>Clock-In app</strong> on your phone and sign in with <strong>{invitation.email}</strong> and your password.
        </p>
        <div className="w-full pt-2">
          <Button component={Link} to="/login" variant="contained" fullWidth sx={primaryButtonSx}>
            Or sign in on the web
          </Button>
        </div>
      </StateCard>
    );
  } else {
    content = (
      <>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Join {invitation.workspaceName}</h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            {invitation.inviterName ?? 'Your administrator'} added you to {invitation.companyName}. Choose your password to finish setting up
            your account. Nobody else will know it.
          </p>
        </div>

        {error && (
          <Alert severity="error" sx={{ borderRadius: '12px', fontSize: '0.85rem' }}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="invite-email" className="text-xs font-semibold text-slate-700">Work email</label>
            <TextField id="invite-email" fullWidth value={invitation.email} disabled sx={fieldSx} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="invite-name" className="text-xs font-semibold text-slate-700">Your name</label>
            <TextField
              id="invite-name"
              fullWidth
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={isSubmitting}
              sx={fieldSx}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="invite-password" className="text-xs font-semibold text-slate-700">Password</label>
            <TextField
              id="invite-password"
              fullWidth
              autoFocus
              autoComplete="new-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowPassword(!showPassword)} edge="end" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                        {showPassword ? <VisibilityOff sx={{ fontSize: 18 }} /> : <Visibility sx={{ fontSize: 18 }} />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
              sx={fieldSx}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="invite-confirm" className="text-xs font-semibold text-slate-700">Repeat password</label>
            <TextField
              id="invite-confirm"
              fullWidth
              autoComplete="new-password"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isSubmitting}
              sx={fieldSx}
            />
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
            <Rule met={hasMinLength}>8+ characters</Rule>
            <Rule met={hasUppercase}>1 uppercase letter</Rule>
            <Rule met={hasLowercase}>1 lowercase letter</Rule>
            <Rule met={hasNumber}>1 number</Rule>
            <Rule met={hasSpecial}>1 special character</Rule>
            <Rule met={isMatch}>Passwords match</Rule>
          </div>

          <Button type="submit" variant="contained" fullWidth disabled={isSubmitting || !isValid} sx={primaryButtonSx}>
            {isSubmitting ? <CircularProgress size={20} color="inherit" /> : 'Save password'}
          </Button>
        </form>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] font-sans antialiased flex flex-col selection:bg-[#2563EB] selection:text-white">
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] transition-all duration-300">
        <section className="flex flex-col justify-between px-6 py-6 sm:px-12 md:px-16 lg:px-20 bg-[#F8FAFC]">
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
                <span className="font-mono text-[10px] font-semibold tracking-wider text-slate-500 uppercase">Enterprise Attendance</span>
              </div>
            </Link>
          </header>

          <div className="flex flex-1 items-center justify-center py-8">
            <div className="w-full max-w-[27rem]">
              <div
                className="rounded-2xl border border-slate-200 bg-white transition-all duration-300"
                style={{ boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 20px 45px -20px rgba(37, 99, 235, 0.28)' }}
              >
                <div className="p-7 sm:p-9 flex flex-col gap-6">{content}</div>
              </div>
            </div>
          </div>

          <footer className="py-2 text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <ShieldIcon sx={{ fontSize: 14, color: '#94A3B8' }} />
              Your password is chosen by you and never sent by email.
            </span>
          </footer>
        </section>

        <AttendanceShowcase />
      </main>
    </div>
  );
};

export default AcceptInvitationPage;
