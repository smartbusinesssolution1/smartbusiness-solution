import React, { useState, useEffect, useMemo } from 'react';
import dayjs from 'dayjs';
import { Clock, Coffee, LogOut, Check, MapPin, ShieldCheck, Calendar } from 'lucide-react';

export interface WorkspaceShowcaseProps {
  companyName?: string;
  adminName?: string;
  startTime?: string; // HH:mm format, e.g. "09:00"
  endTime?: string;   // HH:mm format, e.g. "17:00"
}

interface StageData {
  employee: string;
  initials: string;
  role: string;
  badge: string;
  badgeClass: string;
  duration: string;
  location: string;
  biometric: string;
  floatingMsg: string;
}

const STAGES: StageData[] = [
  {
    employee: 'Sarah Jenkins',
    initials: 'SJ',
    role: 'Operations Team Lead · Field Logistics',
    badge: 'Clocked In · On Time',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    duration: '07h 42m',
    location: 'On-Site (Within 14m)',
    biometric: 'Face ID Verified',
    floatingMsg: 'Shift Verified & On Record',
  },
  {
    employee: 'David Kim',
    initials: 'DK',
    role: 'Warehouse Supervisor · Section 4',
    badge: 'On Meal Break',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    duration: '04h 15m (Paused)',
    location: 'Cafeteria Beacon',
    biometric: 'Break Logged',
    floatingMsg: 'Paid Rest Break Logged · 45m',
  },
  {
    employee: 'Elena Rostova',
    initials: 'ER',
    role: 'Logistics Specialist · Terminal B',
    badge: 'Clocked Out · Complete',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    duration: '08h 15m Total',
    location: 'Exit Gate 2 (5m)',
    biometric: 'Exit Verified',
    floatingMsg: 'Daily Shift Logged · 8.25 Hours',
  },
  {
    employee: 'Marcus Vance',
    initials: 'MV',
    role: 'Fleet Dispatcher · Central Hub',
    badge: 'Timesheet Approved',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
    duration: '08h 15m (Locked)',
    location: 'Manager Sign-off',
    biometric: 'Payroll Synced',
    floatingMsg: 'Approved & Ready for Payroll',
  },
];

const STEP_DEFINITIONS = [
  { label: 'Clock In', detail: '09:00 AM · Verified', icon: Clock },
  { label: 'Meal Break', detail: '45m · Rest logged', icon: Coffee },
  { label: 'Clock Out', detail: '05:00 PM · 8h total', icon: LogOut },
  { label: 'Approved', detail: 'Payroll sync ready', icon: Check },
];

function format12h(timeStr?: string): string {
  if (!timeStr || !timeStr.includes(':')) return '09:00 AM';
  const [h, m] = timeStr.split(':');
  let hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12 || 12;
  return `${String(hour).padStart(2, '0')}:${m} ${ampm}`;
}

