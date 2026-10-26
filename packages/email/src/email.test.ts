import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addedToWorkspaceEmail,
  approvalRequestEmail,
  assertSendable,
  checkApprovedEmail,
  checkRejectedEmail,
  createEmailSender,
  escapeHtml,
  FileEmailSender,
  invitationEmail,
  MemoryEmailSender,
  passwordChangedEmail,
  passwordResetEmail,
  safeLink,
  type EmailMessage,
} from "./index.js";

const FROM = "SmartBusiness <no-reply@smartbusiness.test>";
const ATTACK = 'Acme<a href="https://evil.example/login">Verify your bank</a>';

describe("escapeHtml", () => {
  it("turns every HTML-significant character into plain text", () => {
    expect(escapeHtml(`<b>"Tom" & 'Jerry'</b>`)).toBe("&lt;b&gt;&quot;Tom&quot; &amp; &#39;Jerry&#39;&lt;/b&gt;");
  });
});

describe("safeLink", () => {
  it("accepts https and http links", () => {
    expect(safeLink("https://app.smartbusiness.test/reset-password?token=abc")).toBe(
      "https://app.smartbusiness.test/reset-password?token=abc",
    );
    expect(safeLink("http://localhost:5173/accept-invite?token=abc")).toContain("localhost");
  });

  // Reset and invitation links carry their token after "#" (it never reaches a server).
  it("keeps the part after # intact", () => {
    expect(safeLink("https://app.smartbusiness.test/reset-password#token=abc-DEF_123")).toBe(
      "https://app.smartbusiness.test/reset-password#token=abc-DEF_123",
    );
  });

  it.each(["javascript:alert(1)", "data:text/html,<script>", "not a url", "ftp://files.test/x"])(
    "refuses %s",
    (url) => {
      expect(() => safeLink(url)).toThrow();
    },
  );

  it("escapes characters that could close the href attribute", () => {
    expect(safeLink('https://x.test/?q="><script>')).not.toContain('"');
  });
});

describe("templates", () => {
  const reset = passwordResetEmail({
    name: "Jennifer",
    resetUrl: "https://app.smartbusiness.test/reset-password?token=RESET123",
    expiresInMinutes: 60,
  });
  const invite = invitationEmail({
    inviteeName: "Jennifer",
    inviterName: "Maria Rodriguez",
    companyName: "Green Acres Landscaping LLC",
    workspaceName: "Green Acres",
    acceptUrl: "https://app.smartbusiness.test/accept-invite?token=INVITE123",
    expiresInDays: 7,
  });
  const added = addedToWorkspaceEmail({
    name: "David",
    inviterName: "Maria Rodriguez",
    companyName: "Sunshine Pools",
    workspaceName: "Sunshine Pools",
    signInUrl: "https://app.smartbusiness.test/login",
  });
  const changed = passwordChangedEmail({ name: "Jennifer", changedAt: new Date("2026-10-15T09:30:00Z") });

  it("gives each email its own tag", () => {
    expect([reset.tag, invite.tag, added.tag, changed.tag]).toEqual([
      "password-reset",
      "invitation",
      "added-to-workspace",
      "password-changed",
    ]);
  });

  it("puts the link in both the HTML and the plain-text version", () => {
    for (const [email, token] of [
      [reset, "RESET123"],
      [invite, "INVITE123"],
    ] as const) {
      expect(email.html).toContain(token);
      expect(email.text).toContain(token);
    }
  });

  it("tells the reader how long the link lasts", () => {
    expect(reset.text).toContain("expires in 60 minutes");
    expect(invite.text).toContain("expires in 7 days");
  });

  it("names the inviter, workspace and company in an invitation", () => {
    expect(invite.subject).toBe("Maria Rodriguez invited you to Green Acres on SmartBusiness");
    expect(invite.text).toContain("Green Acres Landscaping LLC");
  });

  it("warns the owner and confirms sign-out after a password change", () => {
    expect(changed.text).toContain("Thu, 15 Oct 2026 09:30:00 GMT");
    expect(changed.text).toContain("signed out on every device");
    expect(changed.text).toContain("If this wasn't you");
  });

  it("never lets a user-supplied name inject HTML or a link", () => {
    const evil = invitationEmail({
      inviteeName: ATTACK,
      inviterName: ATTACK,
      companyName: ATTACK,
      workspaceName: ATTACK,
      acceptUrl: "https://app.smartbusiness.test/accept-invite?token=T",
      expiresInDays: 7,
    });
    expect(evil.html).not.toContain('<a href="https://evil.example');
    expect(evil.html).toContain("&lt;a href=&quot;https://evil.example/login&quot;&gt;");
    // The only link in the email is ours.
    expect(evil.html.match(/<a href=/g)).toHaveLength(1);
  });

  it("keeps a subject on one line even when a name contains line breaks", () => {
    const email = invitationEmail({
      inviteeName: "J",
      inviterName: "Maria\r\nBcc: everyone@example.test",
      companyName: "C",
      workspaceName: "W",
      acceptUrl: "https://app.smartbusiness.test/accept-invite?token=T",
      expiresInDays: 7,
    });
    expect(email.subject).not.toMatch(/[\r\n]/);
  });

  it("refuses to build an email with a non-http link", () => {
    expect(() =>
      passwordResetEmail({ name: "J", resetUrl: "javascript:alert(1)", expiresInMinutes: 60 }),
    ).toThrow(/http or https/);
  });
});

