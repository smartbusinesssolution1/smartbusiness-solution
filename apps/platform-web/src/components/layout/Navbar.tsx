import React, { useState } from 'react';
import { PageRoute } from '../../types';
import { SmartBusinessLogo } from '../common/SmartBusinessLogo';
import { Menu, X } from 'lucide-react';

interface NavbarProps {
  currentRoute: PageRoute;
  onRouteChange: (route: PageRoute) => void;
  currentUser: string | null;
  onSignOut: () => void;
  // "My products": the signed-in person's products, with Open buttons.
  onOpenAccount: () => void;
  onOpenContact: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRoute,
  onRouteChange,
  currentUser,
  onSignOut,
  onOpenAccount,
  onOpenContact,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks: Array<{ label: string; route: PageRoute }> = [
    { label: 'Home', route: 'home' },
    { label: 'Services', route: 'services' },
    { label: 'Pricing', route: 'pricing' },
    { label: 'FAQ', route: 'faq' },
    { label: 'Contact us', route: 'contact' },
  ];

  const handleNavClick = (route: PageRoute) => {
    setMobileMenuOpen(false);
    if (route === 'contact') {
      onOpenContact();
    } else {
      onRouteChange(route);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-100 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Left: Brand Logo & Wordmark */}
        <button
          onClick={() => handleNavClick('home')}
          className="cursor-pointer text-left focus:outline-none"
          aria-label="SmartBusiness Solutions Home"
        >
          <SmartBusinessLogo />
        </button>

        {/* Center: Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-8 lg:gap-10">
          <button
            onClick={() => handleNavClick('home')}
            className={`text-[15px] font-medium transition-colors cursor-pointer ${
              currentRoute === 'home'
                ? 'text-indigo-600 font-semibold'
                : 'text-slate-700 hover:text-indigo-600'
            }`}
          >
            Home
          </button>

          {/* Services with Dropdown */}
          <div className="relative group">
            <button
              onClick={() => handleNavClick('services')}
              className={`text-[15px] font-medium transition-colors cursor-pointer flex items-center gap-1 py-2 ${
                currentRoute === 'services' ||
                currentRoute === 'check-printing' ||
                currentRoute === 'clock-in-clock-out'
                  ? 'text-indigo-600 font-semibold'
                  : 'text-slate-700 hover:text-indigo-600'
              }`}
            >
              <span>Services</span>
              <span className="text-[10px] transition-transform group-hover:rotate-180">▼</span>
            </button>

            {/* Dropdown Menu */}
            <div className="absolute top-full left-0 -ml-4 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 opacity-0 translate-y-1 invisible group-hover:opacity-100 group-hover:translate-y-0 group-hover:visible transition-all duration-200 z-50">
              <button
                onClick={() => handleNavClick('check-printing')}
                className={`w-full text-left p-2.5 rounded-xl transition-all cursor-pointer flex flex-col ${
                  currentRoute === 'check-printing'
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'hover:bg-slate-50 text-slate-800'
                }`}
              >
                <span className="text-xs font-bold">Check Printing</span>
                <span className="text-[11px] text-slate-500 mt-0.5">
                  ANSI MICR encoding & same-day mail
                </span>
              </button>

              <button
                onClick={() => handleNavClick('clock-in-clock-out')}
                className={`w-full text-left p-2.5 rounded-xl transition-all cursor-pointer flex flex-col ${
                  currentRoute === 'clock-in-clock-out'
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'hover:bg-slate-50 text-slate-800'
                }`}
              >
                <span className="text-xs font-bold">Clock In Clock Out</span>
                <span className="text-[11px] text-slate-500 mt-0.5">
                  Geofenced shifts & biometric logs
                </span>
              </button>

              <div className="border-t border-slate-100 mt-1 pt-1">
                <button
                  onClick={() => handleNavClick('services')}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50/50 cursor-pointer"
                >
                  View All Services Overview →
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={() => handleNavClick('pricing')}
            className={`text-[15px] font-medium transition-colors cursor-pointer ${
              currentRoute === 'pricing'
                ? 'text-indigo-600 font-semibold'
                : 'text-slate-700 hover:text-indigo-600'
            }`}
          >
            Pricing
          </button>

          <button
            onClick={() => handleNavClick('faq')}
            className={`text-[15px] font-medium transition-colors cursor-pointer ${
              currentRoute === 'faq'
                ? 'text-indigo-600 font-semibold'
                : 'text-slate-700 hover:text-indigo-600'
            }`}
          >
            FAQ
          </button>

          <button
            onClick={() => handleNavClick('contact')}
            className={`text-[15px] font-medium transition-colors cursor-pointer ${
              currentRoute === 'contact'
                ? 'text-indigo-600 font-semibold'
                : 'text-slate-700 hover:text-indigo-600'
            }`}
          >
            Contact us
          </button>
        </nav>

        {/* Right: Auth Action Button */}
        <div className="hidden md:flex items-center gap-4">
          {currentUser ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 font-medium truncate max-w-[140px]">
                {currentUser}
              </span>
              <button
                onClick={onOpenAccount}
                className="text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors px-3 py-1.5 rounded-full cursor-pointer"
              >
                My products
              </button>
              <button
                onClick={onSignOut}
                className="text-xs font-semibold text-slate-600 hover:text-red-600 transition-colors px-3 py-1.5 border border-slate-200 rounded-full cursor-pointer"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              onClick={() => handleNavClick('signin')}
              className="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-medium text-sm px-6 py-2 rounded-full transition-all shadow-sm hover:shadow-indigo-100 cursor-pointer"
            >
              Login
            </button>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-50 cursor-pointer"
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-200 bg-white px-4 pt-3 pb-6 shadow-xl animate-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col space-y-2">
            <button
              onClick={() => handleNavClick('home')}
              className={`text-left px-3 py-2 rounded-lg text-base font-medium transition-colors cursor-pointer ${
                currentRoute === 'home' ? 'bg-indigo-50 text-indigo-600 font-semibold' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              Home
            </button>

            {/* Mobile Service Sub-links */}
            <div className="pl-3 py-1 space-y-1 border-l-2 border-indigo-100 ml-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block px-2">
                Services
              </span>
              <button
                onClick={() => handleNavClick('check-printing')}
                className={`w-full text-left px-2 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  currentRoute === 'check-printing' ? 'bg-indigo-50 text-indigo-600 font-semibold' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                Check Printing Solutions
              </button>
              <button
                onClick={() => handleNavClick('clock-in-clock-out')}
                className={`w-full text-left px-2 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  currentRoute === 'clock-in-clock-out' ? 'bg-indigo-50 text-indigo-600 font-semibold' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                Clock In Clock Out Solutions
              </button>
            </div>

            <button
              onClick={() => handleNavClick('pricing')}
              className={`text-left px-3 py-2 rounded-lg text-base font-medium transition-colors cursor-pointer ${
                currentRoute === 'pricing' ? 'bg-indigo-50 text-indigo-600 font-semibold' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              Pricing
            </button>

            <button
              onClick={() => handleNavClick('faq')}
              className={`text-left px-3 py-2 rounded-lg text-base font-medium transition-colors cursor-pointer ${
                currentRoute === 'faq' ? 'bg-indigo-50 text-indigo-600 font-semibold' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              FAQ
            </button>

            <button
              onClick={() => handleNavClick('contact')}
              className={`text-left px-3 py-2 rounded-lg text-base font-medium transition-colors cursor-pointer ${
                currentRoute === 'contact' ? 'bg-indigo-50 text-indigo-600 font-semibold' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              Contact us
            </button>

            <div className="pt-3 border-t border-slate-100">
              {currentUser ? (
                <>
                  <button
                    onClick={() => {
                      onOpenAccount();
                      setMobileMenuOpen(false);
                    }}
                    className="w-full mb-2 text-center py-2.5 px-4 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl"
                  >
                    My products
                  </button>
                  <button
                    onClick={() => {
                      onSignOut();
                      setMobileMenuOpen(false);
                    }}
                    className="w-full text-center py-2.5 px-4 text-sm font-semibold text-red-600 bg-red-50 rounded-xl"
                  >
                    Sign Out ({currentUser})
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleNavClick('signin')}
                  className="w-full py-2.5 px-4 text-center text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-full transition-all shadow"
                >
                  Login
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
