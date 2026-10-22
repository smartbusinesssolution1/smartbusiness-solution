import { AppError } from "@smartbusiness/auth";

// Both extend AppError: the error handler only trusts AppError subclasses as
// "expected" errors with a safe message. A plain Error with the same fields is
// treated as a crash and answered with a generic 500.

export class ValidationError extends AppError {
  public readonly details: Record<string, string[]>;

  constructor(message = "Validation failed", details: Record<string, string[]> = {}) {
    super(message, 400, "VALIDATION_ERROR");
    this.details = details;
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource already exists") {
    super(message, 409, "CONFLICT");
  }
}

// A sign-in refused because the account is locked after too many wrong passwords. The
// message says for how long; the response also carries Retry-After.
export class AccountLockedError extends AppError {
  constructor(public readonly lockedUntil: Date) {
    const minutes = Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / 60_000));
    super(
      `Too many wrong passwords. This account is locked for ${minutes} minute${minutes === 1 ? "" : "s"}. You can reset your password to unlock it now.`,
      429,
      "ACCOUNT_LOCKED",
    );
  }

  get retryAfterSeconds(): number {
    return Math.max(1, Math.ceil((this.lockedUntil.getTime() - Date.now()) / 1000));
  }
}

export { AppError, AuthError } from "@smartbusiness/auth";
