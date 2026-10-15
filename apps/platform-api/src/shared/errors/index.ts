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

export { AppError, AuthError } from "@smartbusiness/auth";
