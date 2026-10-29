import React from 'react';
import {
  Clock,
  Copy,
  Sun,
  Moon,
  Calendar,
  Sparkles,
  Info,
  Check,
} from 'lucide-react';
import { DayOfWeek, DayShiftConfig, WeeklySchedule } from '../types';
import { cn } from '../lib/utils';
import {
  Button,
  Card,
  Badge,
  Switch,
  Tooltip,
} from './ui';

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
  if (isOvernight) diff += 24 * 60;
  const hours = Math.floor(diff / 60);
  const mins = diff % 60;
  return {
    text: `${hours}h${mins > 0 ? ` ${mins}m` : ''}`,
    hoursNum: diff / 60,
    isOvernight,
  };
};

// Formats "14:30" to "02:30 PM"
export const format12h = (time24?: string) => {
  if (!time24 || !time24.includes(':')) return time24 || '--';
  const [hStr, mStr] = time24.split(':');
  const h = parseInt(hStr, 10);
  if (isNaN(h)) return time24;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12.toString().padStart(2, '0')}:${mStr || '00'} ${ampm}`;
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
  // Convert incoming value into internal dictionary
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

  // Preset: Copy Monday to weekdays (Tue - Fri)
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

  // Preset: Standard Day Shift (09:00 - 18:00)
  const handlePresetDayShift = () => {
    const updated: Record<DayOfWeek, DayShiftConfig> = { ...scheduleMap };
    (['MON', 'TUE', 'WED', 'THU', 'FRI'] as DayOfWeek[]).forEach((d) => {
      updated[d] = { day: d, isWorkDay: true, startTime: '09:00', endTime: '18:00' };
    });
    emitSchedule(updated);
  };

  // Preset: Night Shift (22:00 - 06:00)
  const handlePresetNightShift = () => {
    const updated: Record<DayOfWeek, DayShiftConfig> = { ...scheduleMap };
    (['MON', 'TUE', 'WED', 'THU', 'FRI'] as DayOfWeek[]).forEach((d) => {
      updated[d] = { day: d, isWorkDay: true, startTime: '22:00', endTime: '06:00' };
    });
    emitSchedule(updated);
  };

  // Preset: Sat & Sun as Off
  const handleSetWeekendOff = () => {
    emitSchedule({
      ...scheduleMap,
      SAT: { ...scheduleMap.SAT, isWorkDay: false },
      SUN: { ...scheduleMap.SUN, isWorkDay: false },
    });
  };

  // Calculate statistics
  const activeWorkingDays = DAYS_OF_WEEK.filter((d) => scheduleMap[d.key]?.isWorkDay);
  const overnightShifts = activeWorkingDays.filter((d) =>
    checkIsOvernight(scheduleMap[d.key]?.startTime, scheduleMap[d.key]?.endTime)
  );
  const totalWeeklyHours = activeWorkingDays.reduce((acc, d) => {
    const dur = calcDuration(scheduleMap[d.key]?.startTime, scheduleMap[d.key]?.endTime);
    return acc + dur.hoursNum;
  }, 0);

  return (
    <div className="flex w-full flex-col gap-3">
      {/* Top Summary Banner & Quick Preset Controls */}
      <Card className="border-primary-100 bg-primary-50/30 p-4">
        <div className="flex flex-col gap-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                <Clock className="size-4" />
              </span>
              <div>
                <p className="text-xs font-semibold text-ink">Weekly Custom Shift Schedule</p>
                <p className="text-[0.6875rem] text-muted">
                  Configure working days, core office hours, and overnight night shifts per weekday.
                </p>
              </div>
            </div>

            {/* Metric Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="brand" className="font-mono text-[0.6875rem] num">
                {activeWorkingDays.length} Working Days
              </Badge>
              <Badge variant="outline" className="font-mono text-[0.6875rem] bg-panel num">
                {totalWeeklyHours.toFixed(1)} hrs / week
              </Badge>
              {overnightShifts.length > 0 && (
                <Badge variant="secondary" className="gap-1 font-mono text-[0.6875rem] bg-indigo-100 text-indigo-800">
                  <Moon className="size-3" />
                  <span>{overnightShifts.length} Night Shifts</span>
                </Badge>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 border-t border-primary-200/50 pt-2.5">
            <span className="font-mono text-[0.625rem] font-semibold text-muted tracking-wider uppercase mr-1">
              Quick presets:
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyMondayToWeekdays}
              disabled={disabled}
              className="h-7 text-xs gap-1 px-2.5 bg-panel hover:bg-subtle"
            >
              <Copy className="size-3 text-muted" />
              <span>Copy Mon to Mon–Fri</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePresetDayShift}
              disabled={disabled}
              className="h-7 text-xs gap-1 px-2.5 bg-panel hover:bg-subtle"
            >
              <Sun className="size-3 text-amber-500" />
              <span>Day Shift (9 AM – 6 PM)</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePresetNightShift}
              disabled={disabled}
              className="h-7 text-xs gap-1 px-2.5 bg-panel hover:bg-subtle"
            >
              <Moon className="size-3 text-indigo-500" />
              <span>Night Shift (10 PM – 6 AM)</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleSetWeekendOff}
              disabled={disabled}
              className="h-7 text-xs px-2 text-muted hover:text-ink"
            >
              Set Weekend Off
            </Button>
          </div>
        </div>
      </Card>

      {/* Schedule Table (shadcn Card) */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-line bg-subtle/50 text-faint">
                <th className="py-2.5 px-4 font-mono font-medium tracking-wider uppercase text-[0.6875rem] w-36">
                  Day
                </th>
                <th className="py-2.5 px-3 font-mono font-medium tracking-wider uppercase text-[0.6875rem] w-28">
                  Status
                </th>
                <th className="py-2.5 px-3 font-mono font-medium tracking-wider uppercase text-[0.6875rem] w-48">
                  Shift Start
                </th>
                <th className="py-2.5 px-3 font-mono font-medium tracking-wider uppercase text-[0.6875rem] w-56">
                  Shift End
                </th>
                <th className="py-2.5 px-4 font-mono font-medium tracking-wider uppercase text-[0.6875rem]">
                  Duration & Classification
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {DAYS_OF_WEEK.map(({ key, label, shortLabel, nextDayName, isWeekend }) => {
                const dayConfig = scheduleMap[key] || {
                  day: key,
                  isWorkDay: !isWeekend,
                  startTime: '09:00',
                  endTime: '18:00',
                };
                const dur = calcDuration(dayConfig.startTime, dayConfig.endTime);

                return (
                  <tr
                    key={key}
                    className={cn(
                      'transition-colors',
                      dayConfig.isWorkDay ? 'hover:bg-subtle/40' : 'bg-subtle/20 opacity-60'
                    )}
                  >
                    {/* Day Column */}
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'flex size-6 items-center justify-center rounded-md font-mono text-[10px] font-bold num',
                            dayConfig.isWorkDay
                              ? isWeekend
                                ? 'bg-indigo-100 text-indigo-700'
                                : 'bg-primary-100 text-primary-700'
                              : 'bg-line text-muted'
                          )}
                        >
                          {shortLabel}
                        </span>
                        <span
                          className={cn(
                            'font-medium text-xs',
                            dayConfig.isWorkDay ? 'text-ink' : 'text-muted'
                          )}
                        >
                          {label}
                        </span>
                      </div>
                    </td>

                    {/* Status Switch */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={dayConfig.isWorkDay}
                          onCheckedChange={(checked) => handleDayToggle(key, checked)}
                          disabled={disabled}
                        />
                        <span
                          className={cn(
                            'font-mono text-[0.6875rem] font-semibold',
                            dayConfig.isWorkDay ? 'text-emerald-600' : 'text-muted'
                          )}
                        >
                          {dayConfig.isWorkDay ? 'Work' : 'Off'}
                        </span>
                      </div>
                    </td>

                    {/* Shift Start */}
                    <td className="py-2.5 px-3">
                      {dayConfig.isWorkDay ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            value={dayConfig.startTime || '09:00'}
                            onChange={(e) => handleTimeChange(key, 'startTime', e.target.value)}
                            disabled={disabled}
                            className="h-8 rounded-lg border border-line bg-canvas px-2.5 font-mono text-xs text-ink focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
                          />
                          <span className="font-mono text-[0.6875rem] text-muted num hidden sm:inline">
                            {format12h(dayConfig.startTime)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted font-mono text-xs italic">—</span>
                      )}
                    </td>

                    {/* Shift End */}
                    <td className="py-2.5 px-3">
                      {dayConfig.isWorkDay ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            value={dayConfig.endTime || '18:00'}
                            onChange={(e) => handleTimeChange(key, 'endTime', e.target.value)}
                            disabled={disabled}
                            className="h-8 rounded-lg border border-line bg-canvas px-2.5 font-mono text-xs text-ink focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
                          />
                          <span className="font-mono text-[0.6875rem] text-muted num hidden sm:inline">
                            {format12h(dayConfig.endTime)}
                          </span>
                          {dur.isOvernight && (
                            <Tooltip content={`Crosses midnight into ${nextDayName} morning`}>
                              <Badge
                                variant="secondary"
                                className="bg-indigo-100 text-indigo-700 font-mono text-[9px] px-1 py-0"
                              >
                                +1d
                              </Badge>
                            </Tooltip>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted font-mono text-xs italic">—</span>
                      )}
                    </td>

                    {/* Duration / Tag */}
                    <td className="py-2.5 px-4">
                      {dayConfig.isWorkDay ? (
                        <div className="flex items-center gap-2">
                          {dur.isOvernight ? (
                            <Badge
                              variant="secondary"
                              className="gap-1 bg-indigo-50 text-indigo-700 border-indigo-200 font-mono text-[0.6875rem] num"
                            >
                              <Moon className="size-3 text-indigo-600" />
                              <span>{dur.text} · Night Shift</span>
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="gap-1 border-amber-200 bg-amber-50 text-amber-800 font-mono text-[0.6875rem] num"
                            >
                              <Sun className="size-3 text-amber-500" />
                              <span>{dur.text} · Day Shift</span>
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-[0.6875rem] text-faint italic font-mono">
                          — Scheduled Off —
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default DayWiseShiftPicker;
