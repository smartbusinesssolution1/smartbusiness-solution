import { assertSendable } from "@smartbusiness/email";
import { createTypedWorker, createWorkerConnection, QUEUES, UnrecoverableError, type EmailJobs, type Worker } from "@smartbusiness/jobs";
import { jobs } from "../config/index.js";
import { authService } from "../modules/auth/auth.module.js";
import { logger } from "../shared/services/logger.js";
import { emailSender } from "../shared/services/email.js";

// Processes the "emails" queue. Every processor must be safe to run more than once:
// BullMQ retries failed jobs and re-runs jobs whose worker crashed.
export function startEmailWorker(): { worker: Worker; close: () => Promise<void> } {
  const connection = createWorkerConnection(jobs.redisUrl);
  connection.on("error", (err) => logger.warn({ err: err.message }, "Redis (worker) connection problem"));

  const worker = createTypedWorker<EmailJobs>(
    QUEUES.emails,
    {
      "password-reset": (data, job) =>
        authService.processPasswordResetJob(data.email, {
          // A retry of the same request must not be blocked by the one-per-minute
          // cooldown that its own first attempt started.
          isRetry: job.attemptsMade > 0,
          ipAddress: data.ipAddress,
          appUrl: data.appUrl,
        }),
      "workspace-invitation": (data) => authService.processWorkspaceInvitationJob(data),
      // Already built by the product; checked by the sender (one address, one-line subject).
      // An unsafe message can never become safe on a retry, so it fails for good at once.
      "notification-email": async (data) => {
        try {
          assertSendable({ ...data });
        } catch (err) {
          throw new UnrecoverableError(err instanceof Error ? err.message : String(err));
        }
        await emailSender.send({ ...data });
      },
    },
    connection,
    {
      onFailed: (f) =>
        logger[f.willRetry ? "warn" : "error"](
          { queue: f.queue, job: f.jobName, jobId: f.jobId, attempt: f.attempt, err: f.error },
          f.willRetry ? "Job failed; it will be retried" : "Job failed for good; kept in the failed list",
        ),
    },
  );

  return {
    worker,
    // Finishes running jobs, takes no new ones; anything else stays in Redis.
    close: async () => {
      await worker.close();
      await connection.quit().catch(() => connection.disconnect());
    },
  };
}
