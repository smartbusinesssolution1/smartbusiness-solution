export type LogSeverity = 'FATAL' | 'ERROR' | 'WARN' | 'INFO';

export type ServiceName =
  | 'platform-api'
  | 'check-printing-backend'
  | 'clockInClockOut-backend'
  | 'face-recognition'
  | 'stripe-worker'
  | 'prisma-database';

export interface ErrorLogRecord {
  traceId: string;
  timestamp: string;
  severity: LogSeverity;
  service: ServiceName;
  endpoint: string;
  httpStatus?: number;
  tenantId?: string;
  tenantName?: string;
  userId?: string;
  userEmail?: string;
  message: string;
  stackTrace?: string;
  payload?: Record<string, unknown>;
}

export interface ServiceHealthStatus {
  service: ServiceName;
  port: number;
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  uptimePercent: number;
  latencyMs: number;
  lastCheckedAt: string;
}
