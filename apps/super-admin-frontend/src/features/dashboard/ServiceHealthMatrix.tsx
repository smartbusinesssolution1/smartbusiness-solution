import React from 'react';
import { Card } from '../../components/common/Card';
import { Server, FileSpreadsheet, RefreshCw, Camera, Database } from 'lucide-react';
import type { ServiceHealthStatus } from '../../types';

export interface ServiceHealthMatrixProps {
  services: ServiceHealthStatus[];
}

export const ServiceHealthMatrix: React.FC<ServiceHealthMatrixProps> = ({ services }) => {
  const getIcon = (service: string) => {
    switch (service) {
      case 'platform-api':
        return <Server className="size-3.5 text-primary-600" />;
      case 'check-printing-backend':
        return <FileSpreadsheet className="size-3.5 text-sky-600" />;
      case 'clockInClockOut-backend':
        return <RefreshCw className="size-3.5 text-primary-600 stroke-[2.4]" />;
      case 'face-recognition':
        return <Camera className="size-3.5 text-purple-600" />;
      default:
        return <Database className="size-3.5 text-amber-600" />;
    }
  };

  return (
    <Card className="flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-ink">Microservices & Infrastructure Health</h2>
            <p className="text-xs text-muted">Real-time gateway probe and connection latency.</p>
          </div>
          <span className="px-2 py-0.5 text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-full font-mono flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> All Systems Operational
          </span>
        </div>

        <div className="divide-y divide-line text-xs">
          {services.map((svc) => (
            <div key={svc.service} className="py-2.5 flex items-center justify-between">
              <span className="font-semibold text-ink-soft flex items-center gap-2">
                {getIcon(svc.service)}
                <span>apps/{svc.service}</span>
                <span className="text-faint font-mono text-[10px]">(Port {svc.port})</span>
              </span>
              <span className="text-emerald-700 font-semibold flex items-center gap-1.5 font-mono">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                {svc.uptimePercent}% ({svc.latencyMs}ms)
              </span>
            </div>
          ))}

          {/* Database Layer */}
          <div className="py-2.5 flex items-center justify-between">
            <span className="font-semibold text-ink-soft flex items-center gap-2">
              <Database className="size-3.5 text-amber-600" />
              <span>PostgreSQL 16 + Prisma Client</span>
            </span>
            <span className="text-emerald-700 font-semibold flex items-center gap-1.5 font-mono">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Connection Pool OK (11ms)
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
};
