import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import {
  Building2,
  User,
  MapPin,
  Printer,
  Clock,
  Sparkles,
  Eye,
  EyeOff,
  Shuffle,
  ShieldCheck,
  Check,
  Loader2,
} from 'lucide-react';
import { fetchPlans } from '../../api/plans.api';
import { createOrganization, type CreateOrganizationPayload } from '../../api/users.api';
import type { AdminUserRecord, ServiceType, PlanConfig } from '../../types';
import { formatCurrency } from '../../utils/formatCurrency';
import { toast } from 'sonner';

export interface AddOrganizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrganizationCreated: (record: AdminUserRecord) => void;
}

export const AddOrganizationModal: React.FC<AddOrganizationModalProps> = ({
  isOpen,
  onClose,
  onOrganizationCreated,
}) => {
  // Organization profile
  const [tenantName, setTenantName] = useState('');
  const [billingEmail, setBillingEmail] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');

  // Primary Owner
  const [fullName, setFullName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [useBillingEmailForOwner, setUseBillingEmailForOwner] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Initial Workspace
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceAddress, setWorkspaceAddress] = useState('');
  const [zipCode, setZipCode] = useState('');

  // Subscription Service & Plan
  const [plans, setPlans] = useState<PlanConfig[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const [serviceType, setServiceType] = useState<ServiceType>('CHECK_PRINTING');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsLoadingPlans(true);
      fetchPlans()
        .then((fetched) => {
          setPlans(fetched);
          const first = fetched.find((p) => p.status === 'ACTIVE' && p.service === serviceType);
          if (first) {
            setSelectedPlanId(first.id);
          } else if (fetched.length > 0) {
            setSelectedPlanId(fetched[0].id);
          }
        })
        .catch(() => {
          toast.error('Failed to load available subscription plans.');
        })
        .finally(() => {
          setIsLoadingPlans(false);
        });
    }
  }, [isOpen]);

  // Sync plan when service type changes
  const availablePlans = plans.filter((p) => p.status === 'ACTIVE' && p.service === serviceType);

  const handleServiceChange = (service: ServiceType) => {
    setServiceType(service);
    const firstPlan = plans.find((p) => p.status === 'ACTIVE' && p.service === service);
    if (firstPlan) {
      setSelectedPlanId(firstPlan.id);
    }
  };

  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
    let generated = '';
    for (let i = 0; i < 14; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(generated);
    setShowPassword(true);
    toast.success('Random temporary password generated.');
  };

  const handleBillingEmailChange = (val: string) => {
    setBillingEmail(val);
    if (useBillingEmailForOwner) {
      setOwnerEmail(val);
    }
  };

  const handleToggleSameEmail = (checked: boolean) => {
    setUseBillingEmailForOwner(checked);
    if (checked) {
      setOwnerEmail(billingEmail);
    }
  };

  const selectedPlan = availablePlans.find((p) => p.id === selectedPlanId) || availablePlans[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!tenantName.trim()) {
      toast.error('Organization legal name is required.');
      return;
    }
    if (!billingEmail.trim()) {
      toast.error('Billing email is required.');
      return;
    }
    if (!fullName.trim()) {
      toast.error('Organization owner full name is required.');
      return;
    }
    const resolvedOwnerEmail = (useBillingEmailForOwner ? billingEmail : ownerEmail).trim();
    if (!resolvedOwnerEmail) {
      toast.error('Owner account email is required.');
      return;
    }

    setIsSubmitting(true);

    try {
      const planDurationStr = selectedPlan
        ? `${selectedPlan.durationCount} ${selectedPlan.durationUnit.toLowerCase()}${selectedPlan.durationCount > 1 ? 's' : ''}`
        : '1 month';

      const payload: CreateOrganizationPayload = {
        tenantName: tenantName.trim(),
        billingEmail: billingEmail.trim(),
        fullName: fullName.trim(),
        email: resolvedOwnerEmail,
        password: password.trim() || undefined,
        city: city.trim() || 'New York',
        state: state.trim() || 'NY',
        workspaceName: workspaceName.trim() || `${tenantName.trim()} HQ`,
        workspaceAddress: workspaceAddress.trim(),
        zipCode: zipCode.trim(),
        serviceType,
        planName: selectedPlan?.name || 'Standard Enterprise',
        planPrice: selectedPlan?.price ?? 49,
        planDuration: planDurationStr,
      };

      const newRecord = await createOrganization(payload);
      toast.success(`Organization "${newRecord.tenantName}" registered successfully.`);
      onOrganizationCreated(newRecord);
      onClose();
    } catch {
      toast.error('Failed to register organization. Please retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Organization"
      subtitle="Provision a complete tenant account, primary owner credentials, default workspace, and product subscription in a single atomic transaction."
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Organization Details */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-1 border-b border-line">
            <Building2 className="size-4 text-primary-600" />
            <h3 className="text-xs font-bold text-ink uppercase tracking-wider font-mono">
              1. Organization Legal Profile
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-ink mb-1">
                Company Legal Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Acme Global Logistics LLC"
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                className="w-full border border-line rounded-lg px-3 py-2 text-xs bg-panel text-ink focus:border-primary-600 focus:ring-2 focus:ring-primary-500/10 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-ink mb-1">
                Billing & Accounts Email <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                required
                placeholder="billing@acme.com"
                value={billingEmail}
                onChange={(e) => handleBillingEmailChange(e.target.value)}
                className="w-full border border-line rounded-lg px-3 py-2 text-xs bg-panel text-ink focus:border-primary-600 focus:ring-2 focus:ring-primary-500/10 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-ink mb-1">Headquarters City</label>
                <input
                  type="text"
                  placeholder="Austin"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full border border-line rounded-lg px-3 py-2 text-xs bg-panel text-ink focus:border-primary-600 focus:ring-2 focus:ring-primary-500/10 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-ink mb-1">State / Region</label>
                <input
                  type="text"
                  maxLength={2}
                  placeholder="TX"
                  value={state}
                  onChange={(e) => setState(e.target.value.toUpperCase())}
                  className="w-full border border-line rounded-lg px-3 py-2 text-xs bg-panel text-ink focus:border-primary-600 focus:ring-2 focus:ring-primary-500/10 focus:outline-none uppercase font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Primary Account Owner Credentials */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-1 border-b border-line">
            <User className="size-4 text-primary-600" />
            <h3 className="text-xs font-bold text-ink uppercase tracking-wider font-mono">
              2. Primary Owner Credentials
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-ink mb-1">
                Owner Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Johnathan Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full border border-line rounded-lg px-3 py-2 text-xs bg-panel text-ink focus:border-primary-600 focus:ring-2 focus:ring-primary-500/10 focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-ink">
                  Account Sign-in Email <span className="text-rose-500">*</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-muted select-none">
                  <input
                    type="checkbox"
                    checked={useBillingEmailForOwner}
                    onChange={(e) => handleToggleSameEmail(e.target.checked)}
                    className="rounded border-line text-primary-600 focus:ring-primary-500 size-3"
                  />
                  <span>Same as Billing</span>
                </label>
              </div>
              <input
                type="email"
                required
                disabled={useBillingEmailForOwner}
                placeholder="owner@acme.com"
                value={useBillingEmailForOwner ? billingEmail : ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                className="w-full border border-line rounded-lg px-3 py-2 text-xs bg-panel text-ink focus:border-primary-600 focus:ring-2 focus:ring-primary-500/10 focus:outline-none disabled:bg-subtle disabled:text-muted"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-ink mb-1">
                Temporary Password (leave blank to send password setup email)
              </label>
              <div className="relative flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Auto-generated secure password or enter custom"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border border-line rounded-lg pl-3 pr-9 py-2 text-xs bg-panel text-ink font-mono focus:border-primary-600 focus:ring-2 focus:ring-primary-500/10 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-ink cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGeneratePassword}
                  icon={<Shuffle className="size-3 text-muted" />}
                  className="text-xs shrink-0"
                >
                  Generate
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Default Workspace Location */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-1 border-b border-line">
            <MapPin className="size-4 text-primary-600" />
            <h3 className="text-xs font-bold text-ink uppercase tracking-wider font-mono">
              3. Initial Workspace Location
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-ink mb-1">Workspace Name</label>
              <input
                type="text"
                placeholder={tenantName ? `${tenantName} Main HQ` : 'Austin Headquarters Yard'}
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                className="w-full border border-line rounded-lg px-3 py-2 text-xs bg-panel text-ink focus:border-primary-600 focus:ring-2 focus:ring-primary-500/10 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-ink mb-1">ZIP / Postal Code</label>
              <input
                type="text"
                maxLength={5}
                placeholder="78758"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                className="w-full border border-line rounded-lg px-3 py-2 text-xs bg-panel text-ink font-mono focus:border-primary-600 focus:ring-2 focus:ring-primary-500/10 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-bold text-ink mb-1">Street Address</label>
              <input
                type="text"
                placeholder="11200 Metric Blvd, Suite 400"
                value={workspaceAddress}
                onChange={(e) => setWorkspaceAddress(e.target.value)}
                className="w-full border border-line rounded-lg px-3 py-2 text-xs bg-panel text-ink focus:border-primary-600 focus:ring-2 focus:ring-primary-500/10 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Subscription & Service Configuration */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-1 border-b border-line">
            <Sparkles className="size-4 text-primary-600" />
            <h3 className="text-xs font-bold text-ink uppercase tracking-wider font-mono">
              4. SaaS Product Access & Plan
            </h3>
          </div>

          {/* Service Selector Tabs */}
          <div className="grid grid-cols-3 gap-2 p-1 bg-subtle rounded-xl border border-line">
            <button
              type="button"
              onClick={() => handleServiceChange('CHECK_PRINTING')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                serviceType === 'CHECK_PRINTING'
                  ? 'bg-panel text-primary-600 shadow-xs border border-line/60'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <Printer className="size-3.5" />
              <span>Check Printing</span>
            </button>

            <button
              type="button"
              onClick={() => handleServiceChange('CLOCK_IN_CLOCK_OUT')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                serviceType === 'CLOCK_IN_CLOCK_OUT'
                  ? 'bg-panel text-primary-600 shadow-xs border border-line/60'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <Clock className="size-3.5" />
              <span>ClockIn-ClockOut</span>
            </button>

            <button
              type="button"
              onClick={() => handleServiceChange('BOTH')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                serviceType === 'BOTH'
                  ? 'bg-panel text-purple-600 shadow-xs border border-line/60'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <ShieldCheck className="size-3.5" />
              <span>Both (Bundle)</span>
            </button>
          </div>

          {/* Plan Options Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
            {isLoadingPlans ? (
              <div className="col-span-full py-6 flex items-center justify-center text-xs text-muted">
                <Loader2 className="size-4 animate-spin text-primary-600 mr-2" />
                Loading dynamic plans...
              </div>
            ) : availablePlans.length === 0 ? (
              <div className="col-span-full py-4 text-center text-xs text-muted">
                No active plans found for this service.
              </div>
            ) : (
              availablePlans.map((p) => {
                const isSelected = selectedPlanId === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPlanId(p.id)}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      isSelected
                        ? 'border-primary-600 bg-primary-50/50 ring-2 ring-primary-500/20'
                        : 'border-line bg-panel hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-ink truncate">{p.name}</span>
                      {isSelected && <Check className="size-3.5 text-primary-600 shrink-0" />}
                    </div>
                    <div className="text-base font-extrabold text-ink font-mono">
                      {formatCurrency(p.price)}
                    </div>
                    <div className="text-[10px] text-muted font-medium mt-0.5">
                      {p.durationCount} {p.durationUnit.toLowerCase()}
                      {p.durationCount > 1 ? 's' : ''} duration
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isSubmitting}
            icon={<ShieldCheck className="size-4" />}
          >
            Provision & Launch Organization
          </Button>
        </div>
      </form>
    </Modal>
  );
};
