import React, { useState } from 'react';
import { PageRoute } from '../../types';
import { SmartBusinessLogo } from '../common/SmartBusinessLogo';
import { Menu, X } from 'lucide-react';

interface NavbarProps {
  currentRoute: PageRoute;
  onRouteChange: (route: PageRoute) => void;
  currentUser: string | null;
  onSignOut: () => void;
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
          {navLinks.map((item) => {
            const isActive = currentRoute === item.route;
            return (
              <button
                key={item.label}
                onClick={() => handleNavClick(item.route)}
                className={`text-[15px] font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'text-indigo-600 font-semibold'
                    : 'text-slate-700 hover:text-indigo-600'
                }`}
              >
                {item.label}
              </button>
            );
          })}
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
          <div className="flex flex-col space-y-3">
            {navLinks.map((item) => (
              <button
                key={item.label}
                onClick={() => handleNavClick(item.route)}
                className={`text-left px-3 py-2 rounded-lg text-base font-medium transition-colors cursor-pointer ${
                  currentRoute === item.route
                    ? 'bg-indigo-50 text-indigo-600 font-semibold'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {item.label}
              </button>
            ))}
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
