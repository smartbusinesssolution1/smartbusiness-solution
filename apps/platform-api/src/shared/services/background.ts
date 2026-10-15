import { logger } from "./logger.js";

// ═══════════════════════════════════════════════════════════════
// BACKGROUND WORK THAT OUTLIVES ITS REQUEST
//
// Some work runs after the HTTP reply was sent (e.g. the forgot-password email, so
// every email answers equally fast). Tracking it lets a shutdown wait for it instead
// of silently dropping a half-sent email during a deploy, and lets tests wait for it
// before emptying the database.
//
// This is in-process: a crash still loses pending work. A durable job queue (outbox)
// is the next step when guaranteed delivery is needed.
// ═══════════════════════════════════════════════════════════════

const inFlight = new Set<Promise<void>>();

// Starts `work` without waiting for it. Failures are logged, never thrown at a caller.
export function runInBackground(task: string, work: () => Promise<unknown>): void {
  const running: Promise<void> = work()
    .then(() => undefined)
    .catch((err: unknown) => {
      logger.error({ err, task }, "Background task failed");
    })
    .finally(() => {
      inFlight.delete(running);
    });
  inFlight.add(running);
}

// Waits until no background work is running, or until `timeoutMs` has passed.
// Returns how many tasks were still running when it gave up (0 = all finished).
export async function drainBackgroundWork(timeoutMs = 10_000): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  // Loop: a task may start more work while we wait.
  while (inFlight.size > 0 && Date.now() < deadline) {
    const remaining = deadline - Date.now();
    await Promise.race([
      Promise.allSettled([...inFlight]),
      new Promise((resolve) => setTimeout(resolve, remaining)),
    ]);
  }
  return inFlight.size;
}

export function backgroundWorkCount(): number {
  return inFlight.size;
}
