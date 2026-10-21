/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { PageRoute } from './types';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { HeroSection } from './components/home/HeroSection';
import { ServicesSection } from './components/home/ServicesSection';
import { FastApprovalFeatures } from './components/home/FastApprovalFeatures';
import { ContactSection } from './components/home/ContactSection';
import { PricingSection } from './components/pricing/PricingSection';
import { FaqSection } from './components/faq/FaqSection';
import { AuthSection } from './components/auth/AuthSection';
import { FloatingChatWidget } from './components/chat/FloatingChatWidget';
import { ToastProvider, useToast } from './components/ui/Toast';
import { CheckCircle2, LogOut, UserCheck } from 'lucide-react';

function AppContent() {
  const [currentRoute, setCurrentRoute] = useState<PageRoute>('home');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const { showToast } = useToast();

  const handleStartTrial = () => {
    if (currentUser) {
      showToast(`Logged in as ${currentUser}. Accessing check dashboard...`, 'success');
      return;
    }
    setCurrentRoute('signin');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('Log in or sign up to start check automation', 'info');
  };

  const handleSelectPlan = (planId: string) => {
    if (!currentUser) {
      setCurrentRoute('signin');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      showToast(`Please sign in to select the ${planId.toUpperCase()} plan`, 'info');
    } else {
      showToast(`Plan ${planId.toUpperCase()} activated for ${currentUser}!`, 'success');
    }
  };

  const handleAuthSuccess = (email: string) => {
    setCurrentUser(email);
    setCurrentRoute('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSignOut = () => {
    setCurrentUser(null);
    showToast('Signed out of SmartBusiness account', 'info');
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
      {currentUser && (
        <div className="bg-indigo-600 text-white text-xs py-2 px-4 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
            <UserCheck className="w-3.5 h-3.5 text-indigo-200" />
            <span className="font-medium">
              Signed in to SmartBusiness Workspace: <strong>{currentUser}</strong> (Active Check 21 Clearing)
            </span>
            <button
              onClick={handleSignOut}
              className="ml-auto inline-flex items-center gap-1 text-[11px] text-indigo-200 hover:text-white underline cursor-pointer"
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
        onRouteChange={setCurrentRoute}
        currentUser={currentUser}
        onSignOut={handleSignOut}
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
            onSuccess={handleAuthSuccess}
            onNavigateHome={() => setCurrentRoute('home')}
          />
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
