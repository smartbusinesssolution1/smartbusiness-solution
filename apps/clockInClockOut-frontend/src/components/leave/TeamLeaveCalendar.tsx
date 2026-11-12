import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Filter,
  Users,
  AlertTriangle,
  Clock,
  Sparkles,
  Info,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import dayjs from 'dayjs';
import { cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { leaveService, LeaveRequest } from '../../services/leave.service';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
} from '../ui';

interface Props {
  workspaceId: string;
}

export const TeamLeaveCalendar: React.FC<Props> = ({ workspaceId }) => {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState<dayjs.Dayjs>(dayjs());
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedEvent, setSelectedEvent] = useState<LeaveRequest | null>(null);

  const monthStr = currentMonth.format('YYYY-MM');

  // Fetch departments
  const { data: departments = [] } = useQuery({
    queryKey: ['leaveDepartments', workspaceId],
    queryFn: () => leaveService.listDepartments(workspaceId),
    enabled: Boolean(workspaceId),
  });

  // Fetch calendar leaves
  const {
    data: calendarLeaves = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['teamCalendarLeaves', workspaceId, monthStr, selectedDept],
    queryFn: () => leaveService.getTeamCalendar(workspaceId, monthStr, selectedDept, 'ALL'),
    enabled: Boolean(workspaceId),
  });

  // Filter out current user from team calendar
  const displayLeaves = useMemo(() => {
    if (!user) return calendarLeaves;
    return calendarLeaves.filter((l) => {
      const empUser = l.employee?.workspaceMember?.user;
      const empUserId = empUser?.id;
      const empEmail = empUser?.email;
      const empCode = l.employee?.employeeCode;
      const empName = empUser?.fullName;

      const isSelf = Boolean(
        (user.id && (l.employeeId === user.id || l.employee?.id === user.id || empUserId === user.id)) ||
        (user.userId && (l.employeeId === user.userId || l.employee?.id === user.userId || empUserId === user.userId)) ||
        (user.employeeId && empCode && empCode.toLowerCase() === user.employeeId.toLowerCase()) ||
        (user.email && empEmail && empEmail.toLowerCase() === user.email.toLowerCase()) ||
        (user.name && empName && user.name.trim().toLowerCase() === empName.trim().toLowerCase())
      );

      return !isSelf;
    });
  }, [calendarLeaves, user]);

  const handlePrevMonth = () => {
    setCurrentMonth((prev) => prev.subtract(1, 'month'));
  };

  const handleNextMonth = () => {
    setCurrentMonth((prev) => prev.add(1, 'month'));
  };

  const handleToday = () => {
    setCurrentMonth(dayjs());
  };

  // Calendar Grid Days Calculation
  const calendarDays = useMemo(() => {
    const startOfMonth = currentMonth.startOf('month');
    const endOfMonth = currentMonth.endOf('month');

    const startDayOfWeek = startOfMonth.day(); // 0 is Sunday
    const daysInMonth = currentMonth.daysInMonth();

    const days: { date: dayjs.Dayjs; isCurrentMonth: boolean }[] = [];

    // Prefix days from previous month
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: startOfMonth.subtract(i + 1, 'day'),
        isCurrentMonth: false,
      });
    }

    // Days in current month
    for (let i = 0; i < daysInMonth; i++) {
      days.push({
        date: startOfMonth.add(i, 'day'),
        isCurrentMonth: true,
      });
    }

    // Suffix days to complete grid (42 days total for 6 weeks)
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        date: endOfMonth.add(i, 'day'),
        isCurrentMonth: false,
      });
    }

    return days;
  }, [currentMonth]);

  // Color mapper by category
  const getEventBadgeColor = (category?: string, status?: string) => {
    const isPending = status === 'PENDING';
    switch (category) {
      case 'SICK':
        return isPending
          ? 'bg-rose-50 text-rose-700 border border-dashed border-rose-300 dark:bg-rose-950/40 dark:text-rose-300'
          : 'bg-rose-100 text-rose-800 border border-rose-200 dark:bg-rose-900/40 dark:text-rose-200';
      case 'VACATION':
        return isPending
          ? 'bg-emerald-50 text-emerald-700 border border-dashed border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300'
          : 'bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200';
      case 'PTO':
        return isPending
          ? 'bg-indigo-50 text-indigo-700 border border-dashed border-indigo-300 dark:bg-indigo-950/40 dark:text-indigo-300'
          : 'bg-indigo-100 text-indigo-800 border border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-200';
      case 'FMLA':
        return isPending
          ? 'bg-amber-50 text-amber-700 border border-dashed border-amber-300 dark:bg-amber-950/40 dark:text-amber-300'
          : 'bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/40 dark:text-amber-200';
      default:
        return 'bg-subtle text-ink border border-line';
    }
  };

  return (
    <div className="space-y-4">
      {/* Calendar Controls Bar */}
      <Card className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 border border-line bg-panel shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 border border-line rounded-lg p-1 bg-subtle/30">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrevMonth}
              className="size-8 p-0"
              title="Previous Month"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToday}
              className="text-xs px-2.5 h-8 font-medium"
            >
              Today
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNextMonth}
              className="size-8 p-0"
              title="Next Month"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <CalendarIcon className="size-4 text-primary-600" />
            <h2 className="text-base font-bold text-ink tracking-tight">
              {currentMonth.format('MMMM YYYY')}
            </h2>
          </div>
        </div>

        {/* Filters and Legend */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Department Filter */}
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <Filter className="size-3.5 text-muted" />
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="h-8 rounded-lg border border-line bg-panel px-2.5 text-xs font-medium text-ink focus:border-primary-500 focus:outline-none"
            >
              <option value="ALL">All Departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Legend Pills */}
          <div className="hidden lg:flex items-center gap-2 text-[11px] font-medium text-muted pl-2 border-l border-line">
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-emerald-500" /> Vacation
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-rose-500" /> Sick (PSL)
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-indigo-500" /> PTO
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-amber-500" /> FMLA
            </span>
          </div>
        </div>
      </Card>

      {/* Interactive Calendar Grid */}
      <Card className="overflow-hidden border border-line shadow-sm">
        {/* Days of Week Header */}
        <div className="grid grid-cols-7 border-b border-line bg-subtle/50 text-center font-mono text-[11px] uppercase tracking-wider font-semibold text-faint">
          <div className="py-2.5 text-rose-500/80">Sun</div>
          <div className="py-2.5">Mon</div>
          <div className="py-2.5">Tue</div>
          <div className="py-2.5">Wed</div>
          <div className="py-2.5">Thu</div>
          <div className="py-2.5">Fri</div>
          <div className="py-2.5 text-rose-500/80">Sat</div>
        </div>

        {/* Month Cells Grid */}
        <div className="grid grid-cols-7 divide-x divide-y divide-line">
          {calendarDays.map((cell, idx) => {
            const dateStr = cell.date.format('YYYY-MM-DD');
            const isToday = cell.date.isSame(dayjs(), 'day');

            // Find overlapping leaves for this day (excluding self user)
            const dayEvents = displayLeaves.filter((l) => {
              const start = l.startDate.slice(0, 10);
              const end = l.endDate.slice(0, 10);
              return dateStr >= start && dateStr <= end;
            });

            return (
              <div
                key={idx}
                className={cn(
                  'min-h-[105px] p-1.5 flex flex-col justify-between transition-colors',
                  cell.isCurrentMonth ? 'bg-panel' : 'bg-subtle/25 text-muted/50',
                  isToday && 'ring-2 ring-primary-500 ring-inset bg-primary-50/15'
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      'flex size-6 items-center justify-center rounded-full text-xs font-semibold',
                      isToday
                        ? 'bg-primary-600 text-white font-bold'
                        : cell.isCurrentMonth
                        ? 'text-ink'
                        : 'text-muted/50'
                    )}
                  >
                    {cell.date.date()}
                  </span>

                  {dayEvents.length > 0 && (
                    <span className="text-[10px] font-mono text-muted/70 font-medium">
                      {dayEvents.length} away
                    </span>
                  )}
                </div>

                {/* Event Chips List */}
                <div className="mt-1 flex flex-col gap-1 overflow-y-auto max-h-[75px] scrollbar-none">
                  {dayEvents.slice(0, 3).map((event) => {
                    const empUser = event.employee?.workspaceMember?.user;
                    const empName = empUser?.fullName || 'Employee';
                    const firstName = empName.split(' ')[0];
                    const category = event.policy?.category;
                    const badgeClass = getEventBadgeColor(category, event.status);

                    return (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => setSelectedEvent(event)}
                        className={cn(
                          'w-full text-left truncate rounded px-1.5 py-0.5 text-[10px] font-medium transition-transform hover:scale-[1.02] cursor-pointer flex items-center justify-between gap-1',
                          badgeClass
                        )}
                        title={`${empName} • ${event.policy?.name} (${event.status})`}
                      >
                        <span className="truncate">{firstName}</span>
                        <span className="text-[9px] font-mono opacity-80 shrink-0">
                          {event.totalHours}h
                        </span>
                      </button>
                    );
                  })}

                  {dayEvents.length > 3 && (
                    <div className="text-[10px] text-primary-600 font-semibold px-1">
                      +{dayEvents.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Event Details Drawer / Card (when clicked) */}
      {selectedEvent && (
        <Card className="p-4 border border-primary-200 bg-primary-50/20 dark:bg-primary-950/20 dark:border-primary-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary-100 text-primary-700 font-bold text-sm">
              {(selectedEvent.employee?.workspaceMember?.user?.fullName || 'E').charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-ink">
                  {selectedEvent.employee?.workspaceMember?.user?.fullName}
                </span>
                <Badge variant={selectedEvent.status === 'APPROVED' ? 'success' : 'warning'} className="text-[10px]">
                  {selectedEvent.status}
                </Badge>
                <span className="text-xs text-muted font-medium">
                  {selectedEvent.employee?.department || 'General'}
                </span>
              </div>
              <p className="text-xs text-muted mt-0.5">
                <strong>{selectedEvent.policy?.name}</strong> &bull; {selectedEvent.totalHours} hrs &bull;{' '}
                {dayjs(selectedEvent.startDate).format('MMM D, YYYY')} – {dayjs(selectedEvent.endDate).format('MMM D, YYYY')}{' '}
                {selectedEvent.reason && `• "${selectedEvent.reason}"`}
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedEvent(null)}
            className="text-xs h-8"
          >
            Dismiss
          </Button>
        </Card>
      )}
    </div>
  );
};
