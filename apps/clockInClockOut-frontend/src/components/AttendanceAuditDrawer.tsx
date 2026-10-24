import React, { useState } from 'react';
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
  Dialog,
  Button,
  DialogContent,
  Tooltip,
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
  PhotoCamera as CameraIcon,
  ZoomIn as ZoomInIcon,
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
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [drawerSortOrder, setDrawerSortOrder] = useState<'asc' | 'desc'>('asc');

  const sessions: AttendanceSessionLog[] = record?.sessions || [];

  const sortedSessions = React.useMemo(() => {
    if (!record) return [];
    const list = [...sessions];
    list.sort((a, b) => {
      const timeA = a.checkIn || '';
      const timeB = b.checkIn || '';
      return drawerSortOrder === 'asc' ? timeA.localeCompare(timeB) : timeB.localeCompare(timeA);
    });
    return list;
  }, [record, sessions, drawerSortOrder]);

  if (!record) return null;

  const isAbsent = record.status === 'absent';

  const formatTime = (timeStr?: string | null) => {
    if (!timeStr) return '--';
    if (dayjs(`${record.date}T${timeStr}`).isValid()) {
      return dayjs(`${record.date}T${timeStr}`).format('hh:mm:ss A');
    }
    return timeStr;
  };

  const getStatusChip = (status: string) => {
    switch (status.toLowerCase()) {
      case 'present':
        return <Chip label="On Time" color="success" size="small" icon={<OnTimeIcon />} sx={{ fontWeight: 700 }} />;
      case 'late':
        return <Chip label="Late Check-In" color="warning" size="small" icon={<LateIcon />} sx={{ fontWeight: 700 }} />;
      case 'absent':
        return <Chip label="Absent" color="error" size="small" icon={<AbsentIcon />} sx={{ fontWeight: 700 }} />;
      case 'auto_closed':
        return <Chip label="Auto-Closed" color="secondary" size="small" icon={<AutoClosedIcon />} sx={{ fontWeight: 700 }} />;
      default:
        return <Chip label={status} size="small" sx={{ fontWeight: 700 }} />;
    }
  };

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        slotProps={{
          paper: {
            sx: {
              width: { xs: '100%', sm: 480, md: 540 },
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              bgcolor: 'background.default',
            },
          },
        }}
      >
        {/* Drawer Header */}
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
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
              Daily Attendance Logs
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              {dayjs(record.date).format('dddd, MMMM D, YYYY')}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small" sx={{ color: 'text.secondary' }}>
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Drawer Body */}
        <Box sx={{ p: 2.5, overflowY: 'auto', flex: 1 }}>
          {/* Employee Profile Header Card */}
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              borderRadius: 3,
              mb: 3,
              bgcolor: 'background.paper',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Avatar
                src={getAvatarUrl(record.avatarUrl)}
                sx={{
                  width: 52,
                  height: 52,
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  bgcolor: isAbsent ? 'error.main' : 'primary.main',
                  boxShadow: 2,
                }}
              >
                {record.employeeName ? record.employeeName.charAt(0).toUpperCase() : 'E'}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {record.employeeName}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main' }}>
                    {record.employeeId}
                  </Typography>
                  {record.workspaceName && (
                    <Typography variant="caption" color="text.secondary">
                      · {record.workspaceName}
                    </Typography>
                  )}
                </Box>
              </Box>
              <Box>{getStatusChip(record.status)}</Box>
            </Box>

            <Divider sx={{ my: 1.5 }} />

            {/* Daily Overall Metrics */}
            <Grid container spacing={1.5}>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Box sx={{ p: 1.25, bgcolor: 'action.hover', borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 600 }}>
                    First Check-In
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 800, color: 'success.main' }}>
                    {record.checkIn ? formatTime(record.checkIn) : '--'}
                  </Typography>
                </Box>
              </Grid>

              <Grid size={{ xs: 6, sm: 3 }}>
                <Box sx={{ p: 1.25, bgcolor: 'action.hover', borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 600 }}>
                    Last Check-Out
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 800,
                      color: record.checkOut ? 'warning.dark' : record.checkIn ? 'primary.main' : 'text.disabled',
                    }}
                  >
                    {record.checkOut ? formatTime(record.checkOut) : record.checkIn ? 'Active Shift' : '--'}
                  </Typography>
                </Box>
              </Grid>

              <Grid size={{ xs: 6, sm: 3 }}>
                <Box sx={{ p: 1.25, bgcolor: 'action.hover', borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 600 }}>
                    Total Hours
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 800 }}>
                    {record.workingHours || 0} hrs
                  </Typography>
                </Box>
              </Grid>

              <Grid size={{ xs: 6, sm: 3 }}>
                <Box sx={{ p: 1.25, bgcolor: 'action.hover', borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 600 }}>
                    Total Punches
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 800, color: 'primary.main' }}>
                    {sessions.length || (isAbsent ? 0 : 1)}
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>

          {/* Section: Individual Shift Punches */}
          <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Punch History & Biometrics
              </Typography>
              <Chip
                label={`${sessions.length} Log${sessions.length === 1 ? '' : 's'}`}
                size="small"
                variant="outlined"
                color="primary"
                sx={{ fontWeight: 700 }}
              />
            </Box>

            {sessions.length > 1 && (
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <Button
                  size="small"
                  variant={drawerSortOrder === 'asc' ? 'contained' : 'outlined'}
                  onClick={() => setDrawerSortOrder('asc')}
                  sx={{ py: 0.2, px: 1, fontSize: '0.7rem', textTransform: 'none', borderRadius: 1.5, minWidth: 'auto' }}
                >
                  Earliest First
                </Button>
                <Button
                  size="small"
                  variant={drawerSortOrder === 'desc' ? 'contained' : 'outlined'}
                  onClick={() => setDrawerSortOrder('desc')}
                  sx={{ py: 0.2, px: 1, fontSize: '0.7rem', textTransform: 'none', borderRadius: 1.5, minWidth: 'auto' }}
                >
                  Latest First
                </Button>
              </Box>
            )}
          </Box>

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
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {sortedSessions.map((session, index) => {
                const sessionNum = session.sessionNumber || index + 1;
                const isSessionActive = Boolean(session.checkIn && !session.checkOut);

                return (
                  <Paper
                    key={session.id || index}
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderRadius: 3,
                      bgcolor: 'background.paper',
                      borderColor: isSessionActive ? 'primary.main' : 'divider',
                      boxShadow: isSessionActive ? 1 : 0,
                      position: 'relative',
                    }}
                  >
                    {/* Session Header */}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        mb: 1.5,
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          label={`Punch #${sessionNum}`}
                          size="small"
                          color="primary"
                          sx={{ fontWeight: 800, height: 22, fontSize: '0.72rem' }}
                        />
                        {isSessionActive && (
                          <Chip
                            label="Active Session"
                            size="small"
                            color="success"
                            variant="outlined"
                            sx={{ fontWeight: 700, height: 20, fontSize: '0.68rem' }}
                          />
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                          Duration: {session.workingHours || 0} hrs
                        </Typography>
                        {sessionNum === 1 && getStatusChip(session.status)}
                      </Box>
                    </Box>

                    {/* Clock In / Clock Out Timeline Box */}
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 1.5,
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: 'action.hover',
                        mb: 1.5,
                      }}
                    >
                      {/* Check-In Time */}
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <CheckInIcon sx={{ fontSize: 18, color: 'success.main', mt: 0.2 }} />
                        <Box>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block' }}>
                            Clock In
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 800 }}>
                            {session.checkIn ? formatTime(session.checkIn) : '--'}
                          </Typography>
                        </Box>
                      </Box>

                      {/* Check-Out Time */}
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <CheckOutIcon
                          sx={{
                            fontSize: 18,
                            color: session.checkOut ? 'warning.main' : 'text.disabled',
                            mt: 0.2,
                          }}
                        />
                        <Box>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block' }}>
                            Clock Out
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 800,
                              color: session.checkOut ? 'text.primary' : 'primary.main',
                            }}
                          >
                            {session.checkOut ? formatTime(session.checkOut) : 'In Progress'}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>

                    {/* Biometrics & Verification Row */}
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
                      {/* Face Match Confidence Badge */}
                      {session.clockInFaceMatchConfidence !== null &&
                        session.clockInFaceMatchConfidence !== undefined && (
                          <Chip
                            icon={<VerifiedIcon sx={{ fontSize: 14 }} />}
                            label={`Face Match: ${session.clockInFaceMatchConfidence}%`}
                            size="small"
                            color="success"
                            variant="outlined"
                            sx={{ fontWeight: 700, fontSize: '0.72rem' }}
                          />
                        )}

                      {/* GPS Geofence Badge */}
                      {session.clockInLatitude && session.clockInLongitude && (
                        <Chip
                          icon={<LocationIcon sx={{ fontSize: 14 }} />}
                          label={`GPS: ${Number(session.clockInLatitude).toFixed(4)}, ${Number(session.clockInLongitude).toFixed(4)}`}
                          size="small"
                          variant="outlined"
                          sx={{ fontWeight: 600, fontSize: '0.72rem' }}
                        />
                      )}
                    </Box>

                    {/* Notes */}
                    {session.notes && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          display: 'block',
                          fontStyle: 'italic',
                          bgcolor: 'action.hover',
                          px: 1,
                          py: 0.5,
                          borderRadius: 1,
                        }}
                      >
                        Note: {session.notes}
                      </Typography>
                    )}
                  </Paper>
                );
              })}
            </Box>
          )}
        </Box>
      </Drawer>

      {/* Full-size Photo Preview Modal */}
      <Dialog open={Boolean(previewImage)} onClose={() => setPreviewImage(null)} maxWidth="sm">
        <DialogContent sx={{ p: 1, textAlign: 'center', bgcolor: 'black' }}>
          {previewImage && (
            <img
              src={previewImage}
              alt="Verification Portrait Full Preview"
              style={{ maxWidth: '100%', maxHeight: '75vh', borderRadius: 8 }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
