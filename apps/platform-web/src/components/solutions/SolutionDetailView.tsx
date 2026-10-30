import React, { useState } from 'react';
import { SolutionType } from '../../types';
import {
  Printer,
  FileSignature,
  RefreshCw,
  MapPin,
  Calendar,
  ScanFace,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Settings,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  X,
  Sparkles,
  ExternalLink,
  ChevronRight,
  ArrowLeft
} from 'lucide-react';

interface SolutionDetailViewProps {
  solutionType: SolutionType;
  onStartTrial: () => void;
  onNavigateHome: () => void;
  onSwitchSolution?: (type: SolutionType) => void;
}

export const SolutionDetailView: React.FC<SolutionDetailViewProps> = ({
  solutionType,
  onStartTrial,
  onNavigateHome,
  onSwitchSolution,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [activeModalFeature, setActiveModalFeature] = useState<{
    id: string;
    title: string;
    description: string;
    specs: string[];
    badge1: string;
    badge2: string;
  } | null>(null);
  const [showDemoModal, setShowDemoModal] = useState(false);

  const isCheckPrinting = solutionType === 'check-printing';

  // Config data for both pages within this single reusable component
  const content = isCheckPrinting
    ? {
        heroBadge: 'CORE SERVICE 01',
        titleLine1: 'Check Printing Solutions',
        titleLine2: 'Built For Your Workflow.',
        subtitle:
          'Our checks have everything in order for you, just ordering checks! Seamless processing crafted for scale with ANSI-standard magnetic encoding and same-day carrier fulfillment.',
        ctaPrimary: 'Start Free 14–Day Trial',
        ctaSecondary: 'Watch 3–Min Demo',
        videoSectionTitle: 'See How Check Printing Works',
        videoSectionSubtitle:
          'Experience our high-speed, secure batch generation from initial invoice upload to final magnetic check print and carrier handoff.',
        videoTitle:
          'Apex Check Printing: Automated End-to-End Walkthrough & Bank Reconciliation (Full Demo)',
        platformTag: 'APEX AUTOMATION PLATFORM v4.2 // MICR-ANSI',
        batchCode: 'Batch #9042-US-PAYROLL-EXEC',
        badgePrimary: 'CHECKS VALIDATED (184/184)',
        badgeSecondary: 'ANSI X9 PASS',
        encryptionText: 'ENCRYPTION: RSA 4096-BIT + HARDWARE SECURITY MODULE',
        dispatchText: 'ESTIMATED DISPATCH: TODAY, 4:30 PM CST (FEDEX 2-DAY)',
        featuresHeaderLine1: 'Enterprise Check Printing',
        featuresHeaderLine2: 'engineered to eliminate errors.',
        featuresSubtitle:
          'Zero hardware to purchase, no MICR toner maintenance, and absolute clearing compliance guaranteed with every check run.',
        features: [
          {
            id: 'micr',
            icon: Printer,
            iconColor: 'bg-blue-600',
            bgCurve: 'bg-blue-50/70',
            badge1: 'CORE SERVICE 01',
            badge2: 'ANSI X9.27',
            title: 'High-Resolution MICR Magnetic Encoding',
            description:
              'Tamper-proof security check stock formulated with reactive chemical stains, fluorescent fibers, and precise iron oxide magnetic toner (MICR) strictly conforming to ANSI X9 and Federal Reserve clearing mandates.',
            actionText: 'Explore Print Fulfillment',
            specs: [
              'ANSI X9.27 and X9.100-181 Certified MICR magnetic toner formulation',
              'High-grade 24lb chemically sensitized security paper',
              'Thermochromic heat-sensitive ink icon indicator',
              'Micro-printed borders preventing photocopier reproduction',
              'Instant Federal Reserve Clearinghouse pass guarantee',
            ],
          },
          {
            id: 'signatures',
            icon: FileSignature,
            iconColor: 'bg-cyan-600',
            bgCurve: 'bg-cyan-50/70',
            badge1: 'CORE SERVICE 02',
            badge2: 'Multi-Signatory Security',
            title: 'Batch Check Printing & E-Signatures',
            description:
              'Upload standard payroll or vendor CSVs/APIs, enforce dual-officer approval thresholds, and sign dynamically using encrypted signature keys backed by indelible audit logs and IP verification records.',
            actionText: 'Explore E-Signature Governance',
            specs: [
              'Dual-signatory approval workflows for payouts exceeding customizable thresholds',
              'Hardware Security Module (HSM) protected PKI signature certificates',
              'Detailed tamper-evident audit trails with IP & geolocation stamps',
              'Direct CSV, XLSX, and REST API automated batch scheduling',
              'Automatic check voiding and positive pay feed generation',
            ],
          },
          {
            id: 'reconciliation',
            icon: RefreshCw,
            iconColor: 'bg-purple-600',
            bgCurve: 'bg-purple-50/70',
            badge1: 'CORE SERVICE 03',
            badge2: 'Two-Way Ledger Sync',
            title: 'Instant Ledger & Bank Reconciliation',
            description:
              'Automated two-way ledger synchronization with QuickBooks, NetSuite, Xero, Sage Intacct, and top treasury tier-1 banks. Check numbers and positive pay files are synced automatically without human intervention.',
            actionText: 'Explore ERP Integrations',
            specs: [
              'Real-time webhooks with QuickBooks Online, Desktop & NetSuite ERP',
              'Automatic Positive Pay transmission formatted for all US & Canadian banks',
              'Instant reconciliation of cleared vs. outstanding check batches',
              'Bank-grade 256-bit AES encryption & SOC2 Type II compliance',
              'Multi-account support for distinct payroll, operating & vendor ledgers',
            ],
          },
        ],
      }
    : {
        heroBadge: 'CORE SERVICE 02',
        titleLine1: 'Real-time tracking, geofenced',
        titleLine2: 'shifts & precision attendance.',
        subtitle:
          'Instant payroll sync to eliminate missed clock-outs and manual logs. Built for frontline teams, distributed offices, and scalable enterprises.',
        ctaPrimary: 'Start Free 14–Day Trial',
        ctaSecondary: 'Watch On-Demand Demo',
        videoSectionTitle: 'See Clock In / Clock Out in Action',
        videoSectionSubtitle:
          'Experience how frontline mobile GPS verification directly reconciles with enterprise payroll.',
        videoTitle:
          'Apex Attendance & Shift Verification: Real-Time Mobile & Payroll Sync Demo',
        platformTag: 'APEX ATTENDANCE PLATFORM v4.2 // GEO-GPS',
        batchCode: 'Shift Batch #4109-EAST-REGIONAL-OPS',
        badgePrimary: 'PUNCHES VERIFIED (342/342)',
        badgeSecondary: 'GEOFENCE ACTIVE',
        encryptionText: 'GPS ACCURACY: ±3 METERS + HARDWARE BIOMETRIC ATTESTATION',
        dispatchText: 'PAYROLL RECONCILIATION: AUTOMATIC SYNC AT MIDNIGHT EST',
        featuresHeaderLine1: 'Engineered for',
        featuresHeaderLine2: 'absolute accountability.',
        featuresSubtitle:
          'Every punch is validated using high-resolution GPS coordinates, biometric selfies, and attendance logs.',
        features: [
          {
            id: 'geofence',
            icon: MapPin,
            iconColor: 'bg-blue-600',
            bgCurve: 'bg-blue-50/70',
            badge1: 'CORE SERVICE 01',
            badge2: 'RADIUS: 50M – 5,000M',
            title: 'Geofenced Shifts & Location Verification',
            description:
              'Custom geofence perimeters around worksites, job sites, and client offices. Staff receive instant automated push notifications to clock in only when they enter physical job boundaries.',
            actionText: 'Explore Geofencing',
            specs: [
              'Precision polygon or radial perimeter fences from 50m to 5,000m',
              'Automated clock-in/out prompts upon geofence entry and exit',
              'Offline punch caching with cryptographic timestamp validation',
              'Anti-spoofing GPS mock-location detection algorithms',
              'Seamless integration with multi-location enterprise sites',
            ],
          },
          {
            id: 'attendance',
            icon: Calendar,
            iconColor: 'bg-cyan-600',
            bgCurve: 'bg-cyan-50/70',
            badge1: 'CORE SERVICE 02',
            badge2: 'REAL-TIME ATTENDANCE',
            title: 'Smart Attendance Logs & Records',
            description:
              'Automatically capture and maintain accurate attendance records with GPS verification, biometric selfies, and real-time punch logs. Keep every attendance entry organized, secure, and easily accessible without manual record-keeping.',
            actionText: 'Explore Attendance Logs',
            specs: [
              'Live shift board displaying present, absent, on-break, and late personnel',
              'Overtime calculation based on state and federal labor regulations',
              'One-click supervisor dispute resolution and timesheet signoff',
              'Custom break tracking (paid rest vs. unpaid meal compliance)',
              'Exportable audit-ready timesheets in CSV, PDF, and payroll formats',
            ],
          },
          {
            id: 'biometric',
            icon: ScanFace,
            iconColor: 'bg-purple-600',
            bgCurve: 'bg-purple-50/70',
            badge1: 'CORE SERVICE 03',
            badge2: 'IDENTITY CHECK COMPLETE',
            title: 'Secure Biometric Verification',
            description:
              'Verify every attendance punch with secure biometric selfies and advanced facial recognition. Ensure each check-in and check-out is authentic, accurate, and linked to the right employee.',
            actionText: 'Explore Biometric Verification',
            specs: [
              'Facial liveness verification to eliminate buddy-punching completely',
              'On-device AI matching with privacy-preserving vector embeddings',
              'Works seamlessly across iOS, Android, and shared kiosk tablets',
              'Zero storage of raw photographic PII beyond authorized audit window',
              'Compliance with BIPA and state biometric privacy standards',
            ],
          },
        ],
      };

  return (
    <div className="bg-white text-slate-900 min-h-screen">
      {/* Breadcrumb & Switcher Bar */}
      <div className="border-b border-slate-100 bg-slate-50/60 py-3 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-xs sm:text-sm">
          <button
            onClick={onNavigateHome}
            className="inline-flex items-center gap-1.5 text-slate-600 hover:text-indigo-600 font-medium transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 hidden sm:inline">Switch view:</span>
            <button
              onClick={() => onSwitchSolution?.('check-printing')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                isCheckPrinting
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
              }`}
            >
              Check Printing
            </button>
            <button
              onClick={() => onSwitchSolution?.('clock-in-clock-out')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                !isCheckPrinting
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
              }`}
            >
              Clock In Clock Out
            </button>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <section className="pt-12 sm:pt-16 pb-12 sm:pb-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center">
        {/* Main Title matching Figma Screenshot Typography */}
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.15]">
          <span>{content.titleLine1}</span>{' '}
          <span className="font-serif italic font-normal text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-blue-600">
            {content.titleLine2}
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mt-6 text-sm sm:text-base lg:text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed">
          {content.subtitle}
        </p>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          <button
            onClick={onStartTrial}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm transition-all shadow-md shadow-blue-500/20 cursor-pointer"
          >
            <span>{content.ctaPrimary}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowDemoModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 font-medium text-sm border border-slate-200/90 shadow-xs transition-all cursor-pointer"
          >
            <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
              <Play className="w-3 h-3 fill-current ml-0.5" />
            </span>
            <span>{content.ctaSecondary}</span>
          </button>
        </div>
      </section>

      {/* Video / Interactive Demo Section */}
      <section className="py-8 sm:py-12 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {content.videoSectionTitle}
          </h2>
          <p className="mt-2.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
            {content.videoSectionSubtitle}
          </p>
        </div>

        {/* Video Player Frame matching macOS dark window styling */}
        <div className="rounded-2xl border border-slate-800 bg-[#0B132B] shadow-2xl overflow-hidden transition-all">
          {/* Top Window Bar */}
          <div className="px-4 py-3 bg-[#080E20] border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500/90 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-500/90 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/90 inline-block" />
            </div>

            <div className="text-[11px] sm:text-xs text-slate-300 font-medium truncate max-w-md px-2">
              {content.videoTitle}
            </div>

            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-red-500 text-white animate-pulse">
              LIVE RECORDING
            </span>
          </div>

          {/* Player Stage */}
          <div className="p-4 sm:p-8 bg-gradient-to-b from-[#0B132B] via-[#0D1836] to-[#0A1024] relative select-none">
            {/* Top Stats Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-slate-800/80">
              <div>
                <div className="text-[10px] tracking-wider font-mono text-cyan-400 font-semibold uppercase">
                  {content.platformTag}
                </div>
                <div className="text-base sm:text-lg font-bold text-white tracking-wide mt-0.5">
                  {content.batchCode}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-[10px] font-bold text-emerald-400 bg-emerald-950/70 border border-emerald-800/50">
                  {content.badgePrimary}
                </span>
                <span className="px-3 py-1 rounded-full text-[10px] font-bold text-cyan-300 bg-cyan-950/70 border border-cyan-800/50">
                  {content.badgeSecondary}
                </span>
              </div>
            </div>

            {/* Center Check & Verification Simulation Box */}
            <div className="my-8 sm:my-10 relative flex justify-center items-center">
              {/* Check Preview Card */}
              <div className="w-full max-w-xl bg-gradient-to-br from-slate-50 to-white text-slate-900 rounded-xl p-5 sm:p-6 shadow-2xl border border-slate-200 font-mono text-xs relative overflow-hidden group">
                {/* Watermark subtle logo */}
                <div className="absolute right-4 bottom-8 text-[60px] font-serif font-black text-slate-100/70 select-none pointer-events-none">
                  CHECK
                </div>

                <div className="flex justify-between items-start border-b border-slate-200/80 pb-3 mb-4">
                  <div>
                    <div className="font-bold text-slate-900 text-xs sm:text-sm tracking-wide">
                      {isCheckPrinting ? 'NORTHSTAR LOGISTICS CORP.' : 'METRO OPERATIONS CORP.'}
                    </div>
                    <div className="text-[10px] text-slate-500 font-sans mt-0.5">
                      100 Enterprise Blvd, Suite 400 • Austin, TX 78701
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">
                      {isCheckPrinting ? 'CHECK NO:' : 'SHIFT ID:'}
                    </div>
                    <div className="font-bold text-slate-900 text-xs">
                      {isCheckPrinting ? '0048921' : 'SH-904218'}
                    </div>
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span className="text-[10px] text-slate-500 font-sans">
                      {isCheckPrinting ? 'PAY TO THE ORDER OF:' : 'EMPLOYEE ATTENDANCE:'}
                    </span>
                    <span className="font-bold text-slate-900 font-sans text-xs sm:text-sm">
                      {isCheckPrinting ? 'Vanguard Fleet Services LLC' : 'Marcus Vance (Sr. Operations)'}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pt-2 border-t border-dashed border-slate-200">
                    <span className="text-[10px] text-slate-500 font-sans">
                      {isCheckPrinting ? 'AUTHORIZED AMOUNT:' : 'VERIFIED LOCATION:'}
                    </span>
                    <span className="font-bold text-blue-600 text-base sm:text-lg">
                      {isCheckPrinting ? '$24,850.00' : 'Austin Worksites Hub (Radius: 35m)'}
                    </span>
                  </div>
                </div>

                {/* MICR Bar or GPS Bar */}
                <div className="pt-3 border-t border-slate-200 text-slate-700 text-center tracking-widest text-[11px] sm:text-xs font-mono select-none bg-slate-50/80 rounded px-2 py-1.5">
                  {isCheckPrinting ? (
                    '⑆122000496⑆ 048921⑈ ⑈000129384719⑈'
                  ) : (
                    'LAT: 30.2672° N  |  LON: -97.7431° W  |  PUNCH IN: 08:00:14 AM'
                  )}
                </div>

                {/* Interactive Play Button overlay over check */}
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="absolute inset-0 flex items-center justify-center bg-slate-950/20 backdrop-blur-[1px] hover:backdrop-blur-none transition-all cursor-pointer group-hover:scale-100"
                  aria-label="Toggle demo playback"
                >
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-2xl shadow-blue-500/50 transform group-hover:scale-110 transition-transform">
                    {isPlaying ? (
                      <Pause className="w-6 h-6 fill-current" />
                    ) : (
                      <Play className="w-6 h-6 fill-current ml-1" />
                    )}
                  </div>
                </button>
              </div>
            </div>

            {/* Bottom Status Information */}
            <div className="pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between text-[10px] font-mono text-slate-400 gap-2">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                <span>{content.encryptionText}</span>
              </div>
              <div className="text-cyan-400 font-semibold">
                {content.dispatchText}
              </div>
            </div>

            {/* Video Controls Bar */}
            <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center gap-3 text-slate-300 text-xs">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="hover:text-white transition-colors cursor-pointer"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>

              <button
                onClick={() => setIsMuted(!isMuted)}
                className="hover:text-white transition-colors cursor-pointer"
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>

              {/* Scrubber Progress Bar */}
              <div className="flex-1 bg-slate-800 h-1.5 rounded-full overflow-hidden relative cursor-pointer group">
                <div
                  className={`bg-blue-500 h-full rounded-full transition-all duration-300 ${
                    isPlaying ? 'w-[68%]' : 'w-[32%]'
                  }`}
                />
              </div>

              <span className="font-mono text-[11px] text-slate-400">
                {isPlaying ? '08:14 / 12:15' : '03:42 / 12:15'}
              </span>

              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300">
                1080p HD
              </span>

              <button
                onClick={() => setActiveModalFeature(content.features[0])}
                className="hover:text-white transition-colors cursor-pointer"
                aria-label="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>

              <button
                onClick={() => setShowDemoModal(true)}
                className="hover:text-white transition-colors cursor-pointer"
                aria-label="Fullscreen"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Pillars Section matching Figma design */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            <span>{content.featuresHeaderLine1}</span>{' '}
            <span className="font-serif italic font-normal text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-blue-600">
              {content.featuresHeaderLine2}
            </span>
          </h2>
          <p className="mt-4 text-sm sm:text-base text-slate-600 leading-relaxed">
            {content.featuresSubtitle}
          </p>
        </div>

        {/* 3 Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {content.features.map((feat) => {
            const Icon = feat.icon;
            return (
              <div
                key={feat.id}
                className="group relative bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-7 shadow-xs hover:shadow-lg hover:border-indigo-100 transition-all flex flex-col justify-between overflow-hidden"
              >
                {/* Decorative curved corner background accent */}
                <div
                  className={`absolute top-0 right-0 w-32 h-32 rounded-bl-full pointer-events-none transition-all group-hover:scale-110 ${feat.bgCurve}`}
                />

                <div className="relative z-10">
                  {/* Top Icon */}
                  <div
                    className={`w-12 h-12 rounded-xl text-white flex items-center justify-center shadow-sm mb-5 transition-transform group-hover:scale-105 ${feat.iconColor}`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>

                  {/* Badges */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold text-indigo-700 bg-indigo-50 uppercase tracking-wider">
                      {feat.badge1}
                    </span>
                    <span className="text-[11px] font-medium text-slate-500">
                      {feat.badge2}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-3 group-hover:text-indigo-600 transition-colors">
                    {feat.title}
                  </h3>

                  {/* Description */}
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6">
                    {feat.description}
                  </p>
                </div>

                {/* Bottom Link Action */}
                <div className="relative z-10 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => setActiveModalFeature(feat)}
                    className="inline-flex items-center text-xs sm:text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors cursor-pointer group-hover:translate-x-1 duration-200"
                  >
                    <span>{feat.actionText}</span>
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom CTA Banner */}
        <div className="mt-16 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-8 sm:p-12 text-white text-center relative overflow-hidden shadow-xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.2),transparent)]" />
          <div className="relative z-10 max-w-2xl mx-auto space-y-4">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Instant Deployment
            </span>
            <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Ready to automate your {isCheckPrinting ? 'check printing' : 'employee attendance'}?
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Join over 7,100 companies streamlining operations with guaranteed compliance and zero hardware overhead.
            </p>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-4">
              <button
                onClick={onStartTrial}
                className="px-6 py-3 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-md cursor-pointer inline-flex items-center gap-2"
              >
                <span>{content.ctaPrimary}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => onSwitchSolution?.(isCheckPrinting ? 'clock-in-clock-out' : 'check-printing')}
                className="px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 text-white font-medium text-sm transition-all border border-white/20 cursor-pointer"
              >
                Explore {isCheckPrinting ? 'Clock In / Clock Out' : 'Check Printing'} →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Deep-Dive Modal */}
      {activeModalFeature && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 relative">
            <button
              onClick={() => setActiveModalFeature(null)}
              className="absolute top-5 right-5 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Close feature details"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold text-indigo-700 bg-indigo-50 uppercase tracking-wider">
                {activeModalFeature.badge1}
              </span>
              <span className="text-xs font-medium text-slate-500">
                {activeModalFeature.badge2}
              </span>
            </div>

            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mb-3">
              {activeModalFeature.title}
            </h3>

            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              {activeModalFeature.description}
            </p>

            <div className="bg-slate-50 rounded-2xl p-4 sm:p-5 mb-6 border border-slate-100">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                Key Technical Specifications
              </h4>
              <ul className="space-y-2 text-xs sm:text-sm text-slate-600">
                {activeModalFeature.specs.map((spec, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{spec}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setActiveModalFeature(null)}
                className="px-4 py-2 rounded-full text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setActiveModalFeature(null);
                  onStartTrial();
                }}
                className="px-5 py-2 rounded-full text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-xs cursor-pointer"
              >
                Start Trial with Feature
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Demo Video Modal */}
      {showDemoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0B132B] text-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl border border-slate-800 relative">
            <button
              onClick={() => setShowDemoModal(false)}
              className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Close demo"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                Interactive Walkthrough
              </span>
            </div>

            <h3 className="text-xl sm:text-2xl font-bold mb-2">
              {content.videoTitle}
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 mb-6">
              {content.videoSectionSubtitle}
            </p>

            {/* Simulated Live Workflow Steps */}
            <div className="space-y-3 mb-6">
              {[
                {
                  step: '01',
                  name: isCheckPrinting ? 'CSV / ERP Ingestion' : 'Geofence Perimeter Definition',
                  status: 'Completed',
                  desc: isCheckPrinting
                    ? '184 payee records parsed from QuickBooks API with positive pay hashes.'
                    : 'Polygon perimeter calibrated around 5 work hubs with 50m tolerance.',
                },
                {
                  step: '02',
                  name: isCheckPrinting ? 'ANSI X9 & MICR Encoding' : 'Biometric Face Liveness Verification',
                  status: 'Completed',
                  desc: isCheckPrinting
                    ? 'Iron-oxide magnetic character alignment verified against Federal Reserve specifications.'
                    : 'Anti-spoofing facial match validated in 180ms with cryptographic proof.',
                },
                {
                  step: '03',
                  name: isCheckPrinting ? 'Dual-Officer Signatory Gate' : 'Automated Timesheet Ledger Sync',
                  status: 'Active',
                  desc: isCheckPrinting
                    ? 'Two CFO signatures authorized via RSA-4096 hardware token.'
                    : 'Shift hours automatically routed to payroll ledger with zero manual entry.',
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start gap-3"
                >
                  <span className="text-xs font-mono font-bold text-cyan-400 px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/40">
                    {item.step}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-100">{item.name}</span>
                      <span className="text-[11px] font-mono text-emerald-400">{item.status}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                onClick={() => setShowDemoModal(false)}
                className="px-4 py-2 rounded-full text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Close Demo
              </button>
              <button
                onClick={() => {
                  setShowDemoModal(false);
                  onStartTrial();
                }}
                className="px-5 py-2.5 rounded-full text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md cursor-pointer"
              >
                Start 14-Day Free Trial
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
