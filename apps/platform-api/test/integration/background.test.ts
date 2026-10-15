import { describe, expect, it } from "vitest";
import { backgroundWorkCount, drainBackgroundWork, runInBackground } from "../../src/shared/services/background.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("background work", () => {
  it("lets a shutdown wait for work that outlived its request", async () => {
    let finished = false;
    runInBackground("slow-email", async () => {
      await sleep(200);
      finished = true;
    });

    expect(backgroundWorkCount()).toBe(1);
    expect(await drainBackgroundWork(2_000)).toBe(0);
    expect(finished).toBe(true);
  });

  it("never throws a failed task at the caller", async () => {
    runInBackground("broken", async () => {
      throw new Error("email provider down");
    });
    expect(await drainBackgroundWork(2_000)).toBe(0);
  });

  it("gives up after the timeout and reports what is still running", async () => {
    runInBackground("stuck", () => sleep(600));
    expect(await drainBackgroundWork(100)).toBe(1);
    expect(await drainBackgroundWork(2_000)).toBe(0);
  });

  it("waits for work started by other background work", async () => {
    let inner = false;
    runInBackground("outer", async () => {
      await sleep(50);
      runInBackground("inner", async () => {
        await sleep(100);
        inner = true;
      });
    });
    await drainBackgroundWork(2_000);
    expect(inner).toBe(true);
  });
});
