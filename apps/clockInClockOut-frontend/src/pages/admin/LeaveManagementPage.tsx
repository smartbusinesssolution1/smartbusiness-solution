import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  Filter,
  Plus,
  Sparkles,
  FileText,
  User,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Info,
  Calendar,
  AlertTriangle,
  RotateCcw,
  UserCheck,
  History,
  Send,
  Ban,
  ExternalLink,
  Scale,
  FileSpreadsheet,
  DollarSign,
  Sliders,
  MoreHorizontal,
} from 'lucide-react';
import dayjs from 'dayjs';
import { cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { notify } from '../../context/NotificationContext';
import { leaveService, LeaveRequest, LeaveRequestStatus } from '../../services/leave.service';
import { employeeService } from '../../services/employeeService';
import type { User as EmployeeUser } from '../../types';
import { LeavePolicyManagement } from '../../components/leave/LeavePolicyManagement';
import { CreateLeavePolicyModal } from '../../components/leave/CreateLeavePolicyModal';
import { SubmitLeaveRequestModal } from '../../components/leave/SubmitLeaveRequestModal';
import { TeamLeaveCalendar } from '../../components/leave/TeamLeaveCalendar';
import { PayrollExportModal } from '../../components/leave/PayrollExportModal';
import { AssignLeaveBalanceModal } from '../../components/leave/AssignLeaveBalanceModal';
import {
  Menu,
  MenuTrigger,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuLabel,
} from '../../components/ui/menu';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
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

export const LeaveManagementPage: React.FC = () => {
  const { currentWorkspace, currentTenant, isSuperAdmin, user } = useAuth();
  const isOwner = Boolean(
    currentTenant?.role === 'OWNER' ||
    currentWorkspace?.role === 'OWNER' ||
    currentWorkspace?.userRole === 'OWNER' ||
    isSuperAdmin
  );
  const workspaceId = currentWorkspace?.id || '';
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'requests' | 'my-time-off' | 'calendar' | 'balances' | 'policies' | 'compliance'>('requests');

  useEffect(() => {
    if (isOwner && activeTab === 'my-time-off') {
      setActiveTab('requests');
    }
  }, [isOwner, activeTab]);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [myStatusFilter, setMyStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Staff Balances Search, Filter, Pagination & Expand State
  const [balanceSearchQuery, setBalanceSearchQuery] = useState('');
  const [balancePolicyFilter, setBalancePolicyFilter] = useState('ALL');
  const [balancesPage, setBalancesPage] = useState(0);
  const [balancesRowsPerPage, setBalancesRowsPerPage] = useState(10);
  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set());

  // Modals
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [createPolicyModalOpen, setCreatePolicyModalOpen] = useState(false);
  const [hoursExportOpen, setHoursExportOpen] = useState(false);
  const [assignBalanceModalOpen, setAssignBalanceModalOpen] = useState(false);
  const [balanceToAdjust, setBalanceToAdjust] = useState<any | null>(null);

  // Review Dialog
  const [reviewRequestItem, setReviewRequestItem] = useState<LeaveRequest | null>(null);
  const [reviewDecision, setReviewDecision] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [reviewerComment, setReviewerComment] = useState('');

  // Cancel Confirmation Dialog
  const [cancelTargetRequest, setCancelTargetRequest] = useState<LeaveRequest | null>(null);

  // Conflict Check Query for Manager Review
  const { data: conflictData } = useQuery({
    queryKey: [
      'staffingConflict',
      workspaceId,
      reviewRequestItem?.employeeId,
      reviewRequestItem?.startDate,
      reviewRequestItem?.endDate,
    ],
    queryFn: () =>
      leaveService.checkStaffingConflict(
        workspaceId,
        reviewRequestItem!.employeeId,
        reviewRequestItem!.startDate.slice(0, 10),
        reviewRequestItem!.endDate.slice(0, 10),
        reviewRequestItem!.id
      ),
    enabled: Boolean(
      workspaceId &&
        reviewRequestItem &&
        reviewRequestItem.employeeId &&
        reviewRequestItem.startDate &&
        reviewRequestItem.endDate &&
        reviewDecision === 'APPROVED'
    ),
  });

  // Fetch Requests (All / Admin)
  const {
    data: requests = [],
    isLoading: isRequestsLoading,
    refetch: refetchRequests,
  } = useQuery({
    queryKey: ['leaveRequests', workspaceId],
    queryFn: () => leaveService.listRequests(workspaceId),
    enabled: Boolean(workspaceId),
  });

  // Fetch My Personal Requests (Self-Service)
  const {
    data: myRequests = [],
    isLoading: isMyRequestsLoading,
    refetch: refetchMyRequests,
  } = useQuery({
    queryKey: ['myLeaveRequests', workspaceId],
    queryFn: () => leaveService.getMyRequests(workspaceId),
    enabled: Boolean(workspaceId && !isOwner),
  });

  // Fetch My Personal Balances (Self-Service)
  const {
    data: myBalances = [],
    isLoading: isMyBalancesLoading,
    refetch: refetchMyBalances,
  } = useQuery({
    queryKey: ['myLeaveBalances', workspaceId],
    queryFn: () => leaveService.getMyBalances(workspaceId),
    enabled: Boolean(workspaceId && !isOwner),
  });

  // Cancel Request Mutation (Self-Service or Admin)
  const cancelMutation = useMutation({
    mutationFn: (requestId: string) => leaveService.cancelRequest(requestId, workspaceId),
    onSuccess: () => {
      notify('Leave request cancelled successfully. Reserved/used hours restored to balance.', 'success');
      queryClient.invalidateQueries({ queryKey: ['myLeaveRequests', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['leaveRequests', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['myLeaveBalances', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['workspaceLeaveBalances', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['teamCalendarLeaves'] });
      setCancelTargetRequest(null);
    },
    onError: (err: any) => {
      notify(err?.response?.data?.error?.message || err?.message || 'Failed to cancel request', 'error');
    },
  });

  const handleConfirmCancel = () => {
    if (!cancelTargetRequest) return;
    cancelMutation.mutate(cancelTargetRequest.id);
  };

  // Fetch Policies
  const { data: policies = [] } = useQuery({
    queryKey: ['leavePolicies', workspaceId],
    queryFn: () => leaveService.listPolicies(workspaceId),
    enabled: Boolean(workspaceId),
  });

  // Fetch Balances
  const {
    data: workspaceBalances = [],
    isLoading: isBalancesLoading,
    refetch: refetchBalances,
  } = useQuery({
    queryKey: ['workspaceLeaveBalances', workspaceId],
    queryFn: () => leaveService.listWorkspaceBalances(workspaceId),
    enabled: Boolean(workspaceId),
  });

  // Fetch Workspace Employees for reliable name/code resolution
  const { data: employeesData } = useQuery({
    queryKey: ['workspaceEmployees', workspaceId],
    queryFn: () => employeeService.getEmployees({ workspaceId, limit: 100 }),
    enabled: Boolean(workspaceId),
  });

  const employeeMap = useMemo(() => {
    const map = new Map<string, EmployeeUser>();
    (employeesData?.items || []).forEach((emp) => {
      map.set(emp.id, emp);
      if (emp.userId) map.set(emp.userId, emp);
    });
    return map;
  }, [employeesData]);

  // Helper to check if an employee belongs to the current user
  const isSelfEmployee = (employeeId?: string, empObj?: any) => {
    if (!user) return false;
    const empFromMap = employeeId ? employeeMap.get(employeeId) : (empObj?.id ? employeeMap.get(empObj.id) : null);
    const empUserId = empObj?.workspaceMember?.user?.id || empFromMap?.userId;
    const empEmail = empObj?.workspaceMember?.user?.email || empFromMap?.email;
    const empCode = empObj?.employeeCode || empFromMap?.employeeId;
    const empName = empFromMap?.name || empObj?.workspaceMember?.user?.fullName;

    return Boolean(
      (user.id && (employeeId === user.id || empObj?.id === user.id || empUserId === user.id)) ||
      (user.userId && (employeeId === user.userId || empObj?.id === user.userId || empUserId === user.userId)) ||
      (user.employeeId && empCode && empCode.toLowerCase() === user.employeeId.toLowerCase()) ||
      (user.email && empEmail && empEmail.toLowerCase() === user.email.toLowerCase()) ||
      (user.name && empName && user.name.trim().toLowerCase() === empName.trim().toLowerCase()) ||
      (empFromMap && (empFromMap.id === user.id || empFromMap.userId === user.id || empFromMap.userId === user.userId))
    );
  };

  // Filter out self user entry from staff balances
  const filteredWorkspaceBalances = useMemo(() => {
    return workspaceBalances.filter((b: any) => !isSelfEmployee(b.employeeId, b.employee));
  }, [workspaceBalances, user, employeeMap]);

  const toggleExpandEmployee = (employeeId: string) => {
    setExpandedEmployees((prev) => {
      const next = new Set(prev);
      if (next.has(employeeId)) {
        next.delete(employeeId);
      } else {
        next.add(employeeId);
      }
      return next;
    });
  };

  const toggleExpandAll = () => {
    if (expandedEmployees.size === paginatedGroups.length && paginatedGroups.length > 0) {
      setExpandedEmployees(new Set());
    } else {
      setExpandedEmployees(new Set(paginatedGroups.map((g) => g.employeeId)));
    }
  };

  // Group staff balances by employee so each staff member has one consolidated entry
  const groupedWorkspaceBalances = useMemo(() => {
    const map = new Map<string, {
      employeeId: string;
      empName: string;
      empCode: string;
      empDept: string;
      empEmail: string;
      empAvatar?: string;
      balances: any[];
      totalAccrued: number;
      totalCarriedOver: number;
      totalUsed: number;
      totalPending: number;
      totalAvailable: number;
    }>();

    filteredWorkspaceBalances.forEach((b: any) => {
      const empId = b.employeeId || b.employee?.id || 'unknown';
      const empFromMap = employeeMap.get(empId) || (b.employee?.id ? employeeMap.get(b.employee.id) : null);
      const empUser = b.employee?.workspaceMember?.user;
      const empName = empFromMap?.name || empUser?.fullName || (empUser as any)?.name || b.employee?.employeeCode || 'Employee';
      const empEmail = empFromMap?.email || empUser?.email || '';
      const empCode = empFromMap?.employeeId || b.employee?.employeeCode || '';
      const empDept = empFromMap?.department || b.employee?.department || '';
      const empAvatar = empFromMap?.avatarUrl || (empUser as any)?.avatarUrl;

      const accrued = (Number(b.accruedHours) || 0) + (Number(b.allocatedHours) || 0);
      const carried = Number(b.carriedOverHours) || 0;
      const used = Number(b.usedHours) || 0;
      const pending = Number(b.pendingHours) || 0;
      const available = Number(b.availableHours) || 0;

      if (!map.has(empId)) {
        map.set(empId, {
          employeeId: empId,
          empName,
          empCode,
          empDept,
          empEmail,
          empAvatar,
          balances: [b],
          totalAccrued: accrued,
          totalCarriedOver: carried,
          totalUsed: used,
          totalPending: pending,
          totalAvailable: available,
        });
      } else {
        const item = map.get(empId)!;
        item.balances.push(b);
        item.totalAccrued += accrued;
        item.totalCarriedOver += carried;
        item.totalUsed += used;
        item.totalPending += pending;
        item.totalAvailable += available;
      }
    });

    return Array.from(map.values());
  }, [filteredWorkspaceBalances, employeeMap]);

  // Filter grouped staff balances
  const filteredGroupedBalances = useMemo(() => {
    return groupedWorkspaceBalances.filter((group) => {
      if (balancePolicyFilter !== 'ALL') {
        const hasPolicy = group.balances.some(
          (b) => b.policyId === balancePolicyFilter || b.policy?.code === balancePolicyFilter || b.policy?.category === balancePolicyFilter
        );
        if (!hasPolicy) return false;
      }

      if (balanceSearchQuery.trim()) {
        const q = balanceSearchQuery.toLowerCase();
        const matchName = group.empName.toLowerCase().includes(q);
        const matchCode = group.empCode.toLowerCase().includes(q);
        const matchDept = group.empDept.toLowerCase().includes(q);
        const matchEmail = group.empEmail.toLowerCase().includes(q);
        const matchPolicy = group.balances.some((b) => (b.policy?.name || '').toLowerCase().includes(q));
        if (!matchName && !matchCode && !matchDept && !matchEmail && !matchPolicy) {
          return false;
        }
      }

      return true;
    });
  }, [groupedWorkspaceBalances, balanceSearchQuery, balancePolicyFilter]);

  const totalBalancePages = Math.ceil(filteredGroupedBalances.length / balancesRowsPerPage) || 1;

  const paginatedGroups = useMemo(() => {
    const start = balancesPage * balancesRowsPerPage;
    return filteredGroupedBalances.slice(start, start + balancesRowsPerPage);
  }, [filteredGroupedBalances, balancesPage, balancesRowsPerPage]);

  // Pay Period Accrual Mutation
  const payPeriodAccrualMutation = useMutation({
    mutationFn: () => leaveService.runPayPeriodAccruals(workspaceId),
    onSuccess: (data) => {
      notify(data.message || 'Pay-period accruals executed successfully', 'success');
      queryClient.invalidateQueries({ queryKey: ['workspaceLeaveBalances', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['leaveBalances'] });
    },
    onError: (err: any) => {
      notify(err.response?.data?.error?.message || err.message || 'Failed to run pay period accruals', 'error');
    },
  });

  // Review Mutation
  const reviewMutation = useMutation({
    mutationFn: ({ id, decision, comment }: { id: string; decision: 'APPROVED' | 'REJECTED'; comment?: string }) =>
      leaveService.reviewRequest(id, decision, comment, workspaceId),
    onSuccess: (_, variables) => {
      notify(`Leave request ${variables.decision.toLowerCase()} successfully`, 'success');
      queryClient.invalidateQueries({ queryKey: ['leaveRequests', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['workspaceLeaveBalances', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['myLeaveBalances', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['myLeaveRequests', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['teamCalendarLeaves'] });
      queryClient.invalidateQueries({ queryKey: ['leaveBalances'] });
      setReviewRequestItem(null);
      setReviewerComment('');
    },
    onError: (err: any) => {
      notify(err.response?.data?.error?.message || err.message || 'Failed to review request', 'error');
    },
  });

  // Seed Presets Mutation
  const seedPresetsMutation = useMutation({
    mutationFn: () => leaveService.seedUsPresets(workspaceId),
    onSuccess: (data) => {
      notify(`Successfully configured ${data.length} US statutory leave policies`, 'success');
      queryClient.invalidateQueries({ queryKey: ['leavePolicies', workspaceId] });
    },
    onError: (err: any) => {
      notify(err.response?.data?.error?.message || err.message || 'Failed to seed presets', 'error');
    },
  });

  // Filter out self user requests from Admin Leave Requests
  const nonSelfRequests = useMemo(() => {
    return requests.filter((r) => !isSelfEmployee(r.employeeId, r.employee));
  }, [requests, user, employeeMap]);

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return nonSelfRequests.filter((req) => {
      if (statusFilter !== 'ALL' && req.status !== statusFilter) {
        return false;
      }
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      const empFromMap = employeeMap.get(req.employeeId) || (req.employee?.id ? employeeMap.get(req.employee.id) : null);
      const empName = (empFromMap?.name || req.employee?.workspaceMember?.user?.fullName || '').toLowerCase();
      const empEmail = (empFromMap?.email || req.employee?.workspaceMember?.user?.email || '').toLowerCase();
      const empCode = (empFromMap?.employeeId || req.employee?.employeeCode || '').toLowerCase();
      const policyName = req.policy?.name?.toLowerCase() || '';
      const reason = req.reason?.toLowerCase() || '';

      return empName.includes(q) || empEmail.includes(q) || empCode.includes(q) || policyName.includes(q) || reason.includes(q);
    });
  }, [nonSelfRequests, statusFilter, searchQuery, employeeMap]);

  // Filtered My Personal Requests
  const filteredMyRequests = useMemo(() => {
    return myRequests.filter((req) => {
      if (myStatusFilter !== 'ALL' && req.status !== myStatusFilter) {
        return false;
      }
      return true;
    });
  }, [myRequests, myStatusFilter]);

  // Statistics
  const stats = useMemo(() => {
    const pendingCount = nonSelfRequests.filter((r) => r.status === 'PENDING').length;
    const approvedThisMonth = nonSelfRequests.filter((r) => {
      if (r.status !== 'APPROVED') return false;
      return dayjs(r.startDate).isSame(dayjs(), 'month');
    }).length;
    const today = dayjs().format('YYYY-MM-DD');
    const onLeaveToday = nonSelfRequests.filter((r) => {
      if (r.status !== 'APPROVED') return false;
      const start = r.startDate.slice(0, 10);
      const end = r.endDate.slice(0, 10);
      return today >= start && today <= end;
    }).length;

    return {
      pending: pendingCount,
      approvedMonth: approvedThisMonth,
      activePolicies: policies.filter((p) => p.isActive).length,
      onLeaveToday,
    };
  }, [nonSelfRequests, policies]);

  const handleOpenReview = (request: LeaveRequest, decision: 'APPROVED' | 'REJECTED') => {
    setReviewRequestItem(request);
    setReviewDecision(decision);
    setReviewerComment('');
  };

  const handleConfirmReview = () => {
    if (!reviewRequestItem) return;
    reviewMutation.mutate({
      id: reviewRequestItem.id,
      decision: reviewDecision,
      comment: reviewerComment.trim() || undefined,
    });
  };

  const getStatusBadge = (status: LeaveRequestStatus) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25">
            <Clock className="size-3 text-amber-600 dark:text-amber-400" />
            <span>Pending Review</span>
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
            <CheckCircle2 className="size-3 text-emerald-600 dark:text-emerald-400" />
            <span>Approved</span>
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/25">
            <XCircle className="size-3 text-rose-600 dark:text-rose-400" />
            <span>Rejected</span>
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-subtle text-muted border border-line">
            <Ban className="size-3 text-muted" />
            <span>Cancelled</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-subtle text-muted border border-line">
            {status}
          </span>
        );
    }
  };

  const getCategoryBadge = (category?: string) => {
    switch (category) {
      case 'SICK':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
            Sick Leave
          </span>
        );
      case 'VACATION':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20">
            Vacation
          </span>
        );
      case 'PTO':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20">
            PTO
          </span>
        );
      case 'FMLA':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
            FMLA
          </span>
        );
      case 'BEREAVEMENT':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20">
            Bereavement
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-subtle text-muted border border-line">
            {category || 'General'}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Leave Management</h1>
              <p className="text-sm text-muted-foreground">
                Track US-compliant Paid Sick Leave (CA, NY, IL), Unified PTO, Vacation, and FMLA requests
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {policies.length === 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => seedPresetsMutation.mutate()}
              disabled={seedPresetsMutation.isPending}
              className="gap-2 text-indigo-600 border-indigo-200 hover:bg-indigo-50 dark:border-indigo-800 dark:hover:bg-indigo-950/30"
            >
              <Sparkles className="h-4 w-4" />
              {seedPresetsMutation.isPending ? 'Seeding...' : 'Load US State Presets'}
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCreatePolicyModalOpen(true)}
            className="gap-1.5 shadow-xs"
          >
            <Plus className="size-3.5 text-muted" />
            <span>New Policy</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setHoursExportOpen(true)}
            className="gap-1.5 shadow-xs"
            title="Export employee regular, overtime, and leave hours to CSV"
          >
            <FileSpreadsheet className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Export Hours CSV</span>
          </Button>

          {!isOwner && (
            <Button
              variant="brand"
              size="sm"
              onClick={() => setSubmitModalOpen(true)}
              className="gap-1.5 shadow-theme-btn"
            >
              <Plus className="size-3.5" />
              <span>Submit Leave Request</span>
            </Button>
          )}
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-card/60 backdrop-blur-sm border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Pending Approvals
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">{stats.pending}</span>
            {stats.pending > 0 && (
              <Badge variant="warning" className="text-[10px] px-1.5 py-0">Needs Action</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Requires manager review</p>
        </Card>

        <Card className="p-4 bg-card/60 backdrop-blur-sm border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Approved This Month
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">{stats.approvedMonth}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{dayjs().format('MMMM YYYY')}</p>
        </Card>

        <Card className="p-4 bg-card/60 backdrop-blur-sm border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              On Leave Today
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
              <User className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">{stats.onLeaveToday}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Currently away from work</p>
        </Card>

        <Card className="p-4 bg-card/60 backdrop-blur-sm border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Active Policies
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">{stats.activePolicies}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">US statutory & internal rules</p>
        </Card>
      </div>

      {/* Modern Tabs Navigation Bar */}
      <div className="flex items-center justify-between border-b border-line pb-1">
        <div className="flex items-center gap-1 p-1 bg-subtle/70 border border-line rounded-xl overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => setActiveTab('requests')}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all whitespace-nowrap cursor-pointer select-none',
              activeTab === 'requests'
                ? 'bg-panel font-semibold text-ink shadow-xs border border-line/80'
                : 'text-muted font-medium hover:text-ink hover:bg-panel/40'
            )}
          >
            <Calendar className={cn('size-3.5', activeTab === 'requests' ? 'text-primary-600 dark:text-primary-400' : 'text-muted')} />
            <span>Leave Requests</span>
            {stats.pending > 0 && (
              <span className="inline-flex items-center justify-center min-w-[1.125rem] h-4.5 px-1.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
                {stats.pending}
              </span>
            )}
          </button>

          {!isOwner && (
            <button
              type="button"
              onClick={() => setActiveTab('my-time-off')}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all whitespace-nowrap cursor-pointer select-none',
                activeTab === 'my-time-off'
                  ? 'bg-panel font-semibold text-ink shadow-xs border border-line/80'
                  : 'text-muted font-medium hover:text-ink hover:bg-panel/40'
              )}
            >
              <UserCheck className={cn('size-3.5', activeTab === 'my-time-off' ? 'text-primary-600 dark:text-primary-400' : 'text-muted')} />
              <span>My Time Off</span>
              {myRequests.filter((r) => r.status === 'PENDING').length > 0 && (
                <span className="inline-flex items-center justify-center min-w-[1.125rem] h-4.5 px-1.5 rounded-full bg-primary-500/15 text-primary-600 dark:text-primary-400 text-[10px] font-bold">
                  {myRequests.filter((r) => r.status === 'PENDING').length}
                </span>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('calendar')}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all whitespace-nowrap cursor-pointer select-none',
              activeTab === 'calendar'
                ? 'bg-panel font-semibold text-ink shadow-xs border border-line/80'
                : 'text-muted font-medium hover:text-ink hover:bg-panel/40'
            )}
          >
            <CalendarDays className={cn('size-3.5', activeTab === 'calendar' ? 'text-primary-600 dark:text-primary-400' : 'text-muted')} />
            <span>Team Calendar</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('balances')}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all whitespace-nowrap cursor-pointer select-none',
              activeTab === 'balances'
                ? 'bg-panel font-semibold text-ink shadow-xs border border-line/80'
                : 'text-muted font-medium hover:text-ink hover:bg-panel/40'
            )}
          >
            <Clock className={cn('size-3.5', activeTab === 'balances' ? 'text-primary-600 dark:text-primary-400' : 'text-muted')} />
            <span>Staff Balances</span>
            <span className="px-1.5 py-0.5 rounded-md bg-subtle text-muted text-[10px] font-mono font-medium">
              {groupedWorkspaceBalances.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('policies')}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all whitespace-nowrap cursor-pointer select-none',
              activeTab === 'policies'
                ? 'bg-panel font-semibold text-ink shadow-xs border border-line/80'
                : 'text-muted font-medium hover:text-ink hover:bg-panel/40'
            )}
          >
            <ShieldCheck className={cn('size-3.5', activeTab === 'policies' ? 'text-primary-600 dark:text-primary-400' : 'text-muted')} />
            <span>Leave Policies</span>
            <span className="px-1.5 py-0.5 rounded-md bg-subtle text-muted text-[10px] font-mono font-medium">
              {policies.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('compliance')}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all whitespace-nowrap cursor-pointer select-none',
              activeTab === 'compliance'
                ? 'bg-panel font-semibold text-ink shadow-xs border border-line/80'
                : 'text-muted font-medium hover:text-ink hover:bg-panel/40'
            )}
          >
            <Info className={cn('size-3.5', activeTab === 'compliance' ? 'text-primary-600 dark:text-primary-400' : 'text-muted')} />
            <span>Compliance Guide</span>
          </button>
        </div>
      </div>

      {/* TAB 1: Leave Requests */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search by employee, code, policy or reason..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <span className="text-xs text-muted font-medium flex items-center gap-1.5 shrink-0">
                <Filter className="size-3.5 text-muted" /> Status:
              </span>
              <div className="inline-flex items-center gap-1 rounded-xl border border-line bg-panel p-1 shadow-2xs">
                {(['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const).map((st) => {
                  const isSelected = statusFilter === st;
                  const label = st === 'ALL' ? 'All' : st.charAt(0) + st.slice(1).toLowerCase();
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatusFilter(st)}
                      className={cn(
                        'px-3 py-1 text-xs font-medium rounded-lg transition-all duration-150 cursor-pointer flex items-center gap-1.5 whitespace-nowrap',
                        isSelected
                          ? 'bg-primary-600 text-white font-semibold shadow-theme-btn'
                          : 'text-muted hover:text-ink hover:bg-subtle/70'
                      )}
                    >
                      {st === 'PENDING' && (
                        <span className={cn('size-1.5 rounded-full', isSelected ? 'bg-amber-300' : 'bg-amber-500')} />
                      )}
                      {st === 'APPROVED' && (
                        <span className={cn('size-1.5 rounded-full', isSelected ? 'bg-emerald-300' : 'bg-emerald-500')} />
                      )}
                      {st === 'REJECTED' && (
                        <span className={cn('size-1.5 rounded-full', isSelected ? 'bg-rose-300' : 'bg-rose-500')} />
                      )}
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchRequests()}
                title="Refresh Requests"
                className="size-8 p-0 shrink-0 text-muted hover:text-ink"
              >
                <RotateCcw className="size-3.5" />
              </Button>
            </div>
          </div>

          {/* Requests Table */}
          <Card className="overflow-hidden border border-line shadow-sm">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-line bg-subtle/50">
                    <TableHead className="font-mono uppercase tracking-wider text-[0.6875rem] text-faint font-semibold py-3 px-4">Employee</TableHead>
                    <TableHead className="font-mono uppercase tracking-wider text-[0.6875rem] text-faint font-semibold py-3 px-4">Leave Policy</TableHead>
                    <TableHead className="font-mono uppercase tracking-wider text-[0.6875rem] text-faint font-semibold py-3 px-4">Duration & Dates</TableHead>
                    <TableHead className="font-mono uppercase tracking-wider text-[0.6875rem] text-faint font-semibold py-3 px-4">Total Hours</TableHead>
                    <TableHead className="font-mono uppercase tracking-wider text-[0.6875rem] text-faint font-semibold py-3 px-4">Compensation</TableHead>
                    <TableHead className="font-mono uppercase tracking-wider text-[0.6875rem] text-faint font-semibold py-3 px-4">Reason / Documentation</TableHead>
                    <TableHead className="font-mono uppercase tracking-wider text-[0.6875rem] text-faint font-semibold py-3 px-4">Status</TableHead>
                    <TableHead className="font-mono uppercase tracking-wider text-[0.6875rem] text-faint font-semibold py-3 px-4 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {isRequestsLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                        <Clock className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                        Loading leave requests...
                      </TableCell>
                    </TableRow>
                  ) : filteredRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                        <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-40" />
                        <p className="font-medium text-foreground">No leave requests found</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {searchQuery || statusFilter !== 'ALL'
                            ? 'Try adjusting your filters or search query.'
                            : 'Submitted time-off requests will appear here for manager approval.'}
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRequests.map((req) => {
                      const empFromMap = employeeMap.get(req.employeeId) || (req.employee?.id ? employeeMap.get(req.employee.id) : null);
                      const empUser = req.employee?.workspaceMember?.user;
                      const empName = empFromMap?.name || empUser?.fullName || (empUser as any)?.name || req.employee?.employeeCode || 'Employee';
                      const empEmail = empFromMap?.email || empUser?.email || '';
                      const empCode = empFromMap?.employeeId || req.employee?.employeeCode || '';
                      const empDept = empFromMap?.department || req.employee?.department || '';
                      const empAvatar = empFromMap?.avatarUrl || (empUser as any)?.avatarUrl;
                      const policy = req.policy;
                      const sDate = dayjs(req.startDate);
                      const eDate = dayjs(req.endDate);
                      const dayCount = eDate.diff(sDate, 'day') + 1;

                      return (
                        <TableRow key={req.id} className="hover:bg-subtle/50 transition-colors border-b border-line/60">
                          {/* Employee */}
                          <TableCell className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              {empAvatar ? (
                                <img
                                  src={empAvatar}
                                  alt={empName}
                                  className="size-9 rounded-full object-cover ring-1 ring-line shrink-0"
                                />
                              ) : (
                                <div className="size-9 rounded-full bg-linear-to-br from-primary-500/15 to-primary-600/10 text-primary-700 dark:text-primary-300 font-semibold text-xs flex items-center justify-center shrink-0 border border-primary-500/20 shadow-2xs">
                                  {empName.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0 max-w-[240px]">
                                <div className="font-semibold text-sm text-ink truncate flex items-center gap-1.5">
                                  <span className="truncate">{empName}</span>
                                  {empCode && (
                                    <span className="font-mono text-[10px] font-semibold text-muted bg-subtle px-1.5 py-0.2 rounded border border-line shrink-0">
                                      {empCode}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-muted flex items-center gap-1.5 mt-0.5 truncate">
                                  {empDept && <span className="font-medium text-ink/80 shrink-0">{empDept}</span>}
                                  {empDept && empEmail && <span className="text-faint">•</span>}
                                  {empEmail && (
                                    <span className="text-muted truncate" title={empEmail}>
                                      {empEmail}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </TableCell>

                          {/* Policy */}
                          <TableCell className="py-3.5 px-4">
                            <div className="space-y-1">
                              <div className="font-semibold text-xs text-ink">{policy?.name || 'Leave Policy'}</div>
                              <div className="flex items-center gap-1.5">
                                {getCategoryBadge(policy?.category)}
                                {policy?.code && (
                                  <span className="text-[10px] text-faint font-mono font-medium">{policy.code}</span>
                                )}
                              </div>
                            </div>
                          </TableCell>

                          {/* Dates */}
                          <TableCell className="py-3.5 px-4">
                            <div className="space-y-0.5 whitespace-nowrap">
                              <div className="font-semibold text-xs text-ink flex items-center gap-1.5">
                                <Calendar className="size-3 text-muted shrink-0" />
                                <span>
                                  {sDate.format('MMM D, YYYY')}
                                  {!sDate.isSame(eDate, 'day') && ` – ${eDate.format('MMM D, YYYY')}`}
                                </span>
                              </div>
                              <div className="text-[11px] text-muted flex items-center gap-1.5">
                                <span className="font-medium">
                                  {dayCount} {dayCount === 1 ? 'calendar day' : 'calendar days'}
                                </span>
                                {req.isIntermittent && (
                                  <span className="inline-flex items-center text-[10px] text-amber-700 dark:text-amber-400 font-semibold bg-amber-500/15 px-1.5 py-0.2 rounded">
                                    Intermittent
                                  </span>
                                )}
                              </div>
                            </div>
                          </TableCell>

                          {/* Total Hours */}
                          <TableCell className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1 font-mono font-bold text-xs text-ink bg-subtle px-2 py-0.5 rounded-md border border-line">
                              <Clock className="size-3 text-primary-600 dark:text-primary-400" />
                              {req.totalHours}h
                            </span>
                          </TableCell>

                          {/* Compensation */}
                          <TableCell className="py-3.5 px-4">
                            {policy?.isPaid ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 className="size-2.5" />
                                Paid
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-subtle text-muted border border-line">
                                Unpaid
                              </span>
                            )}
                          </TableCell>

                          {/* Reason & Docs */}
                          <TableCell className="py-3.5 px-4 max-w-xs">
                            <div className="space-y-1.5">
                              {/* Reason note */}
                              <div className="flex items-start gap-1.5 text-xs text-ink">
                                <FileText className="size-3 text-muted shrink-0 mt-0.5" />
                                {req.reason ? (
                                  <p className="line-clamp-2 leading-relaxed text-ink/90 text-xs" title={req.reason}>
                                    {req.reason}
                                  </p>
                                ) : (
                                  <span className="text-faint italic text-[11px]">No note provided</span>
                                )}
                              </div>

                              {/* Medical / Supporting Document */}
                              {req.attachmentUrl && (
                                <a
                                  href={req.attachmentUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium text-primary-600 bg-primary-50/80 hover:bg-primary-100 dark:bg-primary-950/40 dark:text-primary-400 border border-primary-200 dark:border-primary-800 transition-colors w-fit"
                                >
                                  <span>View Document</span>
                                  <ExternalLink className="size-2.5 opacity-70" />
                                </a>
                              )}

                              {/* Reviewer / Decision note */}
                              {req.reviewerNotes && (
                                <div className="flex items-start gap-1.5 px-2 py-1 rounded-md bg-subtle/80 border border-line/70 text-[11px] text-muted leading-snug">
                                  <ShieldCheck className="size-3 text-primary-600 dark:text-primary-400 shrink-0 mt-0.5" />
                                  <div className="min-w-0">
                                    <span className="font-semibold text-ink">Decision note:</span>{' '}
                                    <span className="text-ink/80">{req.reviewerNotes}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </TableCell>

                          {/* Status */}
                          <TableCell className="py-3.5 px-4 whitespace-nowrap">
                            {getStatusBadge(req.status)}
                          </TableCell>

                          {/* Actions */}
                          <TableCell className="py-3.5 px-4 text-right whitespace-nowrap">
                            {req.status === 'PENDING' ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenReview(req, 'APPROVED')}
                                  className="h-7 px-2.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50/70 hover:bg-emerald-100 border-emerald-300 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800 gap-1 shadow-2xs"
                                  title="Approve Request"
                                >
                                  <CheckCircle2 className="size-3.5" />
                                  <span>Approve</span>
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenReview(req, 'REJECTED')}
                                  className="h-7 px-2.5 text-xs font-semibold text-rose-700 hover:text-rose-800 bg-rose-50/70 hover:bg-rose-100 border-rose-300 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800 gap-1 shadow-2xs"
                                  title="Reject Request"
                                >
                                  <XCircle className="size-3.5" />
                                  <span>Reject</span>
                                </Button>
                                <Menu>
                                  <MenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="size-7 p-0 text-muted hover:text-ink hover:bg-subtle rounded-lg"
                                      title="More Options"
                                    >
                                      <MoreHorizontal className="size-4" />
                                    </Button>
                                  </MenuTrigger>
                                  <MenuContent align="end" className="w-44">
                                    <MenuLabel>Manage Request</MenuLabel>
                                    <MenuItem
                                      onClick={() => handleOpenReview(req, 'REJECTED')}
                                      className="text-rose-600 dark:text-rose-400"
                                    >
                                      <XCircle className="size-3.5" />
                                      <span>Reject with Note...</span>
                                    </MenuItem>
                                    <MenuSeparator />
                                    <MenuItem
                                      destructive
                                      onClick={() => setCancelTargetRequest(req)}
                                    >
                                      <Ban className="size-3.5" />
                                      <span>Cancel Request</span>
                                    </MenuItem>
                                  </MenuContent>
                                </Menu>
                              </div>
                            ) : req.status === 'APPROVED' ? (
                              <div className="flex items-center justify-end gap-2">
                                <div className="flex flex-col items-end text-right">
                                  <span className="text-[10px] uppercase font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                                    Approved
                                  </span>
                                  <span className="text-[11px] text-muted font-medium">
                                    {req.reviewedAt
                                      ? dayjs(req.reviewedAt).format('MMM D, YYYY')
                                      : dayjs(req.createdAt).format('MMM D, YYYY')}
                                  </span>
                                </div>
                                <Menu>
                                  <MenuTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="size-7 p-0 text-muted hover:text-ink border-line rounded-lg"
                                      title="More Actions"
                                    >
                                      <MoreHorizontal className="size-4" />
                                    </Button>
                                  </MenuTrigger>
                                  <MenuContent align="end" className="w-48">
                                    <MenuLabel>Approved Leave Actions</MenuLabel>
                                    <MenuItem
                                      onClick={() => handleOpenReview(req, 'REJECTED')}
                                      className="text-amber-600 dark:text-amber-400"
                                    >
                                      <XCircle className="size-3.5" />
                                      <span>Reject Approved Leave...</span>
                                    </MenuItem>
                                    <MenuSeparator />
                                    <MenuItem
                                      destructive
                                      onClick={() => setCancelTargetRequest(req)}
                                    >
                                      <Ban className="size-3.5" />
                                      <span>Cancel Leave</span>
                                    </MenuItem>
                                  </MenuContent>
                                </Menu>
                              </div>
                            ) : (
                              <div className="flex flex-col items-end text-right">
                                <span className="text-[10px] uppercase font-mono font-medium text-faint">
                                  {req.status === 'CANCELLED' ? 'Cancelled' : 'Rejected'}
                                </span>
                                <span className="text-xs font-medium text-muted">
                                  {req.reviewedAt
                                    ? dayjs(req.reviewedAt).format('MMM D, YYYY')
                                    : dayjs(req.createdAt).format('MMM D, YYYY')}
                                </span>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: My Time-Off & Balances (Employee Self-Service) */}
      {!isOwner && activeTab === 'my-time-off' && (
        <div className="space-y-6">
          {/* Self-Service Banner */}
          <Card className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 border border-line bg-panel shadow-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-primary-600 font-semibold text-sm">
                <UserCheck className="size-4" />
                <span>Employee Time-Off & Quota Self-Service</span>
              </div>
              <p className="text-xs text-muted max-w-2xl">
                Track your accrued Paid Sick Leave, Vacation, and PTO balances. Submit time-off requests in hourly increments and review manager feedback.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  refetchMyBalances();
                  refetchMyRequests();
                }}
                title="Refresh Balances & Requests"
                className="gap-1.5 text-xs"
              >
                <RotateCcw className="size-3.5" />
                <span>Refresh</span>
              </Button>

              <Button
                variant="brand"
                size="sm"
                onClick={() => setSubmitModalOpen(true)}
                className="gap-1.5 text-xs shadow-sm"
              >
                <Plus className="size-3.5" />
                <span>Request Time Off</span>
              </Button>
            </div>
          </Card>

          {/* Personal Leave Balance Cards */}
          <div>
            <h3 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2">
              <Clock className="size-4 text-primary-600" />
              <span>My Available Leave Balances</span>
            </h3>

            {isMyBalancesLoading ? (
              <div className="flex items-center justify-center p-8 bg-panel rounded-xl border border-line">
                <Clock className="size-5 animate-spin text-primary-600 mr-2" />
                <span className="text-xs text-muted">Loading your leave balances...</span>
              </div>
            ) : myBalances.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line p-6 text-center bg-subtle/20">
                <CalendarDays className="size-6 text-muted mx-auto mb-2 opacity-60" />
                <p className="text-sm font-medium text-ink">No personal balances assigned yet</p>
                <p className="text-xs text-muted mt-1">
                  Once your shift hours are logged or policies are seeded, your balances will display here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {myBalances.map((b) => {
                  const policy = b.policy;
                  return (
                    <Card key={b.id} className="p-4 border border-line bg-panel shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="font-semibold text-sm text-ink truncate" title={policy?.name || 'Policy'}>
                            {policy?.name || 'Policy'}
                          </span>
                          {getCategoryBadge(policy?.category)}
                        </div>

                        <div className="my-2">
                          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                            {Number(b.availableHours).toFixed(2)} <span className="text-xs font-normal text-muted">hrs</span>
                          </div>
                          <div className="text-[11px] text-muted font-medium">Available to take</div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-line/60 grid grid-cols-2 gap-2 text-[11px] text-muted">
                        <div>
                          <span className="text-muted/80">Accrued: </span>
                          <span className="font-semibold text-ink">{(Number(b.accruedHours) + Number(b.allocatedHours)).toFixed(1)}h</span>
                        </div>
                        <div>
                          <span className="text-muted/80">Used: </span>
                          <span className="font-semibold text-rose-600">{Number(b.usedHours).toFixed(1)}h</span>
                        </div>
                        <div>
                          <span className="text-muted/80">Pending: </span>
                          <span className="font-semibold text-amber-600">{Number(b.pendingHours).toFixed(1)}h</span>
                        </div>
                        <div>
                          <span className="text-muted/80">Carried: </span>
                          <span className="font-semibold text-ink">{Number(b.carriedOverHours).toFixed(1)}h</span>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* My Requests History */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
                <History className="size-4 text-primary-600" />
                <span>My Leave Request History ({myRequests.length})</span>
              </h3>

              {/* Status Segmented Control */}
              <div className="inline-flex items-center gap-1 rounded-xl border border-line bg-panel p-1 shadow-2xs">
                {(['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const).map((st) => {
                  const isSelected = myStatusFilter === st;
                  const label = st === 'ALL' ? 'All' : st.charAt(0) + st.slice(1).toLowerCase();
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setMyStatusFilter(st)}
                      className={cn(
                        'px-2.5 py-1 text-xs font-medium rounded-lg transition-all duration-150 cursor-pointer flex items-center gap-1.5 whitespace-nowrap',
                        isSelected
                          ? 'bg-primary-600 text-white font-semibold shadow-theme-btn'
                          : 'text-muted hover:text-ink hover:bg-subtle/70'
                      )}
                    >
                      {st === 'PENDING' && <span className={cn('size-1.5 rounded-full', isSelected ? 'bg-amber-300' : 'bg-amber-500')} />}
                      {st === 'APPROVED' && <span className={cn('size-1.5 rounded-full', isSelected ? 'bg-emerald-300' : 'bg-emerald-500')} />}
                      {st === 'REJECTED' && <span className={cn('size-1.5 rounded-full', isSelected ? 'bg-rose-300' : 'bg-rose-500')} />}
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <Card className="overflow-hidden border border-line shadow-sm">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-line bg-subtle/50">
                      <TableHead className="font-mono uppercase tracking-wider text-[0.6875rem] text-faint font-semibold py-3 px-4">Leave Policy</TableHead>
                      <TableHead className="font-mono uppercase tracking-wider text-[0.6875rem] text-faint font-semibold py-3 px-4">Duration & Dates</TableHead>
                      <TableHead className="font-mono uppercase tracking-wider text-[0.6875rem] text-faint font-semibold py-3 px-4">Total Hours</TableHead>
                      <TableHead className="font-mono uppercase tracking-wider text-[0.6875rem] text-faint font-semibold py-3 px-4">Compensation</TableHead>
                      <TableHead className="font-mono uppercase tracking-wider text-[0.6875rem] text-faint font-semibold py-3 px-4">Reason & Documentation</TableHead>
                      <TableHead className="font-mono uppercase tracking-wider text-[0.6875rem] text-faint font-semibold py-3 px-4">Status</TableHead>
                      <TableHead className="font-mono uppercase tracking-wider text-[0.6875rem] text-faint font-semibold py-3 px-4">Manager Review Notes</TableHead>
                      <TableHead className="font-mono uppercase tracking-wider text-[0.6875rem] text-faint font-semibold py-3 px-4 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {isMyRequestsLoading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                          <Clock className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                          Loading your requests...
                        </TableCell>
                      </TableRow>
                    ) : filteredMyRequests.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                          <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-40" />
                          <p className="font-medium text-foreground">No time-off requests found</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {myStatusFilter !== 'ALL'
                              ? 'No requests found matching the selected filter.'
                              : 'Click "Request Time Off" above to submit a new leave request.'}
                          </p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredMyRequests.map((req) => {
                        const policy = req.policy;
                        const sDate = dayjs(req.startDate);
                        const eDate = dayjs(req.endDate);
                        const days = eDate.diff(sDate, 'day') + 1;

                        return (
                          <TableRow key={req.id} className="hover:bg-muted/40 transition-colors">
                            {/* Policy */}
                            <TableCell>
                              <div className="font-medium text-sm text-foreground">{policy?.name || 'Policy'}</div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {getCategoryBadge(policy?.category)}
                                <span className="text-[10px] text-muted-foreground font-mono">{policy?.code}</span>
                              </div>
                            </TableCell>

                            {/* Dates */}
                            <TableCell>
                              <div className="font-medium text-sm text-foreground">
                                {sDate.format('MMM D, YYYY')}
                                {!sDate.isSame(eDate, 'day') && ` → ${eDate.format('MMM D, YYYY')}`}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {days} calendar day{days > 1 ? 's' : ''}
                                {req.isIntermittent && ' • Intermittent'}
                              </div>
                            </TableCell>

                            {/* Total Hours */}
                            <TableCell>
                              <span className="inline-flex items-center gap-1 font-mono font-bold text-xs text-ink bg-subtle px-2 py-0.5 rounded-md border border-line">
                                <Clock className="size-3 text-primary-600 dark:text-primary-400" />
                                {req.totalHours}h
                              </span>
                            </TableCell>

                            {/* Compensation */}
                            <TableCell>
                              {policy?.isPaid ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                                  <CheckCircle2 className="size-2.5" />
                                  Paid
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-subtle text-muted border border-line">
                                  Unpaid
                                </span>
                              )}
                            </TableCell>

                            {/* Reason & Docs */}
                            <TableCell className="max-w-xs">
                              <p className="text-xs text-foreground truncate" title={req.reason || ''}>
                                {req.reason || <span className="text-muted-foreground italic">No note provided</span>}
                              </p>
                              {req.attachmentUrl && (
                                <a
                                  href={req.attachmentUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline mt-0.5"
                                >
                                  <FileText className="h-3 w-3" /> View Doctor Note / Proof
                                  <ExternalLink className="size-2.5" />
                                </a>
                              )}
                            </TableCell>

                            {/* Status */}
                            <TableCell>{getStatusBadge(req.status)}</TableCell>

                            {/* Reviewer Feedback */}
                            <TableCell className="max-w-xs">
                              {req.reviewerNotes ? (
                                <p className="text-xs text-foreground bg-subtle/50 p-1.5 rounded-lg border border-line">
                                  {req.reviewerNotes}
                                </p>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">
                                  {req.status === 'PENDING' ? 'Awaiting manager approval' : '—'}
                                </span>
                              )}
                            </TableCell>

                            {/* Actions */}
                            <TableCell className="text-right">
                              {req.status === 'PENDING' ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setCancelTargetRequest(req)}
                                  disabled={cancelMutation.isPending}
                                  className="h-7 px-2.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-200 dark:border-rose-800"
                                  title="Cancel pending request"
                                >
                                  <Ban className="size-3 mr-1" />
                                  <span>Cancel</span>
                                </Button>
                              ) : req.status === 'APPROVED' ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setCancelTargetRequest(req)}
                                  disabled={cancelMutation.isPending}
                                  className="h-7 px-2.5 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30 border-amber-200 dark:border-amber-800 gap-1"
                                  title="Cancel approved leave"
                                >
                                  <Ban className="size-3" />
                                  <span>Cancel Leave</span>
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  {req.reviewedAt ? dayjs(req.reviewedAt).format('MMM D, YYYY') : 'Closed'}
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: Employee Balances & Automatic Accrual Engine */}
      {activeTab === 'balances' && (
        <div className="space-y-4">
          <Card className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 border border-line bg-panel shadow-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-primary-600 font-semibold text-sm">
                <Clock className="size-4" />
                <span>US Labor-Compliant Accrual Engine</span>
              </div>
              <p className="text-xs text-muted max-w-2xl">
                Hourly sick leaves (CA PSL 1h/30h, IL PLAAR 1h/40h) accrue in real-time when employees clock out.
                For pay-period policies, execute regular payroll cycle accruals here.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchBalances()}
                title="Refresh Balances"
                className="gap-1.5 text-xs"
              >
                <RotateCcw className="size-3.5" />
                <span>Refresh</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setHoursExportOpen(true)}
                className="gap-1.5 text-xs shadow-xs"
              >
                <FileSpreadsheet className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Export Hours CSV</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setBalanceToAdjust(null);
                  setAssignBalanceModalOpen(true);
                }}
                className="gap-1.5 text-xs shadow-xs border-primary-300 text-primary-700 bg-primary-50/50 hover:bg-primary-100/50 dark:border-primary-800 dark:text-primary-300 dark:bg-primary-950/40"
              >
                <Plus className="size-3.5 text-primary-600 dark:text-primary-400" />
                <span>Assign / Prorate Balance</span>
              </Button>

              <Button
                variant="brand"
                size="sm"
                onClick={() => {
                  if (window.confirm('Run pay-period accruals for all active employees?')) {
                    payPeriodAccrualMutation.mutate();
                  }
                }}
                disabled={payPeriodAccrualMutation.isPending}
                className="gap-1.5 text-xs shadow-sm"
              >
                <Sparkles className="size-3.5 text-amber-300" />
                <span>{payPeriodAccrualMutation.isPending ? 'Processing Accrual...' : 'Run Pay-Period Accrual Cycle'}</span>
              </Button>
            </div>
          </Card>

          {/* Staff Balances Search, Filter & Quick-Action Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search staff by employee name, code, department..."
                  value={balanceSearchQuery}
                  onChange={(e) => {
                    setBalanceSearchQuery(e.target.value);
                    setBalancesPage(0);
                  }}
                  className="pl-9 h-9 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              <select
                value={balancePolicyFilter}
                onChange={(e) => {
                  setBalancePolicyFilter(e.target.value);
                  setBalancesPage(0);
                }}
                className="h-9 rounded-xl border border-line bg-panel px-3 text-xs font-medium text-ink focus:border-primary-500 focus:outline-none"
              >
                <option value="ALL">All Leave Policies</option>
                {policies.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>

              <Button
                variant="outline"
                size="sm"
                onClick={toggleExpandAll}
                className="h-9 gap-1.5 text-xs text-muted hover:text-ink shadow-2xs whitespace-nowrap"
                title={
                  expandedEmployees.size === paginatedGroups.length && paginatedGroups.length > 0
                    ? 'Collapse all policy details'
                    : 'Expand all policy details'
                }
              >
                {expandedEmployees.size === paginatedGroups.length && paginatedGroups.length > 0 ? (
                  <>
                    <ChevronUp className="size-3.5" />
                    <span>Collapse All</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="size-3.5" />
                    <span>Expand All</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          <Card className="overflow-hidden border border-line shadow-sm">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-line bg-subtle/60 text-xs">
                    <TableHead className="font-mono uppercase tracking-wider text-[0.6875rem] text-faint font-semibold py-3 px-4 w-[300px]">
                      Employee / Leave Policy
                    </TableHead>
                    <TableHead className="font-mono uppercase tracking-wider text-[0.6875rem] text-faint font-semibold py-3 px-4">
                      Accrual Model
                    </TableHead>
                    <TableHead className="font-mono uppercase tracking-wider text-[0.6875rem] text-faint font-semibold py-3 px-4 text-center">
                      Accrued / Frontload
                    </TableHead>
                    <TableHead className="font-mono uppercase tracking-wider text-[0.6875rem] text-faint font-semibold py-3 px-4 text-center">
                      Carried Over
                    </TableHead>
                    <TableHead className="font-mono uppercase tracking-wider text-[0.6875rem] text-faint font-semibold py-3 px-4 text-center">
                      Used
                    </TableHead>
                    <TableHead className="font-mono uppercase tracking-wider text-[0.6875rem] text-faint font-semibold py-3 px-4 text-center">
                      Pending
                    </TableHead>
                    <TableHead className="font-mono uppercase tracking-wider text-[0.6875rem] text-faint font-semibold py-3 px-4 text-center">
                      Available Balance
                    </TableHead>
                    <TableHead className="font-mono uppercase tracking-wider text-[0.6875rem] text-faint font-semibold py-3 px-4 text-right w-[110px]">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {isBalancesLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                        <Clock className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                        Loading employee leave balances...
                      </TableCell>
                    </TableRow>
                  ) : paginatedGroups.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                        <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-40" />
                        <p className="font-medium text-foreground">No leave balances found</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {balanceSearchQuery || balancePolicyFilter !== 'ALL'
                            ? 'No staff members match your search or filter criteria.'
                            : 'Balances will generate automatically as employees work and clock shifts, or when you run a pay-period accrual cycle.'}
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedGroups.map((group) => {
                      const isExpanded = expandedEmployees.has(group.employeeId);

                      return (
                        <React.Fragment key={group.employeeId}>
                          {/* Employee Group Header Row */}
                          <TableRow className="bg-subtle/50 hover:bg-subtle/70 transition-colors border-t border-line/80">
                            <TableCell colSpan={8} className="py-2.5 px-4">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="flex items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={() => toggleExpandEmployee(group.employeeId)}
                                    className="p-1 rounded-md hover:bg-panel text-muted hover:text-ink transition-colors cursor-pointer shrink-0"
                                    title={isExpanded ? 'Collapse policies' : 'Expand policies'}
                                  >
                                    {isExpanded ? (
                                      <ChevronDown className="size-4 text-ink" />
                                    ) : (
                                      <ChevronRight className="size-4 text-muted" />
                                    )}
                                  </button>

                                  {group.empAvatar ? (
                                    <img
                                      src={group.empAvatar}
                                      alt={group.empName}
                                      className="size-8 rounded-full object-cover ring-1 ring-line shrink-0"
                                    />
                                  ) : (
                                    <div className="size-8 rounded-full bg-linear-to-br from-primary-500/15 to-primary-600/10 text-primary-700 dark:text-primary-300 font-semibold text-xs flex items-center justify-center shrink-0 border border-primary-500/20 shadow-2xs">
                                      {group.empName.charAt(0).toUpperCase()}
                                    </div>
                                  )}

                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-semibold text-sm text-ink">{group.empName}</span>
                                    {group.empCode && (
                                      <span className="font-mono text-[10px] font-semibold text-muted bg-panel px-1.5 py-0.5 rounded border border-line">
                                        {group.empCode}
                                      </span>
                                    )}
                                    {group.empDept && (
                                      <span className="text-xs text-muted font-medium">• {group.empDept}</span>
                                    )}
                                    {group.empEmail && (
                                      <span className="text-xs text-faint hidden md:inline">• {group.empEmail}</span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2.5 self-end sm:self-auto pl-7 sm:pl-0">
                                  <span className="text-xs text-muted font-mono font-medium">
                                    {group.balances.length} {group.balances.length === 1 ? 'policy' : 'policies'}
                                  </span>
                                  <span className="inline-flex items-center gap-1 font-mono font-bold text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                                    <Clock className="size-3" />
                                    {group.totalAvailable.toFixed(1)}h available
                                  </span>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setBalanceToAdjust({ employeeId: group.employeeId });
                                      setAssignBalanceModalOpen(true);
                                    }}
                                    className="h-6.5 px-2 text-[11px] gap-1 text-primary-600 hover:text-primary-700 hover:bg-primary-50 dark:hover:bg-primary-950/40 border-primary-200 dark:border-primary-800 shadow-2xs"
                                    title="Assign or add quota for this employee"
                                  >
                                    <Plus className="size-3" />
                                    <span>Add Quota</span>
                                  </Button>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>

                          {/* Individual Policy Rows Under This Employee */}
                          {isExpanded &&
                            group.balances.map((b: any) => {
                              const policy = b.policy;
                              return (
                                <TableRow
                                  key={b.id}
                                  className="hover:bg-subtle/30 transition-colors border-b border-line/40 bg-panel/30"
                                >
                                  {/* Policy Title & Code */}
                                  <TableCell className="py-2.5 px-4 pl-12">
                                    <div className="flex items-center gap-2">
                                      <div className="w-2.5 h-2.5 border-b-2 border-l-2 border-line/80 rounded-bl-xs shrink-0 mb-1" />
                                      <div className="font-semibold text-xs text-ink">{policy?.name || 'Policy'}</div>
                                      {getCategoryBadge(policy?.category)}
                                      {policy?.code && (
                                        <span className="text-[10px] text-faint font-mono font-medium">
                                          {policy.code}
                                        </span>
                                      )}
                                    </div>
                                  </TableCell>

                                  {/* Accrual Model */}
                                  <TableCell className="py-2.5 px-4 text-xs text-muted">
                                    {policy?.accrualType === 'HOURLY_ACCRUAL'
                                      ? `Hourly (${Number(policy.rate || 0.0333).toFixed(4)}/hr)`
                                      : policy?.accrualType === 'PER_PAY_PERIOD'
                                      ? 'Pay-Period'
                                      : policy?.accrualType === 'FRONTLOAD'
                                      ? 'Annual Frontload'
                                      : policy?.accrualType || 'Standard'}
                                  </TableCell>

                                  {/* Accrued / Allocated */}
                                  <TableCell className="py-2.5 px-4 text-center font-mono font-medium text-xs text-ink">
                                    {(Number(b.accruedHours) + Number(b.allocatedHours)).toFixed(2)}h
                                  </TableCell>

                                  {/* Carried Over */}
                                  <TableCell className="py-2.5 px-4 text-center font-mono text-xs text-muted">
                                    {Number(b.carriedOverHours).toFixed(2)}h
                                  </TableCell>

                                  {/* Used */}
                                  <TableCell className="py-2.5 px-4 text-center font-mono text-xs text-rose-600 dark:text-rose-400 font-medium">
                                    {Number(b.usedHours).toFixed(2)}h
                                  </TableCell>

                                  {/* Pending */}
                                  <TableCell className="py-2.5 px-4 text-center font-mono text-xs text-amber-600 dark:text-amber-400 font-medium">
                                    {Number(b.pendingHours).toFixed(2)}h
                                  </TableCell>

                                  {/* Available Balance */}
                                  <TableCell className="py-2.5 px-4 text-center">
                                    <span className="inline-flex items-center font-mono font-bold text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                                      {Number(b.availableHours).toFixed(2)}h
                                    </span>
                                  </TableCell>

                                  {/* Action */}
                                  <TableCell className="py-2.5 px-4 text-right">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setBalanceToAdjust(b);
                                        setAssignBalanceModalOpen(true);
                                      }}
                                      className="h-6 px-2 text-[11px] gap-1 text-muted hover:text-ink shadow-2xs hover:bg-subtle"
                                      title="Adjust or Prorate Balance"
                                    >
                                      <Sliders className="size-3" />
                                      <span>Adjust</span>
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                        </React.Fragment>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-xs text-muted bg-panel">
              <div className="flex items-center gap-2">
                <span>Rows per page:</span>
                <select
                  value={String(balancesRowsPerPage)}
                  onChange={(e) => {
                    setBalancesRowsPerPage(Number(e.target.value));
                    setBalancesPage(0);
                  }}
                  className="rounded-lg border border-line bg-subtle px-2 py-1 text-xs font-medium text-ink focus:border-primary-500 focus:outline-none"
                >
                  {[5, 10, 25, 50].map((count) => (
                    <option key={count} value={String(count)}>
                      {count}
                    </option>
                  ))}
                </select>
                <span className="font-mono text-xs num">
                  {filteredGroupedBalances.length > 0 ? balancesPage * balancesRowsPerPage + 1 : 0}–
                  {Math.min((balancesPage + 1) * balancesRowsPerPage, filteredGroupedBalances.length)} of {filteredGroupedBalances.length} staff
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="font-mono text-xs num mr-2">
                  Page {balancesPage + 1} of {totalBalancePages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={balancesPage === 0}
                  onClick={() => setBalancesPage((p) => Math.max(0, p - 1))}
                  className="h-7 w-7 p-0"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="size-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={balancesPage >= totalBalancePages - 1}
                  onClick={() => setBalancesPage((p) => p + 1)}
                  className="h-7 w-7 p-0"
                  aria-label="Next page"
                >
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 3: Team Time-Off Calendar & Schedule */}
      {activeTab === 'calendar' && (
        <TeamLeaveCalendar workspaceId={workspaceId} />
      )}

      {/* TAB 4: Leave Policies */}
      {activeTab === 'policies' && (
        <LeavePolicyManagement workspaceId={workspaceId} />
      )}

      {/* TAB 3: US Compliance Guide */}
      {activeTab === 'compliance' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-5 border shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-base text-foreground">California Healthy Workplaces Healthy Families Act</h3>
                <p className="text-xs text-muted-foreground">Statutory Paid Sick Leave (CA PSL)</p>
              </div>
            </div>
            <ul className="text-xs space-y-2 text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="font-bold text-foreground">•</span>
                <span><strong>Mandatory Minimum:</strong> 40 hours (or 5 days) of paid sick leave per year.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-foreground">•</span>
                <span><strong>Statutory Accrual:</strong> 1 hour per 30 hours worked (accrual rate 0.0333).</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-foreground">•</span>
                <span><strong>Usage Waiting Period:</strong> Employees can use accrued sick leave after 90 days of employment.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-foreground">•</span>
                <span><strong>Separation:</strong> Unused statutory sick leave balance expires upon departure.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-foreground">•</span>
                <span><strong>Doctor's Certification:</strong> Employers cannot require medical certification for absences under 3 consecutive days.</span>
              </li>
            </ul>
          </Card>

          <Card className="p-5 border shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-base text-foreground">New York State Paid Sick Leave Law</h3>
                <p className="text-xs text-muted-foreground">Statutory Sick Leave (NY PSL)</p>
              </div>
            </div>
            <ul className="text-xs space-y-2 text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="font-bold text-foreground">•</span>
                <span><strong>Small Employers (4 or fewer, net income ≤$1M):</strong> 40 hours unpaid sick leave.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-foreground">•</span>
                <span><strong>Medium Employers (5-99 employees):</strong> 40 hours paid sick leave per calendar year.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-foreground">•</span>
                <span><strong>Accrual Rate:</strong> 1 hour for every 30 hours worked, beginning immediately on first day.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-foreground">•</span>
                <span><strong>Rollover:</strong> Unused sick leave carries over to following year (up to 40 or 56 hours cap).</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-foreground">•</span>
                <span><strong>Termination:</strong> No statutory requirement to pay out accrued unused sick time at separation.</span>
              </li>
            </ul>
          </Card>

          <Card className="p-5 border shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-base text-foreground">Illinois Paid Leave for All Workers Act (PLAAR)</h3>
                <p className="text-xs text-muted-foreground">Statutory Paid Leave for Any Reason</p>
              </div>
            </div>
            <ul className="text-xs space-y-2 text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="font-bold text-foreground">•</span>
                <span><strong>Mandatory Provision:</strong> 40 hours of paid leave per 12-month period.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-foreground">•</span>
                <span><strong>Any Reason:</strong> Employees do NOT have to provide a reason or medical note for taking leave.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-foreground">•</span>
                <span><strong>Accrual:</strong> 1 hour per 40 hours worked (0.025 rate) or 40 hours frontloaded on day one.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-foreground">•</span>
                <span><strong>Separation:</strong> Unused hours balance expires upon departure.</span>
              </li>
            </ul>
          </Card>

          <Card className="p-5 border shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-base text-foreground">Federal Family and Medical Leave Act (FMLA)</h3>
                <p className="text-xs text-muted-foreground">Federal Job Protection (DOL / 29 CFR Part 825)</p>
              </div>
            </div>
            <ul className="text-xs space-y-2 text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="font-bold text-foreground">•</span>
                <span><strong>Entitlement:</strong> Up to 12 workweeks (480 hours) of unpaid, job-protected leave per year.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-foreground">•</span>
                <span><strong>Eligibility:</strong> Employed for at least 12 months, with 1,250 hours of service during the previous 12-month period.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-foreground">•</span>
                <span><strong>Notice:</strong> 30 days advance notice required when foreseeable; as soon as practicable when unforeseen.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-foreground">•</span>
                <span><strong>Intermittent Leave:</strong> Supported for medical treatments and serious health conditions.</span>
              </li>
            </ul>
          </Card>
        </div>
      )}
      {/* Review Dialog */}
      <Dialog open={Boolean(reviewRequestItem)} onOpenChange={(open) => !open && setReviewRequestItem(null)}>
        <DialogContent className="max-w-md sm:max-w-[480px] p-6 rounded-2xl bg-panel">
          <DialogHeader
            title={
              <span className="text-xl font-bold tracking-tight text-ink">
                {reviewRequestItem?.status === 'APPROVED'
                  ? 'Reject Leave Request'
                  : reviewDecision === 'APPROVED'
                  ? 'Approve Leave Request'
                  : 'Reject Leave Request'}
              </span>
            }
          />

          <DialogBody className="space-y-4 px-0 py-2">
            {reviewRequestItem?.status === 'APPROVED' && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300 flex items-start gap-2.5">
                <AlertCircle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-semibold">Reversal Notice</div>
                  <p className="leading-relaxed opacity-90">
                    Reversing this approved request will restore <strong>{reviewRequestItem.totalHours} hrs</strong> back to the employee&apos;s available balance.
                  </p>
                </div>
              </div>
            )}

            {reviewRequestItem && (
              <div className="rounded-2xl bg-slate-200/75 dark:bg-slate-800/80 p-4 sm:p-5 space-y-2.5 text-sm">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Employee:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 text-right">
                    {employeeMap.get(reviewRequestItem.employeeId)?.name ||
                      reviewRequestItem.employee?.workspaceMember?.user?.fullName ||
                      'Employee'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Policy:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 text-right">
                    {reviewRequestItem.policy?.name || 'Leave Policy'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Requested Hours:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 text-right">
                    {reviewRequestItem.totalHours} hours
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Dates:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 text-right">
                    {dayjs(reviewRequestItem.startDate).format('MMM D, YYYY')} – {dayjs(reviewRequestItem.endDate).format('MMM D, YYYY')}
                  </span>
                </div>

                <div className="border-t border-slate-300/80 dark:border-slate-700/80 my-2.5" />

                <div className="text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Employee note: </span>
                  <span className="text-slate-900 dark:text-slate-100 font-medium">
                    {reviewRequestItem.reason || 'None'}
                  </span>
                </div>

                {reviewRequestItem.attachmentUrl && (
                  <div className="flex items-center justify-between text-sm pt-1">
                    <span className="text-slate-600 dark:text-slate-400">Attachment:</span>
                    <a
                      href={reviewRequestItem.attachmentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                    >
                      View Document <ExternalLink className="size-3" />
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Staffing Conflict Alert if approving */}
            {reviewDecision === 'APPROVED' && conflictData?.hasConflict && (
              <div
                className={cn(
                  'rounded-xl p-3 text-xs border flex items-start gap-2.5',
                  conflictData.severity === 'HIGH'
                    ? 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-200'
                    : 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200'
                )}
              >
                <AlertTriangle
                  className={cn(
                    'size-4 shrink-0 mt-0.5',
                    conflictData.severity === 'HIGH' ? 'text-rose-600' : 'text-amber-600'
                  )}
                />
                <div className="space-y-1">
                  <div className="font-semibold">
                    {conflictData.severity === 'HIGH' ? 'Critical Staffing Shortage Warning' : 'Staffing Conflict Alert'}
                  </div>
                  <p className="text-[11px] leading-relaxed opacity-90">
                    {conflictData.warningMessage}
                  </p>
                </div>
              </div>
            )}

            {/* Reviewer Comments */}
            <div className="space-y-1.5 pt-1">
              <label htmlFor="leave-reviewer-comment" className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
                Reviewer Comments (Optional)
              </label>
              <textarea
                id="leave-reviewer-comment"
                rows={2}
                placeholder={
                  reviewDecision === 'APPROVED'
                    ? 'e.g. Approved. Enjoy your time off.'
                    : 'e.g. Insufficient coverage or schedule conflict.'
                }
                value={reviewerComment}
                onChange={(e) => setReviewerComment(e.target.value)}
                maxLength={500}
                className="w-full resize-none rounded-xl border border-blue-400/90 dark:border-blue-500/80 bg-panel px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/15 transition shadow-xs leading-normal"
              />
            </div>
          </DialogBody>

          <DialogFooter className="border-t-0 bg-transparent px-0 pt-2 pb-0 flex-row justify-end gap-3 sm:space-x-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setReviewRequestItem(null)}
              disabled={reviewMutation.isPending}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 shadow-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmReview}
              disabled={reviewMutation.isPending}
              className={cn(
                'rounded-xl px-5 py-2 text-sm font-medium text-white shadow-xs transition',
                reviewDecision === 'APPROVED'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-[#E11D48] hover:bg-[#BE123C]'
              )}
            >
              {reviewMutation.isPending
                ? 'Processing...'
                : reviewDecision === 'APPROVED'
                ? 'Confirm Approval'
                : 'Confirm Rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Leave Request Confirmation Dialog */}
      <Dialog
        open={Boolean(cancelTargetRequest)}
        onOpenChange={(open) => !open && setCancelTargetRequest(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader
            title="Cancel Leave Request"
            description="Are you sure you want to cancel this leave request?"
          />

          <DialogBody className="space-y-4 py-2">
            {cancelTargetRequest && (
              <div className="rounded-xl border border-line bg-subtle/50 p-3.5 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted font-medium">Employee:</span>
                  <span className="font-semibold text-ink">
                    {employeeMap.get(cancelTargetRequest.employeeId)?.name ||
                      cancelTargetRequest.employee?.workspaceMember?.user?.fullName ||
                      'Employee'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted font-medium">Policy:</span>
                  <span className="font-semibold text-ink">
                    {cancelTargetRequest.policy?.name || 'Leave Policy'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted font-medium">Duration & Dates:</span>
                  <span className="font-semibold text-ink font-mono">
                    {dayjs(cancelTargetRequest.startDate).format('MMM D, YYYY')} –{' '}
                    {dayjs(cancelTargetRequest.endDate).format('MMM D, YYYY')} (
                    {cancelTargetRequest.totalHours} hrs)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted font-medium">Current Status:</span>
                  {getStatusBadge(cancelTargetRequest.status)}
                </div>

                <div
                  className={cn(
                    'mt-2 p-2.5 rounded-lg border text-xs leading-relaxed',
                    cancelTargetRequest.status === 'APPROVED'
                      ? 'border-amber-200 bg-amber-50/70 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300'
                      : 'border-primary-200 bg-primary-50/70 text-primary-800 dark:border-primary-900 dark:bg-primary-950/30 dark:text-primary-300'
                  )}
                >
                  {cancelTargetRequest.status === 'APPROVED'
                    ? `⚠️ This leave was previously Approved. Cancelling it will immediately restore ${cancelTargetRequest.totalHours} hours back to the employee's available leave balance.`
                    : `ℹ️ Cancelling this pending request will release the reserved ${cancelTargetRequest.totalHours} hours back to the available leave balance.`}
                </div>
              </div>
            )}
          </DialogBody>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCancelTargetRequest(null)}
              disabled={cancelMutation.isPending}
            >
              Keep Leave
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmCancel}
              disabled={cancelMutation.isPending}
              className="gap-1.5"
            >
              <Ban className="size-3.5" />
              <span>{cancelMutation.isPending ? 'Cancelling...' : 'Confirm Cancellation'}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submit Leave Request Modal */}
      <SubmitLeaveRequestModal
        open={submitModalOpen}
        onOpenChange={setSubmitModalOpen}
        workspaceId={workspaceId}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['leaveRequests', workspaceId] });
        }}
      />

      {/* Create Policy Modal */}
      <CreateLeavePolicyModal
        open={createPolicyModalOpen}
        onOpenChange={setCreatePolicyModalOpen}
        workspaceId={workspaceId}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['leavePolicies', workspaceId] });
        }}
      />

      {/* Time & Leave Hours Export Modal */}
      <PayrollExportModal
        open={hoursExportOpen}
        onOpenChange={setHoursExportOpen}
        workspaceId={workspaceId}
      />

      {/* Assign / Prorate Balance Modal */}
      <AssignLeaveBalanceModal
        open={assignBalanceModalOpen}
        onOpenChange={(open) => {
          setAssignBalanceModalOpen(open);
          if (!open) setBalanceToAdjust(null);
        }}
        workspaceId={workspaceId}
        initialBalance={balanceToAdjust}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['workspaceLeaveBalances', workspaceId] });
        }}
      />
    </div>
  );
};

export default LeaveManagementPage;
