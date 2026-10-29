import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LogOut,
  RefreshCw,
  Mail,
  ShieldAlert,
  AlertTriangle,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAppTheme } from '../../context/ThemeContext';
import { Button } from '../../components/ui/button';

export const SubscriptionExpiredPage: React.FC = () => {
  const navigate = useNavigate();
  const { logout, refreshWorkspaces } = useAuth();
  const { mode, toggleTheme } = useAppTheme();
  const [isChecking, setIsChecking] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Preload LoginPage chunk into browser memory so clicking Sign Out transitions in 0ms
  useEffect(() => {
    import('./LoginPage');
  }, []);

  const handleCheckAgain = async () => {
    setIsChecking(true);
    try {
      await refreshWorkspaces();
      navigate('/admin/dashboard', { replace: true });
    } catch {
      // Still 403 or error, stay on page
    } finally {
      setIsChecking(false);
    }
  };

  const handleLogout = () => {
    setIsLoggingOut(true);
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-canvas text-ink font-sans antialiased flex flex-col justify-between selection:bg-primary-600 selection:text-white">
      {/* Top Brand Header */}
      <header className="px-6 py-4 sm:px-12 md:px-16 lg:px-20 border-b border-line bg-panel/80 backdrop-blur-md sticky top-0 z-10 transition-colors">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary-50 dark:bg-primary-950/60 border border-primary-200/80 dark:border-primary-800/80 flex items-center justify-center shadow-xs overflow-hidden">
              <img src="/auth-icon.png" alt="SmartBusiness" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-ink">SmartBusiness</span>
                <span className="px-2 py-0.5 text-[10px] font-semibold text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-950/70 border border-primary-200 dark:border-primary-800/80 rounded-full">
                  Clock-In Clock-Out SaaS
                </span>
              </div>
              <span className="font-mono text-[10px] font-semibold tracking-wider text-muted uppercase">
                Enterprise Attendance
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={toggleTheme}
              title={`Switch to ${mode === 'light' ? 'Dark' : 'Light'} Mode`}
              aria-label="Toggle theme"
            >
              {mode === 'light' ? <Moon className="size-4" /> : <Sun className="size-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex items-center gap-1.5 text-muted hover:text-ink hover:bg-subtle cursor-pointer"
            >
              <LogOut className="size-4" />
              <span>Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-xl">
          <div className="rounded-2xl border border-line bg-panel shadow-pop transition-all duration-300 overflow-hidden">
            {/* Top Amber Alert Banner */}
            <div className="bg-amber-500/10 border-b border-amber-200/70 dark:border-amber-900/60 px-6 py-4 flex items-center gap-3">
              <div className="size-9 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="size-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-xs font-semibold text-amber-900 dark:text-amber-200 uppercase tracking-wide">
                  Access Suspended
                </h3>
                <p className="text-xs text-amber-800/90 dark:text-amber-300/80">
                  This product is currently locked for your organization.
                </p>
              </div>
            </div>

            <div className="p-7 sm:p-9 flex flex-col gap-6">
              {/* Header Title & Description */}
              <div className="flex flex-col gap-2">
                <div className="inline-flex items-center gap-2 self-start rounded-full bg-rose-50 dark:bg-rose-950/50 border border-rose-200/80 dark:border-rose-900/80 px-3 py-1 text-xs font-semibold text-rose-700 dark:text-rose-400">
                  <ShieldAlert className="size-3.5" />
                  <span>No Active Subscription</span>
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-ink">
                  Subscription required for Clock-In Clock-Out
                </h1>
                <p className="text-sm text-muted leading-relaxed">
                  Your organization does not currently have an active trial or paid subscription to access
                  the <strong className="text-ink">Clock-In Clock-Out</strong> platform.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                  onClick={handleCheckAgain}
                  disabled={isChecking}
                  variant="default"
                  size="default"
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-medium shadow-theme-btn transition cursor-pointer"
                >
                  <RefreshCw className={`size-4 ${isChecking ? 'animate-spin' : ''}`} />
                  <span>{isChecking ? 'Checking status...' : 'Check Again'}</span>
                </Button>

                <a
                  href="mailto:support@smartbusiness.com?subject=Subscription%20Inquiry%20-%20Clock-In%20Clock-Out"
                  className="flex-1 inline-flex"
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="default"
                    className="w-full flex items-center justify-center gap-2 py-2.5 border-line bg-panel text-ink hover:bg-subtle font-medium transition cursor-pointer"
                  >
                    <Mail className="size-4" />
                    <span>Contact Support</span>
                  </Button>
                </a>
              </div>
            </div>

            {/* Footer with Sign Out shortcut */}
            <div className="border-t border-line bg-subtle/40 px-7 py-3.5 flex items-center justify-between text-xs text-muted">
              <span>Need to switch accounts?</span>
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 hover:underline transition cursor-pointer"
              >
                Sign out & return to login
              </button>
            </div>
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
