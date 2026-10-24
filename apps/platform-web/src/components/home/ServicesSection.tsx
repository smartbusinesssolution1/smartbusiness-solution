import React from 'react';
import { Check } from 'lucide-react';

interface ServicesSectionProps {
  onSelectService?: (serviceName: string) => void;
}

export const ServicesSection: React.FC<ServicesSectionProps> = ({ onSelectService }) => {
  return (
    <section id="services-section" className="py-12 sm:py-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Enclosing Container with subtle frame matching Figma screenshot */}
        <div className="rounded-3xl border border-slate-200/70 bg-white/70 p-6 sm:p-12 shadow-xs">
          
          {/* Header */}
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="inline-block px-3.5 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase text-indigo-600 bg-indigo-50 mb-4">
              SERVICES
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight">
              Check Printing Solutions Built For Your Workflow
            </h2>
            <p className="mt-4 text-sm sm:text-base text-slate-600 leading-relaxed">
              Our checks have everything in order for you, just ordering checks! Seamless processing crafted for scale.
            </p>
          </div>

          {/* 2 Service Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Service 1: Check Printing */}
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col">
              {/* Image banner */}
              <div className="h-56 w-full relative overflow-hidden bg-slate-100">
                <img
                  src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80"
                  alt="Check Printing and Postal Dispatch"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-transparent" />
              </div>

              {/* Content */}
              <div className="p-6 sm:p-7 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">
                    Check Printing
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6">
                    High-resolution MICR magnetic encoding, tamper-proof security check stock, and guaranteed same-day FedEx & USPS mailing dispatch directly to your vendors.
                  </p>
                </div>

                <ul className="space-y-2.5 pt-4 border-t border-slate-100">
                  <li className="flex items-center text-xs sm:text-sm text-slate-700 font-medium">
                    <span className="w-4 h-4 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mr-2.5 shrink-0">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                    Batch check printing & e-signatures
                  </li>
                  <li className="flex items-center text-xs sm:text-sm text-slate-700 font-medium">
                    <span className="w-4 h-4 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mr-2.5 shrink-0">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                    Batch check printing & e-signatures
                  </li>
                </ul>
              </div>
            </div>

            {/* Service 2: Clock In Clock Out */}
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col">
              {/* Image banner */}
              <div className="h-56 w-full relative overflow-hidden bg-slate-100">
                <img
                  src="https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=800&q=80"
                  alt="Clock In Clock Out Attendance and Payroll"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-transparent" />
              </div>

              {/* Content */}
              <div className="p-6 sm:p-7 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">
                    Clock In Clock Out
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6">
                    Real-time employee time tracking, geofenced shifts, and automated attendance audits with instant payroll sync to eliminate missed clock-outs and manual logs.
                  </p>
                </div>

                <ul className="space-y-2.5 pt-4 border-t border-slate-100">
                  <li className="flex items-center text-xs sm:text-sm text-slate-700 font-medium">
                    <span className="w-4 h-4 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mr-2.5 shrink-0">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                    Geofenced shifts & automated attendance audits
                  </li>
                  <li className="flex items-center text-xs sm:text-sm text-slate-700 font-medium">
                    <span className="w-4 h-4 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mr-2.5 shrink-0">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                    Instant payroll sync & digital timecard logs
                  </li>
                </ul>
              </div>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
};
