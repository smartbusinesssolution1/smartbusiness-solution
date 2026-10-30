// The one place the portal talks HTTP. It only ever calls platform-api's /auth endpoints.
//
// Requests go to /api/v1 on the portal's own origin: the Vite dev server (vite.config.ts)
// or nginx in production forwards /api/v1/auth to platform-api. The browser therefore sees
// one origin, so the httpOnly login cookies platform-api sets are stored for the portal's
// host and sent back automatically, and no CORS is involved.
//
// platform-api answers { success, data } or { success: false, error: { code, message,
// details? } }. The access cookie lasts 15 minutes, so a 401 triggers one refresh and one
// retry; if the refresh fails the session is over.

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, string[]>;

  constructor(status: number, code: string, message: string, details?: Record<string, string[]>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  // The first message for a field, for showing under that input.
  field(name: string): string | undefined {
    return this.details?.[name]?.[0];
  }
}

// Calls where a 401 means "wrong credentials" or "no session", never "refresh and retry".
const NO_REFRESH = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/forgot-password', '/auth/logout'];

let refreshing: Promise<boolean> | null = null;

// One refresh at a time: requests failing together must not start several refreshes (the
// refresh token rotates, so all but the first would fail and end the session).
function refreshSession(): Promise<boolean> {
  refreshing ??= fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'same-origin' })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      setTimeout(() => (refreshing = null), 0);
    });
  return refreshing;
}

export interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  let body: string | undefined;
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  const run = () =>
    fetch(`/api/v1${path}`, { method: options.method ?? 'GET', headers, body, credentials: 'same-origin' });

  let response: Response;
  try {
    response = await run();
    if (response.status === 401 && !NO_REFRESH.some((p) => path.startsWith(p)) && (await refreshSession())) {
      response = await run();
    }
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', "Can't reach the server. Check your connection and try again.");
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    const error = payload?.error;
    throw new ApiError(
      response.status,
      error?.code ?? 'UNKNOWN_ERROR',
      error?.message ?? 'Something went wrong. Please try again.',
      error?.details,
    );
  }
  return payload.data as T;
}
