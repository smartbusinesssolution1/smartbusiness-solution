import React, { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Briefcase, AlertCircle, Loader2, Info } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  Button,
  Input,
  Label,
  Switch,
  Badge,
} from '../ui';
import {
  leaveService,
  LeavePolicy,
  LeaveCategory,
  LeaveAccrualType,
  CreateLeavePolicyPayload,
} from '../../services/leave.service';
import { notify } from '../../context/NotificationContext';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  policyToEdit?: LeavePolicy | null;
  onSuccess?: () => void;
}

export const CreateLeavePolicyModal: React.FC<Props> = ({
  open,
  onOpenChange,
  workspaceId,
  policyToEdit,
  onSuccess,
}) => {
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<LeaveCategory>('PTO');
  const [accrualType, setAccrualType] = useState<LeaveAccrualType>('HOURLY_ACCRUAL');
  const [hoursPerYear, setHoursPerYear] = useState('40');
  const [accrualCapHours, setAccrualCapHours] = useState('');
  const [maxCarryoverHours, setMaxCarryoverHours] = useState('40');
  const [waitingPeriodDays, setWaitingPeriodDays] = useState('90');
  const [minNoticeDays, setMinNoticeDays] = useState('0');
  const [requiresDocDays, setRequiresDocDays] = useState('3');
  const [isPaid, setIsPaid] = useState(true);
  const [payoutOnTermination, setPayoutOnTermination] = useState(false);
  const [requiresApproval, setRequiresApproval] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (policyToEdit) {
      setName(policyToEdit.name);
      setCode(policyToEdit.code);
      setDescription(policyToEdit.description || '');
      setCategory(policyToEdit.category);
      setAccrualType(policyToEdit.accrualType);
      setHoursPerYear(String(policyToEdit.hoursPerYear ?? 40));
      setAccrualCapHours(policyToEdit.accrualCapHours ? String(policyToEdit.accrualCapHours) : '');
      setMaxCarryoverHours(String(policyToEdit.maxCarryoverHours ?? 0));
      setWaitingPeriodDays(String(policyToEdit.waitingPeriodDays ?? 0));
      setMinNoticeDays(String(policyToEdit.minNoticeDays ?? 0));
      setRequiresDocDays(policyToEdit.requiresDocDays ? String(policyToEdit.requiresDocDays) : '');
      setIsPaid(policyToEdit.isPaid);
      setPayoutOnTermination(policyToEdit.payoutOnTermination);
      setRequiresApproval(policyToEdit.requiresApproval);
      setIsActive(policyToEdit.isActive);
    } else {
      setName('');
      setCode('');
      setDescription('');
      setCategory('PTO');
      setAccrualType('HOURLY_ACCRUAL');
      setHoursPerYear('40');
      setAccrualCapHours('80');
      setMaxCarryoverHours('40');
      setWaitingPeriodDays('90');
      setMinNoticeDays('0');
      setRequiresDocDays('3');
      setIsPaid(true);
      setPayoutOnTermination(false);
      setRequiresApproval(true);
      setIsActive(true);
    }
    setErrorMsg(null);
  }, [policyToEdit, open]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: CreateLeavePolicyPayload = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        description: description.trim() || undefined,
        category,
        accrualType,
        hoursPerYear: parseFloat(hoursPerYear) || 40,
        accrualCapHours: accrualCapHours ? parseFloat(accrualCapHours) : undefined,
        maxCarryoverHours: parseFloat(maxCarryoverHours) || 0,
        waitingPeriodDays: parseInt(waitingPeriodDays, 10) || 0,
        minNoticeDays: parseInt(minNoticeDays, 10) || 0,
        requiresDocDays: requiresDocDays ? parseInt(requiresDocDays, 10) : undefined,
        isPaid,
        payoutOnTermination,
        requiresApproval,
        isActive,
        workspaceId,
      };

      if (policyToEdit) {
        return leaveService.updatePolicy(policyToEdit.id, payload, workspaceId);
      }
      return leaveService.createPolicy(payload);
    },
    onSuccess: () => {
      notify(
        policyToEdit ? 'Leave policy updated successfully' : 'Leave policy created successfully',
        'success'
      );
      queryClient.invalidateQueries({ queryKey: ['leavePolicies', workspaceId] });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error?.message ||
        err?.message ||
        'Failed to save leave policy';
      setErrorMsg(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Policy name is required.');
      return;
    }
    if (!code.trim()) {
      setErrorMsg('Policy code is required (e.g. CA-PSL, PTO, VAC).');
      return;
    }
    setErrorMsg(null);
    saveMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh]">
        <DialogHeader
          title={policyToEdit ? 'Edit Leave Policy' : 'Create US Leave Policy'}
          description="Configure accrual method, annual quota, rollover, and statutory compliance rules."
          icon={<Briefcase className="size-4 text-primary-600" />}
        />
        <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
          <DialogBody className="space-y-4 overflow-y-auto max-h-[65vh] pr-2">
            {errorMsg && (
              <div className="flex items-center gap-2 rounded-lg bg-danger-50 p-3 text-xs text-danger-700 border border-danger-200">
                <AlertCircle className="size-4 shrink-0 text-danger-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Basic Info */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="policy-name">Policy Name *</Label>
                <Input
                  id="policy-name"
                  placeholder="e.g. California Paid Sick Leave"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!policyToEdit && !code) {
                      const initials = e.target.value
                        .split(' ')
                        .filter(Boolean)
                        .map((w) => w[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 6);
                      setCode(initials);
                    }
                  }}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="policy-code">Policy Code *</Label>
                <Input
                  id="policy-code"
                  placeholder="e.g. CA-PSL"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  maxLength={15}
                  required
                  className="font-mono uppercase font-semibold"
                />
              </div>
            </div>

            {/* Category & Accrual Type */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="policy-category">Category</Label>
                <select
                  id="policy-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as LeaveCategory)}
                  className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-xs font-medium text-ink focus:border-primary-500 focus:outline-none"
                >
                  <option value="PTO">PTO (Combined Bank)</option>
                  <option value="VACATION">Vacation (Dedicated)</option>
                  <option value="SICK">Sick Leave (Statutory / Medical)</option>
                  <option value="BEREAVEMENT">Bereavement</option>
                  <option value="JURY_DUTY">Jury Duty</option>
                  <option value="MILITARY">Military (USERRA)</option>
                  <option value="FMLA">FMLA (Medical / Family)</option>
                  <option value="UNPAID">Unpaid Leave</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="policy-accrual">Accrual Method</Label>
                <select
                  id="policy-accrual"
                  value={accrualType}
                  onChange={(e) => setAccrualType(e.target.value as LeaveAccrualType)}
                  className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-xs font-medium text-ink focus:border-primary-500 focus:outline-none"
                >
                  <option value="HOURLY_ACCRUAL">Hourly Accrual (1h / 30-40h worked)</option>
                  <option value="FRONTLOAD">Annual Frontload (Lump-sum Jan 1)</option>
                  <option value="PER_PAY_PERIOD">Per Pay-Period Accrual (Bi-Weekly)</option>
                  <option value="UNLIMITED">Unlimited / Flexible (No Accrual)</option>
                </select>
              </div>
            </div>

            {/* Quota & Caps */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="hours-per-year">Annual Quota (Hours)</Label>
                <Input
                  id="hours-per-year"
                  type="number"
                  step="0.5"
                  min="0"
                  value={hoursPerYear}
                  onChange={(e) => setHoursPerYear(e.target.value)}
                  placeholder="40"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="accrual-cap">Accrual Cap (Hours)</Label>
                <Input
                  id="accrual-cap"
                  type="number"
                  step="0.5"
                  min="0"
                  value={accrualCapHours}
                  onChange={(e) => setAccrualCapHours(e.target.value)}
                  placeholder="80 (Leave blank for no cap)"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="max-carryover">Max Rollover (Hours)</Label>
                <Input
                  id="max-carryover"
                  type="number"
                  step="0.5"
                  min="0"
                  value={maxCarryoverHours}
                  onChange={(e) => setMaxCarryoverHours(e.target.value)}
                  placeholder="40"
                />
              </div>
            </div>

            {/* Waiting Period & Rules */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="waiting-period">Waiting Period (Days)</Label>
                <Input
                  id="waiting-period"
                  type="number"
                  min="0"
                  value={waitingPeriodDays}
                  onChange={(e) => setWaitingPeriodDays(e.target.value)}
                  placeholder="90"
                />
                <p className="text-[0.6875rem] text-muted">Days from hire before taking</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="min-notice">Advance Notice (Days)</Label>
                <Input
                  id="min-notice"
                  type="number"
                  min="0"
                  value={minNoticeDays}
                  onChange={(e) => setMinNoticeDays(e.target.value)}
                  placeholder="0 (Immediate for sick)"
                />
                <p className="text-[0.6875rem] text-muted">Min days advance notice</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="doc-days">Doctor Note Required (Days)</Label>
                <Input
                  id="doc-days"
                  type="number"
                  min="1"
                  value={requiresDocDays}
                  onChange={(e) => setRequiresDocDays(e.target.value)}
                  placeholder="3"
                />
                <p className="text-[0.6875rem] text-muted">Consecutive days trigger</p>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="policy-desc">Description & Statutory Notes</Label>
              <Input
                id="policy-desc"
                placeholder="e.g. Mandated by California Labor Code Section 246..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Statutory Compliance Toggles */}
            <div className="flex flex-col gap-3 rounded-xl border border-line bg-subtle/40 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-ink">Paid Time Off</div>
                  <div className="text-[0.6875rem] text-muted">
                    Employee receives normal regular hourly rate compensation
                  </div>
                </div>
                <Switch checked={isPaid} onCheckedChange={setIsPaid} />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-line/60">
                <div>
                  <div className="text-xs font-semibold text-ink">Requires Manager Approval</div>
                  <div className="text-[0.6875rem] text-muted">
                    Supervisor must review before timecard status updates
                  </div>
                </div>
                <Switch checked={requiresApproval} onCheckedChange={setRequiresApproval} />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-line/60">
                <div>
                  <div className="text-xs font-semibold text-ink">Active Policy</div>
                  <div className="text-[0.6875rem] text-muted">
                    Available for staff in this workspace to select
                  </div>
                </div>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saveMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saveMutation.isPending}
              className="gap-2"
            >
              {saveMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              {policyToEdit ? 'Save Changes' : 'Create Leave Policy'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
