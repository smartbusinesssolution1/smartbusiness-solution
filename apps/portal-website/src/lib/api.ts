// The one place the app talks HTTP.
//
// Both APIs answer { success, data, meta? } or { success: false, error: { code, message,
// details? } }. Login lives in httpOnly cookies the browser sends by itself; the app only
// adds X-Tenant-Id (which company the request is for). The access cookie lasts 15 minutes,
// so a 401 triggers one refresh and one retry; if the refresh fails the session is over.

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

export interface ApiResult<T, M = Record<string, unknown>> {
  data: T;
  meta?: M;
}

const TENANT_KEY = "sb.tenantId";

export const tenantStore = {
  get(): string | null {
    try {
      return localStorage.getItem(TENANT_KEY);
    } catch {
      return null;
    }
  },
  set(id: string | null) {
    try {
      if (id) localStorage.setItem(TENANT_KEY, id);
      else localStorage.removeItem(TENANT_KEY);
    } catch {
      // Storage blocked (private mode): the tenant is re-chosen after the next sign-in.
    }
  },
};

type Listener = () => void;
const sessionEndedListeners = new Set<Listener>();
export function onSessionEnded(listener: Listener): () => void {
  sessionEndedListeners.add(listener);
  return () => sessionEndedListeners.delete(listener);
}

// Check Printing refuses the session of someone who turned two-factor on until it enters a
// code: the app listens and shows the code screen, whichever request hit it first.
const twoFactorListeners = new Set<() => void>();
export function onTwoFactorNeeded(listener: () => void): () => void {
  twoFactorListeners.add(listener);
  return () => twoFactorListeners.delete(listener);
}

let refreshing: Promise<boolean> | null = null;

// One refresh at a time: ten requests failing together must not start ten refreshes
// (the refresh token rotates, so all but the first would fail).
function refreshSession(): Promise<boolean> {
  refreshing ??= fetch("/api/v1/auth/refresh", { method: "POST", credentials: "same-origin" })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      setTimeout(() => (refreshing = null), 0);
    });
  return refreshing;
}

const NO_REFRESH = ["/auth/login", "/auth/register", "/auth/refresh", "/auth/forgot-password", "/auth/reset-password", "/auth/invitations", "/auth/logout"];

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = `/api/v1${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

async function send(path: string, options: RequestOptions, accept: "json" | "blob"): Promise<Response> {
  const headers: Record<string, string> = { Accept: accept === "json" ? "application/json" : "*/*", ...options.headers };
  const tenantId = tenantStore.get();
  if (tenantId && !path.startsWith("/auth/")) headers["X-Tenant-Id"] = tenantId;

  let body: BodyInit | undefined;
  if (options.body instanceof FormData) {
    body = options.body;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  const run = () =>
    fetch(buildUrl(path, options.query), {
      method: options.method ?? "GET",
      headers,
      body,
      credentials: "same-origin",
      signal: options.signal,
    });

  let response: Response;
  try {
    response = await run();
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError(0, "NETWORK_ERROR", "Can't reach the server. Check your connection and try again.");
  }

  if (response.status === 401 && !NO_REFRESH.some((p) => path.startsWith(p))) {
    if (await refreshSession()) {
      response = await run();
    }
    if (response.status === 401) {
      sessionEndedListeners.forEach((l) => l());
    }
  }
  if (response.status === 403) {
    // Read a copy: the caller still gets the response (and its error) as usual.
    const code = await response
      .clone()
      .json()
      .then((j: { error?: { code?: string } }) => j?.error?.code)
      .catch(() => undefined);
    if (code === "MFA_REQUIRED") twoFactorListeners.forEach((l) => l());
  }
  return response;
}

async function toError(response: Response): Promise<ApiError> {
  try {
    const json = await response.json();
    const e = json?.error;
    if (e?.message) return new ApiError(response.status, e.code ?? "ERROR", e.message, e.details);
  } catch {
    // Not JSON (a proxy error page, an empty 502): fall through to a plain message.
  }
  if (response.status === 429) return new ApiError(429, "RATE_LIMITED", "Too many requests. Wait a moment and try again.");
  if (response.status >= 500) return new ApiError(response.status, "SERVER_ERROR", "Something went wrong on our side. Try again in a moment.");
  return new ApiError(response.status, "ERROR", `Request failed (${response.status}).`);
}

export async function api<T, M = Record<string, unknown>>(path: string, options: RequestOptions = {}): Promise<ApiResult<T, M>> {
  const response = await send(path, options, "json");
  if (!response.ok) throw await toError(response);
  if (response.status === 204) return { data: undefined as T };
  const json = await response.json();
  return { data: json.data as T, meta: json.meta as M | undefined };
}

// For PDFs and images: the file itself, or the API's JSON error.
export async function apiBlob(path: string, options: RequestOptions = {}): Promise<Blob> {
  const response = await send(path, options, "blob");
  if (!response.ok) throw await toError(response);
  return response.blob();
}

// For exports: the file and the name the server gave it (Content-Disposition).
export async function apiFile(path: string, options: RequestOptions = {}): Promise<{ blob: Blob; fileName: string }> {
  const response = await send(path, options, "blob");
  if (!response.ok) throw await toError(response);
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const fileName = /filename="([^"]+)"/.exec(disposition)?.[1] ?? "export";
  return { blob: await response.blob(), fileName };
}

// Hands a downloaded file to the browser's "save" flow.
export function saveFile(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoked after the click has been handled, or some browsers cancel the download.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}
