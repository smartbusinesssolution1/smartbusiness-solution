import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  AlertCircle,
  Loader2,
  Clock,
  Sparkles,
  Calculator,
  UserCheck,
  Shield,
  Info,
  CheckCircle2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  Button,
  Input,
  Label,
  Badge,
} from '../ui';
import {
  leaveService,
  LeavePolicy,
  EmployeeLeaveBalance,
  AssignLeaveBalancePayload,
} from '../../services/leave.service';
import { employeeService } from '../../services/employeeService';
import { useAuth } from '../../context/AuthContext';
import { notify } from '../../context/NotificationContext';
import { cn } from '../../lib/utils';
import dayjs from 'dayjs';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  initialBalance?: EmployeeLeaveBalance | null;
  onSuccess?: () => void;
}

export const AssignLeaveBalanceModal: React.FC<Props> = ({
  open,
  onOpenChange,
  workspaceId,
  initialBalance,
  onSuccess,
}) => {
  const queryClient = useQueryClient();

  // True only when adjusting a specific existing balance row (has a policyId).
  // If initialBalance only has employeeId (from "+ Add Quota"), it is Multi-Policy Assignment Mode!
  const isSingleAdjustment = Boolean(initialBalance && initialBalance.policyId);

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(initialBalance?.year || currentYear);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>('');
  const [hireDate, setHireDate] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(`${initialBalance?.year || currentYear}-01-01`);
  const [endDate, setEndDate] = useState<string>(`${initialBalance?.year || currentYear}-12-31`);
  const [allocatedHours, setAllocatedHours] = useState<string>('0');
  const [carriedOverHours, setCarriedOverHours] = useState<string>('0');
  const [notes, setNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Multi-policy assignment state (when !initialBalance)
  interface MultiPolicyItem {
    policyId: string;
    selected: boolean;
    allocatedHours: string;
    carriedOverHours: string;
  }
  const [multiPolicies, setMultiPolicies] = useState<Record<string, MultiPolicyItem>>({});

  // Fetch Employees
  const { data: employeesData, isLoading: isEmployeesLoading } = useQuery({
    queryKey: ['workspaceEmployees', workspaceId],
    queryFn: () => employeeService.getEmployees({ workspaceId, limit: 100 }),
    enabled: open,
  });

  const employees = employeesData?.items || [];
  const { user } = useAuth();

  const filteredEmployees = useMemo(() => {
    if (!user) return employees;
    return employees.filter((emp) => {
      const isSelf = Boolean(
        (user.id && (emp.id === user.id || emp.userId === user.id)) ||
        (user.userId && (emp.id === user.userId || emp.userId === user.userId)) ||
        (user.email && emp.email && emp.email.toLowerCase() === user.email.toLowerCase()) ||
        (user.employeeId && emp.employeeId && emp.employeeId.toLowerCase() === user.employeeId.toLowerCase())
      );
      return !isSelf;
    });
  }, [employees, user]);

  // Fetch Policies
  const { data: policies = [], isLoading: isPoliciesLoading } = useQuery({
    queryKey: ['leavePolicies', workspaceId],
    queryFn: () => leaveService.listPolicies(workspaceId, true),
    enabled: open,
  });

  // When opening or changing initialBalance
  useEffect(() => {
    if (open) {
      setErrorMsg(null);
      const yr = initialBalance?.year || currentYear;
      setSelectedYear(yr);
      const yearStart = `${yr}-01-01`;
      const yearEnd = `${yr}-12-31`;

      if (isSingleAdjustment && initialBalance) {
        setSelectedEmployeeId(initialBalance.employeeId);
        setSelectedPolicyId(initialBalance.policyId);
        setAllocatedHours(String(initialBalance.allocatedHours ?? 0));
        setCarriedOverHours(String(initialBalance.carriedOverHours ?? 0));
        setNotes(`Adjusted balance for year ${yr}`);
        if (initialBalance.employee?.createdAt) {
          const empHire = dayjs(initialBalance.employee.createdAt).format('YYYY-MM-DD');
          setHireDate(empHire);
          setStartDate(dayjs(empHire).year() === yr ? empHire : yearStart);
        } else {
          setStartDate(yearStart);
        }
        setEndDate(yearEnd);
      } else {
        setSelectedEmployeeId(initialBalance?.employeeId || '');
        setAllocatedHours('0');
        setCarriedOverHours('0');
        setNotes('');
        setEndDate(yearEnd);
        if (policies.length > 0 && !selectedPolicyId) {
          setSelectedPolicyId(policies[0].id);
        }
      }
    }
  }, [open, initialBalance, isSingleAdjustment]);

  // When employee is selected, detect their joining date
  useEffect(() => {
    if (selectedEmployeeId && employees.length > 0) {
      const emp = employees.find((e) => e.id === selectedEmployeeId);
      if (emp?.joinedDate) {
        const parsed = dayjs(emp.joinedDate);
        if (parsed.isValid()) {
          const joinDateStr = parsed.format('YYYY-MM-DD');
          setHireDate(joinDateStr);
          if (parsed.year() === selectedYear) {
            setStartDate(joinDateStr);
          } else {
            setStartDate(`${selectedYear}-01-01`);
          }
        }
      } else if (!startDate) {
        setStartDate(`${selectedYear}-01-01`);
      }
    }
  }, [selectedEmployeeId, employees, selectedYear]);

  // When selectedYear changes, adjust start and end date boundaries
  useEffect(() => {
    const yearStart = `${selectedYear}-01-01`;
    const yearEnd = `${selectedYear}-12-31`;
    if (!startDate || dayjs(startDate).year() !== selectedYear) {
      if (hireDate && dayjs(hireDate).year() === selectedYear) {
        setStartDate(hireDate);
      } else {
        setStartDate(yearStart);
      }
    }
    if (!endDate || dayjs(endDate).year() !== selectedYear) {
      setEndDate(yearEnd);
    }
  }, [selectedYear]);

  const selectedPolicy = useMemo(() => {
    return policies.find((p) => p.id === selectedPolicyId);
  }, [policies, selectedPolicyId]);

  const selectedEmployee = useMemo(() => {
    return employees.find((e) => e.id === selectedEmployeeId);
  }, [employees, selectedEmployeeId]);

  // Auto-calculation based on Start Date and End Date range
  const dateCalculation = useMemo(() => {
    if (!startDate || !endDate) return null;
    const s = dayjs(startDate);
    const e = dayjs(endDate);
    if (!s.isValid() || !e.isValid() || e.isBefore(s)) return null;

    const isLeapYear = (selectedYear % 4 === 0 && selectedYear % 100 !== 0) || selectedYear % 400 === 0;
    const totalDaysInYear = isLeapYear ? 366 : 365;

    const yearStart = dayjs(`${selectedYear}-01-01`);
    const yearEnd = dayjs(`${selectedYear}-12-31`);

    // Bound effective dates within the selected calendar year
    const effectiveStart = s.isBefore(yearStart) ? yearStart : s;
    const effectiveEnd = e.isAfter(yearEnd) ? yearEnd : e;

    if (effectiveEnd.isBefore(effectiveStart)) {
      return {
        activeDays: 0,
        totalDaysInYear,
        ratio: 0,
        percent: 0,
        isFullYear: false,
      };
    }

    const activeDays = effectiveEnd.diff(effectiveStart, 'day') + 1;
    const ratio = Math.min(1, Math.max(0, activeDays / totalDaysInYear));
    const percent = Math.round(ratio * 1000) / 10;
    const isFullYear = activeDays >= totalDaysInYear;

    return {
      activeDays,
      totalDaysInYear,
      ratio,
      percent,
      isFullYear,
      startDateStr: effectiveStart.format('MMM D, YYYY'),
      endDateStr: effectiveEnd.format('MMM D, YYYY'),
    };
  }, [startDate, endDate, selectedYear]);

  // Mutation to save/assign balance
  const assignMutation = useMutation({
    mutationFn: (payload: AssignLeaveBalancePayload) =>
      leaveService.assignOrAdjustBalance(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workspaceLeaveBalances', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['leaveBalances'] });
      notify('Leave balance assigned and updated successfully', 'success');
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (err: any) => {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Failed to assign leave balance.';
      setErrorMsg(msg);
      notify(msg, 'error');
    },
  });

  // Pre-populate multi-policies whenever policies are loaded and creating new balances
  useEffect(() => {
    if (policies && policies.length > 0 && !isSingleAdjustment) {
      setMultiPolicies((prev) => {
        const next = { ...prev };
        policies.forEach((p) => {
          if (!next[p.id]) {
            next[p.id] = {
              policyId: p.id,
              selected: true,
              allocatedHours: String(p.hoursPerYear ?? 40),
              carriedOverHours: '0',
            };
          }
        });
        return next;
      });
    }
  }, [policies, isSingleAdjustment, open]);

  const toggleSelectAll = (selectAll: boolean) => {
    setMultiPolicies((prev) => {
      const next = { ...prev };
      policies.forEach((p) => {
        next[p.id] = {
          ...(next[p.id] || {
            policyId: p.id,
            allocatedHours: String(p.hoursPerYear ?? 40),
            carriedOverHours: '0',
          }),
          selected: selectAll,
        };
      });
      return next;
    });
  };

  const togglePolicyCheck = (policyId: string) => {
    setMultiPolicies((prev) => {
      const cur = prev[policyId];
      if (!cur) return prev;
      return {
        ...prev,
        [policyId]: {
          ...cur,
          selected: !cur.selected,
        },
      };
    });
  };

  const updatePolicyHours = (policyId: string, hours: string) => {
    setMultiPolicies((prev) => {
      const cur = prev[policyId];
      if (!cur) return prev;
      return {
        ...prev,
        [policyId]: {
          ...cur,
          allocatedHours: hours,
        },
      };
    });
  };

  const updatePolicyCarryover = (policyId: string, carry: string) => {
    setMultiPolicies((prev) => {
      const cur = prev[policyId];
      if (!cur) return prev;
      return {
        ...prev,
        [policyId]: {
          ...cur,
          carriedOverHours: carry,
        },
      };
    });
  };

  // Helper to calculate prorated hours for any given policy based on the Start Date & End Date range
  const getProratedHoursForPolicy = (policy: LeavePolicy) => {
    const standardAnnualHours = Number(policy.hoursPerYear) || 40;
    if (!dateCalculation) return standardAnnualHours;
    return Math.round(standardAnnualHours * dateCalculation.ratio * 10) / 10;
  };

  const applyProrationToAll = () => {
    if (!dateCalculation) return;
    setMultiPolicies((prev) => {
      const next = { ...prev };
      policies.forEach((p) => {
        const prorated = getProratedHoursForPolicy(p);
        next[p.id] = {
          ...(next[p.id] || {
            policyId: p.id,
            selected: true,
            carriedOverHours: '0',
          }),
          allocatedHours: String(prorated),
        };
      });
      return next;
    });
    setNotes(`Auto-calculated based on dates: ${startDate} to ${endDate} (${dateCalculation.activeDays} days, ${dateCalculation.percent}%)`);
  };

  const applyStandardToAll = () => {
    setStartDate(`${selectedYear}-01-01`);
    setEndDate(`${selectedYear}-12-31`);
    setMultiPolicies((prev) => {
      const next = { ...prev };
      policies.forEach((p) => {
        next[p.id] = {
          ...(next[p.id] || {
            policyId: p.id,
            selected: true,
            carriedOverHours: '0',
          }),
          allocatedHours: String(p.hoursPerYear ?? 40),
        };
      });
      return next;
    });
    setNotes(`Full annual standard quotas applied for year ${selectedYear}`);
  };

  // Automatically recalculate hours for multi-policies whenever Start Date or End Date changes
  useEffect(() => {
    if (policies && policies.length > 0 && !isSingleAdjustment && dateCalculation) {
      setMultiPolicies((prev) => {
        const next = { ...prev };
        policies.forEach((p) => {
          const std = Number(p.hoursPerYear) || 40;
          const calculatedHours = Math.round(std * dateCalculation.ratio * 10) / 10;
          next[p.id] = {
            ...(next[p.id] || {
              policyId: p.id,
              selected: true,
              carriedOverHours: '0',
            }),
            allocatedHours: String(calculatedHours),
          };
        });
        return next;
      });
    }
  }, [dateCalculation?.ratio, isSingleAdjustment, policies]);

  // Automatically recalculate hours for single policy adjustment whenever Start Date or End Date changes
  useEffect(() => {
    if (isSingleAdjustment && selectedPolicy && dateCalculation) {
      const std = Number(selectedPolicy.hoursPerYear) || 40;
      const calculatedHours = Math.round(std * dateCalculation.ratio * 10) / 10;
      setAllocatedHours(String(calculatedHours));
    }
  }, [dateCalculation?.ratio, selectedPolicy, isSingleAdjustment]);

  const isEmployeeMidYearJoiner = useMemo(() => {
    if (!hireDate) return false;
    const parsed = dayjs(hireDate);
    if (!parsed.isValid()) return false;
    return parsed.year() === selectedYear && parsed.diff(dayjs(`${selectedYear}-01-01`), 'day') > 0;
  }, [hireDate, selectedYear]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedEmployeeId) {
      setErrorMsg('Please select an employee.');
      return;
    }

    if (isSingleAdjustment) {
      if (!selectedPolicyId) {
        setErrorMsg('Please select a leave policy.');
        return;
      }

      const hours = parseFloat(allocatedHours);
      if (isNaN(hours) || hours < 0) {
        setErrorMsg('Allocated hours must be a non-negative number.');
        return;
      }

      const carryover = parseFloat(carriedOverHours);
      if (isNaN(carryover) || carryover < 0) {
        setErrorMsg('Carried-over hours must be a non-negative number.');
        return;
      }

      assignMutation.mutate({
        workspaceId,
        employeeId: selectedEmployeeId,
        policyId: selectedPolicyId,
        year: selectedYear,
        allocatedHours: hours,
        carriedOverHours: carryover,
        hireDate: hireDate || undefined,
        notes: notes.trim() || undefined,
      });
      return;
    }

    // Multi-policy assignment mode
    const selectedItems = Object.values(multiPolicies).filter((item) => item.selected);
    if (selectedItems.length === 0) {
      setErrorMsg('Please select at least one leave policy to assign.');
      return;
    }

    for (const item of selectedItems) {
      const hours = parseFloat(item.allocatedHours);
      if (isNaN(hours) || hours < 0) {
        setErrorMsg('Allocated hours must be non-negative for all selected policies.');
        return;
      }
      const carryover = parseFloat(item.carriedOverHours);
      if (isNaN(carryover) || carryover < 0) {
        setErrorMsg('Carried-over hours must be a non-negative number.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await Promise.all(
        selectedItems.map((item) =>
          leaveService.assignOrAdjustBalance({
            workspaceId,
            employeeId: selectedEmployeeId,
            policyId: item.policyId,
            year: selectedYear,
            allocatedHours: parseFloat(item.allocatedHours) || 0,
            carriedOverHours: parseFloat(item.carriedOverHours) || 0,
            hireDate: hireDate || undefined,
            notes: notes.trim() || undefined,
          })
        )
      );

      queryClient.invalidateQueries({ queryKey: ['workspaceLeaveBalances', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['leaveBalances'] });
      notify(`Successfully assigned ${selectedItems.length} leave policy balances!`, 'success');
      onSuccess?.();
      onOpenChange(false);
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Failed to assign leave balances.';
      setErrorMsg(msg);
      notify(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader
          title={isSingleAdjustment ? 'Adjust Employee Leave Balance' : 'Assign Leave Policy Quotas'}
          description={
            isSingleAdjustment
              ? 'Update the annual quota or carryover hours for this employee.'
              : 'Assign multiple leave policies and customize allocated hour quotas at one time.'
          }
        />

        <form onSubmit={handleSubmit} className="space-y-5">
          <DialogBody className="space-y-4">
            {errorMsg && (
              <div className="flex items-center gap-2 p-3 text-xs rounded-lg bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900/60 dark:text-rose-300">
                <AlertCircle className="size-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Employee & Year */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="assign-employee">Employee</Label>
                <select
                  id="assign-employee"
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  disabled={isSingleAdjustment || isEmployeesLoading}
                  className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-xs font-medium text-ink focus:border-primary-500 focus:outline-none"
                  required
                >
                  <option value="">-- Select Employee --</option>
                  {initialBalance && !employees.some((e) => e.id === initialBalance.employeeId) && (
                    <option value={initialBalance.employeeId}>
                      {initialBalance.employee?.workspaceMember?.user?.fullName || 'Employee'}{' '}
                      {initialBalance.employee?.employeeCode ? `(${initialBalance.employee.employeeCode})` : ''} -{' '}
                      {initialBalance.employee?.department || 'General'}
                    </option>
                  )}
                  {filteredEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} {emp.employeeId ? `(${emp.employeeId})` : ''} - {emp.department || 'General'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="assign-year">Calendar Year</Label>
                <select
                  id="assign-year"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  disabled={isSingleAdjustment}
                  className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-xs font-medium text-ink focus:border-primary-500 focus:outline-none"
                >
                  {[currentYear - 1, currentYear, currentYear + 1].map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* If Single Balance Edit Mode (has specific policyId) */}
            {isSingleAdjustment ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="assign-policy">Leave Policy</Label>
                    <select
                      id="assign-policy"
                      value={selectedPolicyId}
                      onChange={(e) => setSelectedPolicyId(e.target.value)}
                      disabled={true}
                      className="w-full rounded-lg border border-line bg-subtle px-3 py-2 text-xs font-medium text-muted cursor-not-allowed"
                      required
                    >
                      <option value="">-- Select Policy --</option>
                      {policies.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.category} • {p.accrualType})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="assign-single-start">Start Date</Label>
                      {selectedEmployee?.joinedDate && dayjs(selectedEmployee.joinedDate).year() === selectedYear && (
                        <span className="text-[10px] text-primary-600 font-mono">From hire date</span>
                      )}
                    </div>
                    <Input
                      id="assign-single-start"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="assign-single-end">End Date</Label>
                      <span className="text-[10px] text-muted font-mono">{selectedYear} Year-End</span>
                    </div>
                    <Input
                      id="assign-single-end"
                      type="date"
                      value={endDate}
                      min={startDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                </div>

                {/* Auto-Calculation Banner for Single Policy */}
                {dateCalculation && selectedPolicy && (
                  <div className={cn(
                    'rounded-xl border p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs',
                    dateCalculation.isFullYear
                      ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-300'
                      : 'border-primary-200/80 bg-primary-50/50 dark:border-primary-900/60 dark:bg-primary-950/20 text-primary-950 dark:text-primary-300'
                  )}>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={cn(
                        'p-1.5 rounded-lg shrink-0',
                        dateCalculation.isFullYear
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-primary-500/10 text-primary-600 dark:text-primary-400'
                      )}>
                        <Calculator className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold flex items-center gap-1.5 flex-wrap">
                          <span>
                            {dateCalculation.isFullYear
                              ? `Full 100% Annual Quota (${selectedPolicy.hoursPerYear}h)`
                              : `Auto-Calculated Proration (${dateCalculation.percent}% of Year)`}
                          </span>
                          <Badge variant={dateCalculation.isFullYear ? 'outline' : 'brand'} className="text-[10px] font-mono py-0">
                            {dateCalculation.percent}%
                          </Badge>
                        </div>
                        <div className="text-[11px] opacity-80 font-mono mt-0.5">
                          {dateCalculation.activeDays} active day(s) / {dateCalculation.totalDaysInYear} days in {selectedYear} ({startDate} &rarr; {endDate})
                        </div>
                      </div>
                    </div>

                    {!dateCalculation.isFullYear && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setStartDate(`${selectedYear}-01-01`);
                          setEndDate(`${selectedYear}-12-31`);
                        }}
                        className="text-[11px] h-7 px-2.5 shrink-0"
                      >
                        Reset to Full Year
                      </Button>
                    )}
                  </div>
                )}

                {/* Allocated & Carried-Over Hours */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="assign-allocated">
                      Allocated / Frontloaded Hours <span className="text-rose-500">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="assign-allocated"
                        type="number"
                        step="0.1"
                        min="0"
                        placeholder="e.g. 40.0"
                        value={allocatedHours}
                        onChange={(e) => setAllocatedHours(e.target.value)}
                        required
                        className="pr-10 font-semibold"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted font-medium">
                        hrs
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="assign-carried">Carried-Over Hours</Label>
                    <div className="relative">
                      <Input
                        id="assign-carried"
                        type="number"
                        step="0.1"
                        min="0"
                        placeholder="0.0"
                        value={carriedOverHours}
                        onChange={(e) => setCarriedOverHours(e.target.value)}
                        className="pr-10"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted font-medium">
                        hrs
                      </span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              /* Multi-Policy Assignment Mode */
              <>
                {/* Period Dates (Start Date & End Date) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="assign-multi-start">Start Date</Label>
                      {selectedEmployee?.joinedDate && dayjs(selectedEmployee.joinedDate).year() === selectedYear && (
                        <span className="text-[10px] text-primary-600 font-mono">From hire date</span>
                      )}
                    </div>
                    <Input
                      id="assign-multi-start"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="assign-multi-end">End Date</Label>
                      <span className="text-[10px] text-muted font-mono">{selectedYear} Year-End</span>
                    </div>
                    <Input
                      id="assign-multi-end"
                      type="date"
                      value={endDate}
                      min={startDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                </div>

                {/* Auto-Calculation Banner for Multi-Policy Assignment */}
                {dateCalculation && (
                  <div className={cn(
                    'rounded-xl border p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs',
                    dateCalculation.isFullYear
                      ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-300'
                      : 'border-primary-200/80 bg-primary-50/50 dark:border-primary-900/60 dark:bg-primary-950/20 text-primary-950 dark:text-primary-300'
                  )}>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={cn(
                        'p-1.5 rounded-lg shrink-0',
                        dateCalculation.isFullYear
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-primary-500/10 text-primary-600 dark:text-primary-400'
                      )}>
                        <Calculator className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold flex items-center gap-1.5 flex-wrap">
                          <span>
                            {dateCalculation.isFullYear
                              ? 'Full 100% Annual Quotas Applied'
                              : `Auto-Calculated Proration (${dateCalculation.percent}% of Year)`}
                          </span>
                          <Badge variant={dateCalculation.isFullYear ? 'outline' : 'brand'} className="text-[10px] font-mono py-0">
                            {dateCalculation.percent}%
                          </Badge>
                        </div>
                        <div className="text-[11px] opacity-80 font-mono mt-0.5">
                          {dateCalculation.activeDays} active day(s) / {dateCalculation.totalDaysInYear} days in {selectedYear} ({startDate} &rarr; {endDate})
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                      {!dateCalculation.isFullYear ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setStartDate(`${selectedYear}-01-01`);
                            setEndDate(`${selectedYear}-12-31`);
                          }}
                          className="text-[11px] h-7 px-2.5"
                        >
                          Set Full Year (100%)
                        </Button>
                      ) : (
                        <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono">
                          Standard 365 Days
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Multi-Policy Selection Box */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-ink">
                      Select Leave Policies to Assign (
                      {Object.values(multiPolicies).filter((m) => m.selected).length} of{' '}
                      {policies.length} selected)
                    </Label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleSelectAll(true)}
                        className="h-6 text-[11px] text-primary-600 hover:text-primary-700"
                      >
                        Select All
                      </Button>
                      <span className="text-line text-xs">|</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleSelectAll(false)}
                        className="h-6 text-[11px] text-muted hover:text-ink"
                      >
                        Deselect All
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {policies.map((p) => {
                      const item = multiPolicies[p.id] || {
                        policyId: p.id,
                        selected: false,
                        allocatedHours: String(p.hoursPerYear ?? 40),
                        carriedOverHours: '0',
                      };

                      return (
                        <div
                          key={p.id}
                          className={cn(
                            'flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border transition-colors',
                            item.selected
                              ? 'border-primary-300 bg-primary-50/20 dark:border-primary-800 dark:bg-primary-950/20'
                              : 'border-line bg-subtle/30 opacity-75'
                          )}
                        >
                          <div className="flex items-start gap-2.5 min-w-0 flex-1">
                            <input
                              type="checkbox"
                              id={`modal-policy-${p.id}`}
                              checked={item.selected}
                              onChange={() => togglePolicyCheck(p.id)}
                              className="mt-1 size-4 rounded border-line text-primary-600 focus:ring-primary-500 cursor-pointer"
                            />
                            <div className="min-w-0">
                              <label
                                htmlFor={`modal-policy-${p.id}`}
                                className="text-xs font-semibold text-ink cursor-pointer flex items-center gap-1.5 flex-wrap"
                              >
                                <span>{p.name}</span>
                                <Badge variant="outline" className="font-mono text-[10px]">
                                  {p.code}
                                </Badge>
                                <span className="text-[10px] text-muted font-normal">
                                  ({p.category} • {p.isPaid ? 'Paid' : 'Unpaid'})
                                </span>
                              </label>
                              <p className="text-[10px] text-muted mt-0.5">
                                Standard: {p.hoursPerYear}h/yr • Accrual: {p.accrualType.replace(/_/g, ' ')}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pl-6 sm:pl-0 shrink-0">
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-muted">Alloc:</span>
                              <div className="relative w-18">
                                <Input
                                  type="number"
                                  step="any"
                                  min="0"
                                  disabled={!item.selected}
                                  value={item.allocatedHours}
                                  onChange={(e) => updatePolicyHours(p.id, e.target.value)}
                                  className="h-7 text-xs font-mono pr-4"
                                />
                                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-muted pointer-events-none font-mono">
                                  h
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-muted">Carry:</span>
                              <div className="relative w-16">
                                <Input
                                  type="number"
                                  step="any"
                                  min="0"
                                  disabled={!item.selected}
                                  value={item.carriedOverHours}
                                  onChange={(e) => updatePolicyCarryover(p.id, e.target.value)}
                                  className="h-7 text-xs font-mono pr-4"
                                />
                                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-muted pointer-events-none font-mono">
                                  h
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* Adjustment Notes / Audit Reason */}
            <div className="space-y-1.5">
              <Label htmlFor="assign-notes">Audit / Adjustment Reason (Optional)</Label>
              <textarea
                id="assign-notes"
                rows={2}
                placeholder="e.g. Annual policy quota assignment or mid-year hire proration"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={500}
                className="w-full rounded-lg border border-line bg-panel p-2.5 text-xs text-ink placeholder:text-muted focus:border-primary-500 focus:outline-none"
              />
            </div>
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={assignMutation.isPending || isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="brand"
              disabled={assignMutation.isPending || isSubmitting}
              className="gap-2"
            >
              {(assignMutation.isPending || isSubmitting) && <Loader2 className="size-4 animate-spin" />}
              {isSingleAdjustment
                ? 'Update Balance'
                : `Assign ${Object.values(multiPolicies).filter((m) => m.selected).length} Policies`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};