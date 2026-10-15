export interface ApiErrorResponse {
  success?: boolean;
  error?: {
    code?: string;
    message?: string;
  };
  message?: string;
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(endpoint, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const errorMsg =
      data?.error?.message ||
      data?.message ||
      (typeof data?.error === "string" ? data.error : `Request failed with status ${res.status}`);
    throw new Error(errorMsg);
  }

  return (data?.data !== undefined ? data.data : data) as T;
}
