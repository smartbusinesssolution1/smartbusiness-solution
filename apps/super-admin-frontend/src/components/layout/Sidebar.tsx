import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  CreditCard,
  Building2,
  Layers,
  Bug,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { toast } from 'sonner';
import { cn } from '../../utils/cn';

export type NavTabId = 'dashboard' | 'payments' | 'users' | 'telemetry';

export interface SidebarProps {
  activeTab?: NavTabId;
  onSelectTab?: (tab: NavTabId) => void;
}

export const Sidebar: React.FC<SidebarProps> = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleConfirmSignOut = () => {
    setShowLogoutModal(false);
    logout();
    navigate('/login');
    toast.info('Signed out of Super Admin.');
  };

  const businessNav = [
    {
      id: 'dashboard',
      path: '/dashboard',
      label: 'Dashboard Overview',
      icon: LayoutDashboard,
      isActive: (pathname: string) => pathname === '/' || pathname.startsWith('/dashboard'),
    },
    {
      id: 'payments',
      path: '/plans',
      label: 'Payment & Plans',
      icon: CreditCard,
      isActive: (pathname: string) => pathname.startsWith('/plans') || pathname.startsWith('/payments'),
    },
    {
      id: 'users',
      path: '/users',
      label: 'Organization Owners',
      icon: Building2,
      isActive: (pathname: string) => pathname.startsWith('/users'),
    },
  ];

  const isTelemetryActive =
    location.pathname.startsWith('/error-logs') || location.pathname.startsWith('/telemetry');

  const isDevAdmin = user?.role === 'DEV_SUPER_ADMIN';

  return (
    <>
      <aside className="w-64 bg-sidebar flex flex-col justify-between border-r border-line shrink-0 select-none">
        <div className="flex flex-col gap-6 p-4 overflow-y-auto">
          {/* Brand Card */}
          <div
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-3 px-1 py-1 cursor-pointer group transition-opacity hover:opacity-90"
          >
            <div className="size-9 rounded-xl bg-gradient-to-tr from-primary-700 to-primary-500 flex items-center justify-center text-white shadow-button shrink-0 transition-transform group-hover:scale-105 duration-200">
              <Layers className="size-5" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[0.9375rem] font-bold text-ink tracking-tight">SmartBusiness</span>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="font-mono text-[0.625rem] tracking-wider text-muted uppercase">
                  Super Admin
                </span>
                <span
                  className={cn(
                    'px-1.5 py-0.2 rounded font-mono text-[9px] font-bold tracking-tight',
                    isDevAdmin ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                  )}
                >
                  {isDevAdmin ? 'DEV ROOT' : 'BIZ OPS'}
                </span>
              </div>
            </div>
          </div>

          {/* Platform Management Navigation */}
          <div className="space-y-1">
            <div className="px-2.5 pb-1 font-mono text-[0.625rem] tracking-[0.12em] text-faint uppercase font-bold">
              Platform Management
            </div>
            <nav className="flex flex-col gap-0.5">
              {businessNav.map((item) => {
                const Icon = item.icon;
                const active = item.isActive(location.pathname);
                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(item.path)}
                    className={cn(
                      'relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-xs font-semibold interactive-tap cursor-pointer text-left transition-all duration-150',
                      active
                        ? 'bg-primary-50 text-primary-700 font-bold border border-primary-200/60 shadow-2xs'
                        : 'text-ink-soft hover:bg-subtle hover:text-ink'
                    )}
                  >
                    {active && (
                      <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-primary-600 animate-in fade-in duration-200" />
                    )}
                    <Icon className={cn('size-4 shrink-0 transition-colors', active ? 'text-primary-600' : 'text-muted')} />
                    <span className="flex-1 truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Developer Diagnostics - Strictly visible ONLY to DEV_SUPER_ADMIN */}
          {isDevAdmin && (
            <div className="space-y-1 pt-2 border-t border-line">
              <div className="px-2.5 pb-1 font-mono text-[0.625rem] tracking-[0.12em] text-faint uppercase font-bold flex items-center justify-between">
                <span>Engineering & Support</span>
                <span className="text-[9px] text-purple-600 font-bold">ROOT</span>
              </div>
              <nav className="flex flex-col gap-0.5">
                <button
                  onClick={() => navigate('/error-logs')}
                  className={cn(
                    'relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-xs font-semibold interactive-tap cursor-pointer text-left transition-all duration-150',
                    isTelemetryActive
                      ? 'bg-rose-50 text-rose-700 font-bold border border-rose-200 shadow-2xs'
                      : 'text-ink-soft hover:bg-subtle hover:text-ink'
                  )}
                >
                  {isTelemetryActive && (
                    <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-rose-600 animate-in fade-in duration-200" />
                  )}
                  <Bug
                    className={cn(
                      'size-4 shrink-0 transition-colors',
                      isTelemetryActive ? 'text-rose-600' : 'text-muted'
                    )}
                  />
                  <span className="flex-1 truncate">Error Logs</span>
                </button>
              </nav>
            </div>
          )}
        </div>

        {/* Footer Profile Strip */}
        <div className="p-3 border-t border-line">
          <div className="flex items-center justify-between p-2 rounded-[var(--radius-control)] bg-subtle/80 border border-line">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={cn(
                  'size-7 rounded-full text-white font-mono font-bold text-xs flex items-center justify-center shadow-xs shrink-0',
                  isDevAdmin ? 'bg-purple-600' : 'bg-primary-600'
                )}
              >
                {isDevAdmin ? 'DEV' : 'SA'}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-ink truncate leading-tight">
                  {user?.name ?? 'Super Administrator'}
                </span>
                <span className="text-[10px] text-muted font-mono truncate leading-tight">
                  {user?.email ?? 'admin@smartbusiness.us'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowLogoutModal(true)}
              className="size-7 rounded-lg hover:bg-rose-50 text-muted hover:text-rose-600 flex items-center justify-center transition cursor-pointer shrink-0"
              title="Sign out of Super Admin"
            >
              <LogOut className="size-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Sign Out Confirmation Modal */}
      <Modal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        title="Sign Out Confirmation"
        subtitle="End Super Administrator Session"
        maxWidth="sm"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowLogoutModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={handleConfirmSignOut}
              icon={<LogOut className="size-3.5" />}
            >
              Sign Out
            </Button>
          </>
        }
      >
        <div className="space-y-3 py-1">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900">
            <div className="size-9 rounded-lg bg-rose-100 flex items-center justify-center text-rose-700 shrink-0">
              <LogOut className="size-5" />
            </div>
            <div className="text-xs">
              <p className="font-bold text-rose-950">Are you sure you want to sign out?</p>
              <p className="text-rose-700 mt-0.5">Your current administrative session will be terminated immediately.</p>
            </div>
          </div>
          <p className="text-xs text-muted leading-relaxed">
            You will need your administrative email and password to log back in to the control console.
          </p>
        </div>
      </Modal>
    </>
  );
};
