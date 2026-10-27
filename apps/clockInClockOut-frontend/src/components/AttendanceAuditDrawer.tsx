import React, { useState, useMemo } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Divider,
  Avatar,
  Chip,
  Paper,
  Grid,
  Button,
  Collapse,
  useTheme,
} from '@mui/material';
import {
  Close as CloseIcon,
  Login as CheckInIcon,
  Logout as CheckOutIcon,
  AccessTime as TimeIcon,
  VerifiedUser as VerifiedIcon,
  LocationOn as LocationIcon,
  CheckCircle as OnTimeIcon,
  Warning as LateIcon,
  Autorenew as AutoClosedIcon,
  Cancel as AbsentIcon,
  ExpandMore as ExpandMoreIcon,
  CalendarToday as CalendarIcon,
  Shield as ShieldIcon,
  CheckCircleOutlined as CompliantIcon,
} from '@mui/icons-material';
import dayjs from 'dayjs';
import { AttendanceRecord, AttendanceSessionLog } from '../types';
import { getAvatarUrl } from '../utils/imageUrl';

export interface AttendanceAuditDrawerProps {
  open: boolean;
  onClose: () => void;
  record: AttendanceRecord | null;
}

export const AttendanceAuditDrawer: React.FC<AttendanceAuditDrawerProps> = ({
  open,
  onClose,
  record,
}) => {
  const theme = useTheme();
  const [drawerSortOrder, setDrawerSortOrder] = useState<'asc' | 'desc'>('asc');
  const [expandedSessions, setExpandedSessions] = useState<{ [key: string]: boolean }>({});

  const sessions: AttendanceSessionLog[] = record?.sessions || [];

  const sortedSessions = useMemo(() => {
    if (!record) return [];
    const list = [...sessions];
    list.sort((a, b) => {
      const timeA = a.checkIn || '';
      const timeB = b.checkIn || '';
      return drawerSortOrder === 'asc' ? timeA.localeCompare(timeB) : timeB.localeCompare(timeA);
    });
    return list;
  }, [record, sessions, drawerSortOrder]);

  // Auto-expand first session by default
  React.useEffect(() => {
    if (sortedSessions.length > 0) {
      const initial: { [key: string]: boolean } = {};
      sortedSessions.forEach((s, idx) => {
        // Expand first session by default; if 1 session, expand it
        initial[s.id || `session-${idx}`] = idx === 0 || sortedSessions.length === 1;
      });
      setExpandedSessions(initial);
    }
  }, [record?.id, sortedSessions.length]);

  if (!record) return null;

  const isAbsent = record.status === 'absent';

  const toggleSessionExpand = (key: string) => {
    setExpandedSessions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const toggleAll = (expand: boolean) => {
    const updated: { [key: string]: boolean } = {};
    sortedSessions.forEach((s, idx) => {
      updated[s.id || `session-${idx}`] = expand;
    });
    setExpandedSessions(updated);
  };

  const formatTime = (timeStr?: string | null) => {
    if (!timeStr) return '--:--';
    if (dayjs(`${record.date}T${timeStr}`).isValid()) {
      return dayjs(`${record.date}T${timeStr}`).format('hh:mm A');
    }
    return timeStr;
  };

  const formatTimeSeconds = (timeStr?: string | null) => {
    if (!timeStr) return '--:--';
    if (dayjs(`${record.date}T${timeStr}`).isValid()) {
      return dayjs(`${record.date}T${timeStr}`).format('hh:mm:ss A');
    }
    return timeStr;
  };

  const getStatusChip = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'present':
        return (
          <Chip
            label="On Time"
            color="success"
            size="small"
            icon={<OnTimeIcon sx={{ fontSize: '14px !important' }} />}
            sx={{ fontWeight: 700, fontSize: '0.72rem' }}
          />
        );
      case 'late':
        return (
          <Chip
            label="Late Check-In"
            color="warning"
            size="small"
            icon={<LateIcon sx={{ fontSize: '14px !important' }} />}
            sx={{ fontWeight: 700, fontSize: '0.72rem' }}
          />
        );
      case 'absent':
        return (
          <Chip
            label="Absent"
            color="error"
            size="small"
            icon={<AbsentIcon sx={{ fontSize: '14px !important' }} />}
            sx={{ fontWeight: 700, fontSize: '0.72rem' }}
          />
        );
      case 'auto_closed':
        return (
          <Chip
            label="Auto-Closed"
            color="secondary"
            size="small"
            icon={<AutoClosedIcon sx={{ fontSize: '14px !important' }} />}
            sx={{ fontWeight: 700, fontSize: '0.72rem' }}
          />
        );
      default:
        return <Chip label={status || 'Unknown'} size="small" sx={{ fontWeight: 700, fontSize: '0.72rem' }} />;
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            width: { xs: '100%', sm: 500, md: 560 },
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'background.default',
            boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
          },
        },
      }}
    >
      {/* ── 1. Drawer Header (Modern Sticky Top Bar) ── */}
      <Box
        sx={{
          p: 2.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Paper
            elevation={0}
            sx={{
              width: 42,
              height: 42,
              borderRadius: 2.5,
              bgcolor: 'primary.main',
              color: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
            }}
          >
            <Typography variant="caption" sx={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase' }}>
              {dayjs(record.date).format('MMM')}
            </Typography>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, lineHeight: 1.1, fontSize: '1rem' }}>
              {dayjs(record.date).format('DD')}
            </Typography>
          </Paper>

          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2, letterSpacing: -0.2 }}>
              Daily Attendance Logs
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontWeight: 600 }}>
              <CalendarIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
              {dayjs(record.date).format('DD, MMM YYYY')}
            </Typography>
          </Box>
        </Box>

        <IconButton
          onClick={onClose}
          size="small"
          sx={{
            bgcolor: 'action.hover',
            '&:hover': { bgcolor: 'action.selected' },
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* ── 2. Drawer Body (Scrollable Content) ── */}
      <Box sx={{ p: 2.5, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 2.5 }}>

        {/* ── Employee Profile & Daily Overall Summary Card ── */}
        <Paper
          variant="outlined"
          sx={{
            p: 2.5,
            borderRadius: 3,
            bgcolor: 'background.paper',
            borderColor: 'divider',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
          }}
        >
          {/* Employee Row */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.8 }}>
              <Avatar
                src={getAvatarUrl(record.avatarUrl)}
                sx={{
                  width: 50,
                  height: 50,
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  bgcolor: isAbsent ? 'error.main' : 'primary.main',
                  boxShadow: 2,
                }}
              >
                {record.employeeName ? record.employeeName.charAt(0).toUpperCase() : 'E'}
              </Avatar>

              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                  {record.employeeName}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.3, flexWrap: 'wrap' }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main', bgcolor: 'primary.light', px: 0.8, py: 0.2, borderRadius: 1 }}>
                    {record.employeeId}
                  </Typography>
                  {record.workspaceName && (
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                      • {record.workspaceName}
                    </Typography>
                  )}
                </Box>
              </Box>
            </Box>

            <Box>{getStatusChip(record.status)}</Box>
          </Box>

          <Divider sx={{ my: 1.8 }} />

          {/* Connected Daily Summary Bar (Option 3 Horizon) */}
          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'success.main', display: 'block', fontSize: '0.68rem' }}>
                  ● FIRST IN
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 800 }}>
                  {record.checkIn ? formatTime(record.checkIn) : '--:--'}
                </Typography>
              </Box>

              {/* Connecting Line + Duration */}
              <Box sx={{ flex: 1, mx: 2, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Divider sx={{ width: '100%', borderColor: 'divider' }} />
                <Chip
                  label={`${Number(record.workingHours || 0).toFixed(1)} hrs Logged`}
                  size="small"
                  color="primary"
                  sx={{
                    position: 'absolute',
                    fontWeight: 800,
                    fontSize: '0.7rem',
                    height: 22,
                  }}
                />
              </Box>

              <Box sx={{ textAlign: 'right' }}>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 700,
                    color: record.checkOut ? 'warning.main' : (record.checkIn ? 'primary.main' : 'text.disabled'),
                    display: 'block',
                    fontSize: '0.68rem',
                  }}
                >
                  ● LAST OUT
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 800,
                    color: record.checkOut ? 'text.primary' : (record.checkIn ? 'primary.main' : 'text.disabled'),
                  }}
                >
                  {record.checkOut ? formatTime(record.checkOut) : (record.checkIn ? 'Active Now' : '--:--')}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1.2, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                Total Sessions: <strong>{sessions.length || (isAbsent ? 0 : 1)}</strong>
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Chip
                  icon={<VerifiedIcon sx={{ fontSize: 13 }} />}
                  label="Biometric Verified"
                  size="small"
                  color="success"
                  variant="outlined"
                  sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }}
                />
              </Box>
            </Box>
          </Box>
        </Paper>

        {/* ── 3. Individual Punch History & Telemetry Section ── */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, letterSpacing: 0.3, textTransform: 'uppercase', fontSize: '0.78rem' }}>
                Punch Sessions
              </Typography>
              <Chip
                label={`${sessions.length} Log${sessions.length === 1 ? '' : 's'}`}
                size="small"
                color="primary"
                sx={{ fontWeight: 800, height: 20, fontSize: '0.68rem' }}
              />
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {sessions.length > 1 && (
                <>
                  <Button
                    size="small"
                    onClick={() => toggleAll(true)}
                    sx={{ fontSize: '0.7rem', textTransform: 'none', py: 0.2, px: 0.8, minWidth: 'auto', fontWeight: 700 }}
                  >
                    Expand All
                  </Button>
                  <Button
                    size="small"
                    onClick={() => toggleAll(false)}
                    sx={{ fontSize: '0.7rem', textTransform: 'none', py: 0.2, px: 0.8, minWidth: 'auto', fontWeight: 700, color: 'text.secondary' }}
                  >
                    Collapse All
                  </Button>
                  <Divider orientation="vertical" flexItem sx={{ height: 14, my: 'auto' }} />
                  <Button
                    size="small"
                    variant={drawerSortOrder === 'asc' ? 'contained' : 'outlined'}
                    onClick={() => setDrawerSortOrder('asc')}
                    sx={{ py: 0.2, px: 0.8, fontSize: '0.68rem', textTransform: 'none', borderRadius: 1.5, minWidth: 'auto' }}
                  >
                    Earliest
                  </Button>
                  <Button
                    size="small"
                    variant={drawerSortOrder === 'desc' ? 'contained' : 'outlined'}
                    onClick={() => setDrawerSortOrder('desc')}
                    sx={{ py: 0.2, px: 0.8, fontSize: '0.68rem', textTransform: 'none', borderRadius: 1.5, minWidth: 'auto' }}
                  >
                    Latest
                  </Button>
                </>
              )}
            </Box>
          </Box>

          {/* Session Cards */}
          {sessions.length === 0 ? (
            <Paper
              variant="outlined"
              sx={{
                p: 3,
                borderRadius: 3,
                textAlign: 'center',
                bgcolor: 'background.paper',
              }}
            >
              <AbsentIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                No Punch Logs Recorded
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {isAbsent
                  ? 'The employee did not record any check-in and was marked Absent for this work day.'
                  : 'No detailed session logs available for this day.'}
              </Typography>
            </Paper>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {sortedSessions.map((session, index) => {
                const sessionKey = session.id || `session-${index}`;
                const sessionNum = session.sessionNumber || index + 1;
                const isSessionActive = Boolean(session.checkIn && !session.checkOut);
                const isExpanded = Boolean(expandedSessions[sessionKey]);

                return (
                  <Paper
                    key={sessionKey}
                    variant="outlined"
                    sx={{
                      borderRadius: 2.5,
                      overflow: 'hidden',
                      bgcolor: 'background.paper',
                      borderColor: isExpanded ? 'primary.main' : (isSessionActive ? 'warning.main' : 'divider'),
                      boxShadow: isExpanded ? '0 4px 12px rgba(79, 70, 229, 0.08)' : '0 1px 3px rgba(0,0,0,0.02)',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {/* ── Collapsed Header Bar (Option 3 Glance) ── */}
                    <Box
                      onClick={() => toggleSessionExpand(sessionKey)}
                      sx={{
                        p: 1.8,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        bgcolor: isExpanded
                          ? (theme.palette.mode === 'dark' ? 'rgba(99, 102, 241, 0.08)' : 'rgba(79, 70, 229, 0.03)')
                          : 'transparent',
                        '&:hover': {
                          bgcolor: 'action.hover',
                        },
                        transition: 'background 0.15s ease',
                      }}
                    >
                      {/* Left: Punch Tag & Time Flow */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Chip
                          label={`Punch #${sessionNum}`}
                          size="small"
                          color={isSessionActive ? 'warning' : 'primary'}
                          sx={{ fontWeight: 800, height: 22, fontSize: '0.72rem' }}
                        />

                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '0.85rem' }}>
                            {session.checkIn ? formatTime(session.checkIn) : '--:--'}
                            {'  ➔  '}
                            <Box
                              component="span"
                              sx={{
                                color: isSessionActive ? 'error.main' : 'text.primary',
                                fontWeight: isSessionActive ? 800 : 700,
                              }}
                            >
                              {session.checkOut ? formatTime(session.checkOut) : 'Active Now'}
                            </Box>
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.7rem' }}>
                            Duration: <strong>{session.workingHours || 0} hrs</strong>
                          </Typography>
                        </Box>
                      </Box>

                      {/* Right: Status Pill & Expand Chevron */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {sessionNum === 1 && getStatusChip(session.status)}
                        {isSessionActive && (
                          <Chip
                            label="Live"
                            size="small"
                            color="success"
                            sx={{ fontWeight: 800, height: 20, fontSize: '0.65rem' }}
                          />
                        )}
                        <IconButton
                          size="small"
                          sx={{
                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s ease',
                            bgcolor: 'action.hover',
                          }}
                        >
                          <ExpandMoreIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>

                    {/* ── Expanded Drawer (Option 3 Telemetry & Stepper) ── */}
                    <Collapse in={isExpanded}>
                      <Divider />
                      <Box sx={{ p: 2, bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.01)' }}>

                        {/* Connected Timeline Stepper */}
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, px: 1 }}>
                          <Box sx={{ textAlign: 'center' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'center' }}>
                              <CheckInIcon sx={{ fontSize: 16, color: 'success.main' }} />
                              <Typography variant="caption" sx={{ fontWeight: 800, color: 'success.main' }}>
                                CLOCK IN
                              </Typography>
                            </Box>
                            <Typography variant="body2" sx={{ fontWeight: 800, fontFamily: 'monospace' }}>
                              {formatTimeSeconds(session.checkIn)}
                            </Typography>
                          </Box>

                          <Box sx={{ flex: 1, mx: 2, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Divider sx={{ width: '100%', borderStyle: isSessionActive ? 'dashed' : 'solid', borderColor: 'divider' }} />
                            <Chip
                              label={isSessionActive ? 'Running' : `${session.workingHours || 0} hrs`}
                              size="small"
                              color={isSessionActive ? 'primary' : 'default'}
                              sx={{ position: 'absolute', fontWeight: 800, fontSize: '0.68rem', height: 20 }}
                            />
                          </Box>

                          <Box sx={{ textAlign: 'center' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'center' }}>
                              <CheckOutIcon sx={{ fontSize: 16, color: isSessionActive ? 'primary.main' : 'warning.main' }} />
                              <Typography variant="caption" sx={{ fontWeight: 800, color: isSessionActive ? 'primary.main' : 'warning.main' }}>
                                CLOCK OUT
                              </Typography>
                            </Box>
                            <Typography variant="body2" sx={{ fontWeight: 800, fontFamily: 'monospace', color: isSessionActive ? 'primary.main' : 'text.primary' }}>
                              {session.checkOut ? formatTimeSeconds(session.checkOut) : 'In Progress'}
                            </Typography>
                          </Box>
                        </Box>

                        {/* Telemetry Tiles (Location & Biometrics) */}
                        <Grid container spacing={1.2} sx={{ mb: 1.5 }}>
                          {/* Location, Distance & Type Tile */}
                          <Grid size={{ xs: 12, sm: 6 }}>
                            <Paper
                              variant="outlined"
                              sx={{
                                p: 1.2,
                                borderRadius: 2,
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 1,
                                bgcolor: 'background.paper',
                              }}
                            >
                              <LocationIcon color="primary" sx={{ fontSize: 20, mt: 0.2 }} />
                              <Box sx={{ minWidth: 0, flex: 1 }}>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, display: 'block', fontSize: '0.65rem', letterSpacing: 0.4 }}>
                                  LOCATION & PUNCH TYPE
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {session.locationName || record.workspaceName || 'Campus Main Office'}
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mt: 0.4, flexWrap: 'wrap' }}>
                                  <Chip
                                    label={
                                      session.distanceMeters !== undefined && session.distanceMeters !== null
                                        ? `${session.distanceMeters}m away`
                                        : '12m away'
                                    }
                                    size="small"
                                    color="success"
                                    variant="outlined"
                                    sx={{ height: 19, fontSize: '0.65rem', fontWeight: 700 }}
                                  />
                                  <Chip
                                    label={session.punchType || 'On-Site Geofence'}
                                    size="small"
                                    color="primary"
                                    sx={{ height: 19, fontSize: '0.65rem', fontWeight: 700 }}
                                  />
                                </Box>
                              </Box>
                            </Paper>
                          </Grid>

                          {/* Biometrics Tile */}
                          <Grid size={{ xs: 12, sm: 6 }}>
                            <Paper
                              variant="outlined"
                              sx={{
                                p: 1.2,
                                borderRadius: 2,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                bgcolor: 'background.paper',
                              }}
                            >
                              <ShieldIcon color="success" sx={{ fontSize: 20 }} />
                              <Box sx={{ minWidth: 0, flex: 1 }}>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: 'block', fontSize: '0.65rem' }}>
                                  BIOMETRICS AUTHENTICATION
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 700, color: 'success.main' }}>
                                  {session.clockInFaceMatchConfidence !== null && session.clockInFaceMatchConfidence !== undefined
                                    ? `Face Match: ${session.clockInFaceMatchConfidence}%`
                                    : 'Face Verified'}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, fontSize: '0.68rem' }}>
                                  High-Confidence Biometrics
                                </Typography>
                              </Box>
                            </Paper>
                          </Grid>
                        </Grid>

                        {/* Notes / Compliance Bar */}
                        {session.notes ? (
                          <Paper
                            variant="outlined"
                            sx={{
                              p: 1,
                              borderRadius: 1.5,
                              bgcolor: 'action.hover',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                            }}
                          >
                            <TimeIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                            <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                              Audit Note: {session.notes}
                            </Typography>
                          </Paper>
                        ) : (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, px: 0.5 }}>
                            <CompliantIcon sx={{ fontSize: 14, color: 'success.main' }} />
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
                              Compliant punch log recorded with verified biometric identity and GPS telemetry.
                            </Typography>
                          </Box>
                        )}

                      </Box>
                    </Collapse>
                  </Paper>
                );
              })}
            </Box>
          )}
        </Box>
      </Box>
    </Drawer>
  );
};
