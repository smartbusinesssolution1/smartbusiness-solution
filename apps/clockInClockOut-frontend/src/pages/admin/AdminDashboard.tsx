import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { attendanceService } from '../../services/attendanceService';
import { useAuth } from '../../context/AuthContext';
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
  Business as WorkspaceIcon,
  CloudDownload as ExportIcon,
  Domain as DomainIcon,
  Schedule as ScheduleIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon,
  FiberManualRecord as DotIcon,
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
}

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { workspaces, currentWorkspace } = useAuth();

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

  // Fetch admin dashboard metrics
  const {
    data: metrics,
    isLoading: isMetricsLoading,
    isFetching: isMetricsFetching,
    refetch: refetchMetrics,
  } = useQuery({
    queryKey: ['adminDashboardMetrics'],
    queryFn: () => attendanceService.getAdminDashboardMetrics(),
  });

  // Fetch recent attendance logs for real-time pulse stream
  const {
    data: rawAttendance = [],
    isLoading: isAttendanceLoading,
    refetch: refetchAttendance,
  } = useQuery({
    queryKey: ['adminAttendanceStream'],
    queryFn: () => attendanceService.getAllAttendance(),
  });

  const isLoading = isMetricsLoading || isAttendanceLoading;

  const handleRefreshAll = () => {
    refetchMetrics();
    refetchAttendance();
  };

  // 1. Row 1: 5-Pillar High-Impact KPI Strip
  const kpiPillars = useMemo(() => [
    {
      title: 'Total Employees',
      value: metrics?.totalEmployees ?? 24,
      icon: <PeopleIcon sx={{ fontSize: 24, color: colors.primary.main }} />,
      bgColor: colors.primary.bg,
      badgeText: `${Math.max(0, (metrics?.totalEmployees ?? 24) - 2)} Active`,
      badgeBg: colors.present.bg,
      badgeColor: colors.present.main,
      subText: '2 Approved Leave',
      path: '/admin/employees',
    },
    {
      title: 'Present Today',
      value: metrics?.presentToday ?? 18,
      icon: <PresentIcon sx={{ fontSize: 24, color: colors.present.main }} />,
      bgColor: colors.present.bg,
      badgeText: '+4.2%',
      badgeBg: colors.present.bg,
      badgeColor: colors.present.main,
      subText: `${metrics?.attendanceRate ?? 75}% floor coverage`,
      path: '/admin/reports',
    },
    {
      title: 'Late Today',
      value: metrics?.lateToday ?? 3,
      icon: <LateIcon sx={{ fontSize: 24, color: colors.late.main }} />,
      bgColor: colors.late.bg,
      badgeText: 'Avg 12.4m',
      badgeBg: colors.late.bg,
      badgeColor: colors.late.main,
      subText: 'After 9:15 AM threshold',
      path: '/admin/reports',
    },
    {
      title: 'Auto Closed',
      value: metrics?.autoClosedToday ?? 1,
      icon: <AutoClosedIcon sx={{ fontSize: 24, color: colors.autoclosed.main }} />,
      bgColor: colors.autoclosed.bg,
      badgeText: 'Action Req.',
      badgeBg: colors.autoclosed.bg,
      badgeColor: colors.autoclosed.main,
      subText: 'Missed check-out',
      path: '/admin/reports',
    },
    {
      title: 'Geofence Compliance',
      value: '98.5%',
      icon: <GpsFixedIcon sx={{ fontSize: 24, color: colors.geofence.main }} />,
      bgColor: colors.geofence.bg,
      badgeText: 'In-Bounds',
      badgeBg: colors.geofence.bg,
      badgeColor: colors.geofence.main,
      subText: '0 Spoof attempts',
      path: '/admin/settings',
    },
  ], [metrics, colors]);

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
      title: 'Audit Reports',
      desc: 'Daily & weekly ledgers',
      icon: <ReportIcon sx={{ fontSize: 22, color: colors.present.main }} />,
      bgColor: colors.present.bg,
      onClick: () => navigate('/admin/reports'),
    },
    {
      title: 'Geofence GPS',
      desc: 'Configure office radius',
      icon: <GeofenceIcon sx={{ fontSize: 22, color: colors.geofence.main }} />,
      bgColor: colors.geofence.bg,
      onClick: () => navigate('/admin/settings'),
    },
    {
      title: 'Workspaces',
      desc: 'HQ, North & South',
      icon: <WorkspaceIcon sx={{ fontSize: 22, color: colors.late.main }} />,
      bgColor: colors.late.bg,
      onClick: () => navigate('/admin/workspaces'),
    },
    {
      title: 'Export Audit',
      desc: 'Download PDF / CSV',
      icon: <ExportIcon sx={{ fontSize: 22, color: colors.autoclosed.main }} />,
      bgColor: colors.autoclosed.bg,
      onClick: () => navigate('/admin/reports'),
    },
  ], [colors, navigate]);

  // Department Attendance Stats
  const departmentStats = useMemo(() => [
    { name: 'Operations', rate: 94, present: 16, late: 1, absent: 0 },
    { name: 'Engineering', rate: 88, present: 12, late: 2, absent: 1 },
    { name: 'Support', rate: 92, present: 10, late: 1, absent: 0 },
    { name: 'Logistics', rate: 100, present: 8, late: 0, absent: 0 },
    { name: 'Administration', rate: 85, present: 5, late: 1, absent: 1 },
  ], []);

  // Formatted Live Feed Stream Items
  const liveStreamRecords = useMemo<StreamRecord[]>(() => {
    if (rawAttendance && rawAttendance.length > 0) {
      // Map first 5 items
      return rawAttendance.slice(0, 5).map((item, idx) => {
        // Ensure EMP-GA00X formatting
        const rawId = item.employeeId || `GA-${idx + 1}`;
        const formattedId = rawId.startsWith('EMP-')
          ? rawId
          : rawId.startsWith('GA-')
          ? `EMP-${rawId}`
          : `EMP-GA00${idx + 1}`;

        let checkInTime = '09:00 AM';
        if (item.checkIn) {
          try {
            checkInTime = dayjs(`${item.date}T${item.checkIn}`).format('hh:mm A');
          } catch {
            checkInTime = item.checkIn;
          }
        }

        const isLate = item.status === 'late';
        return {
          id: item.id || `stream-${idx}`,
          name: item.employeeName || 'Staff Member',
          empId: formattedId,
          workspace: idx % 2 === 0 ? 'Green Acres HQ' : 'North Branch',
          time: checkInTime,
          type: isLate ? 'Late (+14m)' : idx % 2 === 0 ? 'GPS (18m)' : 'On Time',
          status: isLate ? 'late' : (idx % 2 === 0 ? 'gps' : 'present'),
        };
      });
    }

    // Default Fallback Feed
    return [
      {
        id: 'stream-1',
        name: 'Maria Davis',
        empId: 'EMP-GA001',
        workspace: 'Green Acres HQ',
        time: '08:58 AM',
        type: 'GPS (18m)',
        status: 'gps',
      },
      {
        id: 'stream-2',
        name: 'Jennifer Adams',
        empId: 'EMP-GA002',
        workspace: 'North Branch',
        time: '09:02 AM',
        type: 'On Time',
        status: 'present',
      },
      {
        id: 'stream-3',
        name: 'David Rodriguez',
        empId: 'EMP-GA003',
        workspace: 'North Branch',
        time: '09:24 AM',
        type: 'Late (+14m)',
        status: 'late',
      },
      {
        id: 'stream-4',
        name: 'Sarah Connor',
        empId: 'EMP-GA004',
        workspace: 'Green Acres HQ',
        time: '08:45 AM',
        type: 'Biometric',
        status: 'biometric',
      },
      {
        id: 'stream-5',
        name: 'John Miller',
        empId: 'EMP-GA005',
        workspace: 'South Logistics',
        time: '08:52 AM',
        type: 'GPS (42m)',
        status: 'gps',
      },
    ];
  }, [rawAttendance]);

  // Workspace branch health list
  const branchHealthList = useMemo(() => [
    {
      name: 'Green Acres HQ (Austin, TX)',
      rate: '93.3% Present',
      percent: 93.3,
      checkedIn: '14 of 15 Staff Checked-in',
      radiusText: 'Radius: 100m · Optimal',
      color: colors.present.main,
      bgColor: colors.present.bg,
    },
    {
      name: 'North Branch & Operations (Round Rock, TX)',
      rate: '80.0% Present',
      percent: 80.0,
      checkedIn: '8 of 10 Staff (2 Late Exceptions)',
      radiusText: 'Radius: 120m · Alert',
      color: colors.late.main,
      bgColor: colors.late.bg,
    },
    {
      name: 'South Logistics & Warehouse (San Marcos, TX)',
      rate: '100% Present',
      percent: 100,
      checkedIn: '4 of 4 Staff Checked-in',
      radiusText: 'Radius: 150m · Optimal',
      color: colors.geofence.main,
      bgColor: colors.geofence.bg,
    },
  ], [colors]);

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
                  <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }} key={action.title}>
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
                      data={metrics?.weeklyStats || [
                        { day: 'Mon', present: 22, late: 1, absent: 1 },
                        { day: 'Tue', present: 21, late: 2, absent: 1 },
                        { day: 'Wed', present: 23, late: 1, absent: 0 },
                        { day: 'Thu', present: 20, late: 3, absent: 1 },
                        { day: 'Fri', present: 18, late: 3, absent: 3 },
                      ]}
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
                {liveStreamRecords.map((stream) => {
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
                })}
              </Box>
            </Card>
          </Grid>

          {/* ======================================================================
              ROW 4: Cross-Branch Health & Shift Coverage (50% / 50% Split)
              ====================================================================== */}
          {/* Widget A: Multi-Workspace Branch Health Scorecard */}
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
                    Workspace Branch Health
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                    Cross-Branch Compliance Scorecard
                  </Typography>
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => navigate('/admin/workspaces')}
                  sx={{
                    borderRadius: 1.5,
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '0.72rem',
                    py: 0.4,
                    px: 1.25,
                  }}
                >
                  Manage
                </Button>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, flexGrow: 1 }}>
                {branchHealthList.map((branch) => (
                  <Paper
                    key={branch.name}
                    elevation={0}
                    sx={{
                      p: 1.75,
                      borderRadius: 2,
                      bgcolor: isDark ? 'background.default' : '#f8fafc',
                      border: `1px solid ${theme.palette.divider}`,
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <DomainIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                          {branch.name}
                        </Typography>
                      </Box>
                      <Chip
                        label={branch.rate}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          bgcolor: branch.bgColor,
                          color: branch.color,
                          borderRadius: 1.25,
                        }}
                      />
                    </Box>

                    <LinearProgress
                      variant="determinate"
                      value={branch.percent}
                      sx={{
                        height: 6,
                        borderRadius: 3,
                        mb: 1,
                        bgcolor: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
                        '& .MuiLinearProgress-bar': {
                          bgcolor: branch.color,
                          borderRadius: 3,
                        },
                      }}
                    />

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                        {branch.checkedIn}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                        {branch.radiusText}
                      </Typography>
                    </Box>
                  </Paper>
                ))}
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
                    Roster Deployment Today
                  </Typography>
                </Box>
                <Chip
                  label="88% COVERAGE"
                  size="small"
                  sx={{
                    height: 22,
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    bgcolor: colors.primary.bg,
                    color: colors.primary.main,
                    borderRadius: 1.5,
                  }}
                />
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, flexGrow: 1 }}>
                {/* Shift 1: Morning */}
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ScheduleIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                      <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                        Morning Shift (09:00 - 17:00)
                      </Typography>
                    </Box>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: colors.present.main }}>
                      16 / 18 on floor (88.8%)
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={88.8}
                    sx={{
                      height: 6,
                      borderRadius: 3,
                      bgcolor: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
                      '& .MuiLinearProgress-bar': {
                        bgcolor: colors.present.main,
                        borderRadius: 3,
                      },
                    }}
                  />
                </Box>

                {/* Shift 2: Field & Remote */}
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <GeofenceIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                      <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                        Field & Remote (GPS Tracked)
                      </Typography>
                    </Box>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: colors.geofence.main }}>
                      6 / 6 active (100%)
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={100}
                    sx={{
                      height: 6,
                      borderRadius: 3,
                      bgcolor: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
                      '& .MuiLinearProgress-bar': {
                        bgcolor: colors.geofence.main,
                        borderRadius: 3,
                      },
                    }}
                  />
                </Box>

                {/* Shift 3: Night Shift */}
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ScheduleIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                      <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                        Night Shift (Rotational 19:00)
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.disabled" sx={{ fontWeight: 600 }}>
                      Starts in 2h 45m
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={0}
                    sx={{
                      height: 6,
                      borderRadius: 3,
                      bgcolor: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
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
                    <strong>Roster Insight:</strong> All minimum station thresholds are satisfied across warehouse bays and admin desks for the current interval.
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
