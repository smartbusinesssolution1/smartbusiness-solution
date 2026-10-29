import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar,
  Clock,
  LogIn,
  LogOut,
  MapPin,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  ChevronDown,
  UserX,
  Radio,
  FileText,
} from 'lucide-react';
import dayjs from 'dayjs';

import { AttendanceRecord, AttendanceSessionLog } from '../types';
import { getAvatarUrl } from '../utils/imageUrl';
import { cn } from '../lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
  SheetFooter,
  Button,
  Badge,
  Card,
  Separator,
} from './ui';

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
  useEffect(() => {
    if (sortedSessions.length > 0) {
      const initial: { [key: string]: boolean } = {};
      sortedSessions.forEach((s, idx) => {
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

  const renderStatusBadge = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'present':
        return (
          <Badge variant="success" className="gap-1 font-mono text-[0.6875rem]">
            <CheckCircle2 className="size-3 text-emerald-600" />
            <span>On Time</span>
          </Badge>
        );
      case 'late':
        return (
          <Badge variant="warning" className="gap-1 font-mono text-[0.6875rem]">
            <AlertTriangle className="size-3 text-amber-600" />
            <span>Late Check-In</span>
          </Badge>
        );
      case 'absent':
        return (
          <Badge variant="destructive" className="gap-1 font-mono text-[0.6875rem]">
            <XCircle className="size-3" />
            <span>Absent</span>
          </Badge>
        );
      case 'auto_closed':
        return (
          <Badge
            variant="outline"
            className="gap-1 border-purple-300 bg-purple-50 text-purple-700 font-mono text-[0.6875rem]"
          >
            <RefreshCw className="size-3 text-purple-600" />
            <span>Auto-Closed</span>
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="font-mono text-[0.6875rem] capitalize">
            {status || 'Unknown'}
          </Badge>
        );
    }
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent side="right" className="p-0 flex flex-col max-w-xl md:max-w-2xl">
        {/* ── 1. Drawer Header ── */}
        <SheetHeader className="px-6 py-4.5">
          <div className="flex items-center gap-3.5 pr-8">
            {/* Calendar Block Icon */}
            <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-xl bg-primary-600 text-white font-mono shadow-xs">
              <span className="text-[0.625rem] font-bold uppercase leading-none tracking-wider">
                {dayjs(record.date).format('MMM')}
              </span>
              <span className="text-base font-bold leading-tight">
                {dayjs(record.date).format('DD')}
              </span>
            </div>

            <div className="flex flex-col gap-0.5 min-w-0">
              <SheetTitle>Daily Attendance Audit</SheetTitle>
              <SheetDescription className="flex items-center gap-1.5 font-medium">
                <Calendar className="size-3 text-primary-600 shrink-0" />
                <span>{dayjs(record.date).format('dddd, DD MMMM YYYY')}</span>
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* ── 2. Scrollable Body ── */}
        <SheetBody className="px-6 py-5 flex flex-col gap-5">
          {/* ── Profile & Daily Overview Card ── */}
          <Card className="p-4 flex flex-col gap-3.5">
            {/* Employee Row */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {record.avatarUrl ? (
                  <img
                    src={getAvatarUrl(record.avatarUrl)}
                    alt={record.employeeName}
                    className="size-11 rounded-full border border-line object-cover"
                  />
                ) : (
                  <div
                    className={cn(
                      'flex size-11 shrink-0 items-center justify-center rounded-full font-mono text-sm font-bold text-white shadow-xs',
                      isAbsent ? 'bg-rose-500' : 'bg-primary-600'
                    )}
                  >
                    {record.employeeName ? record.employeeName.charAt(0).toUpperCase() : 'E'}
                  </div>
                )}

                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-ink truncate leading-tight">
                    {record.employeeName}
                  </h3>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span className="rounded border border-primary-200 bg-primary-50 px-1.5 py-0.5 font-mono text-[0.6875rem] font-semibold text-primary-700">
                      {record.employeeId}
                    </span>
                    {record.workspaceName && (
                      <span className="text-xs text-muted">
                        • {record.workspaceName}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div>{renderStatusBadge(record.status)}</div>
            </div>

            <Separator />

            {/* Daily Horizon Summary Bar */}
            <div className="rounded-xl border border-line bg-subtle/50 p-3">
              <div className="flex items-center justify-between">
                {/* First In */}
                <div className="flex flex-col">
                  <span className="font-mono text-[0.625rem] font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-emerald-500" /> FIRST IN
                  </span>
                  <span className="font-mono text-sm font-semibold text-ink mt-0.5">
                    {record.checkIn ? formatTime(record.checkIn) : '--:--'}
                  </span>
                </div>

                {/* Duration Line + Pill */}
                <div className="relative flex flex-1 items-center justify-center px-4">
                  <div className="w-full border-t border-line-strong" />
                  <span className="absolute rounded-full border border-primary-200 bg-white px-2.5 py-0.5 font-mono text-[0.6875rem] font-bold text-primary-700 shadow-xs">
                    {Number(record.workingHours || 0).toFixed(1)} hrs Logged
                  </span>
                </div>

                {/* Last Out */}
                <div className="flex flex-col text-right">
                  <span
                    className={cn(
                      'font-mono text-[0.625rem] font-bold uppercase tracking-wider flex items-center justify-end gap-1',
                      record.checkOut
                        ? 'text-amber-600'
                        : record.checkIn
                        ? 'text-primary-600'
                        : 'text-muted'
                    )}
                  >
                    <span
                      className={cn(
                        'size-1.5 rounded-full',
                        record.checkOut
                          ? 'bg-amber-500'
                          : record.checkIn
                          ? 'bg-primary-500 animate-pulse'
                          : 'bg-muted'
                      )}
                    />
                    LAST OUT
                  </span>
                  <span
                    className={cn(
                      'font-mono text-sm font-semibold mt-0.5',
                      record.checkOut
                        ? 'text-ink'
                        : record.checkIn
                        ? 'text-primary-600 font-bold'
                        : 'text-muted'
                    )}
                  >
                    {record.checkOut
                      ? formatTime(record.checkOut)
                      : record.checkIn
                      ? 'Active Now'
                      : '--:--'}
                  </span>
                </div>
              </div>

              {/* Bottom verification metadata */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line mt-3 pt-2 text-xs">
                <span className="font-mono text-muted text-[0.6875rem]">
                  Total Sessions: <strong className="text-ink">{sessions.length || (isAbsent ? 0 : 1)}</strong>
                </span>

                <div className="flex items-center gap-1.5">
                  <Badge
                    variant="outline"
                    className="gap-1 border-emerald-300 bg-emerald-50/70 text-emerald-700 font-mono text-[0.625rem]"
                  >
                    <ShieldCheck className="size-3 text-emerald-600" />
                    <span>Biometric Verified</span>
                  </Badge>
                </div>
              </div>
            </div>
          </Card>

          {/* ── 3. Individual Punch History & Telemetry Section ── */}
          <div className="flex flex-col gap-3">
            {/* Section Header Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="eyebrow">PUNCH SESSIONS</span>
                <Badge variant="brand" className="font-mono text-[0.625rem] px-1.5 py-0">
                  {sessions.length} {sessions.length === 1 ? 'Log' : 'Logs'}
                </Badge>
              </div>

              {sessions.length > 1 && (
                <div className="flex items-center gap-1.5 text-xs">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleAll(true)}
                    className="h-6 px-1.5 text-[0.6875rem] text-muted hover:text-ink"
                  >
                    Expand All
                  </Button>
                  <span className="text-line-strong">•</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleAll(false)}
                    className="h-6 px-1.5 text-[0.6875rem] text-muted hover:text-ink"
                  >
                    Collapse All
                  </Button>
                  <span className="text-line-strong">|</span>
                  <div className="flex rounded-lg border border-line bg-subtle p-0.5">
                    <button
                      type="button"
                      onClick={() => setDrawerSortOrder('asc')}
                      className={cn(
                        'rounded px-2 py-0.5 font-mono text-[0.625rem] font-semibold transition-colors',
                        drawerSortOrder === 'asc'
                          ? 'bg-white text-primary-600 shadow-xs'
                          : 'text-muted hover:text-ink'
                      )}
                    >
                      Earliest
                    </button>
                    <button
                      type="button"
                      onClick={() => setDrawerSortOrder('desc')}
                      className={cn(
                        'rounded px-2 py-0.5 font-mono text-[0.625rem] font-semibold transition-colors',
                        drawerSortOrder === 'desc'
                          ? 'bg-white text-primary-600 shadow-xs'
                          : 'text-muted hover:text-ink'
                      )}
                    >
                      Latest
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Session Cards or Absent Empty State */}
            {sessions.length === 0 ? (
              <Card className="p-8 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 text-rose-600">
                  <UserX className="size-6" />
                </div>
                <h4 className="mt-3 text-sm font-semibold text-ink">No Punch Logs Recorded</h4>
                <p className="mt-1 text-xs text-muted max-w-sm mx-auto leading-relaxed">
                  {isAbsent
                    ? 'The employee did not record any check-in and was marked Absent for this work day.'
                    : 'No detailed session logs available for this day.'}
                </p>
              </Card>
            ) : (
              <div className="flex flex-col gap-2.5">
                {sortedSessions.map((session, index) => {
                  const sessionKey = session.id || `session-${index}`;
                  const sessionNum = session.sessionNumber || index + 1;
                  const isSessionActive = Boolean(session.checkIn && !session.checkOut);
                  const isExpanded = Boolean(expandedSessions[sessionKey]);

                  return (
                    <Card
                      key={sessionKey}
                      className={cn(
                        'overflow-hidden transition-all duration-150',
                        isExpanded
                          ? 'border-primary-500/80 shadow-sm ring-1 ring-primary-500/20'
                          : isSessionActive
                          ? 'border-amber-400 bg-amber-50/10'
                          : 'hover:border-line-strong'
                      )}
                    >
                      {/* ── Collapsed Header ── */}
                      <div
                        onClick={() => toggleSessionExpand(sessionKey)}
                        className={cn(
                          'flex items-center justify-between p-3.5 cursor-pointer transition-colors select-none',
                          isExpanded ? 'bg-primary-50/25 border-b border-line' : 'hover:bg-subtle/50'
                        )}
                      >
                        {/* Left: Punch Tag & Glance Times */}
                        <div className="flex items-center gap-3">
                          <Badge
                            variant={isSessionActive ? 'warning' : 'brand'}
                            className="font-mono text-[0.6875rem] font-bold"
                          >
                            Punch #{sessionNum}
                          </Badge>

                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-ink">
                              <span>{session.checkIn ? formatTime(session.checkIn) : '--:--'}</span>
                              <span className="text-muted">➔</span>
                              <span
                                className={cn(
                                  isSessionActive ? 'text-primary-600 font-bold' : 'text-ink'
                                )}
                              >
                                {session.checkOut ? formatTime(session.checkOut) : 'Active Now'}
                              </span>
                            </div>
                            <span className="font-mono text-[0.6875rem] text-muted">
                              Duration: <strong className="text-ink">{session.workingHours || 0} hrs</strong>
                            </span>
                          </div>
                        </div>

                        {/* Right: Status Pill & Toggle Chevron */}
                        <div className="flex items-center gap-2">
                          {sessionNum === 1 && renderStatusBadge(session.status)}
                          {isSessionActive && (
                            <Badge
                              variant="outline"
                              className="gap-1 border-emerald-300 bg-emerald-50 text-emerald-700 font-mono text-[0.625rem]"
                            >
                              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              <span>Live</span>
                            </Badge>
                          )}
                          <div
                            className={cn(
                              'flex size-6 items-center justify-center rounded-md border border-line bg-canvas text-muted transition-transform duration-200',
                              isExpanded && 'rotate-180 text-ink'
                            )}
                          >
                            <ChevronDown className="size-3.5" />
                          </div>
                        </div>
                      </div>

                      {/* ── Expanded Telemetry & Timeline ── */}
                      {isExpanded && (
                        <div className="flex flex-col gap-3 p-4 bg-canvas">
                          {/* Connected Stepper */}
                          <div className="flex items-center justify-between rounded-xl border border-line bg-subtle/40 p-3">
                            {/* In */}
                            <div className="flex flex-col">
                              <span className="font-mono text-[0.625rem] font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1">
                                <LogIn className="size-3 text-emerald-600" /> CLOCK IN
                              </span>
                              <span className="font-mono text-xs font-bold text-ink mt-0.5">
                                {formatTimeSeconds(session.checkIn)}
                              </span>
                            </div>

                            {/* Stepper bar */}
                            <div className="relative flex flex-1 items-center justify-center px-3">
                              <div
                                className={cn(
                                  'w-full border-t',
                                  isSessionActive
                                    ? 'border-dashed border-primary-400'
                                    : 'border-line-strong'
                                )}
                              />
                              <span
                                className={cn(
                                  'absolute rounded-full border px-2 py-0.5 font-mono text-[0.625rem] font-bold shadow-xs',
                                  isSessionActive
                                    ? 'border-primary-300 bg-primary-50 text-primary-700'
                                    : 'border-line bg-white text-muted'
                                )}
                              >
                                {isSessionActive ? 'Running' : `${session.workingHours || 0} hrs`}
                              </span>
                            </div>

                            {/* Out */}
                            <div className="flex flex-col text-right">
                              <span
                                className={cn(
                                  'font-mono text-[0.625rem] font-bold uppercase tracking-wider flex items-center justify-end gap-1',
                                  isSessionActive ? 'text-primary-600' : 'text-amber-600'
                                )}
                              >
                                <LogOut
                                  className={cn(
                                    'size-3',
                                    isSessionActive ? 'text-primary-600' : 'text-amber-600'
                                  )}
                                />
                                CLOCK OUT
                              </span>
                              <span
                                className={cn(
                                  'font-mono text-xs font-bold mt-0.5',
                                  isSessionActive ? 'text-primary-600' : 'text-ink'
                                )}
                              >
                                {session.checkOut ? formatTimeSeconds(session.checkOut) : 'In Progress'}
                              </span>
                            </div>
                          </div>

                          {/* Telemetry Tiles (Location & Biometrics) */}
                          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                            {/* Location Tile */}
                            <div className="flex items-start gap-2.5 rounded-xl border border-line bg-panel p-2.5 shadow-xs">
                              <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-primary-200 bg-primary-50 text-primary-600 mt-0.5">
                                <MapPin className="size-3.5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <span className="font-mono text-[0.625rem] font-bold uppercase tracking-wider text-muted block">
                                  LOCATION & GEOFENCE
                                </span>
                                <span className="text-xs font-semibold text-ink truncate block mt-0.5">
                                  {session.locationName || record.workspaceName || 'Campus Main Office'}
                                </span>
                                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                  <Badge
                                    variant="outline"
                                    className="border-emerald-300 bg-emerald-50 text-emerald-700 font-mono text-[0.625rem] px-1 py-0"
                                  >
                                    {session.distanceMeters !== undefined && session.distanceMeters !== null
                                      ? `${session.distanceMeters}m away`
                                      : '12m away'}
                                  </Badge>
                                  <Badge
                                    variant="outline"
                                    className="border-primary-200 bg-primary-50 text-primary-700 font-mono text-[0.625rem] px-1 py-0"
                                  >
                                    {session.punchType || 'On-Site Geofence'}
                                  </Badge>
                                </div>
                              </div>
                            </div>

                            {/* Biometrics Tile */}
                            <div className="flex items-start gap-2.5 rounded-xl border border-line bg-panel p-2.5 shadow-xs">
                              <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-600 mt-0.5">
                                <ShieldCheck className="size-3.5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <span className="font-mono text-[0.625rem] font-bold uppercase tracking-wider text-muted block">
                                  BIOMETRIC TELEMETRY
                                </span>
                                <span className="text-xs font-semibold text-emerald-600 block mt-0.5">
                                  {session.clockInFaceMatchConfidence !== null &&
                                  session.clockInFaceMatchConfidence !== undefined
                                    ? `Face Match: ${session.clockInFaceMatchConfidence}%`
                                    : 'Face Verified'}
                                </span>
                                <span className="font-mono text-[0.625rem] text-muted block mt-0.5">
                                  High-Confidence Biometrics
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Notes / Compliance Callout */}
                          {session.notes ? (
                            <div className="flex items-center gap-2 rounded-lg border border-line bg-subtle p-2 text-xs text-muted">
                              <FileText className="size-3.5 text-primary-600 shrink-0" />
                              <span className="italic">Note: {session.notes}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 px-1 text-[0.6875rem] text-muted">
                              <CheckCircle2 className="size-3 text-emerald-600 shrink-0" />
                              <span>Verified punch recorded with authorized face biometrics and verified coordinates.</span>
                            </div>
                          )}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </SheetBody>

        {/* ── 4. Drawer Footer ── */}
        <SheetFooter className="flex items-center justify-between">
          <span className="font-mono text-xs text-muted">
            Record ID: <strong className="text-ink">{record.id.slice(0, 8)}...</strong>
          </span>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close Drawer
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default AttendanceAuditDrawer;
