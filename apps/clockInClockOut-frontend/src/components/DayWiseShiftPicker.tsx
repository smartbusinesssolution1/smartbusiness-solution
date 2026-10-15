import React from 'react';
import dayjs, { Dayjs } from 'dayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import {
  Box,
  Paper,
  Typography,
  Switch,
  Button,
  Chip,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Stack,
  useTheme,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  AccessTime as AccessTimeIcon,
  ContentCopy as CopyIcon,
  EventAvailable as WorkIcon,
  NightlightRound as NightIcon,
  WbSunny as DayIcon,
  Schedule as ClockIcon,
} from '@mui/icons-material';
import { DayOfWeek, DayShiftConfig, WeeklySchedule } from '../types';

export const DAYS_OF_WEEK: {
  key: DayOfWeek;
  label: string;
  shortLabel: string;
  nextDayName: string;
  isWeekend?: boolean;
}[] = [
  { key: 'MON', label: 'Monday', shortLabel: 'Mon', nextDayName: 'Tue' },
  { key: 'TUE', label: 'Tuesday', shortLabel: 'Tue', nextDayName: 'Wed' },
  { key: 'WED', label: 'Wednesday', shortLabel: 'Wed', nextDayName: 'Thu' },
  { key: 'THU', label: 'Thursday', shortLabel: 'Thu', nextDayName: 'Fri' },
  { key: 'FRI', label: 'Friday', shortLabel: 'Fri', nextDayName: 'Sat' },
  { key: 'SAT', label: 'Saturday', shortLabel: 'Sat', nextDayName: 'Sun', isWeekend: true },
  { key: 'SUN', label: 'Sunday', shortLabel: 'Sun', nextDayName: 'Mon', isWeekend: true },
];

export const DEFAULT_WEEKLY_SCHEDULE: WeeklySchedule = [
  { day: 'MON', isWorkDay: true, startTime: '09:00', endTime: '18:00' },
  { day: 'TUE', isWorkDay: true, startTime: '09:00', endTime: '18:00' },
  { day: 'WED', isWorkDay: true, startTime: '09:00', endTime: '18:00' },
  { day: 'THU', isWorkDay: true, startTime: '09:00', endTime: '18:00' },
  { day: 'FRI', isWorkDay: true, startTime: '09:00', endTime: '18:00' },
  { day: 'SAT', isWorkDay: false, startTime: '09:00', endTime: '18:00' },
  { day: 'SUN', isWorkDay: false, startTime: '09:00', endTime: '18:00' },
];

// Check if shift crosses midnight into the next morning
export const checkIsOvernight = (start: string, end: string): boolean => {
  if (!start || !end) return false;
  const [h1, m1] = start.split(':').map(Number);
  const [h2, m2] = end.split(':').map(Number);
  if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return false;
  return h2 * 60 + m2 < h1 * 60 + m1;
};

// Calculate duration in hours & minutes with overnight handling
export const calcDuration = (start: string, end: string): { text: string; hoursNum: number; isOvernight: boolean } => {
  const [h1, m1] = (start || '09:00').split(':').map(Number);
  const [h2, m2] = (end || '18:00').split(':').map(Number);
  let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
  const isOvernight = diff < 0;
  if (isOvernight) diff += 24 * 60; // Next-day morning shift math
  const hours = Math.floor(diff / 60);
  const mins = diff % 60;
  return {
    text: `${hours}h${mins > 0 ? ` ${mins}m` : ''}`,
    hoursNum: diff / 60,
    isOvernight,
  };
};

/**
 * Compact Time Input Picker for table rows
 */
interface CompactTimePickerProps {
  value: string; // HH:mm
  onChange: (val: string) => void;
  disabled?: boolean;
}