describe("check approval emails", () => {
  const check = {
    checkNumber: "005009",
    amount: "$9,000.00",
    payeeName: "Lala Company Pvt Ltd",
    workspaceName: "Green Acres Landscaping LLC",
    checkUrl: "https://app.smartbusiness.test/w/W1/checks/C1",
  };
  const request = approvalRequestEmail({ ...check, approverName: "David", writerName: "Maria Rodriguez", memo: "Rent", approvalsNeeded: 2 });
  const approved = checkApprovedEmail({ ...check, writerName: "Maria Rodriguez" });
  const rejected = checkRejectedEmail({ ...check, writerName: "Maria Rodriguez", rejectedBy: "David Park", reason: "Wrong amount" });

  it("names the check by number, amount and payee in the subject", () => {
    expect(request.subject).toBe("Approval needed: check #005009 · $9,000.00 to Lala Company Pvt Ltd");
    expect(approved.subject).toBe("Approved: check #005009 · $9,000.00 to Lala Company Pvt Ltd");
    expect(rejected.subject).toBe("Rejected: check #005009 · $9,000.00 to Lala Company Pvt Ltd");
    expect([request.tag, approved.tag, rejected.tag]).toEqual(["approval-request", "check-approved", "check-rejected"]);
  });

  it("says who wrote it, the memo, how many approvals it needs, and links to the check", () => {
    for (const body of [request.html, request.text]) {
      expect(body).toContain("Maria Rodriguez");
      expect(body).toContain("Rent");
      expect(body).toContain("needs 2 approvals");
      expect(body).toContain(check.checkUrl);
    }
  });

  it("tells the writer it is ready to print, or who rejected it and why", () => {
    expect(approved.text).toContain("ready to print");
    expect(rejected.text).toContain("David Park rejected");
    expect(rejected.text).toContain("Reason: Wrong amount");
  });

  it("never lets a payee name or a rejection reason inject HTML, and keeps subjects on one line", () => {
    const evil = checkRejectedEmail({ ...check, payeeName: ATTACK, writerName: ATTACK, rejectedBy: ATTACK, reason: ATTACK });
    expect(evil.html).not.toContain('<a href="https://evil.example');
    expect(evil.html.match(/<a href=/g)).toHaveLength(1);
    const broken = approvalRequestEmail({ ...check, payeeName: "Acme\r\nBcc: all@example.test", approverName: "D", writerName: "M", memo: null, approvalsNeeded: 1 });
    expect(broken.subject).not.toMatch(/[\r\n]/);
  });
});

