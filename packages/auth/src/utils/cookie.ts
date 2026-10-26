import type { CookieOptions } from "express";

export interface CookieConfig {
  isDev: boolean;
  cookieDomain?: string;
  accessTokenMaxAge?: number;
  refreshTokenMaxAge?: number;
}

const DEFAULT_ACCESS_MAX_AGE = 15 * 60 * 1000; // 15 minutes
const DEFAULT_REFRESH_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

export function getCookieBase(config: CookieConfig): CookieOptions {
  const isSecure = process.env.COOKIE_SECURE !== undefined
    ? process.env.COOKIE_SECURE === "true"
    : !config.isDev;

  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    ...(config.cookieDomain && { domain: config.cookieDomain }),
  };
}

export function getAccessCookieOptions(config: CookieConfig): CookieOptions {
  return {
    ...getCookieBase(config),
    maxAge: config.accessTokenMaxAge ?? DEFAULT_ACCESS_MAX_AGE,
    path: "/api",
  };
}

export function getRefreshCookieOptions(config: CookieConfig): CookieOptions {
  return {
    ...getCookieBase(config),
    maxAge: config.refreshTokenMaxAge ?? DEFAULT_REFRESH_MAX_AGE,
    path: "/api/v1/auth",
  };
}
