// The SmartBusiness portal (apps/platform-web): where companies create their account and
// get products. Check Printing no longer has a sign-up of its own; it sends people there.
//
// Set at build time with VITE_PORTAL_URL (production: the portal's subdomain, e.g.
// https://app.example.com). In development the portal runs on localhost:3003. A production
// build without it has no address: the app then says where to go instead of linking to
// localhost.

import { ApiError } from "./api";

const DEV_PORTAL_URL = "http://localhost:3003";

// The API's code for "this company doesn't have Check Printing" (requireProduct in
// @smartbusiness/auth): different from not being a member of a workspace. The app answers
// it with a way to the portal, where products are added.
export function isProductNotAvailable(error: unknown): boolean {
  return error instanceof ApiError && error.code === "PRODUCT_NOT_AVAILABLE";
}

export function portalUrl(env: { DEV?: boolean; VITE_PORTAL_URL?: string } = import.meta.env): string | null {
  const configured = env.VITE_PORTAL_URL?.trim();
  const base = configured || (env.DEV ? DEV_PORTAL_URL : "");
  return base ? base.replace(/\/+$/, "") : null;
}

// The portal's sign-up: it opens on "Create your company account" when asked to.
export function portalSignUpUrl(env?: { DEV?: boolean; VITE_PORTAL_URL?: string }): string | null {
  const base = portalUrl(env);
  return base ? `${base}/?start=signup` : null;
}