describe("assertSendable", () => {
  const ok: EmailMessage = { to: "jen@greenacres.test", subject: "Hi", html: "<p>Hi</p>", text: "Hi", tag: "test" };

  it("accepts a complete message to one address", () => {
    expect(() => assertSendable(ok)).not.toThrow();
  });

  it.each([
    ["two recipients", { to: "a@x.test, b@y.test" }],
    ["a line break in the recipient", { to: "a@x.test\r\nBcc: b@y.test" }],
    ["a line break in the subject", { subject: "Hi\r\nBcc: b@y.test" }],
    ["no plain-text body", { text: "" }],
    ["not an address", { to: "jennifer" }],
  ])("refuses %s", (_label, change) => {
    expect(() => assertSendable({ ...ok, ...change })).toThrow();
  });
});

describe("MemoryEmailSender", () => {
  it("keeps sent emails, with the From address and time, for tests to read", async () => {
    const sender = new MemoryEmailSender(FROM);
    await sender.send({ to: "jen@greenacres.test", ...passwordResetEmail({ name: "J", resetUrl: "https://a.test/r?token=1", expiresInMinutes: 60 }) });
    await sender.send({ to: "jen@greenacres.test", ...passwordChangedEmail({ name: "J", changedAt: new Date() }) });

    expect(sender.sent).toHaveLength(2);
    expect(sender.sent[0]!.from).toBe(FROM);
    expect(sender.last("jen@greenacres.test")!.tag).toBe("password-changed");
    expect(sender.last("jen@greenacres.test", "password-reset")!.text).toContain("token=1");
    expect(sender.to("someone-else@x.test")).toEqual([]);

    sender.clear();
    expect(sender.sent).toHaveLength(0);
  });

  it("refuses an unsafe message instead of storing it", async () => {
    const sender = new MemoryEmailSender(FROM);
    await expect(sender.send({ to: "a@x.test, b@y.test", subject: "s", html: "h", text: "t", tag: "x" })).rejects.toThrow();
    expect(sender.sent).toHaveLength(0);
  });
});

describe("FileEmailSender", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "email-test-"));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("writes an .html and a .txt file you can open, and logs where", async () => {
    const lines: string[] = [];
    const sender = new FileEmailSender(FROM, dir, (l) => lines.push(l));
    const email = passwordResetEmail({ name: "Jennifer", resetUrl: "https://a.test/reset-password?token=XYZ", expiresInMinutes: 60 });

    await sender.send({ to: "jen@greenacres.test", ...email });

    const files = fs.readdirSync(dir).sort();
    expect(files).toHaveLength(2);
    expect(files[0]).toMatch(/_password-reset_jen@greenacres\.test\.html$/);
    expect(files[1]).toMatch(/\.txt$/);

    const html = fs.readFileSync(path.join(dir, files[0]!), "utf8");
    expect(html).toContain("token=XYZ");
    expect(html).toContain("Subject: Reset your SmartBusiness password");
    const text = fs.readFileSync(path.join(dir, files[1]!), "utf8");
    expect(text).toContain("To: jen@greenacres.test");
    expect(lines[0]).toContain("written to");
  });
});

describe("createEmailSender", () => {
  it("returns the configured delivery", () => {
    expect(createEmailSender({ transport: "memory", from: FROM })).toBeInstanceOf(MemoryEmailSender);
    expect(createEmailSender({ transport: "file", from: FROM, fileDirectory: os.tmpdir() })).toBeInstanceOf(FileEmailSender);
  });

  it("refuses the file transport without a directory", () => {
    expect(() => createEmailSender({ transport: "file", from: FROM })).toThrow(/needs a directory/);
  });

  it("refuses an unknown transport", () => {
    expect(() => createEmailSender({ transport: "pigeon" as never, from: FROM })).toThrow(/Unknown email transport/);
  });
});
