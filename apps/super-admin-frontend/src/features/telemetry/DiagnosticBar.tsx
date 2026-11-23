import React from 'react';
import { AlertTriangle, Server, Database, Activity } from 'lucide-react';

export const DiagnosticBar: React.FC = () => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Metric 1 */}
      <div className="bg-panel border border-line rounded-xl p-4 shadow-card">
        <div className="flex items-center justify-between text-muted mb-2">
          <span className="text-xs font-semibold">Error Rate (Past 1h)</span>
          <Activity className="size-4 text-emerald-600" />
        </div>
        <div className="text-2xl font-bold text-ink tracking-tight font-mono">
          0.04%
        </div>
        <p className="text-[11px] text-emerald-700 font-semibold mt-1 flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Nominal (Threshold &lt; 0.10%)
        </p>
      </div>

      {/* Metric 2 */}
      <div className="bg-panel border border-line rounded-xl p-4 shadow-card">
        <div className="flex items-center justify-between text-muted mb-2">
          <span className="text-xs font-semibold">HTTP 5xx Server Errors</span>
          <AlertTriangle className="size-4 text-rose-600" />
        </div>
        <div className="text-2xl font-bold text-rose-600 tracking-tight font-mono">
          2 <span className="text-xs font-normal text-muted font-sans">/ past 24h</span>
        </div>
        <p className="text-[11px] text-muted mt-1">1 Gateway timeout, 1 MICR offset</p>
      </div>

      {/* Metric 3 */}
      <div className="bg-panel border border-line rounded-xl p-4 shadow-card">
        <div className="flex items-center justify-between text-muted mb-2">
          <span className="text-xs font-semibold">Microservices Health</span>
          <Server className="size-4 text-primary-600" />
        </div>
        <div className="text-2xl font-bold text-primary-700 tracking-tight font-mono">
          4 / 4
        </div>
        <p className="text-[11px] text-muted mt-1">Check Printing, ClockIn, Auth & Stripe</p>
      </div>

      {/* Metric 4 */}
      <div className="bg-panel border border-line rounded-xl p-4 shadow-card">
        <div className="flex items-center justify-between text-muted mb-2">
          <span className="text-xs font-semibold">Prisma & Redis Latency</span>
          <Database className="size-4 text-primary-600" />
        </div>
        <div className="text-2xl font-bold text-ink tracking-tight font-mono">
          18ms
        </div>
        <p className="text-[11px] text-muted mt-1">P95 query latency • 0 pool timeouts</p>
      </div>
    </div>
  );
};
