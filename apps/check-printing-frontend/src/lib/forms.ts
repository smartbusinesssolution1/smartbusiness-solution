import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { ApiError } from "./api";

// Puts the server's field errors under the matching inputs. Returns the message for the
// form as a whole when the error isn't about one of these fields.
export function applyServerErrors<T extends FieldValues>(err: unknown, setError: UseFormSetError<T>, fields: Array<Path<T>>): string | null {
  if (!(err instanceof ApiError)) return err instanceof Error ? err.message : "Something went wrong.";
  let placed = false;
  for (const field of fields) {
    const message = err.field(field);
    if (message) {
      setError(field, { type: "server", message });
      placed = true;
    }
  }
  return placed ? null : err.message;
}

export const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME",
  "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI",
  "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
];

export function newIdempotencyKey(): string {
  // crypto.randomUUID() is only available in secure contexts (HTTPS).
  // Fall back to a manual UUID v4 generator for HTTP / older environments.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Polyfill: UUID v4 using crypto.getRandomValues when available, otherwise Math.random
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r =
      typeof crypto !== "undefined" && crypto.getRandomValues
        ? (crypto.getRandomValues(new Uint8Array(1))[0] & 15) >> (c === "x" ? 0 : 1)
        : Math.floor(Math.random() * 16);
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