export const WorkspaceShowcase: React.FC<WorkspaceShowcaseProps> = ({
  companyName = 'Apex Global Logistics',
  adminName: _adminName,
  startTime = '09:00',
  endTime = '17:00',
}) => {
  const [currentStage, setCurrentStage] = useState(0);
  const [currentTime, setCurrentTime] = useState(dayjs().format('hh:mm:ss A'));
  const [currentDate, setCurrentDate] = useState(dayjs().format('dddd, MMM D'));

  // Live ticking clock
  useEffect(() => {
    const clockTimer = setInterval(() => {
      const now = dayjs();
      setCurrentTime(now.format('hh:mm:ss A'));
      setCurrentDate(now.format('dddd, MMM D'));
    }, 1000);
    return () => clearInterval(clockTimer);
  }, []);

  // Auto-cycling workflow showcase
  useEffect(() => {
    const stageTimer = setInterval(() => {
      setCurrentStage((prev) => (prev + 1) % STAGES.length);
    }, 2800);
    return () => clearInterval(stageTimer);
  }, []);

  const activeStageData = STAGES[currentStage];

  // Derived organization display
  const orgTitle = useMemo(() => {
    const trimmed = companyName?.trim();
    return trimmed ? `${trimmed.toUpperCase()} · REGIONAL HQ` : 'APEX GLOBAL LOGISTICS · REGIONAL HQ';
  }, [companyName]);

  // Derived subdomain slug
  const orgSlug = useMemo(() => {
    const trimmed = companyName?.trim() || 'apex-global-logistics';
    return (
      trimmed
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'workspace'
    );
  }, [companyName]);

  // Formatted shift range
  const formattedShiftRange = useMemo(() => {
    return `${format12h(startTime)} – ${format12h(endTime)}`;
  }, [startTime, endTime]);

  return (
    <section
      aria-label="Workspace Live Blueprint Showcase"
      className="relative hidden lg:flex flex-col justify-center overflow-hidden bg-[#F8FAFC] px-8 sm:px-12 lg:px-16 py-12 select-none"
    >
      {/* Concentric Dashed Circles SVG (Matches LoginPage AttendanceShowcase) */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full text-slate-300/70"
        aria-hidden="true"
      >
        <circle cx="50%" cy="48%" r="130" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 6" />
        <circle cx="50%" cy="48%" r="230" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 6" />
        <circle cx="50%" cy="48%" r="330" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 6" />
        <circle cx="50%" cy="48%" r="430" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 6" />
        <circle cx="50%" cy="48%" r="530" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 6" />
      </svg>

      {/* Subtle Dot Grid Mask */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
        style={{
          backgroundImage: 'radial-gradient(rgba(148, 163, 184, 0.28) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      />

      {/* Showcase Content Container */}
      <div className="relative z-10 mx-auto flex w-full max-w-xl flex-col gap-6">
        
        {/* Eyebrow & Headline */}
        <div className="flex flex-col gap-2">
          <span className="font-mono text-xs font-bold tracking-wider text-[#2563EB] uppercase flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#2563EB] animate-ping" />
            LIVE WORKSPACE ATTENDANCE ENGINE
          </span>
          <h2 className="text-[1.65rem] sm:text-[1.95rem] leading-tight font-bold tracking-tight text-slate-900 text-balance">
            From the morning punch-in to payday, every shift, break, and geofence verified live.
          </h2>
        </div>

        {/* ================================================================= */}
        {/* ATTENDANCE TIMECARD WIDGET (Dynamic Real-Time Attendance)         */}
        {/* ================================================================= */}
        <div className="relative">
          <div
            className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-7 transition-all duration-300"
            style={{
              boxShadow: '0 20px 50px -15px rgba(15, 23, 42, 0.10), 0 0 0 1px rgba(226, 232, 240, 0.9)',
            }}
          >
            {/* Top Row: Organization (Live Synced) & Live Clock */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold tracking-wide text-slate-900 truncate max-w-[280px]">
                    {orgTitle}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Geofence Active · 150m secure boundary
                </p>
              </div>

              {/* Live Clock Ticker */}
              <div className="text-right">
                <div className="font-mono text-sm font-bold tracking-tight text-slate-900">
                  {currentTime}
                </div>
                <div className="text-[10px] tracking-wider text-slate-400 uppercase">
                  {currentDate}
                </div>
              </div>
            </div>

            {/* Employee Active Shift Row (Live Updating) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-5">
              {/* Employee Info */}
              <div className="flex items-center gap-3.5">
                <div className="relative">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-tr from-[#2563EB] to-sky-400 text-sm font-bold text-white shadow-md transition-all duration-300">
                    {activeStageData.initials}
                  </div>
                  <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">{activeStageData.employee}</h3>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-all duration-200 ${activeStageData.badgeClass}`}
                    >
                      {activeStageData.badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{activeStageData.role}</p>
                </div>
              </div>

              {/* Shift Duration Metric */}
              <div className="rounded-xl border border-slate-200/80 bg-slate-50 px-4 py-2 text-center sm:text-right">
                <span className="block text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                  Time on Shift
                </span>
                <span className="font-mono text-lg font-bold text-[#2563EB]">
                  {activeStageData.duration}
                </span>
              </div>
            </div>

            {/* Verification Chips Row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 border-t border-slate-100 pt-2 text-xs">
              <div className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/80 p-2">
                <MapPin className="h-4 w-4 shrink-0 text-emerald-600" />
                <div className="truncate">
                  <span className="block text-[10px] text-slate-400">Location</span>
                  <span className="font-semibold text-slate-700 truncate">{activeStageData.location}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/80 p-2">
                <ShieldCheck className="h-4 w-4 shrink-0 text-[#2563EB]" />
                <div className="truncate">
                  <span className="block text-[10px] text-slate-400">Biometrics</span>
                  <span className="font-semibold text-slate-700 truncate">{activeStageData.biometric}</span>
                </div>
              </div>

              <div className="col-span-2 sm:col-span-1 flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/80 p-2">
                <Calendar className="h-4 w-4 shrink-0 text-[#2563EB]" />
                <div className="truncate">
                  <span className="block text-[10px] text-slate-400">Roster Shift</span>
                  <span className="font-semibold text-slate-700 font-mono text-[11px] truncate">
                    {formattedShiftRange}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Floating Pop Badge */}
          <div
            className="absolute -top-3.5 -right-3.5 flex items-center gap-1.5 rounded-full bg-[#2563EB] px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg transition-all duration-300"
            style={{
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
            }}
          >
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
            <span>{activeStageData.floatingMsg}</span>
          </div>
        </div>

        {/* ================================================================= */}
        {/* 4 WORKFLOW STAGES (Interactive Lifecycle Cards)                   */}
        {/* ================================================================= */}
        <ol className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {STEP_DEFINITIONS.map((step, idx) => {
            const Icon = step.icon;
            const isReached = idx <= currentStage;
            const isExact = idx === currentStage;

            return (
              <li
                key={step.label}
                onClick={() => setCurrentStage(idx)}
                className={`cursor-pointer flex flex-col gap-2 rounded-xl border p-3.5 transition-all duration-200 ${
                  isExact
                    ? 'border-[#2563EB] bg-white ring-2 ring-[#2563EB]/20 shadow-md'
                    : isReached
                    ? 'border-[#BFDBFE] bg-white/95'
                    : 'border-slate-200 bg-white/70 opacity-70 hover:opacity-100'
                }`}
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors duration-200 ${
                    isExact
                      ? 'bg-[#2563EB] text-white shadow-sm'
                      : isReached
                      ? 'bg-blue-100 text-[#2563EB]'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
                </span>
                <span className="text-[13px] font-bold text-slate-900">{step.label}</span>
                <span className="text-[11px] leading-tight text-slate-500">{step.detail}</span>
              </li>
            );
          })}
        </ol>

        {/* Subdomain Slug and SLA Tag */}
        <div className="flex items-center justify-between text-xs text-slate-500 px-1 pt-1">
          <span className="font-mono text-[11px]">
            Target Workspace:{' '}
            <strong className="text-[#2563EB]">{orgSlug}</strong>.smartbusiness.app
          </span>
          <span className="text-[11px] font-medium text-slate-400">
            SOC 2 · 256-bit TLS · 99.99% SLA
          </span>
        </div>

      </div>
    </section>
  );
};

export default WorkspaceShowcase;