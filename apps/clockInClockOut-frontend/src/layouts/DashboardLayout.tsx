import React, { useState, Suspense } from 'react';
import { useNavigate, useLocation, Outlet, NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  BarChart3,
  Building2,
  UserCheck,
  Search,
  ShieldCheck,
  LogOut,
  Sun,
  Moon,
  Menu as MenuIcon,
  X as CloseIcon,
  Clock,
  ChevronsUpDown,
  Check as CheckIcon,
  User as UserIcon,
  Plus,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/ThemeContext';
import { getAvatarUrl } from '../utils/imageUrl';
import BrandLoader from '../components/BrandLoader';
import { cn } from '../lib/utils';
import {
  Button,
  Badge,
  Input,
  Menu,
  MenuTrigger,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  Tooltip,
  TooltipProvider,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
} from '../components/ui';

interface NavItemDef {
  text: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  preload?: () => void;
}

export const DashboardLayout: React.FC = () => {
  const { user, isSuperAdmin, currentTenant, logout, currentWorkspace, workspaces, switchWorkspace } = useAuth();
  const isOwner = Boolean(currentTenant?.role === 'OWNER' || isSuperAdmin);
  const { mode, toggleTheme } = useAppTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleConfirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
      setShowLogoutConfirm(false);
      navigate('/login');
    }
  };

  // Exact 5 sidebar menu items requested
  const menuItems: NavItemDef[] = [
    {
      text: 'Admin Dashboard',
      path: '/admin/dashboard',
      icon: LayoutDashboard,
      preload: () => import('../pages/admin/AdminDashboard'),
    },
    {
      text: 'Employee Directory',
      path: '/admin/employees',
      icon: Users,
      preload: () => import('../pages/admin/EmployeeList'),
    },
    {
      text: 'Attendance Reports',
      path: '/admin/reports',
      icon: BarChart3,
      preload: () => import('../pages/admin/AttendanceReport'),
    },
    {
      text: 'Organization',
      path: '/admin/settings',
      icon: Building2,
      preload: () => import('../pages/admin/OrganizationSettings'),
    },
    {
      text: 'My Profile',
      path: '/admin/profile',
      icon: UserCheck,
    },
  ];

  const initials = (name?: string) => {
    if (!name) return 'SB';
    return name
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const activeWorkspaceName = currentWorkspace?.name || 'Main Organization';

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between overflow-y-auto px-3.5 py-4 select-none">
      <div className="flex flex-col gap-3.5">
        {/* Brand Header */}
        <div className="flex items-center justify-between px-1.5 pt-0.5">
          <div
            onClick={() => {
              navigate('/admin/dashboard');
              setMobileOpen(false);
            }}
            className="group flex cursor-pointer items-center gap-2.5 transition-opacity hover:opacity-90"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl overflow-hidden shadow-xs border border-line bg-panel p-0.5">
              <img
                src="/favicon.png"
                alt="SmartBusiness Clock-In"
                className="size-8 object-contain rounded-lg"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-[0.9375rem] font-bold tracking-tight text-ink">SmartBusiness</span>
              <span className="font-mono text-[0.625rem] font-bold tracking-[0.12em] text-primary-600 uppercase">
                CLOCK IN / OUT
              </span>
            </div>
          </div>
          {/* Mobile close button */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setMobileOpen(false)}
            className="lg:hidden"
            aria-label="Close menu"
          >
            <CloseIcon className="size-4" />
          </Button>
        </div>

        {/* Workspace Switcher using shadcn DropdownMenu */}
        <Menu>
          <MenuTrigger asChild>
            <button
              type="button"
              className="group flex w-full items-center gap-2.5 rounded-xl border border-line bg-panel p-2 text-left shadow-card transition-all hover:border-line-strong hover:bg-subtle/40 focus:outline-none focus:ring-2 focus:ring-primary-500/20 data-[state=open]:border-primary-500/50 data-[state=open]:ring-2 data-[state=open]:ring-primary-500/20 cursor-pointer"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 font-mono text-xs font-semibold text-primary-700 ring-1 ring-primary-100 ring-inset dark:bg-primary-950 dark:text-primary-300 dark:ring-primary-800/60">
                {initials(activeWorkspaceName)}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[0.8125rem] font-semibold text-ink group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                  {activeWorkspaceName}
                </span>
                <span className="truncate font-mono text-[0.6875rem] text-muted">
                  {isSuperAdmin ? 'Super Administrator' : 'Admin Console'}
                </span>
              </span>
              <ChevronsUpDown className="size-4 shrink-0 text-faint group-hover:text-muted transition-colors" />
            </button>
          </MenuTrigger>
          <MenuContent
            align="start"
            sideOffset={6}
            className="w-[calc(16.25rem-1.75rem)] min-w-[240px] max-w-[280px] p-1.5 shadow-pop border border-line bg-panel rounded-xl"
          >
            {/* Header with Title and Total Count Badge */}
            <div className="flex items-center justify-between px-2 py-1.5 mb-1 border-b border-line">
              <span className="font-mono text-[0.625rem] font-semibold tracking-wider text-muted uppercase">
                Workspaces
              </span>
              <span className="rounded-full bg-subtle px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted">
                {workspaces?.length || 0}
              </span>
            </div>

            {/* Scrollable Workspace List */}
            <div className="max-h-60 overflow-y-auto flex flex-col gap-1 pr-0.5">
              {workspaces && workspaces.length > 0 ? (
                workspaces.map((ws) => {
                  const isCurrent = ws.id === currentWorkspace?.id;
                  return (
                    <MenuItem
                      key={ws.id}
                      onClick={() => switchWorkspace(ws.id)}
                      className={cn(
                        'group flex items-center gap-2.5 rounded-lg p-2 text-xs transition-colors cursor-pointer',
                        isCurrent
                          ? 'bg-primary-50/90 text-primary-950 border border-primary-200 shadow-xs font-semibold dark:bg-primary-950/70 dark:text-primary-100 dark:border-primary-800/80 data-[highlighted]:bg-primary-100/80 dark:data-[highlighted]:bg-primary-900/60'
                          : 'text-ink hover:bg-subtle/80 data-[highlighted]:bg-subtle border border-transparent'
                      )}
                    >
                      {/* Avatar Square */}
                      <span
                        className={cn(
                          'flex size-7 shrink-0 items-center justify-center rounded-md font-mono text-[11px] font-bold transition-colors',
                          isCurrent
                            ? 'bg-primary-600 text-white shadow-xs'
                            : 'bg-subtle text-muted group-hover:bg-primary-50 group-hover:text-primary-700 dark:group-hover:bg-primary-950 dark:group-hover:text-primary-300'
                        )}
                      >
                        {initials(ws.name)}
                      </span>

                      {/* Workspace Name & Subtitle */}
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span
                          className={cn(
                            'truncate leading-tight',
                            isCurrent
                              ? 'text-primary-950 dark:text-primary-100 font-semibold'
                              : 'text-ink font-medium'
                          )}
                        >
                          {ws.name}
                        </span>
                        <span
                          className={cn(
                            'truncate font-mono text-[10px] leading-tight mt-0.5',
                            isCurrent
                              ? 'text-primary-700 dark:text-primary-300'
                              : 'text-muted'
                          )}
                        >
                          {ws.city || ws.address || (ws.isDefault ? 'Default' : 'Active Location')}
                        </span>
                      </div>

                      {/* Active Indicator Checkmark */}
                      {isCurrent && (
                        <CheckIcon className="size-4 shrink-0 text-primary-600 dark:text-primary-400 stroke-[2.5]" />
                      )}
                    </MenuItem>
                  );
                })
              ) : (
                <div className="px-2.5 py-2 text-xs text-muted">No workspaces available</div>
              )}
            </div>

            {/* Owner Action: + Add New Workspace */}
            {isOwner && (
              <>
                <MenuSeparator className="my-1.5" />
                <MenuItem
                  onClick={() => {
                    navigate('/workspace/select');
                    setMobileOpen(false);
                  }}
                  className="group flex items-center justify-between rounded-lg p-2 text-xs font-semibold text-primary-700 bg-primary-50 border border-primary-200/90 hover:bg-primary-100 hover:border-primary-300 data-[highlighted]:bg-primary-100 data-[highlighted]:text-primary-800 dark:bg-primary-950/50 dark:border-primary-900/60 dark:text-primary-300 dark:hover:bg-primary-900/60 dark:data-[highlighted]:bg-primary-900/70 dark:data-[highlighted]:text-primary-100 transition-colors cursor-pointer shadow-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary-600 text-white shadow-xs group-hover:bg-primary-700 dark:group-hover:bg-primary-500 transition-colors">
                      <Plus className="size-3.5 stroke-[2.5]" />
                    </span>
                    <span>Manage Workspaces</span>
                  </div>
                  <span className="rounded bg-primary-100 border border-primary-200/80 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-primary-700 dark:bg-primary-900/70 dark:border-primary-800/80 dark:text-primary-300">
                    Owner
                  </span>
                </MenuItem>
              </>
            )}
          </MenuContent>
        </Menu>

        {/* Quick Action Button (shadcn brand variant) */}
        <Button
          variant="brand"
          size="default"
          onClick={() => navigate('/admin/employees/new')}
          className="w-full"
        >
          <UserIcon className="size-3.5" />
          <span>+ Onboard Staff</span>
        </Button>

        {/* Navigation Items (The exact 5 items) */}
        <nav className="flex flex-col gap-1 pt-1" aria-label="Main Navigation">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              location.pathname === item.path ||
              (item.path !== '/admin/dashboard' && location.pathname.startsWith(item.path));

            return (
              <NavLink
                key={item.text}
                to={item.path}
                onMouseEnter={item.preload}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-xs font-medium transition-all',
                  isActive
                    ? 'bg-theme-gradient text-white shadow-theme-pill font-semibold'
                    : 'text-ink-soft hover:bg-subtle hover:text-ink'
                )}
              >
                <Icon
                  className={cn(
                    'size-4 shrink-0 transition-colors',
                    isActive ? 'text-white' : 'text-muted'
                  )}
                />
                <span className="truncate">{item.text}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Bottom Area: 2FA / Geofence Card & User Profile */}
      <div className="flex flex-col gap-2.5 pt-3">
        {/* Security / Geofence Status Card */}
        <div className="flex items-center justify-between rounded-xl border border-line bg-panel p-2.5 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100 ring-inset">
              <ShieldCheck className="size-4" />
            </span>
            <div className="flex flex-col">
              <span className="text-[0.75rem] font-semibold text-ink">Geofence Guard</span>
              <span className="font-mono text-[0.625rem] text-emerald-600">Active & Enforced</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/admin/settings')}
            className="h-6 px-2 text-[0.6875rem] font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50"
          >
            Config
          </Button>
        </div>

        {/* User Profile Card */}
        <div className="flex items-center justify-between rounded-xl border border-line bg-panel p-2 shadow-sm">
          <div
            onClick={() => navigate('/admin/profile')}
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 overflow-hidden"
          >
            {user?.avatarUrl ? (
              <img
                src={getAvatarUrl(user.avatarUrl)}
                alt={user?.name || 'User'}
                className="size-8 shrink-0 rounded-full border border-primary-200 object-cover"
              />
            ) : (
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-600 font-mono text-xs font-semibold text-white">
                {initials(user?.name)}
              </div>
            )}
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-xs font-semibold text-ink">{user?.name || 'Admin'}</span>
              <span className="truncate text-[0.6875rem] text-muted">
                {isSuperAdmin ? 'Super Admin' : user?.role === 'admin' ? 'Administrator' : 'Admin'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Tooltip content={`Switch to ${mode === 'light' ? 'Dark' : 'Light'} Mode`}>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={toggleTheme}
                aria-label="Toggle theme"
              >
                {mode === 'light' ? <Moon className="size-3.5" /> : <Sun className="size-3.5" />}
              </Button>
            </Tooltip>
            <Tooltip content="Sign Out">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setShowLogoutConfirm(true)}
                className="hover:bg-rose-50 hover:text-rose-600"
                aria-label="Sign Out"
              >
                <LogOut className="size-3.5" />
              </Button>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex min-h-screen bg-canvas text-ink">
        {/* Desktop Sticky Sidebar */}
        <aside className="sticky top-0 hidden h-screen w-[16.25rem] shrink-0 border-r border-line bg-sidebar lg:block">
          {sidebarContent}
        </aside>

        {/* Mobile Drawer Backdrop and Panel */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <div
              className="fixed inset-0 bg-ink/25 backdrop-blur-[2px] transition-opacity"
              onClick={() => setMobileOpen(false)}
            />
            <div className="relative z-10 w-[17rem] max-w-[85vw] border-r border-line bg-sidebar shadow-pop">
              {sidebarContent}
            </div>
          </div>
        )}

        {/* Main Content Stage */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile Header */}
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-panel/90 px-4 backdrop-blur-md lg:hidden">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
            >
              <MenuIcon className="size-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-lg overflow-hidden border border-line bg-panel p-0.5">
                <img
                  src="/favicon.png"
                  alt="SmartBusiness Clock-In"
                  className="size-6 object-contain rounded-md"
                />
              </div>
              <span className="text-sm font-bold tracking-tight text-ink">SmartBusiness</span>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              {mode === 'light' ? <Moon className="size-4" /> : <Sun className="size-4" />}
            </Button>
          </header>

          {/* Content Body */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            <Suspense fallback={<BrandLoader fullScreen message="Loading dashboard view..." />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>
          {/* Logout Confirmation Dialog */}
      <Dialog
        open={showLogoutConfirm}
        onOpenChange={(open) => {
          if (!isLoggingOut) setShowLogoutConfirm(open);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader
            title="Confirm Logout"
            description="Are you sure you want to log out? You will need to sign in again to access your account."
            icon={<LogOut className="size-4 text-rose-600" />}
          />
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setShowLogoutConfirm(false)}
              disabled={isLoggingOut}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmLogout}
              loading={isLoggingOut}
            >
              {isLoggingOut ? 'Logging out...' : 'Log Out'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
};

export default DashboardLayout;