const CompactTimePicker: React.FC<CompactTimePickerProps> = ({ value, onChange, disabled }) => {
  const dayjsValue: Dayjs | null = React.useMemo(() => {
    if (!value || !value.includes(':')) return null;
    const [h, m] = value.split(':');
    return dayjs().hour(Number(h)).minute(Number(m)).second(0);
  }, [value]);

  const handleTimeChange = (newValue: Dayjs | null) => {
    if (newValue && newValue.isValid()) {
      onChange(newValue.format('HH:mm'));
    }
  };

  return (
    <TimePicker
      value={dayjsValue}
      onChange={handleTimeChange}
      disabled={disabled}
      ampm
      format="hh:mm A"
      views={['hours', 'minutes']}
      slotProps={{
        textField: {
          size: 'small',
          sx: {
            width: 146,
            bgcolor: 'background.paper',
            '& .MuiInputBase-root': {
              height: 34,
              fontSize: '0.82rem',
              fontWeight: 600,
              borderRadius: 1.5,
              pr: 0.5,
            },
            '& .MuiInputBase-input': {
              py: 0.5,
              pl: 1.25,
              pr: 0,
              fontSize: '0.82rem',
              fontWeight: 600,
            },
            '& .MuiIconButton-root': {
              p: '2px',
              mr: 0.25,
            },
            '& .MuiSvgIcon-root': {
              fontSize: '1.15rem',
              color: 'text.secondary',
            },
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: 'divider',
            },
          },
        },
        popper: {
          sx: {
            zIndex: 1400,
            '& .MuiPaper-root': {
              borderRadius: '16px !important',
              boxShadow: (theme) =>
                theme.palette.mode === 'dark'
                  ? '0 16px 40px -4px rgba(0, 0, 0, 0.7)'
                  : '0 16px 40px -4px rgba(0, 0, 0, 0.16)',
              border: '1px solid',
              borderColor: 'divider',
            },
          },
        },
      }}
    />
  );
};

interface DayWiseShiftPickerProps {
  value?: WeeklySchedule;
  onChange: (schedule: WeeklySchedule) => void;
  disabled?: boolean;
}

