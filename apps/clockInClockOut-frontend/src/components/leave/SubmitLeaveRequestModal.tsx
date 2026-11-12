import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, AlertCircle, Loader2, Clock, CheckCircle2, FileText, UploadCloud, ExternalLink, FileCheck, Calculator, Sparkles } from 'lucide-react';
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
import { leaveService, LeavePolicy, EmployeeLeaveBalance, SubmitLeaveRequestPayload } from '../../services/leave.service';
import { notify } from '../../context/NotificationContext';
import dayjs from 'dayjs';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  onSuccess?: () => void;
}

export const SubmitLeaveRequestModal: React.FC<Props> = ({
  open,
  onOpenChange,
  workspaceId,
  onSuccess,
}) => {
  const queryClient = useQueryClient();

  const [selectedPolicyId, setSelectedPolicyId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(dayjs().format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState<string>(dayjs().format('YYYY-MM-DD'));
  const [totalHours, setTotalHours] = useState<string>('8');
  const [isIntermittent, setIsIntermittent] = useState<boolean>(false);
  const [reason, setReason] = useState<string>('');
  const [attachmentUrl, setAttachmentUrl] = useState<string>('');
  const [isUploadingDoc, setIsUploadingDoc] = useState<boolean>(false);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingDoc(true);
    setErrorMsg(null);
    try {
      const res = await leaveService.uploadLeaveDocument(file, workspaceId);
      setAttachmentUrl(res.url);
      setUploadedFileName(file.name);
      notify('Medical document uploaded successfully', 'success');
    } catch (err: any) {
      notify(err.response?.data?.message || 'Failed to upload document', 'error');
    } finally {
      setIsUploadingDoc(false);
    }
  };

  // Fetch policies
  const { data: policies = [], isLoading: isPoliciesLoading } = useQuery({
    queryKey: ['leavePolicies', workspaceId],
    queryFn: () => leaveService.listPolicies(workspaceId, true),
    enabled: Boolean(open && workspaceId),
  });

  // Fetch balances
  const { data: balances = [] } = useQuery({
    queryKey: ['myLeaveBalances', workspaceId],
    queryFn: () => leaveService.getMyBalances(workspaceId),
    enabled: Boolean(open && workspaceId),
  });

  useEffect(() => {
    if (policies.length > 0 && !selectedPolicyId) {
      setSelectedPolicyId(policies[0].id);
    }
  }, [policies, selectedPolicyId]);

  const selectedPolicy = useMemo(() => {
    return policies.find((p) => p.id === selectedPolicyId) || null;
  }, [policies, selectedPolicyId]);

  const selectedBalance = useMemo(() => {
    return balances.find((b) => b.policyId === selectedPolicyId) || null;
  }, [balances, selectedPolicyId]);

  // Auto-calculate suggested working days based on date range (excluding weekends)
  const workingDaysCount = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const s = dayjs(startDate);
    const e = dayjs(endDate);
    if (!s.isValid() || !e.isValid() || e.isBefore(s)) return 0;

    let count = 0;
    let cur = s;
    while (cur.isBefore(e) || cur.isSame(e)) {
      const dow = cur.day();
      if (dow !== 0 && dow !== 6) count++;
      cur = cur.add(1, 'day');
    }
    return count;
  }, [startDate, endDate]);

  // Auto-set suggested hours based on working days (8h per day)
  useEffect(() => {
    if (workingDaysCount > 0) {
      setTotalHours(String(workingDaysCount * 8));
    } else if (startDate && endDate) {
      setTotalHours('8');
    }
  }, [workingDaysCount, startDate, endDate]);

  const daysCount = useMemo(() => {
    if (!startDate || !endDate) return 1;
    return dayjs(endDate).diff(dayjs(startDate), 'day') + 1;
  }, [startDate, endDate]);

  const needsDoc = useMemo(() => {
    if (!selectedPolicy?.requiresDocDays) return false;
    return daysCount >= selectedPolicy.requiresDocDays;
  }, [selectedPolicy, daysCount]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const payload: SubmitLeaveRequestPayload = {
        policyId: selectedPolicyId,
        startDate,
        endDate,
        totalHours: parseFloat(totalHours),
        isIntermittent,
        reason: reason.trim() || undefined,
        attachmentUrl: attachmentUrl.trim() || undefined,
        workspaceId,
      };

      return leaveService.submitRequest(payload);
    },
    onSuccess: () => {
      notify('Leave request submitted successfully', 'success');
      queryClient.invalidateQueries({ queryKey: ['myLeaveBalances', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['myLeaveRequests', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['adminLeaveRequests', workspaceId] });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error?.message ||
        err?.message ||
        'Failed to submit request';
      setErrorMsg(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPolicyId) {
      setErrorMsg('Please select a leave policy.');
      return;
    }
    const hours = parseFloat(totalHours);
    if (isNaN(hours) || hours <= 0) {
      setErrorMsg('Total hours must be greater than 0.');
      return;
    }
    if (needsDoc && !attachmentUrl.trim()) {
      setErrorMsg(`Requests of ${selectedPolicy?.requiresDocDays} days or more require proof/document URL.`);
      return;
    }
    setErrorMsg(null);
    submitMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader
          title="Request Time Off"
          description="Submit a leave or absence request against your available policy balance."
          icon={<Calendar className="size-4 text-primary-600" />}
        />
        <form onSubmit={handleSubmit} className="flex flex-col">
          <DialogBody className="space-y-4">
            {errorMsg && (
              <div className="flex items-center gap-2 rounded-lg bg-danger-50 p-3 text-xs text-danger-700 border border-danger-200">
                <AlertCircle className="size-4 shrink-0 text-danger-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Policy Selector */}
            <div className="space-y-1.5">
              <Label htmlFor="req-policy">Leave Policy *</Label>
              {isPoliciesLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted py-2">
                  <Loader2 className="size-3.5 animate-spin" /> Loading policies...
                </div>
              ) : (
                <select
                  id="req-policy"
                  value={selectedPolicyId}
                  onChange={(e) => setSelectedPolicyId(e.target.value)}
                  className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-xs font-medium text-ink focus:border-primary-500 focus:outline-none"
                  required
                >
                  {policies.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code}) — {p.isPaid ? 'Paid' : 'Unpaid'}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Balance Card Banner */}
            {selectedPolicy && (
              <div className="flex items-center justify-between rounded-xl border border-primary-200/80 bg-primary-50/50 dark:bg-primary-950/20 dark:border-primary-800/80 p-3 text-xs">
                <div>
                  <div className="font-semibold text-primary-950 dark:text-primary-100">{selectedPolicy.name}</div>
                  <div className="text-[0.6875rem] text-primary-700 dark:text-primary-300 font-mono">
                    Category: {selectedPolicy.category} &bull; {selectedPolicy.isPaid ? 'Paid' : 'Unpaid'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black text-primary-600 dark:text-primary-400">
                    {selectedBalance?.availableHours ?? '--'} hrs
                  </div>
                  <div className="text-[0.625rem] text-muted uppercase tracking-wider font-semibold">
                    Available Balance
                  </div>
                </div>
              </div>
            )}

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="req-start">Start Date *</Label>
                <Input
                  id="req-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="req-end">End Date *</Label>
                <Input
                  id="req-end"
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Auto-Calculation Breakdown Banner */}
            {workingDaysCount > 0 && (
              <div className="rounded-xl border border-primary-200/80 bg-primary-50/50 dark:bg-primary-950/20 dark:border-primary-900/60 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-primary-950 dark:text-primary-300">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-md bg-primary-500/10 text-primary-600 dark:text-primary-400">
                    <Calculator className="size-3.5" />
                  </div>
                  <div>
                    <span>
                      Auto-calculated: <strong>{workingDaysCount} working day(s)</strong> (Mon-Fri) &times; 8h = <strong>{workingDaysCount * 8}h</strong>
                    </span>
                    {daysCount > workingDaysCount && (
                      <span className="text-[10px] text-muted block">
                        ({daysCount - workingDaysCount} weekend day(s) excluded)
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => setTotalHours(String(workingDaysCount * 8))}
                    className="px-2 py-0.5 rounded bg-primary-600 text-white text-[11px] font-medium hover:bg-primary-700 transition-colors shadow-2xs"
                  >
                    Full Days ({workingDaysCount * 8}h)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTotalHours(String(workingDaysCount * 4))}
                    className="px-2 py-0.5 rounded bg-panel border border-line text-ink text-[11px] font-medium hover:bg-subtle transition-colors shadow-2xs"
                  >
                    Half Days ({workingDaysCount * 4}h)
                  </button>
                </div>
              </div>
            )}

            {/* Hours & Notice Info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="req-hours">Total Hours Requested *</Label>
                <Input
                  id="req-hours"
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="480"
                  value={totalHours}
                  onChange={(e) => setTotalHours(e.target.value)}
                  required
                />
                <p className="text-[0.6875rem] text-muted">Estimated {daysCount} calendar day(s)</p>
              </div>

              <div className="flex flex-col justify-center rounded-lg border border-line bg-subtle/30 p-2 text-xs">
                <div className="font-semibold text-ink">Advance Notice</div>
                <div className="text-[0.6875rem] text-muted">
                  {selectedPolicy?.minNoticeDays
                    ? `${selectedPolicy.minNoticeDays} days required by policy`
                    : 'Immediate / Emergency allowed'}
                </div>
              </div>
            </div>

            {/* Reason */}
            <div className="space-y-1.5">
              <Label htmlFor="req-reason">Reason / Notes</Label>
              <Input
                id="req-reason"
                placeholder="Doctor appointment, personal errand, etc."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            {/* Documentation requirement if days >= requiresDocDays */}
            {needsDoc && (
              <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
                    <FileText className="size-4 text-amber-600 dark:text-amber-400" />
                    <span>Statutory Medical Certification Required</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40 font-mono">
                    CA § 246 / NY § 196-b
                  </Badge>
                </div>
                <p className="text-[11px] text-amber-900/80 dark:text-amber-200/80 leading-relaxed">
                  Requests of {selectedPolicy?.requiresDocDays || 3} or more consecutive days under this statutory policy require a doctor&apos;s note or proof of medical necessity.
                </p>

                {/* Upload Zone */}
                <div className="pt-1">
                  {attachmentUrl ? (
                    <div className="flex items-center justify-between p-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                      <div className="flex items-center gap-2 truncate">
                        <FileCheck className="size-4 shrink-0 text-emerald-600" />
                        <span className="text-xs font-medium truncate">{uploadedFileName || 'Medical Note Attached'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={attachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs underline hover:text-emerald-900 dark:hover:text-emerald-100 flex items-center gap-0.5"
                        >
                          View <ExternalLink className="size-3" />
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                            setAttachmentUrl('');
                            setUploadedFileName('');
                          }}
                          className="text-xs text-red-600 hover:underline ml-2"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-amber-500/40 hover:border-amber-500/70 rounded-xl cursor-pointer bg-card/60 transition-colors group">
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                          className="hidden"
                          onChange={handleFileUpload}
                          disabled={isUploadingDoc}
                        />
                        {isUploadingDoc ? (
                          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 py-1">
                            <Loader2 className="size-4 animate-spin" />
                            <span>Uploading medical document to secure storage...</span>
                          </div>
                        ) : (
                          <>
                            <UploadCloud className="size-6 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform mb-1" />
                            <span className="text-xs font-semibold text-foreground">
                              Click to upload Doctor&apos;s Note / Certificate
                            </span>
                            <span className="text-[10px] text-muted-foreground mt-0.5">
                              PDF, PNG, JPG, or DOCX (up to 10MB)
                            </span>
                          </>
                        )}
                      </label>

                      {/* Fallback direct URL input */}
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-[10px] text-muted-foreground">or paste URL:</span>
                        <Input
                          placeholder="https://..."
                          value={attachmentUrl}
                          onChange={(e) => setAttachmentUrl(e.target.value)}
                          className="h-7 text-[11px]"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitMutation.isPending}
              className="gap-2"
            >
              {submitMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Submit Request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
