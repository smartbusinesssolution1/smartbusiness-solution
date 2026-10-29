import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Headphones,
  LogOut,
  Moon,
  Sun,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAppTheme } from '../../context/ThemeContext';
import { Button } from '../../components/ui/button';
import { clockInApi } from '../../services/apiClient';

const RESTRICTED_FEATURES = [
  {
    name: 'Biometric Face ID & kiosk clock-in',
    status: 'Paused',
  },
  {
    name: 'Real-time attendance & geofencing',
    status: 'Locked',
  },
  {
    name: 'Shift scheduling & automated timesheets',
    status: 'Halted',
  },
] as const;

export const SubscriptionExpiredPage: React.FC = () => {
  const navigate = useNavigate();
  const { logout, refreshWorkspaces } = useAuth();
  const { mode, toggleTheme } = useAppTheme();
  const [isChecking, setIsChecking] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Preload LoginPage chunk into browser memory so clicking Sign Out transitions instantly
  useEffect(() => {
    import('./LoginPage');
  }, []);

  const handleCheckAgain = async () => {
    if (isChecking) return;
    setIsChecking(true);
    setStatusMessage(null);

    try {
      // Actively verify if plan is active with the product API
      const res = await clockInApi.get('/api/v1/workspaces');

      if (res.data?.success) {
        // Plan is active -> refresh and redirect to dashboard
        await refreshWorkspaces();
        navigate('/admin/dashboard', { replace: true });
        return;
      }

      // Not active -> show message, do not redirect anywhere
      setStatusMessage('Plan is still not active.');
    } catch {
      // 403 Forbidden or subscription inactive -> show message, do not redirect anywhere
      setStatusMessage('Plan is still not active.');
    } finally {
      setIsChecking(false);
    }
  };

  const handleLogout = () => {
    setIsLoggingOut(true);
    logout();
    navigate('/login', { replace: true });
  };

  const handleExplore = () => {
    window.open('/clockin-clockout', '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-canvas text-ink font-sans antialiased flex flex-col justify-between selection:bg-primary-600 selection:text-white transition-colors">
      {/* Top utility bar (theme toggle & quick logout) */}
      <header className="px-6 py-4 border-b border-line bg-panel/80 backdrop-blur-md sticky top-0 z-10 flex items-center justify-between transition-colors">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-lg bg-primary-50 dark:bg-primary-950/60 border border-primary-200/80 dark:border-primary-800/80 flex items-center justify-center overflow-hidden">
            <img src="/auth-icon.png" alt="SmartBusiness" className="w-full h-full object-contain" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-ink">SmartBusiness</span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleTheme}
            title={`Switch to ${mode === 'light' ? 'Dark' : 'Light'} Mode`}
            aria-label="Toggle theme"
            className="cursor-pointer"
          >
            {mode === 'light' ? <Moon className="size-4" /> : <Sun className="size-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex items-center gap-1.5 text-muted hover:text-ink hover:bg-subtle cursor-pointer text-xs"
          >
            <LogOut className="size-3.5" />
            <span>Sign Out</span>
          </Button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-[540px] rounded-3xl border border-line bg-panel p-7 sm:p-9 shadow-card sm:shadow-pop text-center transition-all">
          {/* Top Exclamation Icon in current theme border/bg */}
          <div className="mx-auto flex size-14 sm:size-16 items-center justify-center rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200/80 dark:border-rose-900/80 text-rose-600 dark:text-rose-400">
            <AlertCircle className="size-8 stroke-[2.2]" />
          </div>

          {/* Heading */}
          <h2 className="mt-5 text-2xl sm:text-[1.65rem] font-bold tracking-tight text-ink">
            Membership Expired
          </h2>

          {/* Subtitle */}
          <p className="mx-auto mt-2.5 max-w-md text-sm sm:text-base leading-relaxed text-muted">
            Employee time tracking and attendance operations are temporarily paused due to required compliance verification.
          </p>

          {/* Feature Status Box */}
          <div className="my-6 rounded-2xl bg-subtle/70 dark:bg-subtle/50 p-4.5 sm:p-5 text-left border border-line">
            <div className="flex flex-col gap-3.5">
              {RESTRICTED_FEATURES.map((item) => (
                <div key={item.name} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2.5 font-medium text-ink">
                    <span className="size-2 rounded-full bg-rose-600 dark:bg-rose-500 shrink-0" aria-hidden="true" />
                    <span>{item.name}</span>
                  </span>
                  <span className="font-semibold text-rose-600 dark:text-rose-400 shrink-0">
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Inactive Plan Status Alert */}
          {statusMessage && (
            <div className="mb-4 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs sm:text-sm text-rose-700 dark:text-rose-400 flex items-center justify-center gap-2 animate-in fade-in duration-200">
              <AlertCircle className="size-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span className="font-medium">{statusMessage}</span>
            </div>
          )}

          {/* Primary Action Button styled with current primary theme */}
          <button
            type="button"
            onClick={handleCheckAgain}
            disabled={isChecking}
            className="w-full h-11 sm:h-12 rounded-xl bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white font-semibold text-sm sm:text-base shadow-theme-btn flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
          >
            <RefreshCw className={`size-4.5 transition-transform ${isChecking ? 'animate-spin' : ''}`} />
            <span>{isChecking ? 'Retrying now...' : 'Retry Now'}</span>
          </button>

          {/* Secondary Bottom Links */}
          <div className="mt-4 flex items-center justify-between text-xs sm:text-sm font-medium">
            <button
              type="button"
              onClick={handleExplore}
              className="group inline-flex items-center gap-1.5 text-ink hover:text-primary-600 dark:hover:text-primary-400 transition-colors cursor-pointer"
            >
              <span>Explore Clock in Clock out Solution</span>
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </button>

            <a
              href="mailto:support@smartbusiness.com?subject=Reactivate%20Clock-In%20Clock-Out%20Membership"
              className="inline-flex items-center gap-1.5 text-muted hover:text-ink transition-colors cursor-pointer"
            >
              <Headphones className="size-4" />
              <span>Contact Support</span>
            </a>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-muted border-t border-line/60 bg-panel/30">
        &copy; {new Date().getFullYear()} SmartBusiness Platform. All rights reserved.
      </footer>
    </div>
  );
};

export default SubscriptionExpiredPage;
