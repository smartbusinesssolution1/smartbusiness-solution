import { api, ApiError } from './api';

// What platform-api's GET /auth/me returns: the person, their companies, and for each
// company the products it can open now (ACTIVE or TRIALING).
export interface PortalProduct {
  slug: string;
  name: string;
  status: 'ACTIVE' | 'TRIALING' | string;
  trialEndsAt: string | null;
}

export interface PortalTenant {
  tenantId: string;
  tenantName: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | string;
  status: string;
  products: PortalProduct[];
}

export interface PortalSession {
  user: { id: string; fullName: string; email: string };
  tenants: PortalTenant[];
}

export interface RegisterInput {
  fullName: string;
  companyName: string;
  email: string;
  password: string;
}

// Who is signed in, or null. A 401 (after the client's one refresh) means nobody.
export async function fetchSession(): Promise<PortalSession | null> {
  try {
    return await api<PortalSession>('/auth/me');
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}

// Sign-up creates the company, its owner and the trial, and signs the owner in (cookies).
// /me then supplies the products, which sign-up's own answer doesn't include.
export async function register(input: RegisterInput): Promise<PortalSession> {
  await api('/auth/register', { method: 'POST', body: input });
  return requireSession();
}

export async function login(email: string, password: string): Promise<PortalSession> {
  await api('/auth/login', { method: 'POST', body: { email, password } });
  return requireSession();
}

// Always answers the same, whether the email has an account or not (platform-api never
// says which), so the page shows one neutral message either way.
export async function requestPasswordReset(email: string): Promise<void> {
  await api('/auth/forgot-password', { method: 'POST', body: { email } });
}

// Ends this session on the server and clears the cookies. Signing out on the portal also
// signs out of Check Printing and Clock-In: they share these cookies.
export async function logout(): Promise<void> {
  await api('/auth/logout', { method: 'POST' });
}

async function requireSession(): Promise<PortalSession> {
  const session = await fetchSession();
  if (!session) throw new ApiError(401, 'SESSION_MISSING', 'You were signed in, but the session was not kept. Please sign in again.');
  return session;
}
