import React, { useState } from 'react';
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
} from 'lucide-react';
import { MOCK_PLANS } from '../../api/plans.api';
import { createOrganization, type CreateOrganizationPayload } from '../../api/users.api';
import type { AdminUserRecord, ServiceType } from '../../types';
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
  const [serviceType, setServiceType] = useState<ServiceType>('CHECK_PRINTING');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('plan_cp_monthly');

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync plan when service type changes
  const availablePlans = MOCK_PLANS.filter((p) => p.status === 'ACTIVE' && p.service === serviceType);

  const handleServiceChange = (service: ServiceType) => {
    setServiceType(service);
    const firstPlan = MOCK_PLANS.find((p) => p.status === 'ACTIVE' && p.service === service);
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
      title="Add New Organization"
      subtitle="Register an enterprise tenant, provision primary owner credentials, and attach subscription plans"
      maxWidth="2xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-[11px] text-muted flex items-center gap-1.5 font-medium">
            <ShieldCheck className="size-3.5 text-emerald-600 shrink-0" />
            <span>Multi-tenant isolated container provisioned automatically</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} type="button" disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmit}
              type="button"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Provisioning...' : 'Create Organization'}
            </Button>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5 text-xs">
        {/* Section 1: Organization Details */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-1 border-b border-line">
            <Building2 className="size-4 text-primary-600" />
            <h3 className="font-bold text-ink text-xs uppercase tracking-wider">
              1. Organization Legal Profile
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-ink mb-1 tracking-tight">
                Organization / Company Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                placeholder="e.g. Apex Holdings LLC"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white text-ink font-semibold text-xs placeholder:text-slate-400 shadow-xs hover:border-slate-400 focus:border-primary-600 focus:ring-4 focus:ring-primary-500/15 focus:outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-ink mb-1 tracking-tight">
                Billing & Corporate Email <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                required
                value={billingEmail}
                onChange={(e) => handleBillingEmailChange(e.target.value)}
                placeholder="billing@apexholdings.us"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white text-ink font-semibold text-xs placeholder:text-slate-400 shadow-xs hover:border-slate-400 focus:border-primary-600 focus:ring-4 focus:ring-primary-500/15 focus:outline-none transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <label className="block text-xs font-bold text-ink mb-1 tracking-tight">
                City <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Austin"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white text-ink font-semibold text-xs placeholder:text-slate-400 shadow-xs hover:border-slate-400 focus:border-primary-600 focus:ring-4 focus:ring-primary-500/15 focus:outline-none transition-all"
              />
            </div>

            <div className="sm:col-span-1">
              <label className="block text-xs font-bold text-ink mb-1 tracking-tight">
                State (2-letter) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={2}
                value={state}
                onChange={(e) => setState(e.target.value.toUpperCase())}
                placeholder="TX"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white text-ink font-semibold text-xs placeholder:text-slate-400 shadow-xs hover:border-slate-400 focus:border-primary-600 focus:ring-4 focus:ring-primary-500/15 focus:outline-none transition-all uppercase"
              />
            </div>

            <div className="sm:col-span-1">
              <label className="block text-xs font-bold text-ink mb-1 tracking-tight">
                Zip Code
              </label>
              <input
                type="text"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                placeholder="78701"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white text-ink font-semibold text-xs placeholder:text-slate-400 shadow-xs hover:border-slate-400 focus:border-primary-600 focus:ring-4 focus:ring-primary-500/15 focus:outline-none transition-all"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Owner Account */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center gap-2 pb-1 border-b border-line">
            <User className="size-4 text-primary-600" />
            <h3 className="font-bold text-ink text-xs uppercase tracking-wider">
              2. Primary Organization Owner Account
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-ink mb-1 tracking-tight">
                Owner Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Marcus Vance"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white text-ink font-semibold text-xs placeholder:text-slate-400 shadow-xs hover:border-slate-400 focus:border-primary-600 focus:ring-4 focus:ring-primary-500/15 focus:outline-none transition-all"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-ink tracking-tight">
                  Owner Email <span className="text-rose-500">*</span>
                </label>
                <label className="inline-flex items-center gap-1.5 text-[11px] text-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useBillingEmailForOwner}
                    onChange={(e) => handleToggleSameEmail(e.target.checked)}
                    className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span>Same as billing</span>
                </label>
              </div>
              <input
                type="email"
                required
                disabled={useBillingEmailForOwner}
                value={useBillingEmailForOwner ? billingEmail : ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                placeholder="marcus@apexholdings.us"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white disabled:bg-slate-50 disabled:text-slate-500 text-ink font-semibold text-xs placeholder:text-slate-400 shadow-xs hover:border-slate-400 focus:border-primary-600 focus:ring-4 focus:ring-primary-500/15 focus:outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-ink tracking-tight">
                Initial Owner Password
              </label>
              <button
                type="button"
                onClick={handleGeneratePassword}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary-700 hover:text-primary-800 transition cursor-pointer"
              >
                <Shuffle className="size-3" />
                <span>Generate Strong Password</span>
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Temporary password (leave empty to send invite email)"
                className="w-full border border-slate-300 rounded-lg pl-3 pr-10 py-2 bg-white text-ink font-semibold text-xs placeholder:text-slate-400 shadow-xs hover:border-slate-400 focus:border-primary-600 focus:ring-4 focus:ring-primary-500/15 focus:outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Section 3: Initial Workspace */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center gap-2 pb-1 border-b border-line">
            <MapPin className="size-4 text-primary-600" />
            <h3 className="font-bold text-ink text-xs uppercase tracking-wider">
              3. Default Workspace Provisioning
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-ink mb-1 tracking-tight">
                Workspace Name
              </label>
              <input
                type="text"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder={tenantName ? `${tenantName} Corporate HQ` : 'HQ Office'}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white text-ink font-semibold text-xs placeholder:text-slate-400 shadow-xs hover:border-slate-400 focus:border-primary-600 focus:ring-4 focus:ring-primary-500/15 focus:outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-ink mb-1 tracking-tight">
                Physical Office Address
              </label>
              <input
                type="text"
                value={workspaceAddress}
                onChange={(e) => setWorkspaceAddress(e.target.value)}
                placeholder="e.g. 100 Congress Ave, Suite 200"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white text-ink font-semibold text-xs placeholder:text-slate-400 shadow-xs hover:border-slate-400 focus:border-primary-600 focus:ring-4 focus:ring-primary-500/15 focus:outline-none transition-all"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Subscription Plan */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center gap-2 pb-1 border-b border-line">
            <Sparkles className="size-4 text-primary-600" />
            <h3 className="font-bold text-ink text-xs uppercase tracking-wider">
              4. SaaS Service & Subscription Plan
            </h3>
          </div>

          {/* Service Selector */}
          <div>
            <label className="block text-xs font-bold text-ink mb-1.5 tracking-tight">
              Platform Product Access <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleServiceChange('CHECK_PRINTING')}
                className={`flex items-center gap-2 p-2.5 rounded-xl border text-left cursor-pointer transition ${
                  serviceType === 'CHECK_PRINTING'
                    ? 'border-primary-600 bg-primary-50/70 text-primary-900 shadow-2xs font-bold'
                    : 'border-slate-200 bg-white text-ink hover:bg-slate-50'
                }`}
              >
                <div className="size-7 rounded-lg bg-primary-100 flex items-center justify-center text-primary-700 shrink-0">
                  <Printer className="size-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate">Check Printing</div>
                  <div className="text-[10px] text-muted">Core bank printing</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleServiceChange('CLOCK_IN_CLOCK_OUT')}
                className={`flex items-center gap-2 p-2.5 rounded-xl border text-left cursor-pointer transition ${
                  serviceType === 'CLOCK_IN_CLOCK_OUT'
                    ? 'border-emerald-600 bg-emerald-50/70 text-emerald-900 shadow-2xs font-bold'
                    : 'border-slate-200 bg-white text-ink hover:bg-slate-50'
                }`}
              >
                <div className="size-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                  <Clock className="size-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate">ClockIn-ClockOut</div>
                  <div className="text-[10px] text-muted">Attendance & biometric</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleServiceChange('BOTH')}
                className={`flex items-center gap-2 p-2.5 rounded-xl border text-left cursor-pointer transition ${
                  serviceType === 'BOTH'
                    ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 shadow-2xs font-bold'
                    : 'border-slate-200 bg-white text-ink hover:bg-slate-50'
                }`}
              >
                <div className="size-7 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 shrink-0">
                  <Sparkles className="size-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate">All-Access Bundle</div>
                  <div className="text-[10px] text-muted">Both platforms</div>
                </div>
              </button>
            </div>
          </div>

          {/* Plan Selector */}
          <div>
            <label className="block text-xs font-bold text-ink mb-1 tracking-tight">
              Active Tier / Billing Cadence <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {availablePlans.map((plan) => {
                const isSelected = plan.id === selectedPlanId;
                return (
                  <div
                    key={plan.id}
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                      isSelected
                        ? 'border-primary-600 bg-primary-50/50 shadow-2xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-ink text-xs">{plan.name}</div>
                      <div className="text-[11px] text-muted">
                        Billed every {plan.durationCount} {plan.durationUnit.toLowerCase()}
                        {plan.durationCount > 1 ? 's' : ''}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-primary-700 font-mono">
                        {formatCurrency(plan.price)}
                      </div>
                      {isSelected && (
                        <div className="inline-flex items-center gap-0.5 text-[10px] text-primary-600 font-bold">
                          <Check className="size-3" /> Selected
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
};
