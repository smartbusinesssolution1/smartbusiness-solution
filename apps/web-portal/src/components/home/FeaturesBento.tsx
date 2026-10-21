import React, { useState } from 'react';
import { Cpu, ShieldCheck, Activity, Network, ArrowRight, Code, Database, Sparkles, Check } from 'lucide-react';

export const FeaturesBento: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'all' | 'ai' | 'security' | 'integrations'>('all');

  return (
    <section id="features-section" className="py-20 sm:py-28 bg-white border-y border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
            Core Architecture
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight text-balance">
            Everything your operations team needs to automate with confidence
          </h2>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
            Eliminate fragile custom cron scripts and unmonitored glue code with a resilient, distributed workflow runtime.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {/* Bento Card 1: Large Marquee (Col Span 2) */}
          <div className="md:col-span-2 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 p-6 sm:p-8 text-white border border-slate-800 relative overflow-hidden flex flex-col justify-between group">
            <div className="relative z-10 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 text-xs font-mono border border-indigo-500/30">
                <Cpu className="w-3.5 h-3.5" />
                <span>01. Multi-Step DAG Engine</span>
              </div>
              <h3 className="text-2xl font-bold tracking-tight text-white max-w-md">
                Deterministic execution with instant rollback and automatic retries
              </h3>
              <p className="text-sm text-slate-300 max-w-lg leading-relaxed">
                Build asynchronous workflows that survive node failures, network partitions, and third-party rate limits with distributed state machines and transactional checkpoints.
              </p>
            </div>

            {/* Interactive Visual Code Preview */}
            <div className="mt-6 pt-4 border-t border-slate-800/80 font-mono text-xs text-slate-300 bg-slate-950/70 p-4 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-slate-500 text-[11px]">
                <span>workflow-spec.ts</span>
                <span className="text-indigo-400">TypeScript Native</span>
              </div>
              <p className="text-indigo-300">export const triagePipeline = workflow({'{'}</p>
              <p className="pl-4 text-slate-400">trigger: events.stripe.chargeSuccess,</p>
              <p className="pl-4 text-slate-300">execute: async ({'{'} event, ai {'}'}) =&gt; {'{'}</p>
              <p className="pl-8 text-emerald-400">const route = await ai.classifyUrgency(event.amount);</p>
              <p className="pl-8 text-sky-400">return syncDatabases({'{'} id: event.id, tier: route.tier {'}'});</p>
              <p className="pl-4 text-slate-300">{'}'}</p>
              <p className="text-indigo-300">{'}'});</p>
            </div>
          </div>

          {/* Bento Card 2: Real-time Observability */}
          <div className="rounded-2xl bg-slate-50 p-6 sm:p-8 border border-slate-200/90 flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                <Activity className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                02. Live Telemetry
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Step-by-step trace spans, execution latencies, and payload diffs logged with sub-millisecond precision.
              </p>
            </div>

            <div className="mt-6 p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Global Execution Rate</span>
                <span className="font-semibold text-emerald-600 tabular-nums">99.98%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: '96%' }}></div>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                <span>P99: 18ms</span>
                <span>Worker Threads: 64</span>
              </div>
            </div>
          </div>

          {/* Bento Card 3: Enterprise Security */}
          <div className="rounded-2xl bg-slate-50 p-6 sm:p-8 border border-slate-200/90 flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                03. Military-Grade Security
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                End-to-end secret vault with AES-256 encryption at rest, automatic token rotation, and zero payload retention.
              </p>
            </div>

            <ul className="mt-6 space-y-2 text-xs text-slate-600">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>SOC2 Type II & HIPAA certified</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Single Sign-On (SAML / Okta)</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Hardware Security Module (HSM) keys</span>
              </li>
            </ul>
          </div>

          {/* Bento Card 4: Universal Connectors (Col Span 2) */}
          <div className="md:col-span-2 rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 p-6 sm:p-8 text-white border border-slate-800 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-sky-500/20 text-sky-300 text-xs font-mono border border-sky-500/30">
                <Network className="w-3.5 h-3.5" />
                <span>04. Integration Ecosystem</span>
              </div>
              <h3 className="text-2xl font-bold text-white tracking-tight">
                100+ native connectors with bi-directional streaming
              </h3>
              <p className="text-sm text-slate-300 max-w-xl leading-relaxed">
                Connect your PostgreSQL database, Snowflake warehouse, Slack workspaces, Linear projects, and custom REST APIs in minutes.
              </p>
            </div>

            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {['GitHub', 'Slack', 'Linear', 'PostgreSQL', 'Snowflake', 'Stripe', 'HubSpot', 'AWS S3'].map((item) => (
                <div
                  key={item}
                  className="px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-medium text-slate-200 flex items-center justify-between hover:bg-white/10 transition-colors"
                >
                  <span>{item}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
