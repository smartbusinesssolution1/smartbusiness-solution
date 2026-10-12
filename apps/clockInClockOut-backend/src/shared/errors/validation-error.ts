import { AppError } from "@smartbusiness/auth";

export class ValidationError extends AppError {
  public readonly details: Record<string, string[]>;

  constructor(
    message: string = "validation failed",
    details: Record<string, string[]> = {},
  ) {
    super(message, 400, "VALIDATION_ERROR");
    this.details = details;
  }
}
