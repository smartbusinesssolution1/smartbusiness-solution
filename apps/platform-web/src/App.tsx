/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { PageRoute } from './types';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { HeroSection } from './components/home/HeroSection';
import { ServicesSection } from './components/home/ServicesSection';
import { FastApprovalFeatures } from './components/home/FastApprovalFeatures';
import { ContactSection } from './components/home/ContactSection';
import { PricingSection } from './components/pricing/PricingSection';
import { FaqSection } from './components/faq/FaqSection';
import { AuthSection, type AuthMode } from './components/auth/AuthSection';
import { AccountSection } from './components/account/AccountSection';
import { FloatingChatWidget } from './components/chat/FloatingChatWidget';
import { ToastProvider, useToast } from './components/ui/Toast';
import { LogOut, UserCheck } from 'lucide-react';
import { fetchSession, logout, type PortalSession } from './lib/auth';

function AppContent() {
  const [currentRoute, setCurrentRoute] = useState<PageRoute>('home');
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [isChatOpen, setIsChatOpen] = useState(false);
  // undefined while the first /me is in flight, null when nobody is signed in.
  const [session, setSession] = useState<PortalSession | null | undefined>(undefined);
  const currentUser = session?.user.email ?? null;
  const { showToast } = useToast();

  // The login cookies outlive the page: someone who signed up yesterday, or signed in on
  // Check Printing, is already signed in here.
  useEffect(() => {
    fetchSession()
      .then(setSession)
      .catch(() => setSession(null));
  }, []);

  // A product's "Create your company account" link (e.g. Check Printing's /sign-up) opens
  // the portal with ?start=signup: show sign-up straight away.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('start') === 'signup') {
      setAuthMode('signup');
      setCurrentRoute('signin');
    }
  }, []);

  const goTo = (route: PageRoute) => {
    setCurrentRoute(route);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openAuth = (mode: AuthMode) => {
    setAuthMode(mode);
    goTo('signin');
  };

  // The navbar's "Login" always opens sign-in, even after a pricing button opened sign-up.
  const handleRouteChange = (route: PageRoute) => {
    if (route === 'signin') setAuthMode('signin');
    setCurrentRoute(route);
  };

  // Online purchase isn't built yet (Stripe is on hold): every new company gets a trial of
  // every product, so a signed-in visitor is sent to their products instead of a fake
  // "plan activated".
  const handleSelectPlan = (planId: string) => {
    if (!session) {
      openAuth('signup');
      showToast(`Create your free account to try the ${planId.toUpperCase()} plan`, 'info');
    } else {
      goTo('account');
      showToast('Online plan purchase is coming soon. Your trial includes every product.', 'info');
    }
  };

  const handleAuthSuccess = (next: PortalSession) => {
    setSession(next);
    goTo('account');
  };

  const handleSignOut = async () => {
    try {
      await logout();
    } catch {
      // The cookies may already be gone (expired, signed out elsewhere): signed out either way.
    }
    setSession(null);
    goTo('home');
    showToast('Signed out of SmartBusiness', 'info');
  };

  const handleOpenContact = () => {
    if (currentRoute !== 'home') {
      setCurrentRoute('home');
      setTimeout(() => {
        const contactEl = document.getElementById('contact-section');
        contactEl?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      const contactEl = document.getElementById('contact-section');
      contactEl?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleExploreService = (serviceName: string) => {
    if (currentRoute !== 'home') {
      setCurrentRoute('home');
      setTimeout(() => {
        const servicesEl = document.getElementById('services-section');
        servicesEl?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      const servicesEl = document.getElementById('services-section');
      servicesEl?.scrollIntoView({ behavior: 'smooth' });
    }
    showToast(`Viewing ${serviceName === 'check-printing' ? 'Check Printing' : 'Clock In Clock Out'} details`, 'info');
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900 selection:bg-indigo-600 selection:text-white font-sans antialiased">
      {/* Top Banner when user is signed in */}
      {session && (
        <div className="bg-indigo-600 text-white text-xs py-2 px-4 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
            <UserCheck className="w-3.5 h-3.5 text-indigo-200" />
            <span className="font-medium truncate">
              Signed in as <strong>{session.user.email}</strong>
              {session.tenants[0] && <> · {session.tenants[0].tenantName}</>}
            </span>
            {currentRoute !== 'account' && (
              <button
                onClick={() => goTo('account')}
                className="ml-auto text-[11px] font-semibold text-white underline cursor-pointer"
              >
                My products
              </button>
            )}
            <button
              onClick={handleSignOut}
              className={`${currentRoute === 'account' ? 'ml-auto' : ''} inline-flex items-center gap-1 text-[11px] text-indigo-200 hover:text-white underline cursor-pointer`}
            >
              <LogOut className="w-3 h-3" />
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Main Top Navigation Header */}
      <Navbar
        currentRoute={currentRoute}
        onRouteChange={handleRouteChange}
        currentUser={currentUser}
        onSignOut={handleSignOut}
        onOpenAccount={() => goTo('account')}
        onOpenContact={handleOpenContact}
      />

      {/* Main Content Router */}
      <main className="flex-1">
        {currentRoute === 'home' && (
          <div className="space-y-0">
            {/* 1. Hero Section + 2 Core Service Cards + Stats Bar */}
            <HeroSection onExploreService={handleExploreService} />

            {/* 2. SERVICES Section (Check Printing & Clock In Clock Out with photos) */}
            <ServicesSection onSelectService={handleExploreService} />

            {/* 3. FAST APPROVAL Features (5 Cards: Quality Assured, Continuous Updates, Made 4 All, 24/7 Help, Flexible Projects) */}
            <FastApprovalFeatures />

            {/* 4. DEDICATED SUPPORT & Contact Form Section */}
            <ContactSection />
          </div>
        )}

        {currentRoute === 'services' && (
          <div className="pt-8 pb-16">
            <ServicesSection onSelectService={handleExploreService} />
            <FastApprovalFeatures />
            <ContactSection />
          </div>
        )}

        {currentRoute === 'pricing' && (
          <PricingSection onSelectPlan={handleSelectPlan} />
        )}

        {currentRoute === 'faq' && (
          <FaqSection onOpenChat={() => setIsChatOpen(true)} />
        )}

        {currentRoute === 'signin' && (
          <AuthSection
            key={authMode}
            initialMode={authMode}
            onSuccess={handleAuthSuccess}
            onNavigateHome={() => setCurrentRoute('home')}
          />
        )}

        {currentRoute === 'account' && session && (
          <AccountSection session={session} onSignOut={handleSignOut} onOpenContact={handleOpenContact} />
        )}

        {currentRoute === 'account' && session === null && (
          <AuthSection initialMode="signin" onSuccess={handleAuthSuccess} onNavigateHome={() => setCurrentRoute('home')} />
        )}
      </main>

      {/* Global Footer matching Figma Screenshot */}
      <Footer
        onRouteChange={setCurrentRoute}
        onOpenContact={handleOpenContact}
      />

      {/* Aside - Floating Chat Container (Positioned bottom right) */}
      <FloatingChatWidget
        isOpen={isChatOpen}
        onToggle={() => setIsChatOpen(!isChatOpen)}
        onNavigatePricing={() => {
          setCurrentRoute('pricing');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
