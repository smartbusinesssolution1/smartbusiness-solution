import React, { useState } from 'react';
import { PRICING_PLANS } from '../../data/mockData';
import { Check, Sparkles, ArrowRight, ShieldCheck, Zap } from 'lucide-react';
import { FeatureComparisonTable } from './FeatureComparisonTable';
import { useToast } from '../ui/Toast';

interface PricingSectionProps {
  onSelectPlan: (planId: string) => void;
}

export const PricingSection: React.FC<PricingSectionProps> = ({ onSelectPlan }) => {
  const [isAnnual, setIsAnnual] = useState(true);
  const { showToast } = useToast();

  const handlePlanClick = (planId: string) => {
    onSelectPlan(planId);
    showToast(`Selected ${planId.toUpperCase()} plan. Setting up your workspace...`, 'info');
  };

  return (
    <section className="py-16 sm:py-24 bg-gradient-to-b from-slate-50 via-white to-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center space-y-4 mb-12">
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
            Transparent Pricing
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight text-balance">
            Simple, predictable plans designed to scale with your team
          </h1>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
            All plans include access to our core workflow builder, end-to-end encryption, and automated retries.
          </p>

          {/* Billing Switcher */}
          <div className="pt-4 flex items-center justify-center gap-3">
            <span className={`text-sm font-medium ${!isAnnual ? 'text-slate-900 font-semibold' : 'text-slate-500'}`}>
              Monthly
            </span>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className="relative w-14 h-7 bg-slate-200 rounded-full p-1 transition-colors duration-200 ease-in-out focus:outline-none cursor-pointer"
              aria-label="Toggle annual billing"
            >
              <div
                className={`w-5 h-5 bg-indigo-600 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                  isAnnual ? 'translate-x-7' : 'translate-x-0'
                }`}
              />
            </button>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium ${isAnnual ? 'text-slate-900 font-semibold' : 'text-slate-500'}`}>
                Annual Billing
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                Save 20%
              </span>
            </div>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch pt-4">
          {PRICING_PLANS.map((plan) => {
            const price = isAnnual ? plan.annualPrice : plan.monthlyPrice;

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl flex flex-col justify-between p-7 sm:p-8 transition-all duration-200 ${
                  plan.popular
                    ? 'bg-white border-2 border-indigo-600 shadow-xl shadow-indigo-600/10 scale-100 md:-translate-y-2'
                    : 'bg-white border border-slate-200/90 shadow-xs hover:border-slate-300'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="px-3.5 py-1 rounded-full text-xs font-bold bg-indigo-600 text-white shadow-sm flex items-center gap-1.5 uppercase tracking-wider">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{plan.badge || 'Most Popular'}</span>
                    </span>
                  </div>
                )}

                {/* Plan Info */}
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
                    <p className="text-xs text-slate-500 leading-relaxed min-h-[32px]">{plan.tagline}</p>
                  </div>

                  {/* Price */}
                  <div className="py-3 border-y border-slate-100 flex items-baseline gap-1.5">
                    <span className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight font-mono tabular-nums">
                      ${price}
                    </span>
                    <span className="text-xs font-medium text-slate-500">
                      / month {isAnnual ? '(billed annually)' : ''}
                    </span>
                  </div>

                  {/* Features list */}
                  <div className="space-y-3 pt-2">
                    <span className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                      Included with plan:
                    </span>
                    <ul className="space-y-2.5 text-xs text-slate-600">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2.5">
                          <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <span className="leading-snug">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* CTA Button */}
                <div className="pt-8">
                  <button
                    onClick={() => handlePlanClick(plan.id)}
                    className={`w-full py-3 px-4 rounded-xl text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      plan.ctaVariant === 'primary'
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-600/20 active:scale-[0.98]'
                        : plan.ctaVariant === 'secondary'
                        ? 'bg-slate-900 text-white hover:bg-slate-800'
                        : 'bg-white text-slate-800 border border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span>{plan.ctaText}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <p className="text-[11px] text-center text-slate-400 mt-2">
                    {plan.id === 'enterprise' ? 'Custom SLA & agreement' : '14-day free trial · Cancel anytime'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Comparison Table */}
        <FeatureComparisonTable />
      </div>
    </section>
  );
};
