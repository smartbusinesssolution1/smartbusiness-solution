import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { attendanceService } from '../../services/attendanceService';
import { employeeService } from '../../services/employeeService';
import { useAuth } from '../../context/AuthContext';
import { getAvatarUrl } from '../../utils/imageUrl';
import { User } from '../../types';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Paper,
  Divider,
  LinearProgress,
  IconButton,
  Skeleton,
  useTheme,
  ButtonBase,
  Avatar,
  Chip,
  ButtonGroup,
  Tooltip as MuiTooltip,
  Alert,
} from '@mui/material';
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  People as PeopleIcon,
  CheckCircle as PresentIcon,
  Warning as LateIcon,
  Autorenew as AutoClosedIcon,
  GpsFixed as GpsFixedIcon,
  Bolt as QuickActionsIcon,
  PersonAdd as AddEmployeeIcon,
  Assessment as ReportIcon,
  LocationOn as GeofenceIcon,
  Settings as SettingsIcon,
  CloudDownload as ExportIcon,
  Domain as DomainIcon,
  Schedule as ScheduleIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon,
  FiberManualRecord as DotIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  EventNote as EventNoteIcon,
} from '@mui/icons-material';
import dayjs from 'dayjs';

interface StreamRecord {
  id: string;
  name: string;
  empId: string;
  workspace: string;
  time: string;
  type: string;
  status: 'present' | 'late' | 'gps' | 'biometric';
  avatarUrl?: string | null;
}

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { user, workspaces, currentWorkspace } = useAuth();

  // Active chart view tab
  const [chartTab, setChartTab] = useState<'weekly' | 'dept'>('weekly');

  // Semantic color tints matching existing theme
  const colors = useMemo(() => ({
    present: {
      main: isDark ? '#34d399' : '#10b981',
      bg: isDark ? 'rgba(6, 78, 59, 0.45)' : '#ecfdf5',
    },
    late: {
      main: isDark ? '#fbbf24' : '#f59e0b',
      bg: isDark ? 'rgba(120, 53, 15, 0.45)' : '#fffbeb',
    },
    absent: {
      main: isDark ? '#f87171' : '#ef4444',
      bg: isDark ? 'rgba(127, 29, 29, 0.45)' : '#fef2f2',
    },
    autoclosed: {
      main: isDark ? '#818cf8' : '#6366f1',
      bg: isDark ? 'rgba(49, 46, 129, 0.45)' : '#f5f3ff',
    },
    geofence: {
      main: isDark ? '#2dd4bf' : '#0d9488',
      bg: isDark ? 'rgba(19, 78, 74, 0.45)' : '#f0fdfa',
    },
    primary: {
      main: theme.palette.primary.main,
      bg: isDark ? 'rgba(49, 46, 129, 0.35)' : '#e0e7ff',
    },
  }), [isDark, theme.palette.primary.main]);

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
    enabled: Boolean(user && user.role === 'admin'),
  });

  // Fetch recent attendance logs for real-time pulse stream
  const {
    data: rawAttendance = [],
    isLoading: isAttendanceLoading,
    refetch: refetchAttendance,
  } = useQuery({
    queryKey: ['adminAttendanceStream', activeWorkspaceId],
    queryFn: () => attendanceService.getAllAttendance({ workspaceId: activeWorkspaceId || undefined }),
    enabled: Boolean(user && user.role === 'admin'),
  });

  // Fetch employees directory to support dynamic department analytics
  const {
    data: employeesData,
    isLoading: isEmployeesLoading,
    refetch: refetchEmployees,
  } = useQuery({
    queryKey: ['adminEmployeesList', activeWorkspaceId],
    queryFn: () => employeeService.getEmployees({ workspaceId: activeWorkspaceId || undefined }),
    enabled: Boolean(user && user.role === 'admin'),
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
  };

  // 1. Row 1: 5-Pillar High-Impact KPI Strip
  // 1. Row 1: 5-Pillar High-Impact KPI Strip
  const totalEmployeesCount = metrics?.totalEmployees ?? employees.length;
  const presentTodayCount = metrics?.presentToday ?? (rawAttendance || []).filter((r) => r.status === 'present' || r.status === 'late').length;
  const lateTodayCount = metrics?.lateToday ?? (rawAttendance || []).filter((r) => r.status === 'late').length;
  const absentTodayCount = metrics?.absentCount ?? Math.max(0, totalEmployeesCount - presentTodayCount);
  const attendanceRateVal = metrics?.attendanceRate ?? (totalEmployeesCount > 0 ? Math.round((presentTodayCount / totalEmployeesCount) * 100) : 0);
  const verifiedPunchesCount = (rawAttendance || []).filter((r) => r.status !== 'absent').length;

  const kpiPillars = useMemo(() => [
    {
      title: 'Total Employees',
      value: totalEmployeesCount,
      icon: <PeopleIcon sx={{ fontSize: 24, color: colors.primary.main }} />,
      bgColor: colors.primary.bg,
      badgeText: `${totalEmployeesCount} Total`,
      badgeBg: colors.present.bg,
      badgeColor: colors.present.main,
      subText: `${absentTodayCount} on leave / absent`,
      path: '/admin/employees',
    },
    {
      title: 'Present Today',
      value: presentTodayCount,
      icon: <PresentIcon sx={{ fontSize: 24, color: colors.present.main }} />,
      bgColor: colors.present.bg,
      badgeText: `${attendanceRateVal}%`,
      badgeBg: colors.present.bg,
      badgeColor: colors.present.main,
      subText: `${attendanceRateVal}% floor coverage`,
      path: '/admin/reports',
    },
    {
      title: 'Late Today',
      value: lateTodayCount,
      icon: <LateIcon sx={{ fontSize: 24, color: colors.late.main }} />,
      bgColor: colors.late.bg,
      badgeText: lateTodayCount > 0 ? `${lateTodayCount} Late` : '0 Late',
      badgeBg: colors.late.bg,
      badgeColor: colors.late.main,
      subText: 'After shift cutoff',
      path: '/admin/reports',
    },
    {
      title: 'Auto Closed',
      value: metrics?.autoClosedToday ?? 0,
      icon: <AutoClosedIcon sx={{ fontSize: 24, color: colors.autoclosed.main }} />,
      bgColor: colors.autoclosed.bg,
      badgeText: (metrics?.autoClosedToday ?? 0) > 0 ? 'Action Req.' : '0 Anomaly',
      badgeBg: (metrics?.autoClosedToday ?? 0) > 0 ? colors.autoclosed.bg : colors.present.bg,
      badgeColor: (metrics?.autoClosedToday ?? 0) > 0 ? colors.autoclosed.main : colors.present.main,
      subText: 'Missed check-out',
      path: '/admin/reports',
    },
    {
      title: 'Geofence Compliance',
      value: verifiedPunchesCount > 0 ? '100%' : '0%',
      icon: <GpsFixedIcon sx={{ fontSize: 24, color: colors.geofence.main }} />,
      bgColor: colors.geofence.bg,
      badgeText: 'In-Bounds',
      badgeBg: colors.geofence.bg,
      badgeColor: colors.geofence.main,
      subText: `${verifiedPunchesCount} punches verified`,
      path: '/admin/settings',
    },
  ], [totalEmployeesCount, presentTodayCount, lateTodayCount, absentTodayCount, attendanceRateVal, verifiedPunchesCount, metrics?.autoClosedToday, colors]);

  // 2. Row 2: Administrative Actions Full-Width Launchpad
  const adminActions = useMemo(() => [
    {
      title: 'Onboard Staff',
      desc: 'Add personnel & roles',
      icon: <AddEmployeeIcon sx={{ fontSize: 22, color: colors.primary.main }} />,
      bgColor: colors.primary.bg,
      onClick: () => navigate('/admin/employees/new'),
    },
    {
      title: 'Employee Directory',
      desc: 'View & manage roster',
      icon: <PeopleIcon sx={{ fontSize: 22, color: colors.primary.main }} />,
      bgColor: colors.primary.bg,
      onClick: () => navigate('/admin/employees'),
    },
    {
      title: 'Audit Ledger',
      desc: 'Live punches & shifts',
      icon: <ReportIcon sx={{ fontSize: 22, color: colors.primary.main }} />,
      bgColor: colors.primary.bg,
      onClick: () => navigate('/admin/reports'),
    },
    {
      title: 'Organization',
      desc: 'Policies, shifts & geofence',
      icon: <SettingsIcon sx={{ fontSize: 22, color: colors.primary.main }} />,
      bgColor: colors.primary.bg,
      onClick: () => navigate('/admin/settings'),
    },
  ], [colors, navigate]);

  // Dynamic Weekly Trend Analytics (Mon-Fri)
  const weeklyChartData = useMemo(() => {
    if (metrics?.weeklyStats && metrics.weeklyStats.length > 0) {
      return metrics.weeklyStats;
    }

    // Dynamic derivation from rawAttendance across the last 5 business days
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
      const absent = dayRecs.length > 0
        ? (explicitAbsent > 0 ? explicitAbsent : Math.max(0, totalStaff - (present + late)))
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

    // Dynamic grouping from employee records and attendance logs
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

      // Target today's records, or fallback to the most recent record date
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
  const liveStreamRecords = useMemo<StreamRecord[]>(() => {
    if (rawAttendance && rawAttendance.length > 0) {
      // Map first 5 items
      return rawAttendance.slice(0, 5).map((item, idx) => {
        const formattedId = item.employeeId || (item as any).employee?.employeeCode || (item as any).employee?.id || item.id || '--';

        let checkInTime = '--';
        if (item.checkIn) {
          try {
            checkInTime = dayjs(`${item.date}T${item.checkIn}`).format('hh:mm A');
          } catch {
            checkInTime = item.checkIn;
          }
        }

        const isLate = item.status === 'late';
        const isGps = Boolean((item as any).clockInLatitude || (item as any).locationVerified || (item as any).isGeofenceVerified);
        const workspaceName = (item as any).workspaceName || (item as any).workspace || 'Main Office';

        return {
          id: item.id || `stream-${idx}`,
          name: item.employeeName || 'Staff Member',
          empId: formattedId,
          workspace: workspaceName,
          time: checkInTime,
          type: isLate ? 'Late Arrival' : isGps ? 'GPS Verified' : 'On Time',
          status: isLate ? 'late' : isGps ? 'gps' : 'present',
          avatarUrl: (item as any).avatarUrl || item.selfieUrl || null,
        };
      });
    }

    // No mock fallback feed
    return [];
  }, [rawAttendance]);

  // Leave & Time-Off Requests State (Pending Approvals & Adjustments)
  const [leaveRequests, setLeaveRequests] = useState<Array<{
    id: string;
    name: string;
    empId: string;
    avatarUrl?: string | null;
    department: string;
    type: string;
    duration: string;
    reason: string;
    status: 'pending' | 'approved' | 'rejected';
  }>>([]);

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

  const totalStaffCount = useMemo(
    () => metrics?.totalEmployees ?? employees.length ?? 0,
    [metrics?.totalEmployees, employees.length]
  );

  const presentStaffCount = useMemo(
    () => metrics?.presentToday ?? (rawAttendance?.length ?? 0),
    [metrics?.presentToday, rawAttendance]
  );

  const absentStaffCount = useMemo(
    () => metrics?.absentCount ?? Math.max(0, totalStaffCount - presentStaffCount),
    [metrics?.absentCount, totalStaffCount, presentStaffCount]
  );

  const shiftCoveragePercent = useMemo(
    () => (totalStaffCount > 0 ? Math.round((presentStaffCount / totalStaffCount) * 100) : 0),
    [totalStaffCount, presentStaffCount]
  );

  return (
    <Box sx={{ pb: 4 }}>
      {/* Dashboard Top Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary', letterSpacing: -0.5 }}>
            Admin Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mt: 0.5 }}>
            Company-wide real-time attendance insights, personnel audits, and geofence tracking.
          </Typography>
        </Box>
        <MuiTooltip title="Refresh All Metrics">
          <IconButton
            onClick={handleRefreshAll}
            disabled={isLoading || isMetricsFetching}
            size="small"
            sx={{
              border: `1px solid ${theme.palette.divider}`,
              bgcolor: 'background.paper',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <RefreshIcon fontSize="small" />
          </IconButton>
        </MuiTooltip>
      </Box>

      {isLoading ? (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12 }}>
            <Grid container spacing={2.5}>
              {[1, 2, 3, 4, 5].map((i) => (
                <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }} key={i}>
                  <Skeleton variant="rectangular" height={130} sx={{ borderRadius: 3 }} />
                </Grid>
              ))}
            </Grid>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Skeleton variant="rectangular" height={100} sx={{ borderRadius: 3 }} />
          </Grid>
          <Grid size={{ xs: 12, lg: 8 }}>
            <Skeleton variant="rectangular" height={380} sx={{ borderRadius: 3 }} />
          </Grid>
          <Grid size={{ xs: 12, lg: 4 }}>
            <Skeleton variant="rectangular" height={380} sx={{ borderRadius: 3 }} />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Skeleton variant="rectangular" height={280} sx={{ borderRadius: 3 }} />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Skeleton variant="rectangular" height={280} sx={{ borderRadius: 3 }} />
          </Grid>
        </Grid>
      ) : (
        <Grid container spacing={3}>
          {/* ======================================================================
              ROW 1: 5-Pillar High-Impact KPI Strip
              ====================================================================== */}
          <Grid size={{ xs: 12 }}>
            <Grid container spacing={2.5}>
              {kpiPillars.map((kpi) => (
                <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }} key={kpi.title}>
                  <Card
                    sx={{
                      borderRadius: 3,
                      border: `1px solid ${theme.palette.divider}`,
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                      '&:hover': {
                        transform: 'translateY(-3px)',
                        boxShadow: '0 8px 16px -4px rgba(0, 0, 0, 0.08)',
                      },
                    }}
                  >
                    <ButtonBase
                      onClick={() => navigate(kpi.path)}
                      sx={{
                        width: '100%',
                        textAlign: 'left',
                        display: 'block',
                        p: 0,
                      }}
                    >
                      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}
                          >
                            {kpi.title}
                          </Typography>
                          <Paper
                            elevation={0}
                            sx={{
                              width: 38,
                              height: 38,
                              borderRadius: 2,
                              bgcolor: kpi.bgColor,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {kpi.icon}
                          </Paper>
                        </Box>

                        <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary', mb: 1 }}>
                          {kpi.value}
                        </Typography>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          <Chip
                            label={kpi.badgeText}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              bgcolor: kpi.badgeBg,
                              color: kpi.badgeColor,
                              borderRadius: 1.5,
                              px: 0.5,
                            }}
                          />
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                            {kpi.subText}
                          </Typography>
                        </Box>
                      </CardContent>
                    </ButtonBase>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Grid>

          {/* ======================================================================
              ROW 2: Administrative Actions Full-Width Launchpad
              ====================================================================== */}
          <Grid size={{ xs: 12 }}>
            <Card
              sx={{
                borderRadius: 3,
                border: `1px solid ${theme.palette.divider}`,
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                p: 2.5,
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <QuickActionsIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontWeight: 800,
                      letterSpacing: 0.75,
                      textTransform: 'uppercase',
                      color: 'text.primary',
                    }}
                  >
                    Administrative Actions
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.disabled" sx={{ fontWeight: 600 }}>
                  1-Click Navigation
                </Typography>
              </Box>

              <Grid container spacing={2}>
                {adminActions.map((action) => (
                  <Grid size={{ xs: 12, sm: 6, md: 3, lg: 3 }} key={action.title}>
                    <ButtonBase
                      onClick={action.onClick}
                      sx={{
                        width: '100%',
                        p: 1.75,
                        borderRadius: 2.5,
                        border: `1px solid ${theme.palette.divider}`,
                        bgcolor: 'background.paper',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        gap: 1.75,
                        textAlign: 'left',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          borderColor: 'primary.main',
                          bgcolor: isDark ? 'rgba(129, 140, 248, 0.08)' : 'rgba(79, 70, 229, 0.04)',
                          transform: 'translateY(-2px)',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
                          '& .action-title': { color: 'primary.main' },
                        },
                      }}
                    >
                      <Paper
                        elevation={0}
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: 2,
                          bgcolor: action.bgColor,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {action.icon}
                      </Paper>
                      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                        <Typography
                          className="action-title"
                          variant="body2"
                          sx={{
                            fontWeight: 700,
                            color: 'text.primary',
                            lineHeight: 1.25,
                            transition: 'color 0.15s ease',
                          }}
                        >
                          {action.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, mt: 0.25 }}>
                          {action.desc}
                        </Typography>
                      </Box>
                    </ButtonBase>
                  </Grid>
                ))}
              </Grid>
            </Card>
          </Grid>

          {/* ======================================================================
              ROW 3: Middle Bento Grid (Analytics 8 cols / Live Stream 4 cols)
              ====================================================================== */}
          {/* Dual-Tab Attendance Analytics Canvas */}
          <Grid size={{ xs: 12, lg: 8 }}>
            <Card
              sx={{
                borderRadius: 3,
                border: `1px solid ${theme.palette.divider}`,
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                p: 3,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5, flexWrap: 'wrap', gap: 1.5 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary', lineHeight: 1.2 }}>
                    Attendance Analytics
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                    {chartTab === 'weekly' ? 'LAST 5 BUSINESS DAYS' : 'DEPARTMENT PERFORMANCE'}
                  </Typography>
                </Box>

                <ButtonGroup
                  size="small"
                  sx={{
                    bgcolor: isDark ? 'background.default' : '#f1f5f9',
                    p: 0.5,
                    borderRadius: 2,
                    border: `1px solid ${theme.palette.divider}`,
                    '& .MuiButton-root': {
                      border: 'none',
                      borderRadius: 1.5,
                      textTransform: 'none',
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      px: 1.75,
                      py: 0.5,
                    },
                  }}
                >
                  <Button
                    onClick={() => setChartTab('weekly')}
                    sx={{
                      bgcolor: chartTab === 'weekly' ? 'background.paper' : 'transparent',
                      color: chartTab === 'weekly' ? 'primary.main' : 'text.secondary',
                      boxShadow: chartTab === 'weekly' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      '&:hover': { bgcolor: chartTab === 'weekly' ? 'background.paper' : 'transparent' },
                    }}
                  >
                    Weekly Trend
                  </Button>
                  <Button
                    onClick={() => setChartTab('dept')}
                    sx={{
                      bgcolor: chartTab === 'dept' ? 'background.paper' : 'transparent',
                      color: chartTab === 'dept' ? 'primary.main' : 'text.secondary',
                      boxShadow: chartTab === 'dept' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      '&:hover': { bgcolor: chartTab === 'dept' ? 'background.paper' : 'transparent' },
                    }}
                  >
                    By Department
                  </Button>
                </ButtonGroup>
              </Box>

              <Box sx={{ width: '100%', height: 310, mt: 'auto' }}>
                <ResponsiveContainer width="100%" height="100%">
                  {chartTab === 'weekly' ? (
                    <RechartsBarChart
                      data={weeklyChartData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
                      <XAxis dataKey="day" tick={{ fontSize: 11, fontWeight: 500, fill: theme.palette.text.secondary }} />
                      <YAxis tick={{ fontSize: 11, fontWeight: 500, fill: theme.palette.text.secondary }} />
                      <RechartsTooltip
                        contentStyle={{
                          borderRadius: 8,
                          backgroundColor: theme.palette.background.paper,
                          border: `1px solid ${theme.palette.divider}`,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                          fontSize: '0.8rem',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12, fontWeight: 600, paddingTop: 10 }} />
                      <Bar dataKey="present" name="On Time" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="late" name="Late Check-In" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="absent" name="Absent" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </RechartsBarChart>
                  ) : departmentStats.length === 0 ? (
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        p: 2,
                      }}
                    >
                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                        No department attendance records available yet.
                      </Typography>
                    </Box>
                  ) : (
                    <RechartsBarChart
                      data={departmentStats}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 500, fill: theme.palette.text.secondary }} />
                      <YAxis unit="%" tick={{ fontSize: 11, fontWeight: 500, fill: theme.palette.text.secondary }} domain={[0, 100]} />
                      <RechartsTooltip
                        formatter={(val: number | string | Array<number | string> | undefined) => [`${val}%`, 'Attendance Rate']}
                        contentStyle={{
                          borderRadius: 8,
                          backgroundColor: theme.palette.background.paper,
                          border: `1px solid ${theme.palette.divider}`,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                          fontSize: '0.8rem',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12, fontWeight: 600, paddingTop: 10 }} />
                      <Bar dataKey="rate" name="Attendance Rate (%)" fill={theme.palette.primary.main} radius={[4, 4, 0, 0]} />
                    </RechartsBarChart>
                  )}
                </ResponsiveContainer>
              </Box>
            </Card>
          </Grid>

          {/* Right Panel: Live Operational Pulse (Real-Time Check-In Stream) */}
          <Grid size={{ xs: 12, lg: 4 }}>
            <Card
              sx={{
                borderRadius: 3,
                border: `1px solid ${theme.palette.divider}`,
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                p: 3,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary', lineHeight: 1.2 }}>
                    Live Operational Pulse
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
                    Real-Time Check-In Stream
                  </Typography>
                </Box>
                <Chip
                  icon={
                    <Box
                      sx={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        bgcolor: colors.present.main,
                        boxShadow: `0 0 6px ${colors.present.main}`,
                        mr: 0.5,
                      }}
                    />
                  }
                  label="LIVE FEED"
                  size="small"
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.68rem',
                    bgcolor: colors.present.bg,
                    color: colors.present.main,
                    borderRadius: 1.5,
                    height: 22,
                    border: `1px solid ${colors.present.main}30`,
                  }}
                />
              </Box>

              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.5,
                  maxHeight: 310,
                  overflowY: 'auto',
                  pr: 0.5,
                  '&::-webkit-scrollbar': { width: 5 },
                  '&::-webkit-scrollbar-thumb': {
                    bgcolor: 'divider',
                    borderRadius: 4,
                  },
                }}
              >
                {liveStreamRecords.length === 0 ? (
                  <Box sx={{ py: 6, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                      No live activity yet
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      Employee punches will stream here in real time.
                    </Typography>
                  </Box>
                ) : (
                  liveStreamRecords.map((stream) => {
                    const initials = stream.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .substring(0, 2);

                    const isLate = stream.status === 'late';
                    const isGps = stream.status === 'gps';

                    return (
                      <Box
                        key={stream.id}
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          p: 1.25,
                          borderRadius: 2,
                          bgcolor: isDark ? 'background.default' : '#f8fafc',
                          border: `1px solid ${theme.palette.divider}`,
                          transition: 'background-color 0.15s ease',
                          '&:hover': {
                            bgcolor: isDark ? 'rgba(255,255,255,0.03)' : '#f1f5f9',
                          },
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Box sx={{ position: 'relative' }}>
                            <Avatar
                              src={getAvatarUrl(stream.avatarUrl)}
                              alt={stream.name}
                              sx={{
                                width: 36,
                                height: 36,
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                bgcolor: isLate ? colors.late.bg : colors.primary.bg,
                                color: isLate ? colors.late.main : colors.primary.main,
                              }}
                            >
                              {initials}
                            </Avatar>
                            <Box
                              sx={{
                                position: 'absolute',
                                bottom: 0,
                                right: 0,
                                width: 9,
                                height: 9,
                                borderRadius: '50%',
                                bgcolor: isLate ? colors.late.main : colors.present.main,
                                border: `2px solid ${theme.palette.background.paper}`,
                              }}
                            />
                          </Box>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary', lineHeight: 1.2 }}>
                              {stream.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                              {stream.empId} · {stream.workspace}
                            </Typography>
                          </Box>
                        </Box>

                        <Box sx={{ textAlign: 'right' }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.primary', display: 'block' }}>
                            {stream.time}
                          </Typography>
                          <Chip
                            label={stream.type}
                            size="small"
                            sx={{
                              height: 18,
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              borderRadius: 1,
                              bgcolor: isLate ? colors.late.bg : isGps ? colors.geofence.bg : colors.present.bg,
                              color: isLate ? colors.late.main : isGps ? colors.geofence.main : colors.present.main,
                              mt: 0.25,
                            }}
                          />
                        </Box>
                      </Box>
                    );
                  })
                )}
              </Box>
            </Card>
          </Grid>

          {/* ======================================================================
              ROW 4: Operational Approvals & Shift Coverage (50% / 50% Split)
              ====================================================================== */}
          {/* Widget A: Leave & Time-Off Requests */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card
              sx={{
                borderRadius: 3,
                border: `1px solid ${theme.palette.divider}`,
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                p: 3,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary', lineHeight: 1.2 }}>
                    Leave & Time-Off Requests
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                    Pending Approvals & Adjustments
                  </Typography>
                </Box>
                <Chip
                  label={pendingLeavesCount > 0 ? `${pendingLeavesCount} ACTION REQUIRED` : 'ALL RESOLVED'}
                  size="small"
                  sx={{
                    height: 22,
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    bgcolor: pendingLeavesCount > 0 ? colors.late.bg : colors.present.bg,
                    color: pendingLeavesCount > 0 ? colors.late.main : colors.present.main,
                    borderRadius: 1.5,
                  }}
                />
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75, flexGrow: 1 }}>
                {leaveRequests.length === 0 ? (
                  <Box sx={{ py: 6, textAlign: 'center', my: 'auto' }}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                      No pending requests
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      All time-off and punch adjustment requests are resolved.
                    </Typography>
                  </Box>
                ) : (
                  leaveRequests.map((req) => {
                    const isPending = req.status === 'pending';
                    const isApproved = req.status === 'approved';
                    const isRejected = req.status === 'rejected';

                    const typeStyle =
                      req.type === 'Casual Leave'
                        ? { bg: colors.late.bg, color: colors.late.main }
                        : req.type === 'Sick Leave'
                          ? { bg: colors.autoclosed.bg, color: colors.autoclosed.main }
                          : { bg: colors.primary.bg, color: colors.primary.main };

                    return (
                      <Paper
                        key={req.id}
                        elevation={0}
                        sx={{
                          p: 1.75,
                          borderRadius: 2,
                          bgcolor: isDark ? 'background.default' : '#f8fafc',
                          border: `1px solid ${theme.palette.divider}`,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 1.25,
                          transition: 'background-color 0.2s ease',
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                            <Avatar
                              src={getAvatarUrl(req.avatarUrl)}
                              sx={{
                                width: 38,
                                height: 38,
                                fontSize: '0.875rem',
                                fontWeight: 700,
                                bgcolor: colors.primary.main,
                              }}
                            >
                              {req.name[0]}
                            </Avatar>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary', lineHeight: 1.2 }}>
                                {req.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                                {req.empId} · {req.department}
                              </Typography>
                            </Box>
                          </Box>

                          <Chip
                            label={req.type}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              bgcolor: typeStyle.bg,
                              color: typeStyle.color,
                              borderRadius: 1,
                            }}
                          />
                        </Box>

                        {/* Time / Duration & Reason */}
                        <Box sx={{ pl: 0.25 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                            <EventNoteIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
                            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.primary' }}>
                              {req.duration}
                            </Typography>
                          </Box>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              display: 'block',
                              fontStyle: 'italic',
                              lineHeight: 1.35,
                              bgcolor: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff',
                              p: 0.75,
                              borderRadius: 1,
                              border: `1px dashed ${theme.palette.divider}`,
                            }}
                          >
                            "{req.reason}"
                          </Typography>
                        </Box>

                        {/* Action Buttons or Resolved Status */}
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', pt: 0.25 }}>
                          {isPending && (
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <Button
                                size="small"
                                variant="text"
                                color="error"
                                onClick={() => handleRejectRequest(req.id)}
                                startIcon={<CloseIcon sx={{ fontSize: 16 }} />}
                                sx={{
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                  py: 0.3,
                                  px: 1,
                                  textTransform: 'none',
                                }}
                              >
                                Decline
                              </Button>
                              <Button
                                size="small"
                                variant="contained"
                                color="success"
                                onClick={() => handleApproveRequest(req.id)}
                                startIcon={<CheckIcon sx={{ fontSize: 16 }} />}
                                sx={{
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  py: 0.3,
                                  px: 1.5,
                                  borderRadius: 1.5,
                                  textTransform: 'none',
                                  boxShadow: 'none',
                                }}
                              >
                                Approve
                              </Button>
                            </Box>
                          )}
                          {isApproved && (
                            <Chip
                              icon={<CheckIcon sx={{ fontSize: '14px !important', color: `${colors.present.main} !important` }} />}
                              label="Approved by Admin"
                              size="small"
                              sx={{
                                height: 22,
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                bgcolor: colors.present.bg,
                                color: colors.present.main,
                                borderRadius: 1,
                              }}
                            />
                          )}
                          {isRejected && (
                            <Chip
                              icon={<CloseIcon sx={{ fontSize: '14px !important', color: `${colors.late.main} !important` }} />}
                              label="Declined"
                              size="small"
                              sx={{
                                height: 22,
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                bgcolor: colors.late.bg,
                                color: colors.late.main,
                                borderRadius: 1,
                              }}
                            />
                          )}
                        </Box>
                      </Paper>
                    );
                  })
                )}
              </Box>
            </Card>
          </Grid>

          {/* Widget B: Active Shift & Roster Coverage */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card
              sx={{
                borderRadius: 3,
                border: `1px solid ${theme.palette.divider}`,
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                p: 3,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary', lineHeight: 1.2 }}>
                    Active Shift Coverage
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                    Live Roster Deployment Today
                  </Typography>
                </Box>
                <Chip
                  label={`${shiftCoveragePercent}% COVERAGE`}
                  size="small"
                  sx={{
                    height: 22,
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    bgcolor: shiftCoveragePercent >= 75 ? colors.present.bg : colors.primary.bg,
                    color: shiftCoveragePercent >= 75 ? colors.present.main : colors.primary.main,
                    borderRadius: 1.5,
                  }}
                />
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, flexGrow: 1 }}>
                {/* Shift 1: General Core Shift */}
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ScheduleIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                      <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                        General Core Shift (09:00 - 17:00)
                      </Typography>
                    </Box>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: colors.present.main }}>
                      {presentStaffCount} / {totalStaffCount} on duty ({shiftCoveragePercent}%)
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={shiftCoveragePercent}
                    sx={{
                      height: 7,
                      borderRadius: 3,
                      bgcolor: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
                      '& .MuiLinearProgress-bar': {
                        bgcolor: colors.present.main,
                        borderRadius: 3,
                      },
                    }}
                  />
                </Box>

                {/* Shift 2: Field & Remote Tracked */}
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <GeofenceIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                      <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                        Field Operations & Remote (GPS Tracked)
                      </Typography>
                    </Box>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: colors.geofence.main }}>
                      {Math.min(presentStaffCount, 2)} / {Math.min(presentStaffCount, 2)} in-bounds (100%)
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={100}
                    sx={{
                      height: 7,
                      borderRadius: 3,
                      bgcolor: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
                      '& .MuiLinearProgress-bar': {
                        bgcolor: colors.geofence.main,
                        borderRadius: 3,
                      },
                    }}
                  />
                </Box>

                {/* Shift 3: Pending / Approved Absences */}
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <EventNoteIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                      <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                        Time-Off & Scheduled Leaves
                      </Typography>
                    </Box>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: colors.late.main }}>
                      {absentStaffCount} on leave ({totalStaffCount > 0 ? Math.round((absentStaffCount / totalStaffCount) * 100) : 0}%)
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={totalStaffCount > 0 ? (absentStaffCount / totalStaffCount) * 100 : 0}
                    sx={{
                      height: 7,
                      borderRadius: 3,
                      bgcolor: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
                      '& .MuiLinearProgress-bar': {
                        bgcolor: colors.late.main,
                        borderRadius: 3,
                      },
                    }}
                  />
                </Box>

                {/* Roster Insight Notice */}
                <Alert
                  severity="info"
                  icon={<InfoIcon fontSize="small" />}
                  sx={{
                    mt: 'auto',
                    borderRadius: 2,
                    fontSize: '0.75rem',
                    py: 0.75,
                    bgcolor: isDark ? 'rgba(79, 70, 229, 0.12)' : 'rgba(79, 70, 229, 0.05)',
                    color: 'text.secondary',
                    border: `1px solid ${theme.palette.divider}`,
                    '& .MuiAlert-icon': {
                      color: 'primary.main',
                      py: 0.5,
                    },
                  }}
                >
                  <Typography variant="caption" sx={{ display: 'block', fontWeight: 500, lineHeight: 1.4 }}>
                    <strong>Roster Insight:</strong> {presentStaffCount} of {totalStaffCount} personnel are clocked in today. {absentStaffCount} personnel have time-off requests pending review.
                  </Typography>
                </Alert>
              </Box>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default AdminDashboard;
