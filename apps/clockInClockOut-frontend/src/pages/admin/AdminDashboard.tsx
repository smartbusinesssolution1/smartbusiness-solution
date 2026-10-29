import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import {
  Users,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  ArrowUpRight,
  ArrowRight,
  Clock,
  ShieldCheck,
  Inbox,
  UserPlus,
  Check,
  Building2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts';
import dayjs from 'dayjs';

import { attendanceService } from '../../services/attendanceService';
import { employeeService } from '../../services/employeeService';
import { settingsService } from '../../services/settingsService';
import { useAuth } from '../../context/AuthContext';
import BrandLoader from '../../components/BrandLoader';
import { getAvatarUrl } from '../../utils/imageUrl';
import { cn } from '../../lib/utils';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Progress,
  Tooltip,
} from '../../components/ui';
import { User } from '../../types';

interface StreamRecord {
  id: string;
  name: string;
  empId: string;
  workspace: string;
  time: string;
  type: string;
  status: 'present' | 'late' | 'absent' | 'half_day' | 'auto_closed';
  avatarUrl?: string | null;
}

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, workspaces, currentWorkspace, currentTenant } = useAuth();

  // Active chart view tab
  const [chartTab, setChartTab] = useState<'weekly' | 'dept'>('weekly');

  const cleanId = (id?: string | null): string => {
    if (!id || id === 'undefined' || id === 'null' || id.trim() === '') return '';
    return id.trim();
  };

  const activeWorkspaceId =
    cleanId(currentWorkspace?.id) ||
    cleanId(localStorage.getItem('active_workspace_id')) ||
    cleanId(workspaces?.[0]?.id) ||
    '';

  // Fetch admin dashboard metrics
  const {
    data: metrics,
    isLoading: isMetricsLoading,
    isFetching: isMetricsFetching,
    refetch: refetchMetrics,
  } = useQuery({
    queryKey: ['adminDashboardMetrics', activeWorkspaceId],
    queryFn: () => attendanceService.getAdminDashboardMetrics(activeWorkspaceId || undefined),
    enabled: Boolean(user && user.role === 'admin' && activeWorkspaceId),
    staleTime: 60_000,
    gcTime: 300_000,
  });

  // Fetch recent attendance logs
  const {
    data: rawAttendance = [],
    isLoading: isAttendanceLoading,
    refetch: refetchAttendance,
  } = useQuery({
    queryKey: ['adminAttendanceStream', activeWorkspaceId],
    queryFn: () => attendanceService.getAllAttendance({ workspaceId: activeWorkspaceId || undefined }),
    enabled: Boolean(user && user.role === 'admin' && activeWorkspaceId),
    staleTime: 30_000,
    gcTime: 300_000,
  });

  // Fetch employees directory
  const {
    data: employeesData,
    isLoading: isEmployeesLoading,
    refetch: refetchEmployees,
  } = useQuery({
    queryKey: ['adminEmployeesList', activeWorkspaceId],
    queryFn: () => employeeService.getEmployees({ workspaceId: activeWorkspaceId || undefined }),
    enabled: Boolean(user && user.role === 'admin' && activeWorkspaceId),
    staleTime: 60_000,
    gcTime: 300_000,
  });

  // Fetch workspace geofence and shift configuration
  const {
    data: geofenceSettings,
    refetch: refetchGeofence,
  } = useQuery({
    queryKey: ['adminGeofence', activeWorkspaceId],
    queryFn: () => settingsService.getGeofence(activeWorkspaceId),
    enabled: Boolean(user && user.role === 'admin' && activeWorkspaceId),
    staleTime: 30_000,
    gcTime: 300_000,
  });

  const employees: User[] = useMemo(() => {
    if (!employeesData) return [];
    if (Array.isArray(employeesData)) return employeesData;
    return (employeesData as any).items || [];
  }, [employeesData]);

  const isLoading = isMetricsLoading || isAttendanceLoading || isEmployeesLoading;

  const handleRefreshAll = () => {
    refetchMetrics();
    refetchAttendance();
    refetchEmployees();
    refetchGeofence();
  };

  // KPIs
  const totalEmployeesCount = metrics?.totalEmployees ?? employees.length;
  const presentTodayCount =
    metrics?.presentToday ??
    (rawAttendance || []).filter((r) => r.status === 'present' || r.status === 'late').length;
  const lateTodayCount =
    metrics?.lateToday ?? (rawAttendance || []).filter((r) => r.status === 'late').length;
  const absentTodayCount =
    metrics?.absentCount ?? Math.max(0, totalEmployeesCount - presentTodayCount);
  const autoClosedCount = metrics?.autoClosedToday ?? 0;
  const attendanceRateVal =
    metrics?.attendanceRate ??
    (totalEmployeesCount > 0 ? Math.round((presentTodayCount / totalEmployeesCount) * 100) : 0);

  // Dynamic Weekly Trend Analytics (Mon-Fri)
  const weeklyChartData = useMemo(() => {
    if (metrics?.weeklyStats && metrics.weeklyStats.length > 0) {
      return metrics.weeklyStats;
    }

    const days: { dateStr: string; day: string }[] = [];
    let cursor = dayjs();
    while (days.length < 5) {
      const dow = cursor.day();
      if (dow !== 0 && dow !== 6) {
        days.unshift({
          dateStr: cursor.format('YYYY-MM-DD'),
          day: cursor.format('ddd'),
        });
      }
      cursor = cursor.subtract(1, 'day');
    }

    const totalStaff = metrics?.totalEmployees ?? employees.length;

    return days.map(({ dateStr, day }) => {
      const dayRecs = (rawAttendance || []).filter((r) => r.date === dateStr);
      const present = dayRecs.filter((r) => r.status === 'present' || r.status === 'half_day').length;
      const late = dayRecs.filter((r) => r.status === 'late').length;
      const explicitAbsent = dayRecs.filter((r) => r.status === 'absent').length;
      const absent =
        dayRecs.length > 0
          ? explicitAbsent > 0
            ? explicitAbsent
            : Math.max(0, totalStaff - (present + late))
          : 0;

      return {
        day,
        present,
        late,
        absent,
      };
    });
  }, [metrics?.weeklyStats, metrics?.totalEmployees, employees.length, rawAttendance]);

  // Dynamic Department Attendance Stats
  const departmentStats = useMemo(() => {
    if (metrics?.departmentStats && metrics.departmentStats.length > 0) {
      return metrics.departmentStats;
    }

    if (employees && employees.length > 0) {
      const deptMap: Record<string, { total: number; empIds: Set<string> }> = {};
      employees.forEach((emp) => {
        const dept = emp.department?.trim() || 'General';
        if (!deptMap[dept]) {
          deptMap[dept] = { total: 0, empIds: new Set() };
        }
        deptMap[dept].total += 1;
        if (emp.id) deptMap[dept].empIds.add(emp.id);
        if (emp.employeeId) deptMap[dept].empIds.add(emp.employeeId);
      });

      const todayStr = dayjs().format('YYYY-MM-DD');
      let targetRecords = (rawAttendance || []).filter((r) => r.date === todayStr);
      if (targetRecords.length === 0 && rawAttendance && rawAttendance.length > 0) {
        const sortedDates = Array.from(new Set(rawAttendance.map((r) => r.date))).sort();
        const latestDate = sortedDates[sortedDates.length - 1];
        targetRecords = rawAttendance.filter((r) => r.date === latestDate);
      }

      const statusMap = new Map<string, string>();
      targetRecords.forEach((rec) => {
        if (rec.employeeId) statusMap.set(rec.employeeId, rec.status);
        if (rec.id) statusMap.set(rec.id, rec.status);
      });

      return Object.entries(deptMap).map(([name, data]) => {
        let present = 0;
        let late = 0;
        data.empIds.forEach((id) => {
          const st = statusMap.get(id);
          if (st === 'present' || st === 'half_day') present++;
          else if (st === 'late') late++;
        });
        const absent = Math.max(0, data.total - (present + late));
        const rate = data.total > 0 ? Math.round(((present + late) / data.total) * 100) : 0;
        return {
          name,
          rate,
          present,
          late,
          absent,
          total: data.total,
        };
      });
    }

    return [];
  }, [metrics?.departmentStats, employees, rawAttendance]);

  // Formatted Live Feed Stream Items
  const recentAttendanceList = useMemo<StreamRecord[]>(() => {
    if (rawAttendance && rawAttendance.length > 0) {
      return rawAttendance.slice(0, 6).map((item, idx) => {
        const formattedId =
          item.employeeId ||
          (item as any).employee?.employeeCode ||
          (item as any).employee?.id ||
          item.id ||
          `#${1001 + idx}`;

        let checkInTime = '--';
        if (item.checkIn) {
          try {
            checkInTime = dayjs(`${item.date}T${item.checkIn}`).format('hh:mm A');
          } catch {
            checkInTime = item.checkIn;
          }
        }

        const isLate = item.status === 'late';
        const isGps = Boolean(
          (item as any).clockInLatitude ||
            (item as any).locationVerified ||
            (item as any).isGeofenceVerified
        );
        const workspaceName =
          (item as any).workspaceName || (item as any).workspace || 'Main Office';

        return {
          id: item.id || `stream-${idx}`,
          name: item.employeeName || 'Staff Member',
          empId: formattedId,
          workspace: workspaceName,
          time: checkInTime,
          type: isLate ? 'Late Arrival' : isGps ? 'GPS Verified' : 'On Time',
          status: item.status,
          avatarUrl: (item as any).avatarUrl || null,
        };
      });
    }

    return [];
  }, [rawAttendance]);

  // Leave & Time-Off Requests State
  const [leaveRequests, setLeaveRequests] = useState<
    Array<{
      id: string;
      name: string;
      empId: string;
      avatarUrl?: string | null;
      department: string;
      type: string;
      duration: string;
      reason: string;
      status: 'pending' | 'approved' | 'rejected';
    }>
  >([]);

  const handleApproveRequest = (id: string) => {
    setLeaveRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: 'approved' as const } : r))
    );
  };

  const handleRejectRequest = (id: string) => {
    setLeaveRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: 'rejected' as const } : r))
    );
  };

  const pendingLeavesCount = useMemo(
    () => leaveRequests.filter((r) => r.status === 'pending').length,
    [leaveRequests]
  );

  // Setup completion metrics
  const hasGeofenceConfigured = Boolean(
    (geofenceSettings?.isConfigured &&
      geofenceSettings?.geofence &&
      (Number(geofenceSettings.geofence.latitude) !== 0 ||
        Number(geofenceSettings.geofence.longitude) !== 0)) ||
      (activeWorkspaceId &&
        localStorage.getItem(`geofence_configured_${activeWorkspaceId}`) === 'true') ||
      (currentTenant?.id &&
        localStorage.getItem(`geofence_configured_${currentTenant.id}`) === 'true')
  );

  const hasShiftConfigured = Boolean(
    (geofenceSettings?.isConfigured &&
      geofenceSettings?.geofence?.defaultShiftStartTime &&
      geofenceSettings?.geofence?.defaultShiftEndTime) ||
      (activeWorkspaceId &&
        localStorage.getItem(`shifts_configured_${activeWorkspaceId}`) === 'true') ||
      (currentTenant?.id &&
        localStorage.getItem(`shifts_configured_${currentTenant.id}`) === 'true')
  );

  const hasEmployeesAdded = totalEmployeesCount > 0;
  const hasAvatarUploaded = Boolean(
    user?.avatarUrl &&
      user.avatarUrl.trim() !== '' &&
      !user.avatarUrl.includes('placeholder')
  );

  const setupSteps = [
    { label: 'Add employees', done: hasEmployeesAdded, path: '/admin/employees/new' },
    { label: 'Set office geofence', done: hasGeofenceConfigured, path: '/admin/settings' },
    { label: 'Define shift hours', done: hasShiftConfigured, path: '/admin/settings' },
    { label: 'Upload admin avatar', done: hasAvatarUploaded, path: '/admin/profile' },
  ];

  const setupDoneCount = setupSteps.filter((s) => s.done).length;
  const setupPercent = Math.round((setupDoneCount / setupSteps.length) * 100);
  const isSetupComplete = setupDoneCount === setupSteps.length;

  const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  };

  const userFirstName = user?.name ? user.name.split(' ')[0] : 'Admin';
  const workspaceTitle = currentWorkspace?.name || 'Workspace';

  const dateEyebrow = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  if (isLoading) {
    return <BrandLoader fullScreen message="Loading dashboard view..." />;
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="eyebrow">{dateEyebrow}</span>
            <h1 className="text-[1.625rem] sm:text-[1.75rem] font-semibold tracking-[-0.02em] leading-tight text-ink">
              {greeting()}, {userFirstName}
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted">
              Here's what needs attention at {workspaceTitle}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Tooltip content="Refresh metrics">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshAll}
                disabled={isLoading || isMetricsFetching}
              >
                <RotateCw className={cn('size-3.5 mr-1.5 text-muted', isMetricsFetching && 'animate-spin')} />
                Refresh
              </Button>
            </Tooltip>

            <Button variant="brand" size="sm" asChild>
              <Link to="/admin/employees/new" className="gap-1.5">
                <UserPlus className="size-3.5" />
                <span>+ Onboard Staff</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Setup Card (shadcn Card with pattern and Progress) */}
      {!isSetupComplete && (
        <Card className="relative overflow-hidden p-5 sm:p-6">
          <div className="dot-grid pointer-events-none absolute inset-y-0 right-0 w-1/2 opacity-60 [mask-image:linear-gradient(to_left,black,transparent)]" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex max-w-xl flex-col gap-2.5">
              <span className="eyebrow">
                SETUP {setupDoneCount} OF {setupSteps.length}
              </span>
              <h2 className="text-base font-semibold tracking-tight text-ink">
                Finish setting up {workspaceTitle}
              </h2>
              <p className="text-xs leading-relaxed text-muted">
                Add your staff roster, establish geofenced coordinates, and define shift hours to
                enable live attendance tracking.
              </p>

              {/* Steps checklist pills using shadcn Badge */}
              <div className="flex flex-wrap gap-2 pt-1">
                {setupSteps.map((step) => (
                  <Link key={step.label} to={step.path}>
                    <Badge
                      variant={step.done ? 'success' : 'outline'}
                      className="cursor-pointer gap-1.5 font-medium transition-colors hover:border-line-strong"
                    >
                      <span
                        className={cn(
                          'flex size-3.5 items-center justify-center rounded-full text-[9px] font-bold',
                          step.done ? 'bg-emerald-600 text-white' : 'border border-faint text-faint'
                        )}
                      >
                        {step.done ? <Check className="size-2.5" /> : null}
                      </span>
                      <span>{step.label}</span>
                    </Badge>
                  </Link>
                ))}
              </div>

              {/* shadcn Progress component */}
              <div className="flex items-center gap-2 pt-1">
                <Progress value={setupPercent} className="h-1.5 flex-1" />
                <span className="font-mono text-xs font-medium text-muted num">{setupPercent}%</span>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Button variant="brand" size="default" asChild>
                <Link
                  to={setupSteps.find((s) => !s.done)?.path || '/admin/settings'}
                  className="gap-1.5"
                >
                  <span>Resume setup</span>
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* 4 QueueTiles Metric Cards (shadcn Cards) */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Tile 1: Total Staff */}
        <Link to="/admin/employees" className="group block">
          <Card className="flex flex-col gap-3 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-pop">
            <div className="flex items-center justify-between">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary-50 text-primary-600 ring-1 ring-primary-100 ring-inset">
                <Users className="size-4" />
              </span>
              <ArrowUpRight className="size-4 text-faint transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary-600" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[0.8125rem] text-muted">Total staff</span>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[1.75rem] font-medium leading-none tracking-tight text-ink num">
                  {totalEmployeesCount}
                </span>
                <span className="font-mono text-xs text-muted num">
                  {absentTodayCount} on leave
                </span>
              </div>
            </div>
            <span className="text-xs font-medium text-primary-600">Review roster →</span>
          </Card>
        </Link>

        {/* Tile 2: Present Today */}
        <Link to="/admin/reports" className="group block">
          <Card className="flex flex-col gap-3 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-pop">
            <div className="flex items-center justify-between">
              <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100 ring-inset">
                <CheckCircle2 className="size-4" />
              </span>
              <ArrowUpRight className="size-4 text-faint transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-emerald-600" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[0.8125rem] text-muted">Present today</span>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[1.75rem] font-medium leading-none tracking-tight text-ink num">
                  {presentTodayCount}
                </span>
                <span className="font-mono text-xs text-muted num">{attendanceRateVal}% coverage</span>
              </div>
            </div>
            <span className="text-xs font-medium text-primary-600">Live attendance →</span>
          </Card>
        </Link>

        {/* Tile 3: Late Arrivals */}
        <Link to="/admin/reports" className="group block">
          <Card
            className={cn(
              'flex flex-col gap-3 p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-pop',
              lateTodayCount > 0
                ? 'border-amber-500/30 bg-amber-50/40 hover:border-amber-400'
                : 'hover:border-primary-200'
            )}
          >
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  'flex size-8 items-center justify-center rounded-lg ring-1 ring-inset',
                  lateTodayCount > 0
                    ? 'bg-amber-100 text-amber-700 ring-amber-200'
                    : 'bg-primary-50 text-primary-600 ring-primary-100'
                )}
              >
                <AlertTriangle className="size-4" />
              </span>
              <ArrowUpRight
                className={cn(
                  'size-4 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5',
                  lateTodayCount > 0 ? 'text-amber-700' : 'text-faint group-hover:text-primary-600'
                )}
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <span
                className={cn(
                  'text-[0.8125rem]',
                  lateTodayCount > 0 ? 'font-medium text-amber-900' : 'text-muted'
                )}
              >
                Late arrivals
              </span>
              <div className="flex items-baseline gap-2">
                <span
                  className={cn(
                    'font-mono text-[1.75rem] font-medium leading-none tracking-tight num',
                    lateTodayCount > 0 ? 'text-amber-900' : 'text-faint'
                  )}
                >
                  {lateTodayCount}
                </span>
                <span className="font-mono text-xs text-muted num">After cutoff</span>
              </div>
            </div>
            <span
              className={cn(
                'text-xs font-medium',
                lateTodayCount > 0 ? 'text-amber-700' : 'text-faint'
              )}
            >
              {lateTodayCount > 0 ? 'Audit late punches →' : 'Zero exceptions'}
            </span>
          </Card>
        </Link>

        {/* Tile 4: Auto Closed Today */}
        <Link to="/admin/reports" className="group block">
          <Card
            className={cn(
              'flex flex-col gap-3 p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-pop',
              autoClosedCount > 0
                ? 'border-indigo-500/30 bg-indigo-50/40 hover:border-indigo-400'
                : 'hover:border-primary-200'
            )}
          >
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  'flex size-8 items-center justify-center rounded-lg ring-1 ring-inset',
                  autoClosedCount > 0
                    ? 'bg-indigo-100 text-indigo-700 ring-indigo-200'
                    : 'bg-primary-50 text-primary-600 ring-primary-100'
                )}
              >
                <RotateCw className="size-4" />
              </span>
              <ArrowUpRight
                className={cn(
                  'size-4 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5',
                  autoClosedCount > 0 ? 'text-indigo-700' : 'text-faint group-hover:text-primary-600'
                )}
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <span
                className={cn(
                  'text-[0.8125rem]',
                  autoClosedCount > 0 ? 'font-medium text-indigo-900' : 'text-muted'
                )}
              >
                Auto closed today
              </span>
              <div className="flex items-baseline gap-2">
                <span
                  className={cn(
                    'font-mono text-[1.75rem] font-medium leading-none tracking-tight num',
                    autoClosedCount > 0 ? 'text-indigo-900' : 'text-faint'
                  )}
                >
                  {autoClosedCount}
                </span>
                <span className="font-mono text-xs text-muted num">Missed checkout</span>
              </div>
            </div>
            <span
              className={cn(
                'text-xs font-medium',
                autoClosedCount > 0 ? 'text-indigo-700' : 'text-faint'
              )}
            >
              {autoClosedCount > 0 ? 'Action required →' : 'Zero anomalies'}
            </span>
          </Card>
        </Link>
      </div>

      {/* Recent Attendance Activity Panel (shadcn Card) */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 className="text-[0.9375rem] font-semibold tracking-tight text-ink">
              Recent attendance activity
            </h2>
            <p className="text-[0.8125rem] text-muted">
              The latest punches and shifts recorded in this workspace.
            </p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link
              to="/admin/reports"
              className="gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
            >
              View all reports <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>

        {recentAttendanceList.length === 0 ? (
          <div className="p-6">
            <div className="dot-grid flex flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border border-dashed border-line-strong px-6 py-12 text-center">
              <div className="flex size-11 items-center justify-center rounded-xl border border-primary-100 bg-panel text-primary-600 shadow-card">
                <Inbox className="size-5" />
              </div>
              <div className="flex max-w-sm flex-col gap-1">
                <p className="font-semibold text-ink">No punches recorded yet</p>
                <p className="text-xs leading-relaxed text-muted">
                  Employee check-ins and check-outs will appear here with live timestamps and GPS
                  verification status.
                </p>
              </div>
              <Button variant="brand" size="sm" asChild className="mt-2">
                <Link to="/admin/employees/new" className="gap-1.5">
                  <UserPlus className="size-3.5" /> Onboard first employee
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {recentAttendanceList.map((rec) => {
              const isLate = rec.status === 'late';
              const isAuto = rec.status === 'auto_closed';
              const isPresent = rec.status === 'present';

              return (
                <li key={rec.id}>
                  <div className="grid grid-cols-[5.5rem_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3 transition-colors hover:bg-subtle/60 sm:grid-cols-[6rem_minmax(0,1fr)_7rem_8rem_6rem]">
                    {/* Employee Code */}
                    <span className="font-mono text-[0.8125rem] text-muted num">
                      {rec.empId}
                    </span>

                    {/* Employee Info */}
                    <div className="flex min-w-0 items-center gap-2.5">
                      {rec.avatarUrl ? (
                        <img
                          src={getAvatarUrl(rec.avatarUrl)}
                          alt={rec.name}
                          className="size-7 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex size-7 items-center justify-center rounded-full bg-primary-100 font-mono text-[10px] font-semibold text-primary-700">
                          {rec.name.substring(0, 2).toUpperCase()}
                        </span>
                      )}
                      <span className="truncate text-sm font-medium text-ink">{rec.name}</span>
                    </div>

                    {/* Check In Time */}
                    <span className="text-right font-mono text-sm text-ink num sm:text-left">
                      {rec.time}
                    </span>

                    {/* Status Pill using shadcn Badge */}
                    <span className="hidden sm:block">
                      <Badge
                        variant={
                          isPresent ? 'success' : isLate ? 'warning' : isAuto ? 'brand' : 'secondary'
                        }
                        className="gap-1 font-mono text-[0.6875rem] num"
                      >
                        <span
                          className={cn(
                            'size-1.5 rounded-full',
                            isPresent && 'bg-emerald-500',
                            isLate && 'bg-amber-500',
                            isAuto && 'bg-primary-500',
                            !isPresent && !isLate && !isAuto && 'bg-muted'
                          )}
                        />
                        {rec.type}
                      </Badge>
                    </span>

                    {/* Workspace / Relative info */}
                    <span className="hidden text-right font-mono text-xs text-muted sm:block">
                      {rec.workspace}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Two-Column Bento Grid: Analytics Chart + Shifts & Leave Requests */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column (8 cols): Attendance Analytics Recharts */}
        <div className="flex flex-col gap-6 lg:col-span-8">
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
              <div>
                <CardTitle className="text-sm font-semibold tracking-tight text-ink">
                  Attendance analytics
                </CardTitle>
                <span className="font-mono text-[0.625rem] font-semibold tracking-wider text-muted uppercase">
                  {chartTab === 'weekly' ? 'LAST 5 BUSINESS DAYS' : 'DEPARTMENT PERFORMANCE'}
                </span>
              </div>

              {/* Chart Tab Switcher */}
              <div className="flex rounded-lg border border-line bg-subtle p-0.5">
                <button
                  type="button"
                  onClick={() => setChartTab('weekly')}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs font-medium transition-all',
                    chartTab === 'weekly'
                      ? 'bg-panel font-semibold text-ink shadow-sm'
                      : 'text-muted hover:text-ink'
                  )}
                >
                  Weekly trend
                </button>
                <button
                  type="button"
                  onClick={() => setChartTab('dept')}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs font-medium transition-all',
                    chartTab === 'dept'
                      ? 'bg-panel font-semibold text-ink shadow-sm'
                      : 'text-muted hover:text-ink'
                  )}
                >
                  By department
                </button>
              </div>
            </div>

            <div className="mt-4 h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                {chartTab === 'weekly' ? (
                  <BarChart
                    data={weeklyChartData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 11, fill: '#64748b', fontFamily: 'var(--font-mono)' }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748b', fontFamily: 'var(--font-mono)' }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        borderRadius: 8,
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                        fontSize: '0.75rem',
                        fontFamily: 'var(--font-sans)',
                      }}
                    />
                    <Legend
                      wrapperStyle={{
                        fontSize: '11px',
                        fontFamily: 'var(--font-sans)',
                        fontWeight: 500,
                        paddingTop: '8px',
                      }}
                    />
                    <Bar
                      dataKey="present"
                      name="On Time"
                      stackId="att"
                      fill="#10b981"
                      barSize={32}
                    />
                    <Bar
                      dataKey="late"
                      name="Late Check-In"
                      stackId="att"
                      fill="#f59e0b"
                      barSize={32}
                    />
                    <Bar
                      dataKey="absent"
                      name="Absent"
                      stackId="att"
                      fill="#ef4444"
                      radius={[4, 4, 0, 0]}
                      barSize={32}
                    />
                  </BarChart>
                ) : departmentStats.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-xs text-muted">
                    No department attendance recorded yet.
                  </div>
                ) : (
                  <BarChart
                    data={departmentStats}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: '#64748b', fontFamily: 'var(--font-mono)' }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                    />
                    <YAxis
                      unit="%"
                      domain={[0, 100]}
                      tick={{ fontSize: 11, fill: '#64748b', fontFamily: 'var(--font-mono)' }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                    />
                    <RechartsTooltip
                      formatter={(val: any) => [`${val}%`, 'Attendance Rate']}
                      contentStyle={{
                        borderRadius: 8,
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                        fontSize: '0.75rem',
                        fontFamily: 'var(--font-sans)',
                      }}
                    />
                    <Bar
                      dataKey="rate"
                      name="Attendance Rate (%)"
                      fill="#4f46e5"
                      radius={[4, 4, 0, 0]}
                      barSize={32}
                    />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Right Column (4 cols): Active Shift & Leave Approvals */}
        <div className="flex flex-col gap-6 lg:col-span-4">
          {/* Active Shift Coverage Widget (shadcn Card + Progress) */}
          <Card className="p-5">
            <div className="flex items-center justify-between border-b border-line pb-3.5">
              <div>
                <CardTitle className="text-sm font-semibold tracking-tight text-ink">
                  Shift coverage
                </CardTitle>
                <span className="font-mono text-[0.625rem] font-semibold text-muted uppercase">
                  LIVE DEPLOYMENT TODAY
                </span>
              </div>
              <Badge variant="success" className="font-mono text-[0.6875rem]">
                {attendanceRateVal}% ACTIVE
              </Badge>
            </div>

            <div className="flex flex-col gap-4 pt-4">
              {/* Core Shift */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-ink">General Shift (09:00 - 17:00)</span>
                  <span className="font-mono text-muted num">
                    {presentTodayCount}/{totalEmployeesCount}
                  </span>
                </div>
                <Progress
                  value={totalEmployeesCount > 0 ? (presentTodayCount / totalEmployeesCount) * 100 : 0}
                  indicatorClassName="bg-emerald-500"
                  className="h-1.5"
                />
              </div>

              {/* Field Operations */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-ink">Field GPS Operations</span>
                  <span className="font-mono text-muted num">100% verified</span>
                </div>
                <Progress value={100} indicatorClassName="bg-teal-500" className="h-1.5" />
              </div>

              {/* Leaves / Absences */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-ink">Absences & Time-Off</span>
                  <span className="font-mono text-muted num">
                    {absentTodayCount} staff ({totalEmployeesCount > 0 ? Math.round((absentTodayCount / totalEmployeesCount) * 100) : 0}%)
                  </span>
                </div>
                <Progress
                  value={totalEmployeesCount > 0 ? (absentTodayCount / totalEmployeesCount) * 100 : 0}
                  indicatorClassName="bg-amber-500"
                  className="h-1.5"
                />
              </div>
            </div>
          </Card>

          {/* Leave & Time-Off Requests Widget */}
          <Card className="p-5">
            <div className="flex items-center justify-between border-b border-line pb-3.5">
              <div>
                <CardTitle className="text-sm font-semibold tracking-tight text-ink">
                  Leave requests
                </CardTitle>
                <span className="font-mono text-[0.625rem] font-semibold text-muted uppercase">
                  PENDING APPROVALS
                </span>
              </div>
              <Badge
                variant={pendingLeavesCount > 0 ? 'warning' : 'success'}
                className="font-mono text-[0.6875rem]"
              >
                {pendingLeavesCount > 0 ? `${pendingLeavesCount} PENDING` : 'ALL RESOLVED'}
              </Badge>
            </div>

            <div className="flex flex-col gap-3 pt-4">
              {leaveRequests.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="text-xs font-medium text-muted">No pending requests</p>
                  <p className="text-[0.6875rem] text-faint">
                    All time-off and punch adjustment requests are clear.
                  </p>
                </div>
              ) : (
                leaveRequests.map((req) => (
                  <div
                    key={req.id}
                    className="flex flex-col gap-2 rounded-lg border border-line bg-subtle/50 p-2.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-ink">{req.name}</span>
                      <Badge variant="secondary" className="font-mono text-[0.625rem]">
                        {req.type}
                      </Badge>
                    </div>
                    <p className="text-[0.6875rem] text-muted italic">"{req.reason}"</p>
                    {req.status === 'pending' && (
                      <div className="flex justify-end gap-1.5 pt-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRejectRequest(req.id)}
                          className="h-6 px-2 text-[0.6875rem] text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                        >
                          Decline
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleApproveRequest(req.id)}
                          className="h-6 bg-emerald-600 px-2.5 text-[0.6875rem] text-white hover:bg-emerald-700"
                        >
                          Approve
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
