import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/common/Button';
import { SmartBusinessLogo } from '../../components/common/SmartBusinessLogo';
import { toast } from 'sonner';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const res = await login(email, password);
      if (res.success) {
        toast.success(`Signed in as ${email}`);
        navigate(from, { replace: true });
      } else {
        const errorMsg = res.error || 'Invalid credentials. Please verify your email and password.';
        setErrorMessage(errorMsg);
        toast.error(errorMsg);
      }
    } catch {
      const connError = 'Unable to connect to authentication server. Please try again.';
      setErrorMessage(connError);
      toast.error(connError);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex flex-col justify-between items-center p-4 sm:p-6 antialiased select-none">
      {/* Top Spacer */}
      <div className="w-full max-w-md pt-4 sm:pt-6" />

      {/* Main Center Auth Card */}
      <div className="w-full max-w-[420px] animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-panel border border-line rounded-2xl shadow-card p-7 sm:p-9 space-y-6">
          {/* Brand & Heading */}
          <div className="text-center space-y-3">
            <div className="flex justify-center">
              <SmartBusinessLogo size="lg" layout="stacked" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary-50 border border-primary-200/80 text-primary-700 font-mono text-[10px] font-bold tracking-wider uppercase mb-1.5">
                Super Admin Control
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Dedicated administrative access for platform control and engineering
              </p>
            </div>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-900 text-xs">
              <AlertCircle className="size-4 text-rose-600 shrink-0 mt-0.5" />
              <span className="leading-tight font-medium">{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div>
              <label className="block text-xs font-bold text-ink mb-1.5 tracking-tight">
                Administrative Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="size-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter administrative email"
                  className="w-full border border-slate-300 rounded-lg pl-9 pr-3.5 py-2.5 bg-white text-ink font-semibold text-xs placeholder:text-slate-400 shadow-xs hover:border-slate-400 focus:border-primary-600 focus:ring-4 focus:ring-primary-500/15 focus:outline-none transition-all"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-ink tracking-tight">
                  Password
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="size-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full border border-slate-300 rounded-lg pl-9 pr-10 py-2.5 bg-white text-ink font-semibold text-xs placeholder:text-slate-400 shadow-xs hover:border-slate-400 focus:border-primary-600 focus:ring-4 focus:ring-primary-500/15 focus:outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-ink-soft font-medium">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-300 text-primary-600 focus:ring-primary-500/20 size-4 cursor-pointer"
                />
                <span>Remember administrative session</span>
              </label>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full justify-center text-xs font-bold py-2.5 shadow-button"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="size-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Signing in...
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    Sign In to Super Admin <ArrowRight className="size-3.5 ml-0.5" />
                  </span>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full text-center text-xs text-muted py-4 font-medium">
        &copy; {new Date().getFullYear()} SmartBusiness Solutions. All rights reserved.
      </footer>
    </div>
  );
};
