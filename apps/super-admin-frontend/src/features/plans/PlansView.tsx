import React, { useState, useEffect, useCallback } from 'react';
import { Plus, RefreshCcw, Printer, RefreshCw, Layers, Sparkles, Inbox } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { CardSkeleton, TableSkeleton } from '../../components/common/LoadingState';
import { PlanCard } from './PlanCard';
import { CreateEditPlanModal } from './CreateEditPlanModal';
import { SubscriptionTable } from './SubscriptionTable';
import { ManageSubscriptionModal } from './ManageSubscriptionModal';
import {
  fetchPlans,
  createPlan,
  updatePlan,
  deletePlan,
  fetchSubscriptions,
  updateSubscription,
  syncStripeWebhooks,
} from '../../api/plans.api';
import type {
  PlanConfig,
  SubscriptionRecord,
  ServiceType,
  DurationUnit,
  SubscriptionStatus,
} from '../../types';
import { toast } from 'sonner';

export const PlansView: React.FC = () => {
  const [plans, setPlans] = useState<PlanConfig[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [subTotal, setSubTotal] = useState(0);
  const [subPage, setSubPage] = useState(1);
  const [subPageSize, setSubPageSize] = useState(10);

  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [isLoadingSubs, setIsLoadingSubs] = useState(true);
  const [serviceFilter, setServiceFilter] = useState<string>('ALL');
  const [durationFilter, setDurationFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isSyncing, setIsSyncing] = useState(false);

  // Modals state
  const [editingPlan, setEditingPlan] = useState<PlanConfig | null>(null);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [selectedSub, setSelectedSub] = useState<SubscriptionRecord | null>(null);
  const [isManageSubModalOpen, setIsManageSubModalOpen] = useState(false);

  const loadPlans = async () => {
    setIsLoadingPlans(true);
    try {
      const fetchedPlans = await fetchPlans();
      setPlans(fetchedPlans);
    } catch {
      toast.error('Failed to load plans from platform.');
    } finally {
      setIsLoadingPlans(false);
    }
  };

  const loadSubscriptions = useCallback(async () => {
    setIsLoadingSubs(true);
    try {
      const res = await fetchSubscriptions({
        page: subPage,
        pageSize: subPageSize,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        service: serviceFilter !== 'ALL' ? serviceFilter : undefined,
      });
      setSubscriptions(res.items);
      setSubTotal(res.pagination.total);
    } catch {
      toast.error('Failed to load subscriptions.');
    } finally {
      setIsLoadingSubs(false);
    }
  }, [subPage, subPageSize, statusFilter, serviceFilter]);

  useEffect(() => {
    loadPlans();
  }, []);

  useEffect(() => {
    loadSubscriptions();
  }, [loadSubscriptions]);

  const handleServiceChange = (service: string) => {
    setServiceFilter(service);
    setSubPage(1);
  };

  const handleStatusChange = (status: string) => {
    setStatusFilter(status);
    setSubPage(1);
  };

  const handleSyncStripe = async () => {
    setIsSyncing(true);
    try {
      const res = await syncStripeWebhooks();
      toast.success(`Stripe synced successfully. ${res.syncedCount} customer accounts verified.`);
      loadSubscriptions();
    } catch {
      toast.error('Failed to sync Stripe webhooks.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingPlan(null);
    setIsPlanModalOpen(true);
  };

  const handleOpenEditModal = (plan: PlanConfig) => {
    setEditingPlan(plan);
    setIsPlanModalOpen(true);
  };

  const handleSavePlan = async (payload: {
    id?: string;
    name: string;
    service: ServiceType;
    durationCount: number;
    durationUnit: DurationUnit;
    price: number;
    status: 'ACTIVE' | 'INACTIVE';
  }) => {
    try {
      if (payload.id) {
        const updated = await updatePlan(payload.id, payload);
        setPlans((prev) => prev.map((p) => (p.id === payload.id ? updated : p)));
        toast.success(`Plan "${payload.name}" updated successfully.`);
      } else {
        const created = await createPlan(payload);
        setPlans((prev) => [created, ...prev]);
        toast.success(`New plan "${payload.name}" created successfully.`);
      }
    } catch {
      toast.error('Failed to save plan configuration.');
    }
  };

  const handleDeletePlan = async (planId: string) => {
    const planToDelete = plans.find((p) => p.id === planId);
    if (!window.confirm(`Are you sure you want to delete the plan "${planToDelete?.name}"?`)) {
      return;
    }
    try {
      await deletePlan(planId);
      setPlans((prev) => prev.filter((p) => p.id !== planId));
      toast.success('Plan deleted successfully.');
    } catch {
      toast.error('Failed to delete plan.');
    }
  };

  const handleManageSubClick = (sub: SubscriptionRecord) => {
    setSelectedSub(sub);
    setIsManageSubModalOpen(true);
  };

  const handleSaveSubscription = async (
    subId: string,
    planId: string,
    planName: string,
    service: ServiceType,
    durationCount: number,
    durationUnit: DurationUnit,
    status: SubscriptionStatus,
    amount: number
  ) => {
    try {
      await updateSubscription(subId, {
        planId,
        planName,
        service,
        durationCount,
        durationUnit,
        status,
        amount,
      });
      loadSubscriptions();
      toast.success(`Tenant subscription updated to ${planName}.`);
    } catch {
      toast.error('Failed to update tenant subscription.');
    }
  };

  // Filtered plans
  const filteredPlans = plans.filter((plan) => {
    const matchesService = serviceFilter === 'ALL' || plan.service === serviceFilter;

    let matchesDuration = true;
    if (durationFilter === 'MONTHLY') {
      matchesDuration = plan.durationUnit === 'MONTH' && plan.durationCount === 1;
    } else if (durationFilter === 'QUARTERLY') {
      matchesDuration = plan.durationUnit === 'MONTH' && plan.durationCount === 3;
    } else if (durationFilter === 'SEMI_ANNUAL') {
      matchesDuration = plan.durationUnit === 'MONTH' && plan.durationCount === 6;
    } else if (durationFilter === 'YEARLY') {
      matchesDuration =
        (plan.durationUnit === 'YEAR' && plan.durationCount === 1) ||
        (plan.durationUnit === 'MONTH' && plan.durationCount === 12);
    }

    return matchesService && matchesDuration;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Title Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-1">
        <div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">
            Payment & Plan Management
          </h1>
          <p className="text-xs sm:text-sm text-muted">
            Create and configure subscription plans for Check Printing and ClockIn-ClockOut with flexible duration (days, months, years) and custom pricing.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              loadPlans();
              loadSubscriptions();
            }}
            isLoading={isLoadingPlans || isLoadingSubs}
            icon={<RefreshCw className="size-3.5 text-muted" />}
          >
            Refresh
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenCreateModal}
            icon={<Plus className="size-3.5" />}
          >
            Create New Plan
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncStripe}
            isLoading={isSyncing}
            icon={<RefreshCcw className="size-3.5 text-primary-600" />}
          >
            Force Stripe Sync
          </Button>
        </div>
      </div>

      {/* Full Access Banner */}
      <div className="bg-gradient-to-r from-primary-50 to-indigo-50 border border-primary-100 rounded-[var(--radius-card)] p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-lg bg-primary-600 text-white flex items-center justify-center shrink-0">
            <Sparkles className="size-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-ink">Flexible Duration & Full Service Access</h3>
            <p className="text-[11px] text-muted">
              Plans provide full access to selected services: <strong>Check Printing</strong>, <strong>ClockIn-ClockOut</strong>, or <strong>Both</strong> with custom duration periods (1 month, 3 months, 6 months, 1 year, or custom days/months).
            </p>
          </div>
        </div>
      </div>

      {/* Filter Bar for Configured Plans */}
      <div className="bg-canvas border border-line rounded-[var(--radius-card)] p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-subtle">
        {/* Service Switcher Tabs */}
        <div className="flex items-center bg-subtle p-1 rounded-[var(--radius-control)] border border-line flex-wrap gap-1">
          <button
            onClick={() => handleServiceChange('ALL')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              serviceFilter === 'ALL'
                ? 'bg-canvas text-ink shadow-sm border border-line/60'
                : 'text-muted hover:text-ink'
            }`}
          >
            All Services
          </button>

          <button
            onClick={() => handleServiceChange('CHECK_PRINTING')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              serviceFilter === 'CHECK_PRINTING'
                ? 'bg-canvas text-primary-600 shadow-sm border border-line/60'
                : 'text-muted hover:text-ink'
            }`}
          >
            <Printer className="size-3.5 text-primary-600" />
            <span>Check Printing</span>
          </button>

          <button
            onClick={() => handleServiceChange('CLOCK_IN_CLOCK_OUT')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              serviceFilter === 'CLOCK_IN_CLOCK_OUT'
                ? 'bg-canvas text-primary-600 shadow-sm border border-line/60'
                : 'text-muted hover:text-ink'
            }`}
          >
            <RefreshCw className="size-3.5 text-primary-600 stroke-[2.4]" />
            <span>ClockIn-ClockOut</span>
          </button>

          <button
            onClick={() => handleServiceChange('BOTH')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              serviceFilter === 'BOTH'
                ? 'bg-canvas text-purple-600 shadow-sm border border-line/60'
                : 'text-muted hover:text-ink'
            }`}
          >
            <Layers className="size-3.5 text-purple-600" />
            <span>Both (Bundle)</span>
          </button>
        </div>

        {/* Duration Filter Pills */}
        <div className="flex items-center gap-1.5 self-start md:self-auto flex-wrap">
          <span className="text-xs font-semibold text-muted mr-1.5">Duration:</span>
          {(
            [
              { id: 'ALL', label: 'All Durations' },
              { id: 'MONTHLY', label: '1 Month' },
              { id: 'QUARTERLY', label: '3 Months' },
              { id: 'SEMI_ANNUAL', label: '6 Months' },
              { id: 'YEARLY', label: '1 Year' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              onClick={() => setDurationFilter(opt.id)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                durationFilter === opt.id
                  ? 'bg-brand text-white shadow-button'
                  : 'bg-canvas border border-line text-ink-soft hover:bg-subtle'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Configured Plans with Loading Skeleton */}
      {isLoadingPlans ? (
        <CardSkeleton count={3} />
      ) : filteredPlans.length === 0 ? (
        <Card className="text-center py-12">
          <Inbox className="size-8 text-slate-300 mx-auto mb-2" />
          <h3 className="text-xs font-bold text-ink">No plans match the selected filters</h3>
          <p className="text-muted text-xs mt-0.5">Try selecting another service or duration, or configure a new plan.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPlans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onEdit={handleOpenEditModal}
              onDelete={handleDeletePlan}
            />
          ))}
        </div>
      )}

      {/* Subscriptions Ledger Section */}
      <Card padding="none" className="overflow-hidden">
        <div className="p-5 border-b border-line flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-ink">
              Tenant Subscription & Stripe Invoicing Ledger
            </h2>
            <p className="text-xs text-muted">
              Live multi-tenant subscription records tied to Stripe Customer IDs across Check Printing, ClockIn-ClockOut, and Bundles.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="text-xs border border-line rounded-[var(--radius-control)] px-3 py-1.5 bg-subtle text-ink-soft font-semibold focus:ring-2 focus:ring-primary-500 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="TRIALING">TRIALING</option>
              <option value="PAST_DUE">PAST_DUE</option>
              <option value="CANCELED">CANCELED</option>
            </select>
          </div>
        </div>

        {isLoadingSubs ? (
          <TableSkeleton rows={subPageSize > 10 ? 10 : subPageSize} columns={6} />
        ) : (
          <SubscriptionTable
            subscriptions={subscriptions}
            total={subTotal}
            currentPage={subPage}
            pageSize={subPageSize}
            onPageChange={setSubPage}
            onPageSizeChange={setSubPageSize}
            onManage={handleManageSubClick}
          />
        )}
      </Card>

      {/* Create / Edit Plan Modal */}
      <CreateEditPlanModal
        plan={editingPlan}
        isOpen={isPlanModalOpen}
        onClose={() => setIsPlanModalOpen(false)}
        onSave={handleSavePlan}
      />

      {/* Manage Tenant Subscription Modal */}
      <ManageSubscriptionModal
        subscription={selectedSub}
        plans={plans}
        isOpen={isManageSubModalOpen}
        onClose={() => setIsManageSubModalOpen(false)}
        onSave={handleSaveSubscription}
      />
    </div>
  );
};
