import { beforeEach, describe, expect, it } from "vitest";
import { outbox, settle, waitForEmail } from "../helpers/emails.js";
import { emailQueue, waitForQueueIdle } from "../helpers/worker.js";

// "notification-email": a product (Check Printing) built the email; the worker only sends it.
// It is still checked: one recipient, one-line subject. An unsafe message can never become
// safe by retrying, so it fails for good at once instead of being retried five times.

beforeEach(() => {
  outbox.clear();
});

const notice = {
  to: "david@greenacres.test",
  tag: "approval-request",
  subject: "Approval needed: check #005009 · $9,000.00 to Lala Company",
  html: "<p>Review the check</p>",
  text: "Review the check",
};

describe("ready-made notification emails", () => {
  it("are sent exactly as built", async () => {
    await emailQueue.add("notification-email", notice);
    const sent = await waitForEmail(notice.to, "approval-request");
    expect(sent).toMatchObject(notice);
  });

  it("an unsafe one (a second address, a header smuggled into the subject) is refused, never sent, never retried", async () => {
    const jobIds = [
      await emailQueue.add("notification-email", { ...notice, to: "a@greenacres.test, attacker@evil.test" }),
      await emailQueue.add("notification-email", { ...notice, subject: "Hi\r\nBcc: attacker@evil.test" }),
    ];
    await waitForQueueIdle();
    await settle();
    expect(outbox.sent).toEqual([]);
    for (const id of jobIds) {
      const job = await emailQueue.raw.getJob(id);
      expect(await job!.getState()).toBe("failed");
      expect(job!.attemptsMade).toBe(1);
    }
  });
});
