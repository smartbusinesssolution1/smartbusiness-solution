import { prisma } from "@smartbusiness/database";
import { startEmailWorker } from "./jobs/email-worker.js";
import { closeQueues } from "./jobs/queues.js";
import { logger } from "./shared/services/logger.js";

// The job worker as its own process (`pnpm start:worker`). In production the API and
// the worker run separately, so slow jobs never compete with API requests, and each
// can be scaled on its own.
async function startWorker() {
  await prisma.$queryRawUnsafe("SELECT 1");
  const emailWorker = startEmailWorker();
  logger.info("Job worker started");

  let stopping = false;
  const stop = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    logger.info({ signal }, "Job worker stopping: finishing running jobs");
    const forceExit = setTimeout(() => process.exit(1), 30_000);
    forceExit.unref();
    await emailWorker.close();
    await closeQueues();
    await prisma.$disconnect();
    logger.info("Job worker stopped");
    process.exit(0);
  };

  process.on("SIGTERM", () => void stop("SIGTERM"));
  process.on("SIGINT", () => void stop("SIGINT"));
}

startWorker().catch(async (err) => {
  logger.fatal(err, "Job worker failed to start");
  await prisma.$disconnect();
  process.exit(1);
});
