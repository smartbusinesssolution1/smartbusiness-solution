import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma, resetDatabase, seedProducts } from "../helpers/db.js";
import { AuthClient, getApp } from "../helpers/auth-client.js";
import { outbox, tokenFrom, waitForEmail } from "../helpers/emails.js";
import { emailQueue, waitForQueueIdle } from "../helpers/worker.js";

// Clock-In onboards employees the same way Check Printing invites people: the employee is
// created WITHOUT a password and a "workspace-invitation" job is queued (product
// "clock-in-clock-out"). Nobody is emailed a password: a new employee chooses their own
// through the link, which opens Clock-In; someone who already has an account just gets
// "you now have access" with Clock-In's sign-in page.

const EMPLOYEE = "ravi@greenacres.test";
const CLOCK_IN = "https://clock.smartbusiness.test"; // test-env.ts CLOCK_IN_APP_URL
const CHECK_PRINTING = "https://app.smartbusiness.test"; // test-env.ts APP_URL
const PASSWORD = "Ravi-Chooses#2026";

let admin: { id: string; tenantId: string };
let workspaceId: string;

beforeEach(async () => {
  await resetDatabase();
  await seedProducts();
  const reg = await new AuthClient().register();
  admin = { id: reg.body.data.user.id, tenantId: reg.body.data.tenants[0].tenantId };
  workspaceId = (
    await prisma.workspace.create({
      data: { tenantId: admin.tenantId, businessName: "Green Acres - Yard", addressLine1: "1 Main St", city: "Austin", state: "TX", zipCode: "78701" },
    })
  ).id;
  await waitForQueueIdle();
  outbox.clear();
});

// What Clock-In's admin-employee service now does when an admin adds an employee.
async function addEmployee(passwordHash: string | null = null): Promise<string> {
  const user = await prisma.user.create({ data: { email: EMPLOYEE, fullName: "Ravi Kumar", passwordHash } });
  await prisma.tenantMember.create({ data: { tenantId: admin.tenantId, userId: user.id, role: "MEMBER" } });
  await prisma.workspaceMember.create({ data: { workspaceId, userId: user.id } });
  await emailQueue.add("workspace-invitation", { userId: user.id, workspaceId, invitedById: admin.id, product: "clock-in-clock-out" });
  await waitForQueueIdle();
  return user.id;
}

describe("a new Clock-In employee", () => {
  it("gets a link to choose their own password, on Clock-In, and no password", async () => {
    await addEmployee();

    const email = await waitForEmail(EMPLOYEE, "invitation");
    const token = tokenFrom(email, "/accept-invitation");
    expect(email.text).toContain(`${CLOCK_IN}/accept-invitation#token=${token}`);
    expect(`${email.text}${email.html}`).not.toContain(CHECK_PRINTING);
    expect(`${email.text}${email.html}`).not.toMatch(/password\s*:/i);
  });

  it("chooses their password through the link, and then signs in with it", async () => {
    await addEmployee();
    const token = tokenFrom(await waitForEmail(EMPLOYEE, "invitation"), "/accept-invitation");

    const inspected = await request(getApp()).post("/api/v1/auth/invitations/inspect").send({ token });
    expect(inspected.body.data).toMatchObject({ email: EMPLOYEE, workspaceName: "Green Acres - Yard", accountReady: false });

    const accepted = await request(getApp()).post("/api/v1/auth/invitations/accept").send({ token, fullName: "Ravi Kumar", password: PASSWORD });
    expect(accepted.status).toBe(200);

    expect((await new AuthClient().login(EMPLOYEE, PASSWORD)).status).toBe(200);
  });

  it("can't sign in before choosing a password (the account has none)", async () => {
    await addEmployee();

    expect((await new AuthClient().login(EMPLOYEE, "anything-at-all")).status).toBe(401);
  });
});

describe("someone who already has an account", () => {
  it("is told they now have access, with Clock-In's sign-in page: no link, no password", async () => {
    // Already a SmartBusiness user (e.g. uses Check Printing) with their own password.
    await addEmployee("$argon2id$v=19$m=65536,t=3,p=4$existingexistingexis$existingexistingexistingexistingexistingexi");

    const email = await waitForEmail(EMPLOYEE, "added-to-workspace");
    expect(email.text).toContain(`${CLOCK_IN}/login`);
    expect(email.text).not.toContain("accept-invitation");
    expect(`${email.text}${email.html}`).not.toMatch(/password\s*:/i);
    expect(outbox.to(EMPLOYEE, "invitation")).toEqual([]);
  });
});

describe("the job and the other product", () => {
  it("the queued job holds ids and the product only, never a password or a link token", async () => {
    const add = vi.spyOn(emailQueue, "add");
    const userId = await addEmployee();

    expect(add).toHaveBeenCalledWith("workspace-invitation", { userId, workspaceId, invitedById: admin.id, product: "clock-in-clock-out" });
    expect(await prisma.userToken.count({ where: { userId } })).toBe(1); // created by the worker when it sent the email
    add.mockRestore();
  });

  it("an invitation without a product still opens Check Printing, unchanged", async () => {
    const user = await prisma.user.create({ data: { email: EMPLOYEE, fullName: "Ravi Kumar", passwordHash: null } });
    await prisma.tenantMember.create({ data: { tenantId: admin.tenantId, userId: user.id, role: "MEMBER" } });
    await prisma.workspaceMember.create({ data: { workspaceId, userId: user.id } });
    await emailQueue.add("workspace-invitation", { userId: user.id, workspaceId, invitedById: admin.id });
    await waitForQueueIdle();

    const email = await waitForEmail(EMPLOYEE, "invitation");
    expect(email.text).toContain(`${CHECK_PRINTING}/accept-invitation#token=`);
  });
});
