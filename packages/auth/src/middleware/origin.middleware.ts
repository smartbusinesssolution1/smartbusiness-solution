import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/index.js";

// ═══════════════════════════════════════════════════════════════
// CSRF: WHICH WEBSITE IS ASKING?
//
// Our sessions are cookies, and a browser attaches cookies to a request whichever website
// started it. SameSite=Lax stops most cross-site requests, but not those from a site that
// counts as the "same site" (any subdomain of ours), and a sign-in form needs no cookie at
// all: a hidden form on another site can sign the visitor into the attacker's account.
//
// A browser says which page started a request in the Origin header, which page JavaScript
// can neither remove nor fake, and sends it on every POST, PUT, PATCH and DELETE. A
// request that changes something and names an origin we don't serve is refused before
// anything is read. No Origin at all means no browser started it (a mobile app, curl, one
// server calling another): it can't be riding a visitor's cookies, so it passes.
// ═══════════════════════════════════════════════════════════════

const READ_ONLY = new Set(["GET", "HEAD", "OPTIONS"]);

export interface OriginGuardOptions {
  // The same decision CORS makes: an origin allowed to read our answers may also write.
  isAllowedOrigin: (origin: string) => boolean;
  // Requests let through whatever their origin. Only for something a forged request cannot
  // carry, such as a custom header (a form can't set headers, and fetch can't send one
  // cross-site without a preflight that CORS refuses).
  exempt?: (req: Request) => boolean;
}

export function createOriginGuard({ isAllowedOrigin, exempt }: OriginGuardOptions) {
  return function originGuard(req: Request, _res: Response, next: NextFunction): void {
    if (READ_ONLY.has(req.method)) return next();

    const origin = req.headers.origin;
    if (!origin) return next();
    if (exempt?.(req)) return next();
    if (isAllowedOrigin(origin)) return next();

    // "null" (sandboxed frames, file pages) is never allowed either.
    throw new AppError("This request came from a website that isn't allowed to make changes here.", 403, "ORIGIN_NOT_ALLOWED");
  };
}
