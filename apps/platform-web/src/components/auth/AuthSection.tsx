import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Mail, User, Building, ArrowRight, Check, Circle } from 'lucide-react';
import { useToast } from '../ui/Toast';
import { SmartBusinessLogo } from '../common/SmartBusinessLogo';
import { ApiError } from '../../lib/api';
import { login, register, requestPasswordReset, type PortalSession } from '../../lib/auth';
import { PASSWORD_RULES, passwordMeetsRules } from '../../lib/password-rules';

export type AuthMode = 'signin' | 'signup' | 'forgot';

interface AuthSectionProps {
  initialMode?: AuthMode;
  onSuccess: (session: PortalSession) => void;
  onNavigateHome: () => void;
}

type FieldErrors = Partial<Record<'fullName' | 'companyName' | 'email' | 'password', string>>;

const inputClass =
  'w-full pl-9 pr-3.5 py-2.5 bg-slate-50/70 border rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all';

export const AuthSection: React.FC<AuthSectionProps> = ({ initialMode = 'signin', onSuccess, onNavigateHome }) => {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [resetSent, setResetSent] = useState(false);
  const { showToast } = useToast();

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setFormError(null);
    setFieldErrors({});
    setResetSent(false);
  };

  // The server's answer, shown where it belongs: a field's own message under that field,
  // anything else (wrong password, account locked, email taken) above the button.
  const showError = (err: unknown) => {
    if (err instanceof ApiError) {
      const fields: FieldErrors = {
        fullName: err.field('fullName'),
        companyName: err.field('companyName'),
        email: err.field('email'),
        password: err.field('password'),
      };
      const hasFieldError = Object.values(fields).some(Boolean);
      setFieldErrors(fields);
      setFormError(hasFieldError ? null : err.message);
    } else {
      setFormError('Something went wrong. Please try again.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    if (mode === 'signup' && !passwordMeetsRules(password)) {
      setFieldErrors({ password: 'Choose a password that meets every rule below.' });
      return;
    }

    setIsLoading(true);
    try {
      if (mode === 'forgot') {
        await requestPasswordReset(email.trim());
        setResetSent(true);
        return;
      }
      const session =
        mode === 'signup'
          ? await register({ fullName: fullName.trim(), companyName: company.trim(), email: email.trim(), password })
          : await login(email.trim(), password);
      showToast(mode === 'signup' ? 'Your company account is ready.' : `Welcome back, ${session.user.fullName}.`, 'success');
      onSuccess(session);
    } catch (err) {
      showError(err);
    } finally {
      setIsLoading(false);
    }
  };

  const heading = { signin: 'Sign in to SmartBusiness', signup: 'Create your company account', forgot: 'Reset your password' }[mode];
  const subheading = {
    signin: 'Sign in to open Check Printing, Clock-In and your company settings.',
    signup: 'Start your 14-day free trial. No credit card required.',
    forgot: "Enter your account's email and we'll send you a link to choose a new password.",
  }[mode];
  const submitLabel = { signin: 'Sign In', signup: 'Create Free Account', forgot: 'Send reset link' }[mode];
  const loadingLabel = { signin: 'Signing in...', signup: 'Creating your account...', forgot: 'Sending...' }[mode];

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="w-full max-w-5xl rounded-3xl bg-white border border-slate-200/90 shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        {/* Left Visual Column */}
        <div className="lg:col-span-5 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-8 sm:p-10 text-white flex flex-col justify-center relative overflow-hidden">
          {/* Subtle geometric background accents */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="space-y-6 relative z-10">
            <button
              onClick={onNavigateHome}
              className="text-left cursor-pointer group focus:outline-none"
              aria-label="Back to home"
            >
              <SmartBusinessLogo whiteText size="lg" />
            </button>

            <div className="space-y-3 pt-2">
              <span className="text-[11px] font-mono uppercase tracking-widest text-indigo-400">
                Check Automation & Attendance
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight leading-snug">
                One account for every SmartBusiness product.
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed pt-1">
                Create your company account once. Check Printing and Clock-In use the same sign-in, so your
                team never has to register twice.
              </p>
            </div>
          </div>
        </div>

        {/* Right Form Column */}
        <div className="lg:col-span-7 p-8 sm:p-12 flex flex-col justify-center">
          <div className="max-w-md w-full mx-auto space-y-6">
            {/* Header */}
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{heading}</h1>
              <p className="text-sm text-slate-500">{subheading}</p>
            </div>

            {mode === 'forgot' && resetSent ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800" role="status">
                If an account exists for <strong>{email.trim()}</strong>, we've emailed a link to choose a new password.
                It expires soon, so use it shortly.
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                {mode === 'signup' && (
                  <>
                    <Field label="Full Name" icon={<User className="w-4 h-4" />} error={fieldErrors.fullName}>
                      <input
                        type="text"
                        required
                        autoComplete="name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Alex Mercer"
                        className={`${inputClass} ${fieldErrors.fullName ? 'border-red-400' : 'border-slate-200'}`}
                      />
                    </Field>

                    <Field label="Company / Organization" icon={<Building className="w-4 h-4" />} error={fieldErrors.companyName}>
                      <input
                        type="text"
                        required
                        autoComplete="organization"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        placeholder="Acme Technologies Ltd"
                        className={`${inputClass} ${fieldErrors.companyName ? 'border-red-400' : 'border-slate-200'}`}
                      />
                    </Field>
                  </>
                )}

                <Field label="Work Email" icon={<Mail className="w-4 h-4" />} error={fieldErrors.email}>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className={`${inputClass} ${fieldErrors.email ? 'border-red-400' : 'border-slate-200'}`}
                  />
                </Field>

                {mode !== 'forgot' && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700">Password</label>
                      {mode === 'signin' && (
                        <button
                          type="button"
                          onClick={() => switchMode('forgot')}
                          className="text-xs text-indigo-600 hover:text-indigo-800 cursor-pointer"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className={`${inputClass} pr-10 ${fieldErrors.password ? 'border-red-400' : 'border-slate-200'}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {fieldErrors.password && <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>}
                    {mode === 'signup' && (
                      <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1" aria-label="Password rules">
                        {PASSWORD_RULES.map((rule) => {
                          const met = rule.test(password);
                          return (
                            <li key={rule.label} className={`flex items-center gap-1.5 text-xs ${met ? 'text-emerald-700' : 'text-slate-500'}`}>
                              {met ? <Check className="w-3.5 h-3.5" /> : <Circle className="w-3 h-3" />}
                              {rule.label}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}

                {formError && (
                  <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                    {formError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] shadow-md shadow-indigo-600/25 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {isLoading ? (
                    <span>{loadingLabel}</span>
                  ) : (
                    <>
                      <span>{submitLabel}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Toggle Mode */}
            <div className="pt-2 text-center text-xs text-slate-500">
              {mode === 'signin' && (
                <p>
                  New to SmartBusiness?{' '}
                  <ModeLink onClick={() => switchMode('signup')}>Start 14-day free trial</ModeLink>
                </p>
              )}
              {mode === 'signup' && (
                <p>
                  Already have an account? <ModeLink onClick={() => switchMode('signin')}>Log in here</ModeLink>
                </p>
              )}
              {mode === 'forgot' && (
                <p>
                  Remembered it? <ModeLink onClick={() => switchMode('signin')}>Back to sign in</ModeLink>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function Field({ label, icon, error, children }: { label: string; icon: React.ReactNode; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1">{label}</label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">{icon}</div>
        {children}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function ModeLink({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer">
      {children}
    </button>
  );
}
