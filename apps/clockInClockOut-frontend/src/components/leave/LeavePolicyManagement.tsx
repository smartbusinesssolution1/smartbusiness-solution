import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Briefcase,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  Sparkles,
  ShieldCheck,
  Calendar,
  Clock,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
} from '../ui';
import { leaveService, LeavePolicy } from '../../services/leave.service';
import { CreateLeavePolicyModal } from './CreateLeavePolicyModal';
import { notify } from '../../context/NotificationContext';

interface Props {
  workspaceId: string;
}

export const LeavePolicyManagement: React.FC<Props> = ({ workspaceId }) => {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedForEdit, setSelectedForEdit] = useState<LeavePolicy | null>(null);

  const {
    data: policies = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['leavePolicies', workspaceId],
    queryFn: () => leaveService.listPolicies(workspaceId),
    enabled: Boolean(workspaceId),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => leaveService.deletePolicy(id, workspaceId),
    onSuccess: () => {
      notify('Leave policy deleted successfully', 'success');
      queryClient.invalidateQueries({ queryKey: ['leavePolicies', workspaceId] });
    },
    onError: (err: any) => {
      notify(
        err?.response?.data?.message || err?.message || 'Failed to delete leave policy',
        'error'
      );
    },
  });

  const seedPresetsMutation = useMutation({
    mutationFn: () => leaveService.seedUsPresets(workspaceId, 'ALL'),
    onSuccess: (data) => {
      notify(`Loaded ${data.length} US statutory leave policies (CA PSL, NY PSL, IL PLAAR, PTO, Vacation, FMLA)`, 'success');
      queryClient.invalidateQueries({ queryKey: ['leavePolicies', workspaceId] });
    },
    onError: (err: any) => {
      notify(
        err?.response?.data?.message || err?.message || 'Failed to load presets',
        'error'
      );
    },
  });

  const handleCreateNew = () => {
    setSelectedForEdit(null);
    setModalOpen(true);
  };

  const handleEdit = (policy: LeavePolicy) => {
    setSelectedForEdit(policy);
    setModalOpen(true);
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to deactivate and delete "${name}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  const formatAccrualType = (type: string) => {
    switch (type) {
      case 'HOURLY_ACCRUAL':
        return 'Hourly Work Accrual';
      case 'FRONTLOAD':
        return 'Annual Frontload';
      case 'PER_PAY_PERIOD':
        return 'Per Pay-Period';
      case 'UNLIMITED':
        return 'Unlimited';
      default:
        return type;
    }
  };

  return (
    <Card className="flex flex-col gap-4 border border-line bg-panel p-5">
      <CardHeader className="flex flex-row items-center justify-between p-0">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-primary-600 font-semibold text-sm">
            <Briefcase className="size-4" />
            <span>US Leave Policies &amp; Quotas</span>
          </div>
          <CardTitle className="text-base font-semibold text-ink">
            Leave &amp; Time-Off Governance
          </CardTitle>
          <CardDescription className="text-xs text-muted">
            Configure vacation, statutory sick leave (CA/NY/IL), bereavement, and FMLA policies with state-compliant accrual rules.
          </CardDescription>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => seedPresetsMutation.mutate()}
            disabled={seedPresetsMutation.isPending}
            className="gap-1.5 text-xs"
          >
            <Sparkles className="size-3.5 text-amber-500" />
            <span>{seedPresetsMutation.isPending ? 'Seeding Policies...' : 'Load US State Presets'}</span>
          </Button>

          <Button
            variant="brand"
            size="sm"
            onClick={handleCreateNew}
            className="gap-1.5 text-xs"
          >
            <Plus className="size-3.5" />
            <span>Create Leave Policy</span>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0 pt-2">
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="size-6 animate-spin text-primary-600" />
          </div>
        ) : policies.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line p-8 text-center bg-subtle/20">
            <div className="flex size-10 items-center justify-center rounded-xl bg-subtle text-muted">
              <Briefcase className="size-5" />
            </div>
            <div className="flex flex-col gap-1">
              <div className="text-sm font-semibold text-ink">No leave policies configured</div>
              <p className="max-w-md text-xs text-muted">
                Load standard US compliance policies (California Paid Sick Leave, New York PSL, Illinois PLAAR, Standard PTO, FMLA) or create your own custom policy.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => seedPresetsMutation.mutate()}
                disabled={seedPresetsMutation.isPending}
                className="gap-1.5 text-xs"
              >
                <Sparkles className="size-3.5 text-amber-500" />
                <span>Load US State Presets</span>
              </Button>
              <Button variant="brand" size="sm" onClick={handleCreateNew} className="gap-1.5 text-xs">
                <Plus className="size-3.5" />
                <span>Create Leave Policy</span>
              </Button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-left text-xs">
              <thead className="bg-subtle/60 text-muted uppercase tracking-wider text-[0.6875rem] border-b border-line">
                <tr>
                  <th className="px-4 py-3 font-semibold">Code</th>
                  <th className="px-4 py-3 font-semibold">Policy Name &amp; Category</th>
                  <th className="px-4 py-3 font-semibold">Accrual Method</th>
                  <th className="px-4 py-3 font-semibold">Annual Quota</th>
                  <th className="px-4 py-3 font-semibold">US Compliance</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60 bg-panel">
                {policies.map((p) => (
                  <tr key={p.id} className="hover:bg-subtle/30 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-ink">
                      <span className="rounded bg-subtle px-2 py-0.5 border border-line text-primary-700">
                        {p.code}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-ink">{p.name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[0.6875rem] font-mono text-muted uppercase">
                          {p.category}
                        </span>
                        {p.description && (
                          <span className="text-[0.6875rem] text-muted truncate max-w-xs">
                            &bull; {p.description}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink">{formatAccrualType(p.accrualType)}</div>
                      {p.accrualCapHours && (
                        <div className="text-[0.6875rem] text-muted font-mono">
                          Cap: {p.accrualCapHours} hrs
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-ink">
                      <div className="font-semibold">{p.hoursPerYear} hrs/yr</div>
                      <div className="text-[0.6875rem] text-muted">
                        Rollover: {p.maxCarryoverHours} hrs
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <Badge variant={p.isPaid ? 'success' : 'outline'} className="text-[0.625rem]">
                            {p.isPaid ? 'Paid' : 'Unpaid'}
                          </Badge>
                        </div>
                        {p.requiresDocDays && (
                          <div className="text-[0.625rem] text-muted">
                            Doc if &ge; {p.requiresDocDays}d
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {p.isActive ? (
                        <span className="inline-flex items-center gap-1 text-[0.6875rem] font-medium text-emerald-600">
                          <CheckCircle2 className="size-3" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[0.6875rem] font-medium text-muted">
                          <XCircle className="size-3" /> Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleEdit(p)}
                          title="Edit policy"
                        >
                          <Pencil className="size-3.5 text-muted hover:text-ink" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleDelete(p.id, p.name)}
                          title="Delete policy"
                          className="hover:text-rose-600"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <CreateLeavePolicyModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        workspaceId={workspaceId}
        policyToEdit={selectedForEdit}
        onSuccess={() => refetch()}
      />
    </Card>
  );
};
