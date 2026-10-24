import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabase, seedProducts } from "../helpers/db.js";
import { AuthClient, getApp, parseSetCookies, VALID_PASSWORD } from "../helpers/auth-client.js";

// S4: SameSite=Lax cookies don't stop everything. A hidden form on another website could
// sign the visitor into the ATTACKER's account (login CSRF: no cookie needed), after which
// whatever they type, bank details included, lands in the attacker's company. Changes
// requested by a page on a website we don't serve are now refused.
//
// The mobile app is unaffected: it sends no Origin, or announces itself with the platform
// header, which a forged request can't carry.

const LOGIN = "/api/v1/auth/login";
const EVIL = "https://evil.example";
const WEB = "http://localhost:5173";
const CREDENTIALS = { email: "maria@greenacres.test", password: VALID_PASSWORD };

beforeEach(async () => {
  await resetDatabase();
  await seedProducts();
  await new AuthClient().register();
});

describe("login CSRF", () => {
  it("a hidden form on another website can't sign the visitor in: 403, and no login cookie", async () => {
    const res = await request(getApp()).post(LOGIN).set("Origin", EVIL).type("form").send(CREDENTIALS);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ORIGIN_NOT_ALLOWED");
    expect(parseSetCookies(res).access_token).toBeUndefined();
  });

  it("claiming to be the app in the body doesn't help: a form can send that", async () => {
    const res = await request(getApp()).post(LOGIN).set("Origin", EVIL).type("form").send({ ...CREDENTIALS, platform: "app" });

    expect(res.status).toBe(403);
  });
});

describe("what keeps working", () => {
  it("our web app signs in", async () => {
    expect((await request(getApp()).post(LOGIN).set("Origin", WEB).send(CREDENTIALS)).status).toBe(200);
  });

  it("the Clock-In web app signs in (its address is on the list)", async () => {
    expect((await request(getApp()).post(LOGIN).set("Origin", "http://localhost:5174").send(CREDENTIALS)).status).toBe(200);
  });

  it("a mobile app with no Origin signs in", async () => {
    expect((await request(getApp()).post(LOGIN).set("x-platform", "app").send(CREDENTIALS)).status).toBe(200);
  });

  it("a mobile app inside a web view (an Origin we don't list) signs in: it sends the platform header", async () => {
    const res = await request(getApp()).post(LOGIN).set("Origin", "capacitor://localhost").set("x-platform", "app").send(CREDENTIALS);

    expect(res.status).toBe(200);
  });

  it("form-encoded sign-ins from an allowed origin still work (platform-api keeps forms for Clock-In)", async () => {
    expect((await request(getApp()).post(LOGIN).set("Origin", WEB).type("form").send(CREDENTIALS)).status).toBe(200);
  });
});

describe("logout CSRF", () => {
  it("another website can't sign the visitor out: the session still works afterwards", async () => {
    const client = new AuthClient();
    await client.login();

    const res = await request(getApp())
      .post("/api/v1/auth/logout")
      .set("Origin", EVIL)
      .set("Cookie", client.cookieHeader("/api/v1/auth/logout"));

    expect(res.status).toBe(403);
    expect((await client.post("/api/v1/auth/refresh")).status).toBe(200);
  });
});
