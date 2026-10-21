import React, { useState } from 'react';
import { Play, RotateCcw, CheckCircle2, Clock, Cpu, ArrowRight, ShieldCheck, Zap, Database, Terminal } from 'lucide-react';

export const InteractiveWorkflowPreview: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [activeStep, setActiveStep] = useState<number>(3); // default complete
  const [logs, setLogs] = useState<string[]>([
    '[10:42:01] INGEST: Stripe webhook payload received (evt_38291)',
    '[10:42:02] VALIDATE: HMAC signature verified with SHA-256',
    '[10:42:02] AI TRIAGE: Priority evaluated as HIGH (Confidence: 99.4%)',
    '[10:42:03] SYNC: Linear ticket #ENG-4912 auto-provisioned',
    '[10:42:03] DISPATCH: Slack alert dispatched to #eng-incident-room'
  ]);

  const runSimulation = () => {
    if (isRunning) return;
    setIsRunning(true);
    setActiveStep(0);
    setLogs(['[SIMULATION] Initiating live workflow trigger...']);

    const steps = [
      { step: 1, log: '[10:44:12] INGEST: Inbound payload parsed (order_tier: Enterprise)' },
      { step: 2, log: '[10:44:13] EVAL: AI Decision Node passed conditions in 12ms' },
      { step: 3, log: '[10:44:14] EXECUTE: Multi-destination sync completed (status: OK)' }
    ];

    steps.forEach((s, idx) => {
      setTimeout(() => {
        setActiveStep(s.step);
        setLogs((prev) => [...prev, s.log]);
        if (idx === steps.length - 1) {
          setIsRunning(false);
        }
      }, (idx + 1) * 800);
    });
  };

  return (
    <div className="relative mx-auto max-w-5xl rounded-2xl border border-slate-700/60 bg-slate-900/95 p-3 sm:p-5 shadow-2xl shadow-indigo-950/40 text-slate-100 overflow-hidden backdrop-blur-xl">
      {/* Top window chrome */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 px-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-rose-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
          </div>
          <span className="text-xs font-mono text-slate-400 pl-3 hidden sm:inline">
            novaflow-pipeline-live.prod.ts
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            CLUSTER ACTIVE
          </span>
          <button
            onClick={runSimulation}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg shadow-sm cursor-pointer transition-all active:scale-95"
          >
            {isRunning ? (
              <>
                <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                <span>Running...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Simulate Trigger</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main interactive node canvas */}
      <div className="py-6 px-2 sm:px-4 grid grid-cols-1 lg:grid-cols-3 gap-4 items-center">
        {/* Node 1: Trigger */}
        <div
          className={`p-4 rounded-xl border transition-all duration-300 ${
            activeStep >= 1
              ? 'bg-slate-800/90 border-indigo-500 shadow-md shadow-indigo-500/10'
              : 'bg-slate-900/60 border-slate-800 opacity-60'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-semibold text-white block">Event Trigger</span>
                <span className="text-[11px] text-slate-400">Stripe Webhook API</span>
              </div>
            </div>
            {activeStep >= 1 ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <Clock className="w-4 h-4 text-slate-500" />
            )}
          </div>
          <p className="text-xs text-slate-300 font-mono bg-slate-950/70 p-2 rounded border border-slate-800/80 truncate">
            POST /v1/webhooks/payment
          </p>
        </div>

        {/* Node 2: AI Reasoning */}
        <div
          className={`p-4 rounded-xl border relative transition-all duration-300 ${
            activeStep >= 2
              ? 'bg-slate-800/90 border-indigo-500 shadow-md shadow-indigo-500/10'
              : 'bg-slate-900/60 border-slate-800 opacity-60'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-semibold text-white block">AI Triage Node</span>
                <span className="text-[11px] text-slate-400">Sentiment & Urgency</span>
              </div>
            </div>
            {activeStep >= 2 ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <Clock className="w-4 h-4 text-slate-500" />
            )}
          </div>
          <p className="text-xs text-slate-300 font-mono bg-slate-950/70 p-2 rounded border border-slate-800/80 truncate">
            eval(payload) -&gt; Priority: HIGH
          </p>
        </div>

        {/* Node 3: Target Action */}
        <div
          className={`p-4 rounded-xl border transition-all duration-300 ${
            activeStep >= 3
              ? 'bg-slate-800/90 border-emerald-500/80 shadow-md shadow-emerald-500/10'
              : 'bg-slate-900/60 border-slate-800 opacity-60'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-semibold text-white block">Multi-Sync Action</span>
                <span className="text-[11px] text-slate-400">Linear + Slack Room</span>
              </div>
            </div>
            {activeStep >= 3 ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <Clock className="w-4 h-4 text-slate-500" />
            )}
          </div>
          <p className="text-xs text-slate-300 font-mono bg-slate-950/70 p-2 rounded border border-slate-800/80 truncate">
            status: 200 OK (Latency: 14ms)
          </p>
        </div>
      </div>

      {/* Terminal Telemetry Log Drawer */}
      <div className="mt-2 bg-slate-950/90 rounded-xl border border-slate-800/80 p-3 font-mono text-xs text-slate-300">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-indigo-400" />
            <span>REAL-TIME PIPELINE LOGS</span>
          </div>
          <span className="tabular-nums">Avg Latency: 22ms</span>
        </div>
        <div className="space-y-1 max-h-24 overflow-y-auto">
          {logs.map((log, i) => (
            <div key={i} className="flex items-center gap-2 leading-relaxed">
              <span className="text-indigo-400 select-none">&gt;</span>
              <span className={log.includes('OK') || log.includes('verified') ? 'text-emerald-300' : 'text-slate-300'}>
                {log}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
