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

// Refused because of too many wrong attempts. The message says for how long; the
// response also carries Retry-After (see the error handler).
export abstract class LockedOutError extends AppError {
  constructor(public readonly lockedUntil: Date, message: (minutes: string) => string, code: string) {
    const n = Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / 60_000));
    super(message(`${n} minute${n === 1 ? "" : "s"}`), 429, code);
  }

  get retryAfterSeconds(): number {
    return Math.max(1, Math.ceil((this.lockedUntil.getTime() - Date.now()) / 1000));
  }
}

// Too many wrong passwords.
export class AccountLockedError extends LockedOutError {
  constructor(lockedUntil: Date) {
    super(
      lockedUntil,
      (m) => `Too many wrong passwords. This account is locked for ${m}. You can reset your password to unlock it now.`,
      "ACCOUNT_LOCKED",
    );
  }
}

// Too many wrong two-factor codes.
export class MfaLockedError extends LockedOutError {
  constructor(lockedUntil: Date) {
    super(
      lockedUntil,
      (m) => `Too many wrong codes. Try again in ${m}, or ask your company owner to reset your two-factor sign-in.`,
      "MFA_LOCKED",
    );
  }
}

export { AppError, AuthError } from "@smartbusiness/auth";
