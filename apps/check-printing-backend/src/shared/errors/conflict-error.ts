import { AppError } from "@smartbusiness/auth";

export class ConflictError extends AppError {
  constructor(message: string = "Resource already exists") {
    super(message, 409, "CONFLICT");
  }
}
