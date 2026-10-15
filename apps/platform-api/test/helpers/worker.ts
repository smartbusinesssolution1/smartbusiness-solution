import { startEmailWorker } from "../../src/jobs/email-worker.js";
import { emailQueue } from "../../src/jobs/queues.js";

// One real job worker per test file, running against the test Redis, exactly like the
// development setup. Tests can stop it (to prove jobs wait safely) and start it again.

let running: ReturnType<typeof startEmailWorker> | null = null;

export function startTestWorker(): void {
  running ??= startEmailWorker();
}

export async function stopTestWorker(): Promise<void> {
  const current = running;
  running = null;
  await current?.close();
}

// Waits until the queue has nothing waiting, running or scheduled for a retry.
export async function waitForQueueIdle(timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while ((await emailQueue.pendingCount()) > 0) {
    if (Date.now() > deadline) throw new Error("The job queue did not become idle in time");
    await new Promise((r) => setTimeout(r, 25));
  }
}

export { emailQueue };
