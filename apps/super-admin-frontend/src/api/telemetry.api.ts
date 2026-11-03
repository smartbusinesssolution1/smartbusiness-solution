import type { ErrorLogRecord } from '../types';
import { apiClient } from './client';

export const MOCK_ERROR_LOGS: ErrorLogRecord[] = [
  {
    traceId: 'tr_ck_9941a80',
    timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    severity: 'ERROR',
    service: 'check-printing-backend',
    endpoint: 'POST /api/v1/checks/print-batch',
    httpStatus: 500,
    tenantId: 'tenant_apex_84920489',
    tenantName: 'Apex Holdings LLC',
    userId: 'usr_84920489',
    userEmail: 'marcus@apexholdings.us',
    message: 'MICR font calibration offset calculation out of bounds: bottom_margin < 0.625"',
    stackTrace: `Error: MICR font calibration offset calculation out of bounds: bottom_margin < 0.625"
    at CheckCalibrationService.validateOffset (apps/check-printing-backend/src/services/calibration.service.ts:142:19)
    at CheckController.printBatch (apps/check-printing-backend/src/controllers/check.controller.ts:89:32)
    at Layer.handle [as handle_request] (node_modules/.pnpm/express@4.21.2/node_modules/express/lib/router/layer.js:95:5)
    at next (node_modules/.pnpm/express@4.21.2/node_modules/express/lib/router/route.js:149:13)`,
    payload: {
      batchId: 'bat_4491',
      checksCount: 25,
      printerDpi: 600,
      paperSize: 'LETTER',
      bottomMargin: 0.58,
    },
  },
  {
    traceId: 'tr_cl_8820c19',
    timestamp: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    severity: 'ERROR',
    service: 'clockInClockOut-backend',
    endpoint: 'POST /api/v1/attendance/verify-face',
    httpStatus: 400,
    tenantId: 'tenant_beacon_99302144',
    tenantName: 'Beacon Healthcare Group',
    userId: 'emp_99182',
    userEmail: 'nurse.valerie@beaconhealth.org',
    message: 'Biometric face embedding vector similarity (0.64) below security threshold (0.85) on Kiosk #3',
    stackTrace: `BiometricMismatchException: Face embedding cosine similarity 0.6421 does not meet required confidence 0.8500
    at FaceRecognitionClient.verifyEmbedding (apps/clockInClockOut-backend/src/services/face-auth.service.ts:88:15)
    at AttendanceController.clockIn (apps/clockInClockOut-backend/src/controllers/attendance.controller.ts:45:22)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`,
    payload: {
      kioskId: 'kiosk_miami_urgent_care_03',
      confidence: 0.6421,
      requiredThreshold: 0.85,
      ambientLux: 140,
      captureWidth: 1280,
    },
  },
  {
    traceId: 'tr_ck_3310f92',
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    severity: 'FATAL',
    service: 'check-printing-backend',
    endpoint: 'POST /api/v1/checks/void-auth',
    httpStatus: 504,
    tenantId: 'tenant_sterling_55210984',
    tenantName: 'Sterling Capital Partners',
    userId: 'usr_55210984',
    userEmail: 'r.sterling@sterlingcap.com',
    message: 'Check void authorization timeout after 5000ms on Chase Treasury Gateway',
    stackTrace: `GatewayTimeoutError: Upstream bank connection timed out: https://api.chase.com/treasury/v2/void
    at BankGatewayClient.requestVoidAuth (apps/check-printing-backend/src/gateways/chase.gateway.ts:114:13)
    at VoidCheckHandler.execute (apps/check-printing-backend/src/handlers/void-check.handler.ts:56:29)`,
    payload: {
      checkNumber: '100482',
      accountRouting: '071000013',
      amount: 14500.0,
      gatewayResponseTimeMs: 5012,
    },
  },
  {
    traceId: 'tr_st_4402a11',
    timestamp: new Date(Date.now() - 24 * 60 * 1000).toISOString(),
    severity: 'WARN',
    service: 'stripe-worker',
    endpoint: 'POST /api/v1/webhooks/stripe',
    httpStatus: 400,
    tenantId: 'tenant_pacific_33109281',
    tenantName: 'Pacific Coast Logistics',
    userEmail: 'billing@pacificcoast.com',
    message: 'Stripe invoice payment failed: card_declined for customer cus_O92k4a',
    stackTrace: `StripeCardError: Your card was declined.
    at StripeWebhookConsumer.handleInvoicePaymentFailed (packages/billing/src/webhooks/stripe.worker.ts:74:18)
    at QueueWorker.processJob (packages/billing/src/workers/queue.ts:112:9)`,
    payload: {
      stripeCustomerId: 'cus_O92k4a',
      declineCode: 'insufficient_funds',
      invoiceId: 'in_1Oq7X2S77',
      attemptCount: 2,
    },
  },
  {
    traceId: 'tr_au_1048b29',
    timestamp: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    severity: 'WARN',
    service: 'platform-api',
    endpoint: 'POST /api/v1/auth/sign-in',
    httpStatus: 429,
    tenantId: 'tenant_pacific_33109281',
    tenantName: 'Pacific Coast Logistics',
    userId: 'usr_33109281',
    userEmail: 'dthorne@pacificcoast.com',
    message: 'Account Lockout threshold triggered: 5th consecutive invalid password attempt.',
    stackTrace: `Warning: Account Lockout threshold triggered
    at PasswordAuthService.verifyCredentials (packages/auth/src/services/password.service.ts:62:15)
    at AuthController.signIn (apps/platform-api/src/routes/auth.route.ts:44:26)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`,
    payload: {
      email: 'dthorne@pacificcoast.com',
      failedAttempts: 5,
      ipAddress: '198.51.100.41',
      lockDurationMinutes: 30,
    },
  },
  {
    traceId: 'tr_db_1190e44',
    timestamp: new Date(Date.now() - 52 * 60 * 1000).toISOString(),
    severity: 'ERROR',
    service: 'prisma-database',
    endpoint: 'PRISMA: $transaction(User, AuditLog)',
    httpStatus: 500,
    tenantId: 'SYSTEM',
    tenantName: 'PostgreSQL Pool',
    message: 'Connection pool contention: pool exhausted at 20/20 active connections during peak batch',
    stackTrace: `PrismaClientKnownRequestError: Timed out fetching a new connection from the connection pool. (More info: http://pris.ly/d/connection-pool-timeout)
    at PrismaPoolManager.getConnection (node_modules/.pnpm/@prisma+client@6.3.1/runtime/library.js:42:19)
    at TransactionManager.start (packages/database/src/client.ts:88:24)`,
    payload: {
      maxConnections: 20,
      activeConnections: 20,
      queuedRequests: 14,
      timeoutMs: 5000,
    },
  },
];

export async function fetchTelemetryLogs(): Promise<ErrorLogRecord[]> {
  try {
    return await apiClient<ErrorLogRecord[]>('/api/v1/super-admin/telemetry');
  } catch {
    return MOCK_ERROR_LOGS;
  }
}
