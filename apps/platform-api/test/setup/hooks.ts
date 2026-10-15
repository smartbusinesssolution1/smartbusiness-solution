// Runs after env.ts (setup files run in order), so the app's config is already set.
import { afterAll, afterEach, beforeAll } from "vitest";
import { closeQueues } from "../../src/jobs/queues.js";
import { emailQueue, startTestWorker, stopTestWorker, waitForQueueIdle } from "../helpers/worker.js";

beforeAll(() => {
  startTestWorker();
});

// Every job a test started must finish before the next test empties the database,
// and finished jobs are removed so each test starts with an empty queue.
afterEach(async () => {
  startTestWorker(); // a test may have stopped it
  await waitForQueueIdle();
  await emailQueue.raw.obliterate({ force: true });
});

afterAll(async () => {
  await stopTestWorker();
  await closeQueues();
});
