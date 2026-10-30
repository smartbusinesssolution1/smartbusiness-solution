import React, { useState } from 'react';
import { PageRoute } from '../../types';
import { SmartBusinessLogo } from '../common/SmartBusinessLogo';
import { useToast } from '../ui/Toast';

interface FooterProps {
  onRouteChange: (route: PageRoute) => void;
  onOpenContact: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onRouteChange, onOpenContact }) => {
  const [email, setEmail] = useState('');
  const { showToast } = useToast();

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    showToast('Subscribed to SmartBusiness updates!', 'success');
    setEmail('');
  };

  const handleNav = (route: PageRoute) => {
    if (route === 'contact') {
      onOpenContact();
    } else {
      onRouteChange(route);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <footer className="bg-[#EEF1FD] border-t border-indigo-50/50 text-slate-800 pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Main 3-Column Footer Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 lg:gap-14 pb-14 border-b border-indigo-100/60">
          
          {/* Column 1: Brand & Newsletter (5 cols) */}
          <div className="md:col-span-5 flex flex-col space-y-4">
            <SmartBusinessLogo size="md" />

            <p className="text-xs sm:text-sm text-slate-600 max-w-sm leading-relaxed">
              Simplify your check payments, deposits, and bookkeeping with our trusted automated cloud platform.
            </p>

            {/* Newsletter Subscription */}
            <form onSubmit={handleSubscribe} className="pt-2">
              <div className="relative flex items-center max-w-sm">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full pl-4 pr-28 py-2.5 bg-white border border-indigo-200/60 rounded-full text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                />
                <button
                  type="submit"
                  className="absolute right-1 px-5 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-medium text-xs rounded-full transition-all cursor-pointer shadow-xs"
                >
                  Subscribe
                </button>
              </div>
            </form>
          </div>

          {/* Column 2: Useful Links (3 cols) */}
          <div className="md:col-span-3">
            <h4 className="text-[11px] font-bold text-slate-900 tracking-wider uppercase mb-4">
              USEFUL LINKS
            </h4>
            <ul className="space-y-2.5">
              {[
                { label: 'Home', route: 'home' as PageRoute },
                { label: 'Check Printing', route: 'check-printing' as PageRoute },
                { label: 'Clock In Clock Out', route: 'clock-in-clock-out' as PageRoute },
                { label: 'Services', route: 'services' as PageRoute },
                { label: 'Pricing', route: 'pricing' as PageRoute },
                { label: 'FAQ', route: 'faq' as PageRoute },
                { label: 'Contact Us', route: 'contact' as PageRoute },
              ].map((link) => (
                <li key={link.label}>
                  <button
                    onClick={() => handleNav(link.route)}
                    className="text-xs sm:text-sm text-slate-600 hover:text-indigo-600 transition-colors cursor-pointer"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Download App & Badges (4 cols) */}
          <div className="md:col-span-4 flex flex-col space-y-3">
            <h4 className="text-[11px] font-bold text-slate-900 tracking-wider uppercase mb-1">
              DOWNLOAD APP
            </h4>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-1">
              Access your accounts and authorize checks securely on the go.
            </p>

            <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 max-w-[200px]">
              {/* App Store Button */}
              <button
                onClick={() => showToast('SmartBusiness iOS App coming soon to App Store!', 'info')}
                className="flex items-center gap-3 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition-all cursor-pointer shadow-sm text-left group"
              >
                <img
                  src="/apple.png"
                  alt="Apple App Store"
                  className="w-5 h-5 object-contain shrink-0 transition-transform group-hover:scale-105"
                />
                <div className="leading-tight">
                  <div className="text-[9px] uppercase tracking-wide text-slate-400">Download on the</div>
                  <div className="text-xs font-semibold">App Store</div>
                </div>
              </button>

              {/* Google Play Button */}
              <button
                onClick={() => showToast('SmartBusiness Android App coming soon to Google Play!', 'info')}
                className="flex items-center gap-3 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition-all cursor-pointer shadow-sm text-left group"
              >
                <img
                  src="/playstore.png"
                  alt="Google Play Store"
                  className="w-5 h-5 object-contain shrink-0 transition-transform group-hover:scale-105"
                />
                <div className="leading-tight">
                  <div className="text-[9px] uppercase tracking-wide text-slate-400">Get it on</div>
                  <div className="text-xs font-semibold">Google Play</div>
                </div>
              </button>
            </div>
          </div>

        </div>

        {/* Bottom Bar: Copyright & Legal */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <div>
            © 2024 All rights reserved. SmartBusiness Solutions
          </div>
          <div className="flex items-center gap-6">
            <button
              onClick={() => showToast('Privacy Policy details', 'info')}
              className="hover:text-indigo-600 transition-colors"
            >
              Privacy Policy
            </button>
            <button
              onClick={() => showToast('Terms of Service details', 'info')}
              className="hover:text-indigo-600 transition-colors"
            >
              Terms of Service
            </button>
            <button
              onClick={() => showToast('Bank-level 256-bit encryption compliance details', 'info')}
              className="hover:text-indigo-600 transition-colors"
            >
              Security
            </button>
          </div>
        </div>

      </div>
    </footer>
  );
};