export const DayWiseShiftPicker: React.FC<DayWiseShiftPickerProps> = ({
  value = DEFAULT_WEEKLY_SCHEDULE,
  onChange,
  disabled = false,
}) => {
  const theme = useTheme();

  // Convert incoming value (array or legacy map) into internal dictionary for quick O(1) row lookups
  const scheduleMap = React.useMemo(() => {
    const map: Record<DayOfWeek, DayShiftConfig> = {
      MON: { day: 'MON', isWorkDay: true, startTime: '09:00', endTime: '18:00' },
      TUE: { day: 'TUE', isWorkDay: true, startTime: '09:00', endTime: '18:00' },
      WED: { day: 'WED', isWorkDay: true, startTime: '09:00', endTime: '18:00' },
      THU: { day: 'THU', isWorkDay: true, startTime: '09:00', endTime: '18:00' },
      FRI: { day: 'FRI', isWorkDay: true, startTime: '09:00', endTime: '18:00' },
      SAT: { day: 'SAT', isWorkDay: false, startTime: '09:00', endTime: '18:00' },
      SUN: { day: 'SUN', isWorkDay: false, startTime: '09:00', endTime: '18:00' },
    };

    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item && item.day && map[item.day]) {
          map[item.day] = { ...item };
        }
      });
    } else if (value && typeof value === 'object') {
      (Object.keys(map) as DayOfWeek[]).forEach((d) => {
        const item = (value as Record<string, any>)[d];
        if (item) {
          map[d] = {
            day: d,
            isWorkDay: item.isWorkDay ?? map[d].isWorkDay,
            startTime: item.startTime || map[d].startTime,
            endTime: item.endTime || map[d].endTime,
          };
        }
      });
    }
    return map;
  }, [value]);

  const emitSchedule = (updatedMap: Record<DayOfWeek, DayShiftConfig>) => {
    const list: DayShiftConfig[] = (['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as DayOfWeek[]).map(
      (d) => updatedMap[d]
    );
    onChange(list);
  };

  const handleDayToggle = (day: DayOfWeek, isWorkDay: boolean) => {
    emitSchedule({
      ...scheduleMap,
      [day]: {
        ...scheduleMap[day],
        isWorkDay,
      },
    });
  };

  const handleTimeChange = (day: DayOfWeek, field: 'startTime' | 'endTime', timeVal: string) => {
    emitSchedule({
      ...scheduleMap,
      [day]: {
        ...scheduleMap[day],
        [field]: timeVal,
      },
    });
  };

  // Quick Action: Copy Monday to weekdays (Tue - Fri)
  const handleCopyMondayToWeekdays = () => {
    const mondayConfig = scheduleMap.MON || { day: 'MON', isWorkDay: true, startTime: '09:00', endTime: '18:00' };
    const updated: Record<DayOfWeek, DayShiftConfig> = { ...scheduleMap };
    (['TUE', 'WED', 'THU', 'FRI'] as DayOfWeek[]).forEach((d) => {
      updated[d] = {
        ...updated[d],
        day: d,
        isWorkDay: mondayConfig.isWorkDay,
        startTime: mondayConfig.startTime,
        endTime: mondayConfig.endTime,
      };
    });
    emitSchedule(updated);
  };

  // Quick Preset: Standard Day Shift (09:00 - 18:00)
  const handlePresetDayShift = () => {
    const updated: Record<DayOfWeek, DayShiftConfig> = { ...scheduleMap };
    (['MON', 'TUE', 'WED', 'THU', 'FRI'] as DayOfWeek[]).forEach((d) => {
      updated[d] = { day: d, isWorkDay: true, startTime: '09:00', endTime: '18:00' };
    });
    emitSchedule(updated);
  };

  // Quick Preset: Night Shift (22:00 - 06:00 / 10 PM - 6 AM)
  const handlePresetNightShift = () => {
    const updated: Record<DayOfWeek, DayShiftConfig> = { ...scheduleMap };
    (['MON', 'TUE', 'WED', 'THU', 'FRI'] as DayOfWeek[]).forEach((d) => {
      updated[d] = { day: d, isWorkDay: true, startTime: '22:00', endTime: '06:00' };
    });
    emitSchedule(updated);
  };

  // Quick Preset: Sat & Sun as Off
  const handleSetWeekendOff = () => {
    emitSchedule({
      ...scheduleMap,
      SAT: { ...scheduleMap.SAT, isWorkDay: false },
      SUN: { ...scheduleMap.SUN, isWorkDay: false },
    });
  };

  // Calculate stats
  const activeWorkingDays = DAYS_OF_WEEK.filter((d) => scheduleMap[d.key]?.isWorkDay);
  const overnightShifts = activeWorkingDays.filter((d) =>
    checkIsOvernight(scheduleMap[d.key]?.startTime, scheduleMap[d.key]?.endTime)
  );
  const totalWeeklyHours = activeWorkingDays.reduce((acc, d) => {
    const dur = calcDuration(scheduleMap[d.key]?.startTime, scheduleMap[d.key]?.endTime);
    return acc + dur.hoursNum;
  }, 0);

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ width: '100%' }}>
        {/* Top Summary Bar & Quick Actions */}
        <Paper
          elevation={0}
          sx={{
            p: 2,
            mb: 2,
            borderRadius: 2.5,
            bgcolor: (theme) =>
              theme.palette.mode === 'dark' ? 'rgba(99, 102, 241, 0.08)' : 'rgba(99, 102, 241, 0.04)',
            border: '1px solid',
            borderColor: (theme) =>
              theme.palette.mode === 'dark' ? 'rgba(99, 102, 241, 0.25)' : 'rgba(99, 102, 241, 0.15)',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: { xs: 'flex-start', sm: 'center' },
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 1.5,
              mb: 1.5,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ClockIcon sx={{ color: 'primary.main', fontSize: 22 }} />
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                  Weekly Shift Schedule
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Configure working days, daytime, or overnight night shifts individually
                </Typography>
              </Box>
            </Box>

            {/* Summary Chips */}
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
              <Chip
                icon={<WorkIcon sx={{ fontSize: 15 }} />}
                label={`${activeWorkingDays.length} Working Days`}
                color="primary"
                size="small"
                sx={{ fontWeight: 700, fontSize: '0.75rem', height: 26 }}
              />
              <Chip
                icon={<AccessTimeIcon sx={{ fontSize: 15 }} />}
                label={`Total ${totalWeeklyHours.toFixed(1)} hrs/wk`}
                variant="outlined"
                color="primary"
                size="small"
                sx={{ fontWeight: 700, fontSize: '0.75rem', height: 26 }}
              />
              {overnightShifts.length > 0 && (
                <Chip
                  icon={<NightIcon sx={{ fontSize: 15 }} />}
                  label={`${overnightShifts.length} Night Shifts`}
                  color="secondary"
                  size="small"
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    height: 26,
                    bgcolor: (theme) =>
                      theme.palette.mode === 'dark' ? 'rgba(168, 85, 247, 0.25)' : 'rgba(168, 85, 247, 0.15)',
                    color: 'secondary.main',
                    border: '1px solid',
                    borderColor: 'secondary.main',
                  }}
                />
              )}
            </Stack>
          </Box>

          <Divider sx={{ my: 1.25, borderStyle: 'dashed' }} />

          {/* Quick Action Buttons */}
          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', mr: 0.5 }}>
              Quick Presets:
            </Typography>
            <Button
              size="small"
              variant="outlined"
              startIcon={<CopyIcon fontSize="small" />}
              onClick={handleCopyMondayToWeekdays}
              disabled={disabled}
              sx={{
                fontSize: '0.75rem',
                py: 0.35,
                px: 1.2,
                borderRadius: 1.5,
                textTransform: 'none',
                fontWeight: 600,
              }}
            >
              Copy Mon to Mon–Fri
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<DayIcon fontSize="small" />}
              onClick={handlePresetDayShift}
              disabled={disabled}
              sx={{
                fontSize: '0.75rem',
                py: 0.35,
                px: 1.2,
                borderRadius: 1.5,
                textTransform: 'none',
                fontWeight: 600,
              }}
            >
              Day Shift (9 AM - 6 PM)
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="secondary"
              startIcon={<NightIcon fontSize="small" />}
              onClick={handlePresetNightShift}
              disabled={disabled}
              sx={{
                fontSize: '0.75rem',
                py: 0.35,
                px: 1.2,
                borderRadius: 1.5,
                textTransform: 'none',
                fontWeight: 600,
              }}
            >
              Night Shift (10 PM - 6 AM)
            </Button>
            <Button
              size="small"
              variant="text"
              onClick={handleSetWeekendOff}
              disabled={disabled}
              sx={{
                fontSize: '0.75rem',
                py: 0.35,
                px: 1,
                borderRadius: 1.5,
                textTransform: 'none',
                color: 'text.secondary',
              }}
            >
              Set Sat & Sun Off
            </Button>
          </Box>
        </Paper>

        {/* Compact Table View */}
        <TableContainer
          component={Paper}
          elevation={0}
          sx={{
            borderRadius: 2.5,
            border: '1px solid',
            borderColor: 'divider',
            overflowX: 'auto',
            width: '100%',
          }}
        >
          <Table size="small" sx={{ minWidth: 780, width: '100%' }}>
            <TableHead>
              <TableRow sx={{ bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)') }}>
                <TableCell sx={{ fontWeight: 700, width: 140, minWidth: 140, py: 1.25, px: 2, whiteSpace: 'nowrap' }}>
                  Day
                </TableCell>
                <TableCell sx={{ fontWeight: 700, width: 110, minWidth: 110, py: 1.25, px: 1, whiteSpace: 'nowrap' }}>
                  Status
                </TableCell>
                <TableCell sx={{ fontWeight: 700, width: 160, minWidth: 160, py: 1.25, px: 1, whiteSpace: 'nowrap' }}>
                  Shift Start
                </TableCell>
                <TableCell sx={{ fontWeight: 700, width: 220, minWidth: 220, py: 1.25, px: 1, whiteSpace: 'nowrap' }}>
                  Shift End
                </TableCell>
                <TableCell sx={{ fontWeight: 700, minWidth: 150, py: 1.25, px: 2, whiteSpace: 'nowrap' }}>
                  Duration / Shift
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {DAYS_OF_WEEK.map(({ key, label, shortLabel, nextDayName, isWeekend }) => {
                const dayConfig = scheduleMap[key] || { day: key, isWorkDay: !isWeekend, startTime: '09:00', endTime: '18:00' };
                const dur = calcDuration(dayConfig.startTime, dayConfig.endTime);

                return (
                  <TableRow
                    key={key}
                    sx={{
                      bgcolor: dayConfig.isWorkDay
                        ? 'background.paper'
                        : (theme) =>
                            theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.015)' : 'rgba(0, 0, 0, 0.015)',
                      opacity: dayConfig.isWorkDay ? 1 : 0.65,
                      '&:hover': {
                        bgcolor: (theme) =>
                          theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                      },
                      transition: 'background-color 0.15s ease',
                    }}
                  >
                    {/* Day Badge & Name */}
                    <TableCell sx={{ py: 1.1, px: 2, width: 140, minWidth: 140, whiteSpace: 'nowrap' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                        <Chip
                          label={shortLabel}
                          size="small"
                          color={dayConfig.isWorkDay ? (isWeekend ? 'secondary' : 'primary') : 'default'}
                          variant={dayConfig.isWorkDay ? 'filled' : 'outlined'}
                          sx={{
                            width: 42,
                            fontWeight: 800,
                            fontSize: '0.72rem',
                            height: 22,
                            borderRadius: 1.25,
                          }}
                        />
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 600,
                            fontSize: '0.84rem',
                            color: dayConfig.isWorkDay ? 'text.primary' : 'text.disabled',
                          }}
                        >
                          {label}
                        </Typography>
                      </Box>
                    </TableCell>

                    {/* Status Toggle Switch */}
                    <TableCell sx={{ py: 1.1, px: 1, width: 110, minWidth: 110, whiteSpace: 'nowrap' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Switch
                          size="small"
                          checked={dayConfig.isWorkDay}
                          onChange={(e) => handleDayToggle(key, e.target.checked)}
                          disabled={disabled}
                          color={dur.isOvernight ? 'secondary' : 'primary'}
                        />
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: 600,
                            fontSize: '0.74rem',
                            color: dayConfig.isWorkDay ? (dur.isOvernight ? 'secondary.main' : 'primary.main') : 'text.disabled',
                            userSelect: 'none',
                          }}
                        >
                          {dayConfig.isWorkDay ? 'Work' : 'Off'}
                        </Typography>
                      </Box>
                    </TableCell>

                    {/* Start Time Picker */}
                    <TableCell sx={{ py: 1.1, px: 1, width: 160, minWidth: 160, whiteSpace: 'nowrap' }}>
                      {dayConfig.isWorkDay ? (
                        <CompactTimePicker
                          value={dayConfig.startTime || '09:00'}
                          onChange={(val) => handleTimeChange(key, 'startTime', val)}
                          disabled={disabled}
                        />
                      ) : (
                        <Typography variant="body2" color="text.disabled" sx={{ fontStyle: 'italic', px: 1 }}>
                          —
                        </Typography>
                      )}
                    </TableCell>

                    {/* End Time Picker (+1 Day overnight badge) */}
                    <TableCell sx={{ py: 1.1, px: 1, width: 220, minWidth: 220, whiteSpace: 'nowrap' }}>
                      {dayConfig.isWorkDay ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <CompactTimePicker
                            value={dayConfig.endTime || '18:00'}
                            onChange={(val) => handleTimeChange(key, 'endTime', val)}
                            disabled={disabled}
                          />
                          {dur.isOvernight && (
                            <Tooltip title={`Crosses midnight · Shift ends on ${nextDayName} morning`}>
                              <Chip
                                label="+1d"
                                size="small"
                                color="secondary"
                                sx={{
                                  height: 22,
                                  fontSize: '0.68rem',
                                  fontWeight: 800,
                                  cursor: 'help',
                                  px: 0.5,
                                  borderRadius: 1,
                                }}
                              />
                            </Tooltip>
                          )}
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.disabled" sx={{ fontStyle: 'italic', px: 1 }}>
                          —
                        </Typography>
                      )}
                    </TableCell>

                    {/* Duration / Shift Type Tag */}
                    <TableCell sx={{ py: 1.1, px: 2, minWidth: 150, whiteSpace: 'nowrap' }}>
                      {dayConfig.isWorkDay ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {dur.isOvernight ? (
                            <Tooltip title={`🌙 Night Shift: Starts ${dayConfig.startTime}, ends ${dayConfig.endTime} on ${nextDayName} morning`}>
                              <Chip
                                icon={<NightIcon sx={{ fontSize: 13, color: '#a855f7 !important' }} />}
                                label={`${dur.text} · Overnight`}
                                size="small"
                                sx={{
                                  fontWeight: 700,
                                  fontSize: '0.72rem',
                                  height: 24,
                                  whiteSpace: 'nowrap',
                                  bgcolor: (theme) =>
                                    theme.palette.mode === 'dark' ? 'rgba(168, 85, 247, 0.16)' : 'rgba(168, 85, 247, 0.08)',
                                  color: (theme) =>
                                    theme.palette.mode === 'dark' ? '#c084fc' : '#7e22ce',
                                  border: '1px solid',
                                  borderColor: (theme) =>
                                    theme.palette.mode === 'dark' ? 'rgba(168, 85, 247, 0.35)' : 'rgba(168, 85, 247, 0.25)',
                                  cursor: 'help',
                                }}
                              />
                            </Tooltip>
                          ) : (
                            <Chip
                              icon={<DayIcon sx={{ fontSize: 13, color: '#d97706 !important' }} />}
                              label={`${dur.text} · Day Shift`}
                              size="small"
                              sx={{
                                fontWeight: 600,
                                fontSize: '0.72rem',
                                height: 24,
                                whiteSpace: 'nowrap',
                                bgcolor: (theme) =>
                                  theme.palette.mode === 'dark' ? 'rgba(245, 158, 11, 0.14)' : 'rgba(245, 158, 11, 0.08)',
                                color: (theme) =>
                                  theme.palette.mode === 'dark' ? '#fbbf24' : '#b45309',
                                border: '1px solid',
                                borderColor: (theme) =>
                                  theme.palette.mode === 'dark' ? 'rgba(245, 158, 11, 0.35)' : 'rgba(245, 158, 11, 0.25)',
                              }}
                            />
                          )}
                        </Box>
                      ) : (
                        <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>
                          — Scheduled Off —
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </LocalizationProvider>
  );
};

export default DayWiseShiftPicker;
