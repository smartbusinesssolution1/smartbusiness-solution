import React from 'react';
import { Printer, RefreshCw, ChevronRight, MessageSquare, DollarSign, Star, ShieldCheck } from 'lucide-react';

interface HeroSectionProps {
  onExploreService: (serviceName: string) => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onExploreService }) => {
  return (
    <section className="relative pt-12 pb-16 sm:pt-16 sm:pb-24 overflow-hidden bg-gradient-to-b from-white via-slate-50/30 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Top Centered Pill Badge */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] sm:text-xs font-bold text-indigo-600 tracking-wider">
              NEW RELEASE
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-[11px] sm:text-xs font-medium text-slate-700">
              Next-Gen Check Automation Platform
            </span>
          </div>
        </div>

        {/* Hero Headline */}
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-slate-900 tracking-tight leading-[1.15]">
            One Platform to manage{' '}
            <span className="font-serif italic font-normal text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-blue-600">
              all your checks
            </span>{' '}
            with precision.
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed font-normal">
            Transform how your business prints, tracks, and reconciles checks. Direct bank integration, instant clearing compliance, and full ledger automation.
          </p>
        </div>

        {/* 2 Core Service Showcase Cards */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Core Service 01: Check Printing */}
          <div
            onClick={() => onExploreService('check-printing')}
            className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 shadow-xs hover:shadow-md hover:border-indigo-100 transition-all cursor-pointer"
          >
            {/* Soft decorative background glow */}
            <div className="absolute -top-12 -right-12 w-36 h-36 bg-cyan-100/50 rounded-full blur-2xl pointer-events-none" />

            <div className="relative z-10">
              <div className="w-12 h-12 rounded-xl bg-blue-500 text-white flex items-center justify-center shadow-sm mb-4 group-hover:scale-105 transition-transform">
                <Printer className="w-6 h-6" />
              </div>

              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold text-indigo-700 bg-indigo-50 uppercase tracking-wider mb-2">
                CORE SERVICE 01
              </span>

              <h2 className="text-lg font-bold text-slate-900 mb-3 group-hover:text-indigo-600 transition-colors">
                Check Printing
              </h2>

              <div className="flex items-center text-xs font-semibold text-indigo-600 group-hover:text-indigo-700 transition-colors">
                <span>Explore Print Fulfillment</span>
                <ChevronRight className="w-3.5 h-3.5 ml-1 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          </div>

          {/* Core Service 02: Clock In Clock Out */}
          <div
            onClick={() => onExploreService('clock-in-out')}
            className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 shadow-xs hover:shadow-md hover:border-indigo-100 transition-all cursor-pointer"
          >
            {/* Soft decorative background glow */}
            <div className="absolute -top-12 -right-12 w-36 h-36 bg-indigo-100/50 rounded-full blur-2xl pointer-events-none" />

            <div className="relative z-10">
              <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm mb-4 group-hover:scale-105 transition-transform">
                <RefreshCw className="w-6 h-6" />
              </div>

              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold text-indigo-700 bg-indigo-50 uppercase tracking-wider mb-2">
                CORE SERVICE 02
              </span>

              <h2 className="text-lg font-bold text-slate-900 mb-3 group-hover:text-indigo-600 transition-colors">
                Clock In Clock Out
              </h2>

              <div className="flex items-center text-xs font-semibold text-indigo-600 group-hover:text-indigo-700 transition-colors">
                <span>Explore Clock In / Clock Out</span>
                <ChevronRight className="w-3.5 h-3.5 ml-1 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          </div>
        </div>

        {/* Stats Row Container */}
        <div className="mt-14 max-w-4xl mx-auto rounded-2xl border border-slate-100 bg-white/90 p-6 sm:p-8 shadow-xs">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
            
            {/* Stat 1: Community */}
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 text-slate-500 mb-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[11px] font-bold tracking-wider uppercase text-slate-500">
                  COMMUNITY
                </span>
              </div>
              <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
                7.1k+
              </div>
              <p className="mt-1 text-xs text-slate-500 leading-normal">
                Satisfied clients worldwide relying on our checks daily
              </p>
            </div>

            {/* Stat 2: Savings */}
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 text-slate-500 mb-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-[11px] font-bold tracking-wider uppercase text-slate-500">
                  SAVINGS
                </span>
              </div>
              <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
                $4k+
              </div>
              <p className="mt-1 text-xs text-slate-500 leading-normal">
                Average operational overhead saved yearly per company
              </p>
            </div>

            {/* Stat 3: Satisfaction */}
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 text-slate-500 mb-1.5">
                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                <span className="text-[11px] font-bold tracking-wider uppercase text-slate-500">
                  SATISFACTION
                </span>
              </div>
              <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
                4.9<span className="text-xl text-slate-400 font-semibold">/5</span>
              </div>
              <p className="mt-1 text-xs text-slate-500 leading-normal">
                Consistently rated excellent on customer feedback indices
              </p>
            </div>

            {/* Stat 4: Guarantee */}
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 text-slate-500 mb-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                <span className="text-[11px] font-bold tracking-wider uppercase text-slate-500">
                  GUARANTEE
                </span>
              </div>
              <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
                100%
              </div>
              <p className="mt-1 text-xs text-slate-500 leading-normal">
                Unconditional 30-day money-back guarantee protection
              </p>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
};
