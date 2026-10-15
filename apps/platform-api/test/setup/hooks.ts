// Runs after env.ts (setup files run in order), so the app's config is already set.
import { afterEach } from "vitest";
import { drainBackgroundWork } from "../../src/shared/services/background.js";

// Work that outlives its request (e.g. the forgot-password email) must finish before
// the next test empties the database underneath it.
afterEach(async () => {
  const unfinished = await drainBackgroundWork(5_000);
  if (unfinished > 0) throw new Error(`${unfinished} background task(s) still running after the test`);
});
