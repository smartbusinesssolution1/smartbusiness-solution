import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Building2,
  Plus,
  Check,
  MapPin,
  Users,
  ArrowRight,
  ShieldCheck,
  Store,
  Radio,
  Search,
  X,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Workspace } from '../../types';
import BrandLoader from '../../components/BrandLoader';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Input,
  Field,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogClose,
} from '../../components/ui';
import { cn } from '../../lib/utils';

// ── Role badge helpers ──────────────────────────────────────────────────────
type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export const WorkspaceSelectPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentTenant, isSuperAdmin, workspaces, currentWorkspace, switchWorkspace, addWorkspace, refreshWorkspaces, logout, isLoading } =
    useAuth();

  const isOwner = Boolean(currentTenant?.role === 'OWNER' || isSuperAdmin);
  const companyName = currentTenant?.name || 'Organization';

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  // Form State
  const [name, setName] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string; severity: 'success' | 'error' | 'info' } | null>(null);

  const hasNoWorkspaces = !isLoading && Boolean(workspaces && workspaces.length === 0);

  useEffect(() => {
    if (!workspaces || workspaces.length === 0) {
      refreshWorkspaces();
    }
  }, [workspaces?.length, refreshWorkspaces]);

  // Auto-open modal if ?create=true
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('create') === 'true') {
      handleOpenAddModal();
    }
  }, []);

  // Helper to determine user role for a specific workspace
  const getWorkspaceRole = (ws: Workspace): WorkspaceRole => {
    const raw = (ws.role || ws.userRole || currentTenant?.role || 'ADMIN').toUpperCase();
    if (raw === 'OWNER') return 'OWNER';
    if (raw === 'ADMIN') return 'ADMIN';
    return 'MEMBER';
  };

  // Only show workspaces where the logged-in user is Owner or Admin for that specific workspace
  const visibleWorkspaces = useMemo(() => {
    if (!workspaces) return [];
    return workspaces.filter((ws) => {
      const role = getWorkspaceRole(ws);
      return role === 'OWNER' || role === 'ADMIN';
    });
  }, [workspaces, currentTenant]);

  // Filtered workspaces by search query
  const filteredWorkspaces = useMemo(() => {
    if (!searchFilter.trim()) return visibleWorkspaces;
    const q = searchFilter.toLowerCase().trim();
    return visibleWorkspaces.filter(
      (ws) =>
        ws.name.toLowerCase().includes(q) ||
        (ws.city && ws.city.toLowerCase().includes(q)) ||
        (ws.state && ws.state.toLowerCase().includes(q)) ||
        (ws.address && ws.address.toLowerCase().includes(q)) ||
        (ws.zipCode && ws.zipCode.includes(q))
    );
  }, [visibleWorkspaces, searchFilter]);

  const initials = (title?: string) => {
    if (!title) return 'BR';
    return title
      .split(' ')
      .filter(Boolean)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const handleSelectWorkspace = async (ws: Workspace) => {
    try {
      await switchWorkspace(ws.id);
      setToast({ message: `Active workspace: ${ws.name}`, severity: 'success' });
      setTimeout(() => {
        navigate('/admin/dashboard');
      }, 350);
    } catch {
      setToast({ message: 'Failed to switch workspace', severity: 'error' });
    }
  };

  const handleOpenAddModal = () => {
    setName('');
    setAddressLine1('');
    setCity('');
    setState('');
    setZipCode('');
    setFormErrors({});
    setIsAddModalOpen(true);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!name.trim()) {
      errors.name = 'Workspace name is required';
    }
    if (!addressLine1.trim()) {
      errors.addressLine1 = 'Street address is required';
    }
    if (!city.trim()) {
      errors.city = 'City is required';
    }
    const cleanState = state.trim().toUpperCase();
    if (!cleanState || !/^[A-Za-z]{2}$/.test(cleanState)) {
      errors.state = 'State must be a 2-letter code (e.g. TX, CA)';
    }
    const cleanZip = zipCode.trim();
    if (!cleanZip) {
      errors.zipCode = 'ZIP code is required';
    } else if (!/^\d{5}(-\d{4})?$/.test(cleanZip)) {
      errors.zipCode = 'ZIP code must be 5 digits or ZIP+4 (e.g. 78701 or 78701-1234)';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await addWorkspace(name.trim(), {
        address: addressLine1.trim(),
        city: city.trim(),
        state: state.trim().toUpperCase(),
        zipCode: zipCode.trim(),
      });
      setIsAddModalOpen(false);
      setToast({ message: `Created branch "${created.name}"!`, severity: 'success' });
      setTimeout(() => {
        navigate('/admin/dashboard');
      }, 400);
    } catch (err: any) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        err?.message ||
        'Failed to create workspace';
      setToast({ message: msg, severity: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!workspaces) {
    return <BrandLoader fullScreen message="Loading workspace directory..." />;
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto pb-10">
      {/* ── 1. Hero Header Section ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-line pb-5">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="eyebrow">BRANCH LOCATIONS • MULTI-SITE ARCHITECTURE</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              Workspaces & Branches
            </h1>
            <Badge variant="brand" className="font-mono text-xs">
              {visibleWorkspaces.length} {visibleWorkspaces.length === 1 ? 'Location' : 'Locations'}
            </Badge>
          </div>
          <p className="text-xs text-muted sm:text-sm max-w-2xl mt-0.5">
            Manage attendance registers, geofences, and shift schedules per physical campus or office location under{' '}
            <strong className="text-ink">{companyName}</strong>.
          </p>
        </div>

        {/* Action Button */}
        {isOwner && (
          <Button
            variant="brand"
            size="default"
            onClick={handleOpenAddModal}
            className="self-start sm:self-center shrink-0 gap-2 shadow-theme-btn"
          >
            <Plus className="size-4 stroke-[2.5]" />
            <span>New Workspace</span>
          </Button>
        )}
      </div>

      {/* ── 2. Filter & Summary Bar ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Filter */}
        <div className="w-full sm:w-80">
          <Input
            placeholder="Search branches by name, city, state..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            leading={<Search className="size-4" />}
            trailing={
              searchFilter ? (
                <button
                  type="button"
                  onClick={() => setSearchFilter('')}
                  className="cursor-pointer text-muted hover:text-ink transition-colors p-0.5"
                  aria-label="Clear branch search"
                >
                  <X className="size-3.5" />
                </button>
              ) : undefined
            }
            className="h-9 text-xs"
          />
        </div>

        {/* Active Branch Status Pill */}
        <div className="flex items-center gap-2 text-xs font-mono text-muted">
          <span>Active Session:</span>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-primary-200 bg-primary-50 px-2.5 py-1 font-semibold text-primary-800 dark:border-primary-900/60 dark:bg-primary-950/60 dark:text-primary-300">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            {currentWorkspace?.name || 'No Workspace Selected'}
          </span>
        </div>
      </div>

      {/* ── 3. Workspace Responsive Cards Grid ── */}
      {filteredWorkspaces.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl border border-line bg-subtle text-muted mb-3">
            <Store className="size-6 text-faint" />
          </div>
          <h3 className="text-base font-semibold text-ink">
            {searchFilter ? 'No matching branches found' : 'No administrative workspaces available'}
          </h3>
          <p className="text-xs text-muted max-w-md mt-1 mb-4">
            {searchFilter
              ? `No branch records matched "${searchFilter}". Try adjusting your search query.`
              : 'Workspaces where you are assigned as an Administrator or Owner will appear in this directory.'}
          </p>
          {searchFilter ? (
            <Button variant="outline" size="sm" onClick={() => setSearchFilter('')}>
              Clear Filter
            </Button>
          ) : isOwner ? (
            <Button variant="brand" size="sm" onClick={handleOpenAddModal}>
              <Plus className="size-3.5 mr-1" />
              Create First Workspace
            </Button>
          ) : null}
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredWorkspaces.map((ws) => {
            const isSelected = ws.id === currentWorkspace?.id;
            const role = getWorkspaceRole(ws);

            return (
              <Card
                key={ws.id}
                onClick={() => handleSelectWorkspace(ws)}
                className={cn(
                  'group relative flex flex-col justify-between overflow-hidden transition-all duration-200 cursor-pointer p-5',
                  isSelected
                    ? 'border-primary-500 ring-2 ring-primary-500/20 bg-primary-50/20 dark:bg-primary-950/20 shadow-md'
                    : 'border-line hover:border-line-strong hover:shadow-card hover:-translate-y-0.5'
                )}
              >
                {/* Active Indicator Strip on Top Edge */}
                {isSelected && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-primary-600" />
                )}

                <div>
                  {/* Top Header Row: Branch Avatar & Status Badges */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div
                      className={cn(
                        'flex size-10 shrink-0 items-center justify-center rounded-xl font-mono text-xs font-bold transition-colors shadow-xs',
                        isSelected
                          ? 'bg-primary-600 text-white'
                          : 'bg-primary-50 text-primary-700 ring-1 ring-primary-100 ring-inset dark:bg-primary-950 dark:text-primary-300 dark:ring-primary-900/60 group-hover:bg-primary-600 group-hover:text-white'
                      )}
                    >
                      {initials(ws.name)}
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {/* Role Badge */}
                      <span
                        className={cn(
                          'rounded-md px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider',
                          role === 'OWNER'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                            : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
                        )}
                      >
                        {role}
                      </span>

                      {/* Active Status Pill */}
                      {isSelected && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          <Check className="size-3 stroke-[2.5]" />
                          ACTIVE
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Branch Title & Description */}
                  <h3 className="text-base font-semibold text-ink group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-1">
                    {ws.name}
                  </h3>

                  {/* Address with MapPin */}
                  <div className="flex items-center gap-1.5 text-xs text-muted mt-1.5 line-clamp-1">
                    <MapPin className="size-3.5 shrink-0 text-faint group-hover:text-primary-500 transition-colors" />
                    <span>
                      {ws.address ? `${ws.address}, ` : ''}
                      {ws.city || 'Regional Center'}, {ws.state || ''} {ws.zipCode || ''}
                    </span>
                  </div>

                  {/* Badges / Metrics Strip */}
                  <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-line/60">
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-muted bg-subtle px-2 py-0.5 rounded-md">
                      <Radio className="size-3 text-emerald-600 dark:text-emerald-400" />
                      100m Geofence
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-muted bg-subtle px-2 py-0.5 rounded-md">
                      <Users className="size-3 text-primary-600 dark:text-primary-400" />
                      {ws.employeeCount || 0} Staff
                    </span>
                  </div>
                </div>

                {/* Footer Switch Action Row */}
                <div className="flex items-center justify-between border-t border-line mt-4 pt-3">
                  <span className="text-[11px] text-faint font-mono">
                    {isSelected ? 'Currently in session' : 'Click to activate'}
                  </span>
                  <div
                    className={cn(
                      'inline-flex items-center gap-1 text-xs font-semibold transition-transform group-hover:translate-x-0.5',
                      isSelected
                        ? 'text-primary-600 dark:text-primary-400'
                        : 'text-muted group-hover:text-ink'
                    )}
                  >
                    <span>{isSelected ? 'In Workspace' : 'Launch Branch'}</span>
                    <ArrowRight className="size-3.5" />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── 4. Shadcn Dialog: Add Workspace & Branch ── */}
      <Dialog
        open={isAddModalOpen}
        onOpenChange={(open) => {
          if (!open && hasNoWorkspaces) return;
          setIsAddModalOpen(open);
        }}
      >
        <DialogContent
          className="max-w-md"
          hideClose={hasNoWorkspaces}
          onPointerDownOutside={(e) => {
            if (hasNoWorkspaces) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (hasNoWorkspaces) e.preventDefault();
          }}
        >
          <form onSubmit={handleCreateWorkspace}>
            <DialogHeader
              icon={<Building2 className="size-5 text-primary-600 dark:text-primary-400" />}
              title={hasNoWorkspaces ? 'Create Your First Workspace' : 'Add Workspace & Branch'}
              description={
                hasNoWorkspaces
                  ? `Welcome to ${companyName}! Please create your first branch or office workspace to get started.`
                  : `Add a physical branch location, warehouse, or regional office under ${companyName}.`
              }
            />

            <DialogBody className="space-y-4 pt-2">
              <Field label="Workspace / Branch Name *" htmlFor="ws-name" error={formErrors.name}>
                <Input
                  id="ws-name"
                  placeholder="e.g. Northeast Regional Branch"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: '' }));
                  }}
                  autoFocus
                />
              </Field>

              <Field label="Street Address *" htmlFor="ws-address" error={formErrors.addressLine1}>
                <Input
                  id="ws-address"
                  placeholder="e.g. 500 Enterprise Way, Suite 200"
                  value={addressLine1}
                  onChange={(e) => {
                    setAddressLine1(e.target.value);
                    if (formErrors.addressLine1) setFormErrors((prev) => ({ ...prev, addressLine1: '' }));
                  }}
                />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-6">
                  <Field label="City *" htmlFor="ws-city" error={formErrors.city}>
                    <Input
                      id="ws-city"
                      placeholder="e.g. Austin"
                      value={city}
                      onChange={(e) => {
                        setCity(e.target.value);
                        if (formErrors.city) setFormErrors((prev) => ({ ...prev, city: '' }));
                      }}
                    />
                  </Field>
                </div>

                <div className="sm:col-span-3">
                  <Field label="State *" htmlFor="ws-state" error={formErrors.state}>
                    <Input
                      id="ws-state"
                      placeholder="TX"
                      maxLength={2}
                      value={state}
                      onChange={(e) => {
                        const clean = e.target.value.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase();
                        setState(clean);
                        if (formErrors.state) setFormErrors((prev) => ({ ...prev, state: '' }));
                      }}
                      className="uppercase font-mono"
                    />
                  </Field>
                </div>

                <div className="sm:col-span-3">
                  <Field label="ZIP Code *" htmlFor="ws-zip" error={formErrors.zipCode}>
                    <Input
                      id="ws-zip"
                      placeholder="78701"
                      inputMode="numeric"
                      autoComplete="postal-code"
                      maxLength={10}
                      value={zipCode}
                      onChange={(e) => {
                        const sanitized = e.target.value.replace(/[^\d-]/g, '').slice(0, 10);
                        setZipCode(sanitized);
                        if (formErrors.zipCode) setFormErrors((prev) => ({ ...prev, zipCode: '' }));
                      }}
                      className="font-mono"
                    />
                  </Field>
                </div>
              </div>
            </DialogBody>

            <DialogFooter>
              {hasNoWorkspaces ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="default"
                  disabled={isSubmitting}
                  onClick={async () => {
                    await logout();
                    navigate('/login');
                  }}
                  className="mr-auto text-xs text-muted hover:text-ink"
                >
                  Sign Out
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className={hasNoWorkspaces ? "hidden" : undefined}
                size="default"
                disabled={isSubmitting}
                onClick={() => setIsAddModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="brand"
                size="default"
                disabled={!name.trim() || isSubmitting}
                loading={isSubmitting}
              >
                {isSubmitting ? 'Creating Branch...' : hasNoWorkspaces ? 'Create & Continue' : 'Create Workspace'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── 5. Toast Feedback Notification ── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-drop-in">
          <div
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-xl text-xs font-semibold text-white transition-all',
              toast.severity === 'error' ? 'bg-rose-600' : 'bg-ink'
            )}
          >
            {toast.severity === 'success' ? (
              <Check className="size-4 text-emerald-400 stroke-[2.5]" />
            ) : null}
            <span>{toast.message}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="ml-2 cursor-pointer text-white/70 hover:text-white p-0.5"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkspaceSelectPage;
