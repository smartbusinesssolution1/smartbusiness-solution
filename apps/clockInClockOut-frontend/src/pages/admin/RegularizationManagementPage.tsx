import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  FileText,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  Check,
  X,
  Loader2,
} from 'lucide-react';
import dayjs from 'dayjs';
import { cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { notify } from '../../context/NotificationContext';
import { regularizationService } from '../../services/regularizationService';
import type {
  AttendanceRegularization,
  RegularizationStatus,
  RegularizationReason,
} from '../../types';
import { getAvatarUrl } from '../../utils/imageUrl';
import {
  Button,
  Card,
  Badge,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '../../components/ui';

const REASON_LABELS: Record<RegularizationReason, string> = {
  MISSED_CLOCK_IN: 'Missed Clock In',
  MISSED_CLOCK_OUT: 'Missed Clock Out',
  MISSED_BOTH: 'Missed Both In & Out',
  ON_DUTY_CLIENT_VISIT: 'On Duty / Client Visit',
  WORK_FROM_HOME: 'Work From Home',
  TECHNICAL_ISSUE: 'Technical / Device Glitch',
  OTHER: 'Other Reason',
};

export const RegularizationManagementPage: React.FC = () => {
  const { currentWorkspace } = useAuth();
  const workspaceId = currentWorkspace?.id || '';
  const queryClient = useQueryClient();

  // Filters & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<RegularizationStatus | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const limit = 15;

  // Modals state
  const [selectedRequest, setSelectedRequest] = useState<AttendanceRegularization | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [reviewerNotes, setReviewerNotes] = useState('');

  // Fetch Requests Query
  const { data: listData, isLoading } = useQuery({
    queryKey: ['regularizations', workspaceId, statusFilter, page],
    queryFn: () =>
      regularizationService.list({
        workspaceId,
        status: statusFilter,
        page,
        limit,
      }),
    enabled: Boolean(workspaceId),
  });

  // Approve Mutation
  const approveMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      regularizationService.approve(id, notes, workspaceId),
    onSuccess: () => {
      notify('Regularization request approved and attendance record updated', 'success');
      queryClient.invalidateQueries({ queryKey: ['regularizations'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      setSelectedRequest(null);
      setActionType(null);
      setReviewerNotes('');
    },
    onError: (err: any) => {
      notify(err?.response?.data?.message || err?.message || 'Failed to approve request', 'error');
    },
  });

  // Reject Mutation
  const rejectMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      regularizationService.reject(id, notes, workspaceId),
    onSuccess: () => {
      notify('Regularization request rejected', 'info');
      queryClient.invalidateQueries({ queryKey: ['regularizations'] });
      setSelectedRequest(null);
      setActionType(null);
      setReviewerNotes('');
    },
    onError: (err: any) => {
      notify(err?.response?.data?.message || err?.message || 'Failed to reject request', 'error');
    },
  });

  const handleOpenReview = (req: AttendanceRegularization, type: 'approve' | 'reject') => {
    setSelectedRequest(req);
    setActionType(type);
    setReviewerNotes('');
  };

  const handleConfirmReview = () => {
    if (!selectedRequest || !actionType) return;
    if (actionType === 'approve') {
      approveMutation.mutate({ id: selectedRequest.id, notes: reviewerNotes });
    } else {
      rejectMutation.mutate({ id: selectedRequest.id, notes: reviewerNotes });
    }
  };

  // Filter items by client search term
  const filteredItems = useMemo(() => {
    const items = listData?.items || [];
    if (!searchTerm.trim()) return items;
    const term = searchTerm.toLowerCase();
    return items.filter((item) => {
      const empName = item.employee?.workspaceMember?.user?.fullName?.toLowerCase() || '';
      const empCode = item.employee?.employeeCode?.toLowerCase() || '';
      const reason = item.reasonText.toLowerCase();
      return empName.includes(term) || empCode.includes(term) || reason.includes(term);
    });
  }, [listData?.items, searchTerm]);

  // Compute metrics
  const metrics = useMemo(() => {
    const items = listData?.items || [];
    const pending = items.filter((r) => r.status === 'PENDING').length;
    const approved = items.filter((r) => r.status === 'APPROVED').length;
    const rejected = items.filter((r) => r.status === 'REJECTED' || r.status === 'CANCELLED').length;
    return { pending, approved, rejected, total: listData?.total || 0 };
  }, [listData]);

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary-50 rounded-xl border border-primary-100">
              <ShieldCheck className="size-5 text-primary-600" />
            </div>
            <h1 className="text-xl font-bold text-ink">Attendance Regularization</h1>
          </div>
          <p className="text-xs text-muted mt-1">
            Review and approve employee requests for missed clock-ins, missed clock-outs, or punch corrections.
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="p-4 flex items-center justify-between border-line">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted">Pending Review</span>
            <span className="text-2xl font-bold text-amber-600">{metrics.pending}</span>
          </div>
          <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
            <Clock className="size-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between border-line">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted">Approved</span>
            <span className="text-2xl font-bold text-emerald-600">{metrics.approved}</span>
          </div>
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
            <CheckCircle2 className="size-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between border-line">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted">Rejected / Cancelled</span>
            <span className="text-2xl font-bold text-rose-600">{metrics.rejected}</span>
          </div>
          <div className="p-3 bg-rose-50 rounded-xl text-rose-600">
            <XCircle className="size-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between border-line">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted">Total Requests</span>
            <span className="text-2xl font-bold text-ink">{metrics.total}</span>
          </div>
          <div className="p-3 bg-slate-100 rounded-xl text-slate-700">
            <FileText className="size-5" />
          </div>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-line">
        <div className="relative w-full sm:w-80">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input
            placeholder="Search employee, code, or note..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {(['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const).map((status) => (
            <button
              key={status}
              onClick={() => {
                setStatusFilter(status);
                setPage(1);
              }}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0',
                statusFilter === status
                  ? 'bg-primary-600 text-white shadow-xs'
                  : 'bg-subtle text-muted hover:text-ink'
              )}
            >
              {status === 'ALL' ? 'All Status' : status.charAt(0) + status.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </Card>

      {/* Requests Table */}
      <Card className="border-line overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-subtle/50">
              <TableHead className="text-xs">Employee</TableHead>
              <TableHead className="text-xs">Date</TableHead>
              <TableHead className="text-xs">Reason / Category</TableHead>
              <TableHead className="text-xs">Requested Times</TableHead>
              <TableHead className="text-xs">Original Punch</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-48 text-center text-xs text-muted">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Loader2 className="size-5 animate-spin text-primary-600" />
                    <span>Loading regularization requests...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-48 text-center text-xs text-muted">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <ShieldCheck className="size-8 text-muted/50" />
                    <span className="font-medium text-ink">No regularization requests found</span>
                    <span className="text-[0.6875rem]">All attendance records are up to date.</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredItems.map((item) => {
                const userObj = item.employee?.workspaceMember?.user;
                const empName = userObj?.fullName || 'Unknown Employee';
                const empCode = item.employee?.employeeCode || 'EMP';
                const avatar = getAvatarUrl(item.employee?.biometricPhotoUrl);
                const reqDate = dayjs(item.date).format('MMM DD, YYYY');
                const reqDay = dayjs(item.date).format('ddd');

                const formatTime = (iso?: string | null) => {
                  if (!iso) return '--';
                  return dayjs(iso).format('hh:mm A');
                };

                return (
                  <TableRow key={item.id} className="hover:bg-subtle/30 transition-colors">
                    {/* Employee */}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {avatar ? (
                          <img src={avatar} alt={empName} className="size-8 rounded-full object-cover border border-line" />
                        ) : (
                          <div className="size-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-semibold">
                            {empName.charAt(0)}
                          </div>
                        )}
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-ink">{empName}</span>
                          <span className="font-mono text-[0.625rem] text-muted">{empCode}</span>
                        </div>
                      </div>
                    </TableCell>

                    {/* Date */}
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-ink">{reqDate}</span>
                        <span className="font-mono text-[0.625rem] text-muted">{reqDay}</span>
                      </div>
                    </TableCell>

                    {/* Reason / Category */}
                    <TableCell>
                      <div className="flex flex-col gap-1 max-w-xs">
                        <span className="inline-block px-2 py-0.5 rounded text-[0.6875rem] font-semibold bg-primary-50 text-primary-700 w-fit">
                          {REASON_LABELS[item.reasonCategory] || item.reasonCategory}
                        </span>
                        <p className="text-[0.6875rem] text-muted line-clamp-1" title={item.reasonText}>
                          &quot;{item.reasonText}&quot;
                        </p>
                      </div>
                    </TableCell>

                    {/* Requested Times */}
                    <TableCell>
                      <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-ink">
                        <span>{formatTime(item.requestedClockInTime)}</span>
                        <ArrowRight className="size-3 text-muted" />
                        <span>{formatTime(item.requestedClockOutTime)}</span>
                      </div>
                    </TableCell>

                    {/* Original Punch */}
                    <TableCell>
                      {item.attendanceRecord ? (
                        <div className="flex flex-col font-mono text-[0.6875rem] text-muted">
                          <span>In: {formatTime(item.attendanceRecord.clockInTime)}</span>
                          <span>Out: {formatTime(item.attendanceRecord.clockOutTime)}</span>
                        </div>
                      ) : (
                        <span className="font-mono text-[0.6875rem] text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                          Absent / No Punch
                        </span>
                      )}
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      {item.status === 'PENDING' && (
                        <Badge variant="warning" className="gap-1 font-mono text-[0.625rem]">
                          <Clock className="size-3" />
                          <span>PENDING</span>
                        </Badge>
                      )}
                      {item.status === 'APPROVED' && (
                        <Badge variant="success" className="gap-1 font-mono text-[0.625rem]">
                          <CheckCircle2 className="size-3" />
                          <span>APPROVED</span>
                        </Badge>
                      )}
                      {item.status === 'REJECTED' && (
                        <Badge variant="destructive" className="gap-1 font-mono text-[0.625rem]">
                          <XCircle className="size-3" />
                          <span>REJECTED</span>
                        </Badge>
                      )}
                      {item.status === 'CANCELLED' && (
                        <Badge variant="outline" className="gap-1 font-mono text-[0.625rem] text-muted">
                          <span>CANCELLED</span>
                        </Badge>
                      )}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right">
                      {item.status === 'PENDING' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenReview(item, 'reject')}
                            className="h-7 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
                            title="Reject Request"
                          >
                            <X className="size-3.5" />
                          </Button>
                          <Button
                            variant="brand"
                            size="sm"
                            onClick={() => handleOpenReview(item, 'approve')}
                            className="h-7 px-2.5 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                            title="Approve Request"
                          >
                            <Check className="size-3.5" />
                            <span className="text-xs">Approve</span>
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedRequest(item);
                            setActionType(null);
                          }}
                          className="h-7 text-xs text-muted hover:text-ink"
                        >
                          Details
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Pagination Bar */}
        {listData && listData.totalPages > 1 && (
          <div className="p-4 border-t border-line flex items-center justify-between text-xs text-muted">
            <span>
              Showing Page {listData.page} of {listData.totalPages} ({listData.total} items)
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-7 w-7 p-0"
              >
                <ChevronLeft className="size-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= listData.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="h-7 w-7 p-0"
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Review / Decision Dialog */}
      <Dialog open={Boolean(selectedRequest)} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader
            title={
              actionType === 'approve'
                ? 'Approve Regularization'
                : actionType === 'reject'
                ? 'Reject Regularization'
                : 'Regularization Details'
            }
            description={
              actionType === 'approve'
                ? 'Approve request and update attendance record.'
                : actionType === 'reject'
                ? 'Decline employee attendance adjustment.'
                : 'Attendance correction history.'
            }
            icon={<ShieldCheck />}
          />
          <DialogBody>
            {selectedRequest && (
              <div className="flex flex-col gap-4 py-1 text-xs">
                {/* Employee & Date summary */}
                <div className="bg-subtle/50 p-3 rounded-xl flex items-center justify-between border border-line">
                  <div>
                    <span className="font-semibold text-ink">
                      {selectedRequest.employee?.workspaceMember?.user?.fullName}
                    </span>
                    <span className="block font-mono text-[0.625rem] text-muted">
                      Code: {selectedRequest.employee?.employeeCode}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold text-ink">
                      {dayjs(selectedRequest.date).format('MMM DD, YYYY')}
                    </span>
                    <span className="block text-[0.625rem] text-muted">
                      {REASON_LABELS[selectedRequest.reasonCategory]}
                    </span>
                  </div>
                </div>

                {/* Justification Note */}
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-ink">Employee Explanation:</span>
                  <p className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 italic leading-relaxed">
                    &quot;{selectedRequest.reasonText}&quot;
                  </p>
                </div>

                {/* Timings comparison */}
                <div className="grid grid-cols-2 gap-3 p-3 bg-primary-50/50 border border-primary-100 rounded-xl">
                  <div>
                    <span className="font-semibold text-primary-700 block mb-1">Requested Clock In</span>
                    <span className="font-mono text-sm font-bold text-ink">
                      {selectedRequest.requestedClockInTime
                        ? dayjs(selectedRequest.requestedClockInTime).format('hh:mm A')
                        : 'Standard (09:00 AM)'}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-primary-700 block mb-1">Requested Clock Out</span>
                    <span className="font-mono text-sm font-bold text-ink">
                      {selectedRequest.requestedClockOutTime
                        ? dayjs(selectedRequest.requestedClockOutTime).format('hh:mm A')
                        : 'Standard (06:00 PM)'}
                    </span>
                  </div>
                </div>

                {/* Reviewer Note Input for Decision */}
                {actionType && (
                  <div className="flex flex-col gap-1.5 pt-2">
                    <label className="font-semibold text-ink">
                      Reviewer Notes {actionType === 'reject' && <span className="text-rose-500">*</span>}
                    </label>
                    <textarea
                      rows={3}
                      value={reviewerNotes}
                      onChange={(e) => setReviewerNotes(e.target.value)}
                      placeholder={
                        actionType === 'approve'
                          ? 'Optional note (e.g. Verified with team lead).'
                          : 'Reason for rejection (e.g. Inconsistent shift evidence).'
                      }
                      className="w-full rounded-xl border border-line p-2.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    />
                  </div>
                )}

                {/* Past Review Info if already reviewed */}
                {selectedRequest.status !== 'PENDING' && selectedRequest.reviewer && (
                  <div className="p-3 bg-slate-100 rounded-xl flex flex-col gap-1 text-[0.6875rem] text-muted">
                    <span>Reviewed by: <strong>{selectedRequest.reviewer.fullName}</strong></span>
                    {selectedRequest.reviewerNotes && <span>Notes: &quot;{selectedRequest.reviewerNotes}&quot;</span>}
                    {selectedRequest.reviewedAt && (
                      <span>Date: {dayjs(selectedRequest.reviewedAt).format('MMM DD, YYYY hh:mm A')}</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSelectedRequest(null)}>
              Cancel
            </Button>
            {actionType === 'approve' && (
              <Button
                variant="brand"
                size="sm"
                onClick={handleConfirmReview}
                disabled={approveMutation.isPending}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {approveMutation.isPending && <Loader2 className="size-3.5 animate-spin" />}
                <span>Confirm Approval</span>
              </Button>
            )}
            {actionType === 'reject' && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleConfirmReview}
                disabled={rejectMutation.isPending}
                className="gap-2"
              >
                {rejectMutation.isPending && <Loader2 className="size-3.5 animate-spin" />}
                <span>Confirm Rejection</span>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RegularizationManagementPage;
