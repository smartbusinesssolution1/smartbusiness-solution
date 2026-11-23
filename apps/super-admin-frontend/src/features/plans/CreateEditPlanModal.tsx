import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import {
  Printer,
  RefreshCw,
  Layers,
  CheckCircle2,
  Calendar,
  DollarSign,
  Minus,
  Plus,
  Sparkles,
  Check,
} from 'lucide-react';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatDuration } from '../../utils/formatDuration';
import type { PlanConfig, ServiceType, DurationUnit } from '../../types';

export interface CreateEditPlanModalProps {
  plan: PlanConfig | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: {
    id?: string;
    name: string;
    service: ServiceType;
    durationCount: number;
    durationUnit: DurationUnit;
    price: number;
    status: 'ACTIVE' | 'INACTIVE';
  }) => void;
}

type DurationPresetKey = 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL' | 'CUSTOM';

export const CreateEditPlanModal: React.FC<CreateEditPlanModalProps> = ({
  plan,
  isOpen,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [service, setService] = useState<ServiceType>('CHECK_PRINTING');
  const [durationCount, setDurationCount] = useState<number>(1);
  const [durationUnit, setDurationUnit] = useState<DurationUnit>('MONTH');
  const [selectedPreset, setSelectedPreset] = useState<DurationPresetKey>('MONTHLY');
  const [price, setPrice] = useState<number>(49);
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');

  // Match preset when plan loads or values change
  const detectPreset = (count: number, unit: DurationUnit): DurationPresetKey => {
    if (unit === 'MONTH' && count === 1) return 'MONTHLY';
    if (unit === 'MONTH' && count === 3) return 'QUARTERLY';
    if (unit === 'MONTH' && count === 6) return 'SEMI_ANNUAL';
    if ((unit === 'YEAR' && count === 1) || (unit === 'MONTH' && count === 12)) return 'ANNUAL';
    return 'CUSTOM';
  };

  useEffect(() => {
    if (plan) {
      setName(plan.name);
      setService(plan.service);
      setDurationCount(plan.durationCount);
      setDurationUnit(plan.durationUnit);
      setSelectedPreset(detectPreset(plan.durationCount, plan.durationUnit));
      setPrice(plan.price);
      setStatus(plan.status);
    } else {
      setName('');
      setService('CHECK_PRINTING');
      setDurationCount(1);
      setDurationUnit('MONTH');
      setSelectedPreset('MONTHLY');
      setPrice(49);
      setStatus('ACTIVE');
    }
  }, [plan, isOpen]);

  const handleSelectPreset = (preset: DurationPresetKey) => {
    setSelectedPreset(preset);
    switch (preset) {
      case 'MONTHLY':
        setDurationCount(1);
        setDurationUnit('MONTH');
        break;
      case 'QUARTERLY':
        setDurationCount(3);
        setDurationUnit('MONTH');
        break;
      case 'SEMI_ANNUAL':
        setDurationCount(6);
        setDurationUnit('MONTH');
        break;
      case 'ANNUAL':
        setDurationCount(1);
        setDurationUnit('YEAR');
        break;
      case 'CUSTOM':
        break;
    }
  };

  const handleIncrement = () => {
    setSelectedPreset('CUSTOM');
    setDurationCount((prev) => prev + 1);
  };

  const handleDecrement = () => {
    setSelectedPreset('CUSTOM');
    setDurationCount((prev) => Math.max(1, prev - 1));
  };

  const handleCountChange = (value: number) => {
    setSelectedPreset('CUSTOM');
    setDurationCount(Math.max(1, value || 1));
  };

  const handleUnitChange = (unit: DurationUnit) => {
    setSelectedPreset('CUSTOM');
    setDurationUnit(unit);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSave({
      id: plan?.id,
      name: name.trim(),
      service,
      durationCount: Math.max(1, Number(durationCount) || 1),
      durationUnit,
      price: Math.max(0, Number(price) || 0),
      status,
    });
    onClose();
  };

  // Calculate monthly equivalent for transparency
  const calculateMonthlyRate = () => {
    if (price <= 0) return null;
    if (durationUnit === 'MONTH') {
      if (durationCount === 1) return null;
      return price / durationCount;
    }
    if (durationUnit === 'YEAR') {
      return price / (durationCount * 12);
    }
    return null;
  };

  const monthlyEquivalent = calculateMonthlyRate();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={plan ? 'Edit Subscription Plan' : 'Create New Subscription Plan'}
      subtitle="Configure pricing, service coverage, and recurring billing frequency"
      maxWidth="xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-[11px] text-muted flex items-center gap-1.5 font-medium">
            <Sparkles className="size-3.5 text-primary-600 shrink-0" />
            <span>Full service access automatically unlocked for subscribers</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} type="button">
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleSubmit} type="button">
              {plan ? 'Save Changes' : 'Create Plan'}
            </Button>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Section 1: Plan Name & Status side-by-side */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-8">
            <label className="block text-xs font-bold text-ink mb-1 tracking-tight">
              Plan Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Check Printing Monthly, ClockIn 6-Month Pass"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white text-ink font-semibold text-xs placeholder:text-slate-400 shadow-xs hover:border-slate-400 focus:border-primary-600 focus:ring-4 focus:ring-primary-500/15 focus:outline-none transition-all"
            />
          </div>

          <div className="sm:col-span-4">
            <label className="block text-xs font-bold text-ink mb-1 tracking-tight">
              Status <span className="text-rose-500">*</span>
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
              className="w-full border border-slate-300 rounded-lg px-2.5 py-2 bg-white text-ink font-semibold text-xs shadow-xs hover:border-slate-400 focus:border-primary-600 focus:ring-4 focus:ring-primary-500/15 focus:outline-none cursor-pointer transition-all"
            >
              <option value="ACTIVE">Active (Public)</option>
              <option value="INACTIVE">Inactive (Hidden)</option>
            </select>
          </div>
        </div>

        {/* Section 2: Service Selection (Sleek Horizontal Pills) */}
        <div>
          <label className="block text-xs font-bold text-ink mb-1 tracking-tight">
            Service Coverage <span className="text-rose-500">*</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* Check Printing */}
            <button
              type="button"
              onClick={() => setService('CHECK_PRINTING')}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                service === 'CHECK_PRINTING'
                  ? 'border-primary-500 bg-primary-50/50 ring-2 ring-primary-500/20 text-primary-900 font-bold shadow-2xs'
                  : 'border-slate-200 bg-white hover:bg-slate-50 text-ink-soft font-semibold'
              }`}
            >
              <div className="size-7 rounded-lg bg-primary-100 text-primary-700 flex items-center justify-center shrink-0">
                <Printer className="size-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs leading-tight truncate">Check Printing</div>
                <div className="text-[10px] text-muted font-normal leading-none mt-0.5">Full check tools</div>
              </div>
              {service === 'CHECK_PRINTING' && (
                <div className="size-4 rounded-full bg-primary-600 text-white flex items-center justify-center shrink-0">
                  <Check className="size-2.5 stroke-[3]" />
                </div>
              )}
            </button>

            {/* ClockIn-ClockOut */}
            <button
              type="button"
              onClick={() => setService('CLOCK_IN_CLOCK_OUT')}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                service === 'CLOCK_IN_CLOCK_OUT'
                  ? 'border-primary-500 bg-primary-50/50 ring-2 ring-primary-500/20 text-primary-900 font-bold shadow-2xs'
                  : 'border-slate-200 bg-white hover:bg-slate-50 text-ink-soft font-semibold'
              }`}
            >
              <div className="size-7 rounded-lg bg-blue-50 border border-blue-200/80 text-primary-600 flex items-center justify-center shrink-0">
                <RefreshCw className="size-3.5 stroke-[2.4]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs leading-tight truncate">ClockIn-ClockOut</div>
                <div className="text-[10px] text-muted font-normal leading-none mt-0.5">Attendance & shifts</div>
              </div>
              {service === 'CLOCK_IN_CLOCK_OUT' && (
                <div className="size-4 rounded-full bg-primary-600 text-white flex items-center justify-center shrink-0">
                  <Check className="size-2.5 stroke-[3]" />
                </div>
              )}
            </button>

            {/* Both (Bundle) */}
            <button
              type="button"
              onClick={() => setService('BOTH')}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                service === 'BOTH'
                  ? 'border-purple-500 bg-purple-50/50 ring-2 ring-purple-500/20 text-purple-900 font-bold shadow-2xs'
                  : 'border-slate-200 bg-white hover:bg-slate-50 text-ink-soft font-semibold'
              }`}
            >
              <div className="size-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                <Layers className="size-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs leading-tight truncate">Both Services</div>
                <div className="text-[10px] text-muted font-normal leading-none mt-0.5">Combined bundle</div>
              </div>
              {service === 'BOTH' && (
                <div className="size-4 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0">
                  <Check className="size-2.5 stroke-[3]" />
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Section 3: Billing Duration & Price (Compact Unified Card) */}
        <div className="bg-canvas border border-line rounded-xl p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold text-xs text-ink">
              <Calendar className="size-3.5 text-primary-600" />
              <span>Billing Duration & Pricing</span>
            </div>
            <span className="text-[11px] font-mono font-bold text-primary-700 bg-primary-50 border border-primary-200 px-2 py-0.5 rounded-md">
              {formatDuration(durationCount, durationUnit)}
            </span>
          </div>

          {/* Preset Buttons */}
          <div className="grid grid-cols-5 gap-1 p-0.5 bg-subtle rounded-lg border border-line">
            {[
              { id: 'MONTHLY' as const, label: 'Monthly' },
              { id: 'QUARTERLY' as const, label: 'Quarterly' },
              { id: 'SEMI_ANNUAL' as const, label: 'Semi-Ann.' },
              { id: 'ANNUAL' as const, label: 'Annual' },
              { id: 'CUSTOM' as const, label: 'Custom' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectPreset(item.id)}
                className={`py-1.5 px-1 rounded-md text-center transition-all cursor-pointer text-xs ${
                  selectedPreset === item.id
                    ? 'bg-panel text-primary-700 font-bold shadow-xs border border-line/80'
                    : 'text-muted hover:text-ink font-medium'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Stepper, Unit, and Price in single row */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
            {/* Stepper & Unit */}
            <div className="sm:col-span-7 flex items-center gap-2">
              <div className="inline-flex items-center rounded-lg border border-slate-300 bg-white overflow-hidden shadow-xs hover:border-slate-400 transition-colors">
                <button
                  type="button"
                  onClick={handleDecrement}
                  className="px-2.5 py-1.5 hover:bg-slate-100 text-slate-600 hover:text-ink transition cursor-pointer border-r border-slate-200"
                  title="Decrease"
                >
                  <Minus className="size-3" />
                </button>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={durationCount}
                  onChange={(e) => handleCountChange(parseInt(e.target.value, 10))}
                  className="w-12 text-center py-1.5 bg-white font-mono font-bold text-ink text-xs focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleIncrement}
                  className="px-2.5 py-1.5 hover:bg-slate-100 text-slate-600 hover:text-ink transition cursor-pointer border-l border-slate-200"
                  title="Increase"
                >
                  <Plus className="size-3" />
                </button>
              </div>

              <select
                value={durationUnit}
                onChange={(e) => handleUnitChange(e.target.value as DurationUnit)}
                className="flex-1 border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-ink font-bold text-xs shadow-xs hover:border-slate-400 focus:ring-4 focus:ring-primary-500/15 focus:border-primary-600 focus:outline-none cursor-pointer transition-colors"
              >
                <option value="MONTH">Months</option>
                <option value="YEAR">Years</option>
                <option value="DAY">Days</option>
              </select>
            </div>

            {/* Price USD */}
            <div className="sm:col-span-5">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-500">
                  <DollarSign className="size-3.5" />
                </div>
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  placeholder="49"
                  className="w-full border border-slate-300 rounded-lg pl-7 pr-12 py-1.5 bg-white text-ink font-bold font-mono text-xs placeholder:text-slate-400 shadow-xs hover:border-slate-400 focus:border-primary-600 focus:ring-4 focus:ring-primary-500/15 focus:outline-none transition-all"
                />
                <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-[11px] font-mono font-bold text-slate-500">
                  USD
                </div>
              </div>
            </div>
          </div>

          {monthlyEquivalent && (
            <div className="text-[11px] font-mono text-emerald-700 font-semibold text-right">
              ≈ {formatCurrency(Math.round(monthlyEquivalent * 100) / 100)} / month equivalent
            </div>
          )}
        </div>

        {/* Section 4: Compact Summary Banner */}
        <div className="px-3 py-2 bg-emerald-50/70 border border-emerald-200/90 rounded-lg flex items-center gap-2.5 text-emerald-950">
          <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
          <p className="text-[11px] leading-tight text-emerald-900">
            <strong>{name.trim() || 'Plan'}</strong> billed{' '}
            <strong>{formatCurrency(price)}</strong> every{' '}
            <strong>{formatDuration(durationCount, durationUnit)}</strong> with{' '}
            <strong>100% full unrestricted access</strong> to{' '}
            <strong>
              {service === 'CHECK_PRINTING'
                ? 'Check Printing'
                : service === 'CLOCK_IN_CLOCK_OUT'
                ? 'ClockIn-ClockOut'
                : 'Both Services'}
            </strong>.
          </p>
        </div>
      </form>
    </Modal>
  );
};
