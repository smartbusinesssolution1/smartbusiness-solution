import request from "supertest";
import type { Express } from "express";
import { createApp } from "../../src/app.js";

let app: Express | null = null;
export function getApp(): Express {
  app ??= createApp();
  return app;
}

export const VALID_PASSWORD = "Str0ng!Passw0rd";

export interface ParsedCookie {
  name: string;
  value: string;
  attributes: Record<string, string | true>;
}

/** Parses Set-Cookie headers the way a browser would read them. */
export function parseSetCookies(res: request.Response): Record<string, ParsedCookie> {
  const header = res.headers["set-cookie"] as unknown as string[] | string | undefined;
  const lines = Array.isArray(header) ? header : header ? [header] : [];
  const out: Record<string, ParsedCookie> = {};
  for (const line of lines) {
    const [pair, ...attrs] = line.split(";").map((s) => s.trim());
    const eq = pair!.indexOf("=");
    const name = pair!.slice(0, eq);
    const attributes: Record<string, string | true> = {};
    for (const a of attrs) {
      const i = a.indexOf("=");
      if (i === -1) attributes[a.toLowerCase()] = true;
      else attributes[a.slice(0, i).toLowerCase()] = a.slice(i + 1);
    }
    out[name] = { name, value: decodeURIComponent(pair!.slice(eq + 1)), attributes };
  }
  return out;
}

/**
 * A browser-like client. Cookies are Secure (as in production), and supertest's own
 * jar drops Secure cookies over plain HTTP, so this client keeps them itself and
 * sends them back explicitly, honouring the cookie Path like a browser does.
 */
export class AuthClient {
  accessToken: string | undefined;
  refreshToken: string | undefined;

  private remember(res: request.Response): request.Response {
    const cookies = parseSetCookies(res);
    for (const c of Object.values(cookies)) {
      const cleared = c.value === "" || c.attributes["expires"] === "Thu, 01 Jan 1970 00:00:00 GMT";
      if (c.name === "access_token") this.accessToken = cleared ? undefined : c.value;
      if (c.name === "refresh_token") this.refreshToken = cleared ? undefined : c.value;
    }
    return res;
  }

  /** Cookie header a browser would send to `path` (access: /api, refresh: /api/v1/auth). */
  cookieHeader(path: string): string {
    const parts: string[] = [];
    if (this.accessToken && path.startsWith("/api")) parts.push(`access_token=${this.accessToken}`);
    if (this.refreshToken && path.startsWith("/api/v1/auth")) parts.push(`refresh_token=${this.refreshToken}`);
    return parts.join("; ");
  }

  async post(path: string, body: Record<string, unknown> = {}): Promise<request.Response> {
    const req = request(getApp()).post(path).send(body);
    const cookie = this.cookieHeader(path);
    if (cookie) req.set("Cookie", cookie);
    return this.remember(await req);
  }

  async get(path: string): Promise<request.Response> {
    const req = request(getApp()).get(path);
    const cookie = this.cookieHeader(path);
    if (cookie) req.set("Cookie", cookie);
    return this.remember(await req);
  }

  register(overrides: Record<string, unknown> = {}): Promise<request.Response> {
    return this.post("/api/v1/auth/register", {
      fullName: "Maria Rodriguez",
      email: "maria@greenacres.test",
      password: VALID_PASSWORD,
      companyName: "Green Acres Landscaping LLC",
      ...overrides,
    });
  }

  login(email = "maria@greenacres.test", password = VALID_PASSWORD): Promise<request.Response> {
    return this.post("/api/v1/auth/login", { email, password });
  }

  refresh(): Promise<request.Response> {
    return this.post("/api/v1/auth/refresh");
  }

  logout(): Promise<request.Response> {
    return this.post("/api/v1/auth/logout");
  }

  logoutAll(): Promise<request.Response> {
    return this.post("/api/v1/auth/logout-all");
  }

  me(): Promise<request.Response> {
    return this.get("/api/v1/auth/me");
  }
}
