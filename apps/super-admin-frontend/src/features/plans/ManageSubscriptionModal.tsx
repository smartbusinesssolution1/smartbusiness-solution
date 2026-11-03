import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatDuration, formatDurationShort } from '../../utils/formatDuration';
import type {
  SubscriptionRecord,
  PlanConfig,
  ServiceType,
  DurationUnit,
  SubscriptionStatus,
} from '../../types';

export interface ManageSubscriptionModalProps {
  subscription: SubscriptionRecord | null;
  plans: PlanConfig[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    subId: string,
    planId: string,
    planName: string,
    service: ServiceType,
    durationCount: number,
    durationUnit: DurationUnit,
    status: SubscriptionStatus,
    amount: number
  ) => void;
}

export const ManageSubscriptionModal: React.FC<ManageSubscriptionModalProps> = ({
  subscription,
  plans,
  isOpen,
  onClose,
  onSave,
}) => {
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<SubscriptionStatus>('ACTIVE');

  useEffect(() => {
    if (subscription) {
      setSelectedPlanId(subscription.planId);
      setSelectedStatus(subscription.status);
    }
  }, [subscription, isOpen]);

  if (!subscription) return null;

  const currentPlan = plans.find((p) => p.id === selectedPlanId) || plans[0];

  const handleSave = () => {
    if (!currentPlan) return;
    onSave(
      subscription.id,
      currentPlan.id,
      currentPlan.name,
      currentPlan.service,
      currentPlan.durationCount,
      currentPlan.durationUnit,
      selectedStatus,
      currentPlan.price
    );
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Manage Tenant Subscription"
      subtitle={`${subscription.tenantName} (${subscription.location})`}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave}>
            Save Changes
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-xs">
        <div>
          <label className="block font-semibold text-ink-soft mb-1">Assigned Plan</label>
          <select
            value={selectedPlanId}
            onChange={(e) => setSelectedPlanId(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 bg-white text-ink font-semibold shadow-xs hover:border-slate-400 focus:border-primary-600 focus:ring-4 focus:ring-primary-500/15 focus:outline-none cursor-pointer transition-all"
          >
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} - {formatCurrency(p.price)}/
                {formatDurationShort(p.durationCount, p.durationUnit)} ({p.service})
              </option>
            ))}
          </select>
        </div>

        {currentPlan && (
          <div className="bg-canvas border border-line rounded-lg p-3 space-y-1.5">
            <div className="flex justify-between text-muted">
              <span>Service:</span>
              <strong className="text-ink">
                {currentPlan.service === 'CHECK_PRINTING'
                  ? 'Check Printing'
                  : currentPlan.service === 'CLOCK_IN_CLOCK_OUT'
                  ? 'ClockIn-ClockOut'
                  : 'Both (Bundle)'}
              </strong>
            </div>
            <div className="flex justify-between text-muted">
              <span>Duration:</span>
              <strong className="text-ink">
                {formatDuration(currentPlan.durationCount, currentPlan.durationUnit)}
              </strong>
            </div>
            <div className="flex justify-between text-muted">
              <span>Billed Amount:</span>
              <strong className="text-ink font-mono font-bold">
                {formatCurrency(currentPlan.price)}
              </strong>
            </div>
          </div>
        )}

        <div>
          <label className="block font-semibold text-ink-soft mb-1">Subscription Status</label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as SubscriptionStatus)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 bg-white text-ink font-semibold shadow-xs hover:border-slate-400 focus:border-primary-600 focus:ring-4 focus:ring-primary-500/15 focus:outline-none cursor-pointer transition-all"
          >
            <option value="ACTIVE">ACTIVE</option>
            <option value="TRIALING">TRIALING</option>
            <option value="PAST_DUE">PAST_DUE</option>
            <option value="CANCELED">CANCELED</option>
          </select>
        </div>

        <div>
          <label className="block font-semibold text-ink-soft mb-1">Stripe Customer ID</label>
          <input
            type="text"
            readOnly
            value={subscription.stripeCustomerId}
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 bg-slate-100 text-slate-500 font-mono text-xs cursor-not-allowed select-all"
          />
        </div>
      </div>
    </Modal>
  );
};
