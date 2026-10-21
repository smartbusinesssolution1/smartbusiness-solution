import React from 'react';
import { ShieldCheck, RefreshCw, Rocket, Clock, FileCheck } from 'lucide-react';

export const FastApprovalFeatures: React.FC = () => {
  return (
    <section className="py-16 sm:py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="inline-block px-3.5 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase text-blue-600 bg-blue-50 mb-4">
            FAST APPROVAL
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Everything you need to run high-volume checks
          </h2>
          <p className="mt-3.5 text-sm sm:text-base text-slate-600">
            With parts 107 if you start the design, it will be faster & more effective to manage checks end-to-end.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="space-y-6">
          
          {/* Top Row: 3 Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Card 1: Quality Assured */}
            <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-7 hover:bg-white hover:border-slate-200 hover:shadow-xs transition-all flex flex-col justify-start">
              <div className="w-10 h-10 rounded-xl bg-blue-100/70 text-blue-600 flex items-center justify-center mb-5">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">
                Quality Assured
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Clean bank-compliant structure that will inspire you and trigger endless inspirations you want, adhering strictly to Check 21 and Federal Reserve MICR standards.
              </p>
            </div>

            {/* Card 2: Continuous Updates */}
            <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-7 hover:bg-white hover:border-slate-200 hover:shadow-xs transition-all flex flex-col justify-start">
              <div className="w-10 h-10 rounded-xl bg-cyan-100/70 text-cyan-600 flex items-center justify-center mb-5">
                <RefreshCw className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">
                Continuous Updates
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Free automatic updates for 3 years, with round-the-clock 24 hours technical assistance, continuous bug fixes, and security patches included out of the box.
              </p>
            </div>

            {/* Card 3: Made 4 All */}
            <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-7 hover:bg-white hover:border-slate-200 hover:shadow-xs transition-all flex flex-col justify-start">
              <div className="w-10 h-10 rounded-xl bg-emerald-100/70 text-emerald-600 flex items-center justify-center mb-5">
                <Rocket className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">
                Made 4 All
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Our specialized team weighs carefully which tools are modern, responsive, fast, and accessible across every web, desktop, and mobile workflow.
              </p>
            </div>

          </div>

          {/* Bottom Row: 2 Wider Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Card 4: 24/7 Hours Dedicated Help */}
            <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-7 hover:bg-white hover:border-slate-200 hover:shadow-xs transition-all flex flex-col justify-start">
              <div className="w-10 h-10 rounded-xl bg-amber-100/70 text-amber-600 flex items-center justify-center mb-5">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">
                24/7 Hours Dedicated Help
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Around the clock 24/7 days technical assistance for free also helps to resolve check printing, printer alignment, or clearing errors immediately.
              </p>
            </div>

            {/* Card 5: Flexible Projects & Audits */}
            <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-7 hover:bg-white hover:border-slate-200 hover:shadow-xs transition-all flex flex-col justify-start">
              <div className="w-10 h-10 rounded-xl bg-purple-100/70 text-purple-600 flex items-center justify-center mb-5">
                <FileCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">
                Flexible Projects & Audits
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                A solid archival system with encrypted PDF export, physical check paper mailkits, and certified audit logs tailored for your enterprise bookkeeping.
              </p>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
};
