// The products the portal can send people to, and where each one lives.
//
// Each product is its own web app on its own subdomain (checks.<domain>, clock.<domain>).
// The address is set at build time (VITE_* variables, see .env.example). In development
// the apps run on fixed local ports, so those are the fallback; a production build
// without the variable has no address, and the portal shows the product as unavailable
// instead of linking to localhost.

export interface ProductInfo {
  slug: string;
  name: string;
  description: string;
  // The page to open in that app: Check Printing sends an owner with no workspace yet
  // straight on to "Create workspace".
  entryPath: string;
  envKey: 'VITE_CHECK_PRINTING_URL' | 'VITE_CLOCK_IN_URL';
  devUrl: string;
}

export const PRODUCT_CATALOG: readonly ProductInfo[] = [
  {
    slug: 'check-printing',
    name: 'Check Printing',
    description: 'Write, approve and print checks on blank check stock.',
    entryPath: '/workspaces',
    envKey: 'VITE_CHECK_PRINTING_URL',
    devUrl: 'http://localhost:5173',
  },
  {
    slug: 'clock-in-clock-out',
    name: 'Clock-In Clock-Out',
    description: 'Employee time tracking and attendance reports.',
    entryPath: '/',
    envKey: 'VITE_CLOCK_IN_URL',
    devUrl: 'http://localhost:5174',
  },
];

export interface BuildEnv {
  DEV?: boolean;
  VITE_CHECK_PRINTING_URL?: string;
  VITE_CLOCK_IN_URL?: string;
}

// The full address to open a product, or null when this build doesn't know where it is.
// tenantId: the company it is opened for, so someone in several companies lands in the one
// whose "Open" they clicked (the product only accepts one of the user's own companies).
export function productUrl(product: ProductInfo, env: BuildEnv, tenantId?: string): string | null {
  const configured = env[product.envKey]?.trim();
  const base = configured || (env.DEV ? product.devUrl : '');
  if (!base) return null;
  const url = `${base.replace(/\/+$/, '')}${product.entryPath}`;
  return tenantId ? `${url}?tenant=${encodeURIComponent(tenantId)}` : url;
}

// "Trial ends Nov 11, 2026" style date, in the reader's own locale and time zone.
export function formatTrialEnd(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
