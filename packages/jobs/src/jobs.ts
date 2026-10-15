// ═══════════════════════════════════════════════════════════════
// QUEUES AND THEIR JOBS
//
// Every job type is declared here with the exact shape of its data, so the code
// that adds a job and the worker that processes it cannot disagree.
//
// Rule: jobs carry IDs and plain values, never secrets. Job data sits in Redis until
// the job finishes (failed jobs are kept for days), so a reset token or a password
// must never be part of it; the worker creates tokens when it runs.
//
// Rule: a job may run more than once (at-least-once delivery after a crash or a
// retry), so every processor must be safe to repeat.
// ═══════════════════════════════════════════════════════════════

export const QUEUES = {
  // Account emails: processed by platform-api's worker (identity belongs to the platform)
  emails: "emails",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export interface EmailJobs {
  // Forgot-password: added for EVERY request (known or unknown email), so adding it
  // takes the same time either way; the worker does the lookup.
  "password-reset": { email: string; ipAddress?: string };
}
